'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SearchResult =
  | { ok: true; photoIds: string[]; matchCount: number }
  | { ok: false; error: string };

export interface FaceSearchModalProps {
  open: boolean;
  onClose: () => void;
  /** Appelé avec la liste des photoIds matchés une fois la recherche réussie. */
  onResult: (matchedPhotoIds: string[]) => void;
  /** Server action injectée — diffère pour owner vs guest. */
  search: (selfieDataUrl: string) => Promise<SearchResult>;
}

type Stage = 'consent' | 'capture' | 'searching' | 'result_ok' | 'result_error';

/** Dimension max d'envoi (côté le plus long) — économise la bande passante. */
const MAX_DIMENSION = 1024;
/** Qualité JPEG après redimensionnement. */
const JPEG_QUALITY = 0.85;

/**
 * Modal accessible (focus trap, ESC, role=dialog) qui pilote le flow
 * RGPD → capture (upload OU caméra live) → recherche → résultat.
 *
 * Le selfie capturé n'est jamais persisté côté client : il vit dans la mémoire
 * du composant le temps de l'appel server action et est garbage-collecté
 * dès la fermeture (pas de localStorage / sessionStorage).
 */
export function FaceSearchModal(props: FaceSearchModalProps) {
  if (!props.open) return null;
  // Forcer un remount complet à chaque ouverture pour reset proprement
  // tous les sous-états (stage, consent, caméra, résultats), sans déclencher
  // de cascade de setState dans un useEffect.
  return <FaceSearchModalInner {...props} />;
}

