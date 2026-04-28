/**
 * Streaming ZIP encoder (store-only, no compression).
 *
 * Produces a ZIP archive on the fly without buffering the whole file in
 * memory. Each entry is hashed (CRC32) as it is consumed, so the input
 * stream is read exactly once. JPEG/PNG/WebP are already compressed —
 * adding DEFLATE on top would waste CPU for no real size reduction.
 *
 * The implementation follows the ZIP file format specification:
 *   https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 *
 * We only emit Local File Headers + raw data + Data Descriptors, then a
 * Central Directory at the end. ZIP64 fields are emitted when an entry
 * exceeds 4 GiB or when the archive total exceeds 4 GiB / 65 535 entries.
 */

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const DATA_DESCRIPTOR_SIG = 0x08074b50;
const CENTRAL_DIRECTORY_SIG = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIG = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_SIG = 0x06064b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIG = 0x07064b50;

const VERSION_NEEDED_TO_EXTRACT = 45; // ZIP64
const GENERAL_PURPOSE_BIT_FLAG = 0x0808; // bit 3 = data descriptor; bit 11 = UTF-8 names
const COMPRESSION_METHOD_STORE = 0;

// Pre-computed CRC32 table.
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function updateCrc32(crc: number, bytes: Uint8Array): number {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface CentralDirectoryEntry {
  nameBytes: Uint8Array;
  crc32: number;
  size: bigint;
  offset: bigint;
  needsZip64: boolean;
}

export interface ZipStreamEntry {
  /** Path inside the archive. UTF-8 supported. Forward slashes for folders. */
  name: string;
  /** Web ReadableStream for the file body. */
  body: ReadableStream<Uint8Array>;
}

/**
 * Build a ReadableStream that emits a ZIP archive containing every entry
 * yielded by the async iterable. Failures on a single entry abort the
 * archive — callers are expected to filter unreachable items beforehand.
 */
export function createZipStream(
  entries: AsyncIterable<ZipStreamEntry>,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const directory: CentralDirectoryEntry[] = [];
        let offset = BigInt(0);

        for await (const entry of entries) {
          const nameBytes = new TextEncoder().encode(entry.name);
          const localHeader = buildLocalFileHeader(nameBytes);
          controller.enqueue(localHeader);
          const localOffset = offset;
          offset += BigInt(localHeader.byteLength);

          let crc = 0;
          let size = BigInt(0);

          const reader = entry.body.getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value || value.byteLength === 0) continue;
            crc = updateCrc32(crc, value);
            size += BigInt(value.byteLength);
            controller.enqueue(value);
            offset += BigInt(value.byteLength);
          }

          const needsZip64 = size >= BigInt(0xffffffff);
          const descriptor = buildDataDescriptor(crc, size, needsZip64);
          controller.enqueue(descriptor);
          offset += BigInt(descriptor.byteLength);

          directory.push({
            nameBytes,
            crc32: crc,
            size,
            offset: localOffset,
            needsZip64: needsZip64 || localOffset >= BigInt(0xffffffff),
          });
        }

        const centralDirectoryStart = offset;
        let centralDirectorySize = BigInt(0);
        for (const entry of directory) {
          const cdh = buildCentralDirectoryHeader(entry);
          controller.enqueue(cdh);
          centralDirectorySize += BigInt(cdh.byteLength);
        }
        offset += centralDirectorySize;

        const totalEntries = directory.length;
        const archiveNeedsZip64 =
          totalEntries >= 0xffff ||
          centralDirectoryStart >= BigInt(0xffffffff) ||
          centralDirectorySize >= BigInt(0xffffffff);

        if (archiveNeedsZip64) {
          const zip64End = buildZip64EndOfCentralDirectory(
            BigInt(totalEntries),
            centralDirectorySize,
            centralDirectoryStart,
          );
          controller.enqueue(zip64End);
          const zip64Locator = buildZip64Locator(offset);
          controller.enqueue(zip64Locator);
          offset += BigInt(zip64End.byteLength + zip64Locator.byteLength);
        }

        controller.enqueue(
          buildEndOfCentralDirectory(
            totalEntries,
            centralDirectorySize,
            centralDirectoryStart,
            archiveNeedsZip64,
          ),
        );

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

function buildLocalFileHeader(nameBytes: Uint8Array): Uint8Array {
  // 30 bytes fixed + name length. Sizes/CRC are 0 because we use a Data
  // Descriptor — bit 3 of the general purpose flag is set, so the central
  // directory will hold the canonical values.
  const buf = new ArrayBuffer(30 + nameBytes.byteLength);
  const view = new DataView(buf);
  view.setUint32(0, LOCAL_FILE_HEADER_SIG, true);
  view.setUint16(4, VERSION_NEEDED_TO_EXTRACT, true);
  view.setUint16(6, GENERAL_PURPOSE_BIT_FLAG, true);
  view.setUint16(8, COMPRESSION_METHOD_STORE, true);
  view.setUint16(10, 0, true); // mod time
  view.setUint16(12, 0, true); // mod date
  view.setUint32(14, 0, true); // crc32 (in descriptor)
  view.setUint32(18, 0, true); // compressed size (in descriptor)
  view.setUint32(22, 0, true); // uncompressed size (in descriptor)
  view.setUint16(26, nameBytes.byteLength, true);
  view.setUint16(28, 0, true); // extra field length
  new Uint8Array(buf, 30).set(nameBytes);
  return new Uint8Array(buf);
}

