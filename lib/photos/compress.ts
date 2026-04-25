import imageCompression from 'browser-image-compression';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export function isAllowedContentType(value: string): value is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

export async function compressForUpload(file: File): Promise<{
  file: Blob;
  width?: number;
  height?: number;
  contentType: AllowedContentType;
}> {
  if (!isAllowedContentType(file.type)) {
    throw new Error('INVALID_CONTENT_TYPE');
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2000,
    useWebWorker: true,
    initialQuality: 0.85,
  });

  const dimensions = await getImageDimensions(compressed).catch(() => undefined);

  return {
    file: compressed,
    width: dimensions?.width,
    height: dimensions?.height,
    contentType: file.type,
  };
}

function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    img.src = url;
  });
}