function FaceSearchModalInner({ onClose, onResult, search }: FaceSearchModalProps) {
  const t = useTranslations('Gallery.faceSearch');
  const titleId = useId();
  const consentId = useId();

  const [stage, setStage] = useState<Stage>('consent');
  const [consentChecked, setConsentChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [matchCount, setMatchCount] = useState<number>(0);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const supportsCamera =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }, []);

  // Cleanup à l'unmount (fermeture parent).
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Gestion ESC.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Focus initial sur le dialog.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function handleConsentSubmit() {
    if (!consentChecked) return;
    setStage('capture');
  }

  async function runSearch(dataUrl: string) {
    setStage('searching');
    try {
      const result = await search(dataUrl);
      if (result.ok) {
        setMatchCount(result.matchCount);
        setMatchedIds(result.photoIds);
        setStage('result_ok');
      } else {
        setErrorMessage(result.error);
        setStage('result_error');
      }
    } catch {
      setErrorMessage('UNKNOWN');
      setStage('result_error');
    }
  }

  async function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // Reset value pour permettre de re-sélectionner le même fichier après retry.
    event.target.value = '';
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      await runSearch(dataUrl);
    } catch {
      setErrorMessage('UNKNOWN');
      setStage('result_error');
    }
  }

  async function handleOpenCamera() {
    setCameraError('');
    if (!supportsCamera) {
      setCameraError(t('cameraUnavailable'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Le video element sera monté au prochain render — branche la srcObject ensuite.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError(t('cameraUnavailable'));
    }
  }

  async function handleSnapshot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) return;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(videoWidth, videoHeight));
    const targetWidth = Math.round(videoWidth * scale);
    const targetHeight = Math.round(videoHeight * scale);
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

    stopCamera();
    await runSearch(dataUrl);
  }

  function handleViewMatches() {
    onResult(matchedIds);
    onClose();
  }

  function handleRetry() {
    setErrorMessage('');
    setStage('capture');
  }

  function errorLabel(code: string): string {
    if (code === 'NO_FACE_DETECTED') return t('errors.noFace');
    if (code === 'NO_COLLECTION_YET') return t('errors.notIndexed');
    if (code === 'FORBIDDEN') return t('errors.forbidden');
    if (code === 'RATE_LIMITED') return t('errors.rateLimited');
    return t('errors.unknown');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[color:var(--color-night-900)]/55 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-[480px] flex-col gap-5 overflow-y-auto bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-popover)] outline-none sm:my-auto sm:rounded-3xl"
        data-testid="face-search-modal"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close') === 'Gallery.faceSearch.close' ? 'Fermer' : t('close')}
          className="focus-ring absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--color-ink-500)] transition-colors hover:bg-[color:var(--color-ivory-100)]"
          data-testid="face-search-close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>

        <header className="flex flex-col gap-1 pr-9">
          <h2
            id={titleId}
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 1.875rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.018em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
          </h2>
        </header>

        {stage === 'consent' ? (
          <ConsentStep
            consentChecked={consentChecked}
            onConsentChange={setConsentChecked}
            onSubmit={handleConsentSubmit}
            consentId={consentId}
            consentTitle={t('consentTitle')}
            consentBody={t('consentBody')}
            consentAccept={t('consentAccept')}
          />
        ) : null}

        {stage === 'capture' ? (
          <CaptureStep
            cameraOpen={cameraOpen}
            cameraError={cameraError}
            supportsCamera={supportsCamera}
            videoRef={videoRef}
            canvasRef={canvasRef}
            fileInputRef={fileInputRef}
            onFilePick={handleFilePick}
            onOpenCamera={handleOpenCamera}
            onSnapshot={handleSnapshot}
            onCancelCamera={() => {
              stopCamera();
            }}
            captureTitle={t('captureTitle')}
            uploadCta={t('uploadCta')}
            cameraCta={t('cameraCta')}
          />
        ) : null}

        {stage === 'searching' ? (
          <div
            className="flex flex-col items-center gap-3 py-10"
            role="status"
            aria-live="polite"
            data-testid="face-search-loading"
          >
            <Loader2
              className="h-8 w-8 animate-spin text-[color:var(--color-accent)]"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="text-sm text-[color:var(--color-ink-500)]">{t('searching')}</p>
          </div>
        ) : null}

        {stage === 'result_ok' ? (
          <div className="flex flex-col gap-4" data-testid="face-search-result-ok">
            {matchCount > 0 ? (
              <>
                <p className="text-base text-[color:var(--color-ink-900)]">
                  {t('resultFound', { count: matchCount })}
                </p>
                <Button
                  type="button"
                  size="lg"
                  onClick={handleViewMatches}
                  data-testid="face-search-view-matches"
                >
                  {t('viewMatches')}
                </Button>
              </>
            ) : (
              <>
                <p className="text-base text-[color:var(--color-ink-700)]">{t('resultEmpty')}</p>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={handleRetry}
                  data-testid="face-search-retry"
                >
                  {t('retry')}
                </Button>
              </>
            )}
          </div>
        ) : null}

        {stage === 'result_error' ? (
          <div
            className="flex flex-col gap-4"
            role="alert"
            data-testid="face-search-result-error"
          >
            <p className="text-base text-[color:var(--color-danger)]">
              {errorLabel(errorMessage)}
            </p>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={handleRetry}
              data-testid="face-search-retry"
            >
              {t('retry')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface ConsentStepProps {
  consentChecked: boolean;
  onConsentChange: (value: boolean) => void;
  onSubmit: () => void;
  consentId: string;
  consentTitle: string;
  consentBody: string;
  consentAccept: string;
}

function ConsentStep({
  consentChecked,
  onConsentChange,
  onSubmit,
  consentId,
  consentTitle,
  consentBody,
  consentAccept,
}: ConsentStepProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-medium text-[color:var(--color-ink-900)]">{consentTitle}</h3>
        <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">{consentBody}</p>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)] p-3 text-sm text-[color:var(--color-ink-700)]">
        <input
          id={consentId}
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-[color:var(--color-border-strong)] text-[color:var(--color-accent)]"
          data-testid="face-search-consent-checkbox"
        />
        <span>{consentAccept}</span>
      </label>
      <Button
        type="submit"
        size="lg"
        disabled={!consentChecked}
        data-testid="face-search-consent-submit"
      >
        {consentAccept}
      </Button>
    </form>
  );
}

interface CaptureStepProps {
  cameraOpen: boolean;
  cameraError: string;
  supportsCamera: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilePick: (e: ChangeEvent<HTMLInputElement>) => void;
  onOpenCamera: () => void;
  onSnapshot: () => void;
  onCancelCamera: () => void;
  captureTitle: string;
  uploadCta: string;
  cameraCta: string;
}

function CaptureStep({
  cameraOpen,
  cameraError,
  supportsCamera,
  videoRef,
  canvasRef,
  fileInputRef,
  onFilePick,
  onOpenCamera,
  onSnapshot,
  onCancelCamera,
  captureTitle,
  uploadCta,
  cameraCta,
}: CaptureStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[color:var(--color-ink-500)]">{captureTitle}</p>

      {!cameraOpen ? (
        <div className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            onChange={onFilePick}
            data-testid="face-search-file-input"
          />
          <Button
            type="button"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            data-testid="face-search-upload-btn"
          >
            <Upload className="h-4 w-4" aria-hidden strokeWidth={1.75} />
            {uploadCta}
          </Button>
          {supportsCamera ? (
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={onOpenCamera}
              data-testid="face-search-camera-btn"
            >
              <Camera className="h-4 w-4" aria-hidden strokeWidth={1.75} />
              {cameraCta}
            </Button>
          ) : null}
          {cameraError ? (
            <p className="text-xs text-[color:var(--color-danger)]" role="alert">
              {cameraError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-auto w-full"
              data-testid="face-search-video"
            />
          </div>
          <canvas ref={canvasRef} className="hidden" aria-hidden />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="lg"
              onClick={onSnapshot}
              className="flex-1"
              data-testid="face-search-snapshot-btn"
            >
              <Camera className="h-4 w-4" aria-hidden strokeWidth={1.75} />
              {cameraCta}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={onCancelCamera}
              className="flex-1"
            >
              <X className="h-4 w-4" aria-hidden strokeWidth={1.75} />
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lit le fichier, redimensionne via canvas si nécessaire (côté le plus long ≤ 1024 px),
 * et renvoie un dataURL JPEG. Le blob original n'est pas conservé.
 */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { naturalWidth, naturalHeight } = img;
    const longest = Math.max(naturalWidth, naturalHeight);
    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    img.src = src;
  });
}