function buildDataDescriptor(crc32: number, size: bigint, useZip64: boolean): Uint8Array {
  if (useZip64) {
    const buf = new ArrayBuffer(24);
    const view = new DataView(buf);
    view.setUint32(0, DATA_DESCRIPTOR_SIG, true);
    view.setUint32(4, crc32, true);
    view.setBigUint64(8, size, true);
    view.setBigUint64(16, size, true);
    return new Uint8Array(buf);
  }
  const buf = new ArrayBuffer(16);
  const view = new DataView(buf);
  view.setUint32(0, DATA_DESCRIPTOR_SIG, true);
  view.setUint32(4, crc32, true);
  view.setUint32(8, Number(size), true);
  view.setUint32(12, Number(size), true);
  return new Uint8Array(buf);
}

function buildCentralDirectoryHeader(entry: CentralDirectoryEntry): Uint8Array {
  const useZip64 = entry.needsZip64;
  const extraFieldLength = useZip64 ? 28 : 0;
  const buf = new ArrayBuffer(46 + entry.nameBytes.byteLength + extraFieldLength);
  const view = new DataView(buf);
  view.setUint32(0, CENTRAL_DIRECTORY_SIG, true);
  view.setUint16(4, VERSION_NEEDED_TO_EXTRACT, true); // version made by
  view.setUint16(6, VERSION_NEEDED_TO_EXTRACT, true); // version needed
  view.setUint16(8, GENERAL_PURPOSE_BIT_FLAG, true);
  view.setUint16(10, COMPRESSION_METHOD_STORE, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, entry.crc32, true);
  if (useZip64) {
    view.setUint32(20, 0xffffffff, true);
    view.setUint32(24, 0xffffffff, true);
  } else {
    view.setUint32(20, Number(entry.size), true);
    view.setUint32(24, Number(entry.size), true);
  }
  view.setUint16(28, entry.nameBytes.byteLength, true);
  view.setUint16(30, extraFieldLength, true);
  view.setUint16(32, 0, true); // comment length
  view.setUint16(34, 0, true); // disk number start
  view.setUint16(36, 0, true); // internal attrs
  view.setUint32(38, 0, true); // external attrs
  view.setUint32(42, useZip64 ? 0xffffffff : Number(entry.offset), true);
  new Uint8Array(buf, 46).set(entry.nameBytes);

  if (useZip64) {
    const extraView = new DataView(buf, 46 + entry.nameBytes.byteLength);
    extraView.setUint16(0, 0x0001, true); // ZIP64 tag
    extraView.setUint16(2, 24, true); // size of following data
    extraView.setBigUint64(4, entry.size, true); // uncompressed
    extraView.setBigUint64(12, entry.size, true); // compressed
    extraView.setBigUint64(20, entry.offset, true); // local header offset
  }

  return new Uint8Array(buf);
}

function buildZip64EndOfCentralDirectory(
  totalEntries: bigint,
  size: bigint,
  offset: bigint,
): Uint8Array {
  const buf = new ArrayBuffer(56);
  const view = new DataView(buf);
  view.setUint32(0, ZIP64_END_OF_CENTRAL_DIRECTORY_SIG, true);
  view.setBigUint64(4, BigInt(44), true); // size of zip64 EOCD record - 12
  view.setUint16(12, VERSION_NEEDED_TO_EXTRACT, true);
  view.setUint16(14, VERSION_NEEDED_TO_EXTRACT, true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  view.setBigUint64(24, totalEntries, true);
  view.setBigUint64(32, totalEntries, true);
  view.setBigUint64(40, size, true);
  view.setBigUint64(48, offset, true);
  return new Uint8Array(buf);
}

function buildZip64Locator(zip64EocdOffset: bigint): Uint8Array {
  const buf = new ArrayBuffer(20);
  const view = new DataView(buf);
  view.setUint32(0, ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIG, true);
  view.setUint32(4, 0, true);
  view.setBigUint64(8, zip64EocdOffset, true);
  view.setUint32(16, 1, true);
  return new Uint8Array(buf);
}

function buildEndOfCentralDirectory(
  totalEntries: number,
  size: bigint,
  offset: bigint,
  archiveNeedsZip64: boolean,
): Uint8Array {
  const buf = new ArrayBuffer(22);
  const view = new DataView(buf);
  view.setUint32(0, END_OF_CENTRAL_DIRECTORY_SIG, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  const entriesField = archiveNeedsZip64 ? 0xffff : Math.min(totalEntries, 0xffff);
  view.setUint16(8, entriesField, true);
  view.setUint16(10, entriesField, true);
  view.setUint32(12, archiveNeedsZip64 ? 0xffffffff : Number(size), true);
  view.setUint32(16, archiveNeedsZip64 ? 0xffffffff : Number(offset), true);
  view.setUint16(20, 0, true);
  return new Uint8Array(buf);
}

/** Sanitises an arbitrary string into a safe ZIP entry name. */
export function safeZipEntryName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[/\\]/g, '_')
    .replace(/[\x00-\x1f]/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}
