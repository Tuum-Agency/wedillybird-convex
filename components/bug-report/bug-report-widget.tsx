'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bug, Camera, Loader2, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { submitBugReportAction } from '@/app/[locale]/(app)/bug-report/actions';

/* ------------------------------------------------------------------ */
/*  Collecteur d'erreurs console (ring buffer global, installé 1 fois) */
/* ------------------------------------------------------------------ */

const ERR_BUFFER: string[] = [];
const MAX_ERR = 20;

function pushErr(msg: string) {
  ERR_BUFFER.push(msg.slice(0, 500));
  if (ERR_BUFFER.length > MAX_ERR) ERR_BUFFER.shift();
}

let installed = false;
function installErrorCollector() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    pushErr(`[error] ${e.message}${e.filename ? ` @ ${e.filename}:${e.lineno}` : ''}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    pushErr(`[promise] ${r instanceof Error ? r.message : String(r)}`);
  });
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    pushErr(
      `[console] ${args
        .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : ''))
        .filter(Boolean)
        .join(' ')
        .slice(0, 500)}`,
    );
    orig(...args);
  };
}

/* ------------------------------------------------------------------ */
/*  Compression image → data URL JPEG sous une taille cible           */
/* ------------------------------------------------------------------ */

async function toCompressedDataUrl(
  source: HTMLVideoElement | HTMLImageElement,
  targetBytes = 500 * 1024,
): Promise<string | null> {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!sw || !sh) return null;
  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  // Descend la qualité jusqu'à tenir sous la cible (approx : 4/3 du base64).
  for (const q of [0.72, 0.6, 0.48, 0.36, 0.28]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length * 0.75 <= targetBytes) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.28);
}

async function captureScreen(): Promise<string | null> {
  const md = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia?: (c?: DisplayMediaStreamOptions) => Promise<MediaStream>;
  };
  if (!md?.getDisplayMedia) throw new Error('UNSUPPORTED');
  const stream = await md.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Laisse une frame se composer avant la capture.
    await new Promise((r) => setTimeout(r, 220));
    return await toCompressedDataUrl(video);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

function fileToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = async () => {
      const url = await toCompressedDataUrl(img);
      URL.revokeObjectURL(objUrl);
      resolve(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve(null);
    };
    img.src = objUrl;
  });
}

/* ------------------------------------------------------------------ */
/*  Widget                                                            */
/* ------------------------------------------------------------------ */

export function BugReportWidget() {
  const t = useTranslations('BugReport');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    installErrorCollector();
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSent(false);
      setCaptureError(false);
      setErrorCount(ERR_BUFFER.length);
    }
  }

  async function onCapture() {
    setCapturing(true);
    setCaptureError(false);
    try {
      const url = await captureScreen();
      if (url) setShot(url);
      else setCaptureError(true);
    } catch {
      setCaptureError(true);
    } finally {
      setCapturing(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCapturing(true);
    setCaptureError(false);
    const url = await fileToDataUrl(file);
    if (url) setShot(url);
    else setCaptureError(true);
    setCapturing(false);
  }

  async function onSubmit() {
    if (description.trim().length < 3 || submitting) return;
    setSubmitting(true);
    const res = await submitBugReportAction({
      url: typeof window !== 'undefined' ? window.location.href : '',
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      description: description.trim(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      viewport:
        typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : undefined,
      locale,
      screenshot: shot ?? undefined,
      consoleErrors: ERR_BUFFER.slice(),
    });
    setSubmitting(false);
    if (res.ok) {
      setSent(true);
      setDescription('');
      setShot(null);
      setTimeout(() => setOpen(false), 1400);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="focus-ring fixed right-4 bottom-4 z-40 flex h-11 items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 text-sm font-medium text-[color:var(--color-ink-700)] shadow-[var(--shadow-lifted)] transition-colors hover:border-[color:var(--color-blush-300)] hover:text-[color:var(--color-ink-900)]"
        aria-label={t('open')}
      >
        <Bug className="h-4 w-4" strokeWidth={1.8} />
        <span className="hidden sm:inline">{t('cta')}</span>
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-sage-50)] text-[color:var(--color-sage-700)]">
                <Check className="h-6 w-6" strokeWidth={2.2} />
              </span>
              <p className="text-sm text-[color:var(--color-ink-700)]">{t('thanks')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[color:var(--color-ink-900)]">
                  {t('descLabel')}
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder={t('descPlaceholder')}
                  className="focus-ring min-h-[92px] resize-y rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm text-[color:var(--color-ink-900)] placeholder:text-[color:var(--color-ink-500)]"
                />
              </label>

              {/* Capture */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[color:var(--color-ink-900)]">
                  {t('captureLabel')}
                </span>
                {shot ? (
                  <div className="relative overflow-hidden rounded-xl border border-[color:var(--color-border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local data URL */}
                    <img src={shot} alt="" className="max-h-48 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setShot(null)}
                      className="focus-ring absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-ink-900)]/70 text-white"
                      aria-label={t('removeShot')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onCapture}
                      disabled={capturing}
                    >
                      {capturing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {t('captureBtn')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={capturing}
                    >
                      {t('uploadBtn')}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => void onFile(e)}
                    />
                  </div>
                )}
                {captureError && (
                  <p className="text-xs text-[color:var(--color-ink-500)]">{t('captureError')}</p>
                )}
              </div>

              {/* Contexte auto-rempli */}
              <div className="rounded-xl bg-[color:var(--color-surface-warm)] px-3 py-2.5 text-xs text-[color:var(--color-ink-500)]">
                <p className="truncate">
                  <span className="font-medium text-[color:var(--color-ink-700)]">
                    {t('contextPage')} :
                  </span>{' '}
                  {typeof window !== 'undefined' ? window.location.pathname : ''}
                </p>
                {errorCount > 0 && (
                  <p className="mt-1">{t('contextErrors', { count: errorCount })}</p>
                )}
              </div>
            </div>
          )}

          {!sent && (
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                {t('cancel')}
              </Button>
              <Button onClick={onSubmit} disabled={submitting || description.trim().length < 3}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('submit')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
