'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { compressForUpload } from '@/lib/photos/compress';

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

  function openPicker() {
    inputRef.current?.click();
  }

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
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

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={handleFiles}
        data-testid="photo-uploader-input"
      />
      <Button
        type="button"
        onClick={openPicker}
        disabled={pending}
        data-testid="photo-uploader-button"
      >
        {pending && progress
          ? t('uploading', { current: progress.current, total: progress.total })
          : t('upload')}
      </Button>
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
