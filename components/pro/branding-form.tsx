'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateOrgBrandingAction } from '@/app/[locale]/(app)/pro/actions';

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

export interface BrandingFormProps {
  /** Logo URL résolue côté serveur (ctx.storage.getUrl). Null si aucun. */
  initialLogoUrl: string | null;
  /** Couleur primaire actuelle au format #RRGGBB. */
  initialPrimaryColor: string;
  /** Couleur d'accent actuelle au format #RRGGBB. */
  initialAccentColor: string;
}

/**
 * Form de branding : logo + couleurs.
 *
 * Comportement :
 *  - Sélection logo → preview live via `URL.createObjectURL`. On révoque
 *    l'objet à l'unmount pour éviter les fuites mémoire.
 *  - Inputs `<input type="color">` (UX native) couplés à des inputs
 *    `<input type="text">` qui partagent la même value (les deux se
 *    synchronisent). Validation hex côté client + côté server action.
 *  - Bouton "Supprimer le logo" désactive le file picker et envoie un flag
 *    `removeLogo=true` au server action.
 *  - Submit via FormData → `updateOrgBrandingAction`. On affiche un toast
 *    discret (banner) sur succès / erreur, puis on `router.refresh()` pour
 *    recharger la preview server-side et confirmer la persistence.
 *
 * Pas de Zustand ici : tout l'état est local au form (inputs, preview,
 * pending). Pas besoin d'un store global.
 */
export function BrandingForm({
  initialLogoUrl,
  initialPrimaryColor,
  initialAccentColor,
}: BrandingFormProps) {
  const t = useTranslations('Branding');
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingRemove, setPendingRemove] = useState(false);

  // URL d'aperçu du blob local (créé via createObjectURL). Quand l'utilisateur
  // sélectionne un nouveau fichier ou supprime sa sélection, on met à jour ;
  // on révoque toujours l'URL précédente pour libérer la mémoire.
  const previewUrl = useMemo(() => {
    if (pendingFile) return URL.createObjectURL(pendingFile);
    return null;
  }, [pendingFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayedLogoUrl = pendingRemove ? null : (previewUrl ?? initialLogoUrl);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setSuccess(false);
    if (!file) {
      setPendingFile(null);
      return;
    }
    setPendingRemove(false);
    setPendingFile(file);
  }

  function handleRemoveLogo() {
    setError(null);
    setSuccess(false);
    setPendingFile(null);
    setPendingRemove(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handlePrimaryHex(value: string) {
    setPrimaryColor(value);
  }
  function handleAccentHex(value: string) {
    setAccentColor(value);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);

    if (!HEX_COLOR_RE.test(primaryColor) || !HEX_COLOR_RE.test(accentColor)) {
      setError(t('errors.invalid_color'));
      return;
    }

    // FormData carries the inputs declared inside the <form>. Mirror the
    // current state explicitly so we don't depend on the input rendering
    // order / native "color" picker propagation.
    formData.set('primaryColor', primaryColor);
    formData.set('accentColor', accentColor);
    if (pendingRemove) formData.set('removeLogo', 'true');
    if (!pendingFile) formData.delete('logo');

    startTransition(async () => {
      const res = await updateOrgBrandingAction(formData);
      if (res.ok) {
        setSuccess(true);
        setPendingFile(null);
        setPendingRemove(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        router.refresh();
        return;
      }
      const errorKey = `errors.${res.error.toLowerCase()}` as const;
      setError(t(errorKey));
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-8" data-testid="branding-form" noValidate>
      {/* Logo section */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('logoSectionTitle')}
          </span>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t('logoSectionDescription')}
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div
            data-testid="branding-logo-preview"
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)]"
          >
            {displayedLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayedLogoUrl}
                alt={t('logoPreviewAlt')}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="px-2 text-center font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                {t('logoEmpty')}
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="sr-only"
              data-testid="branding-logo-input"
              aria-label={t('logoUploadCta')}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                data-testid="branding-pick-logo"
              >
                <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />
                {displayedLogoUrl ? t('logoReplaceCta') : t('logoUploadCta')}
              </Button>
              {displayedLogoUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                  data-testid="branding-remove-logo"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                  {t('logoRemoveCta')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Colors section */}
      <section className="flex flex-col gap-5 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('colorsSectionTitle')}
          </span>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t('colorsSectionDescription')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="primaryColor">{t('primaryColorLabel')}</Label>
            <div className="flex items-center gap-3">
              <input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => handlePrimaryHex(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                data-testid="branding-primary-color"
                aria-label={t('primaryColorLabel')}
              />
              <Input
                type="text"
                value={primaryColor}
                onChange={(e) => handlePrimaryHex(e.target.value)}
                maxLength={7}
                pattern="^#[0-9a-fA-F]{6}$"
                aria-label={`${t('primaryColorLabel')} (hex)`}
                data-testid="branding-primary-hex"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="accentColor">{t('accentColorLabel')}</Label>
            <div className="flex items-center gap-3">
              <input
                id="accentColor"
                type="color"
                value={accentColor}
                onChange={(e) => handleAccentHex(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                data-testid="branding-accent-color"
                aria-label={t('accentColorLabel')}
              />
              <Input
                type="text"
                value={accentColor}
                onChange={(e) => handleAccentHex(e.target.value)}
                maxLength={7}
                pattern="^#[0-9a-fA-F]{6}$"
                aria-label={`${t('accentColorLabel')} (hex)`}
                data-testid="branding-accent-hex"
              />
            </div>
          </div>
        </div>
      </section>

      <p className="text-xs text-[color:var(--color-muted-foreground)]">{t('publicPagesNote')}</p>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10 px-4 py-3 text-sm text-[color:var(--color-destructive)]"
          data-testid="branding-error"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="rounded-xl border border-[color:var(--color-sage-700)] bg-[oklch(26%_0.04_145)] px-4 py-3 text-sm text-[oklch(82%_0.07_145)]"
          data-testid="branding-success"
        >
          {t('saveSuccess')}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={pending}
          data-testid="branding-submit"
        >
          {pending ? t('saving') : t('saveCta')}
        </Button>
      </div>
    </form>
  );
}
