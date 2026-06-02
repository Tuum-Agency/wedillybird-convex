'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud } from 'lucide-react';
import { ALLOWED_CONTENT_TYPES, compressForUpload } from '@/lib/photos/compress';

interface BaseProps {
  onUploaded?: () => void;
}

interface OwnerProps extends BaseProps {
  mode: 'owner';
  eventId: string;
  getUploadUrl: (
    eventId: string,
    contentType: string,
  ) => Promise<{ ok: true; uploadUrl: string; s3Key: string } | { ok: false; error: string }>;
  confirm: (input: {
    eventId: string;
    s3Key: string;
    sizeBytes: number;
    contentType: string;
    width?: number;
    height?: number;
  }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
}

interface GuestProps extends BaseProps {
  mode: 'guest';
  token: string;
  uploaderName?: string;
  getUploadUrl: (
    token: string,
    contentType: string,
  ) => Promise<{ ok: true; uploadUrl: string; s3Key: string } | { ok: false; error: string }>;
  confirm: (input: {
    token: string;
    s3Key: string;
    sizeBytes: number;
    contentType: string;
    width?: number;
    height?: number;
    uploaderName?: string;
  }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
}

export type PhotoUploaderProps = OwnerProps | GuestProps;

export function PhotoUploader(props: PhotoUploaderProps) {
  const t = useTranslations('Gallery');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function openPicker() {
    if (pending) return;
    inputRef.current?.click();
  }

  function processFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setProgress({ current: 0, total: files.length });

    startTransition(async () => {
      let ok = 0;
      for (const [index, file] of files.entries()) {
        try {
          await uploadOne(props, file);
          ok += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'UPLOAD_FAILED';
          setError(t(`errors.${errorKey(message)}` as const));
        } finally {
          setProgress({ current: index + 1, total: files.length });
        }
      }
      setProgress(null);
      if (ok > 0 && inputRef.current) inputRef.current.value = '';
      if (ok > 0) props.onUploaded?.();
    });
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    processFiles(Array.from(event.target.files ?? []));
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (pending) return;
    setIsDragOver(true);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (pending) return;
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (pending) return;
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length === 0) return;
    const allowed = ALLOWED_CONTENT_TYPES as readonly string[];
    const accepted = dropped.filter((file) => allowed.includes(file.type));
    if (accepted.length === 0) {
      setError(t('errors.type'));
      return;
    }
    processFiles(accepted);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={handleInputChange}
        data-testid="photo-uploader-input"
      />
      <div
        role="button"
        tabIndex={pending ? -1 : 0}
        aria-disabled={pending}
        aria-label={t('dropzoneTitle')}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="photo-uploader-dropzone"
        data-drag-over={isDragOver ? 'true' : 'false'}
        className={`focus-ring flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          pending
            ? 'cursor-not-allowed border-[color:var(--color-border)] bg-[color:var(--color-surface)] opacity-70'
            : isDragOver
              ? 'cursor-copy border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10'
              : 'cursor-pointer border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-ivory-100)]'
        }`}
      >
        <UploadCloud
          className="h-7 w-7 text-[color:var(--color-ink-500)]"
          aria-hidden
          strokeWidth={1.75}
        />
        <p className="text-sm font-medium text-[color:var(--color-ink-700)]">
          {pending && progress
            ? t('uploading', { current: progress.current, total: progress.total })
            : t('dropzoneTitle')}
        </p>
        {!pending ? (
          <p className="text-xs text-[color:var(--color-muted)]">{t('dropzoneHint')}</p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

async function uploadOne(props: PhotoUploaderProps, file: File): Promise<void> {
  const { file: compressed, width, height, contentType } = await compressForUpload(file);

  const urlResult =
    props.mode === 'owner'
      ? await props.getUploadUrl(props.eventId, contentType)
      : await props.getUploadUrl(props.token, contentType);
  if (!urlResult.ok) throw new Error(urlResult.error);

  const uploadResponse = await fetch(urlResult.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: compressed,
  });
  if (!uploadResponse.ok) throw new Error('UPLOAD_FAILED');

  const confirmResult =
    props.mode === 'owner'
      ? await props.confirm({
          eventId: props.eventId,
          s3Key: urlResult.s3Key,
          sizeBytes: compressed.size,
          contentType,
          width,
          height,
        })
      : await props.confirm({
          token: props.token,
          s3Key: urlResult.s3Key,
          sizeBytes: compressed.size,
          contentType,
          width,
          height,
          uploaderName: props.uploaderName,
        });

  if (!confirmResult.ok) throw new Error(confirmResult.error);
}

function errorKey(message: string): 'size' | 'type' | 'network' | 'generic' {
  if (message === 'INVALID_SIZE') return 'size';
  if (message === 'INVALID_CONTENT_TYPE' || message === 'INVALID_TYPE') return 'type';
  if (message === 'UPLOAD_FAILED') return 'network';
  return 'generic';
}
