'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  requestLogoUploadUrlAction,
  updateBrandingAction,
} from '@/app/[locale]/(app)/pro/branding/actions';

interface BrandingFormProps {
  initialPrimary?: string;
  initialAccent?: string;
  initialLogoUrl?: string | null;
  organizationName: string;
}

const DEFAULT_PRIMARY = '#7E2F50';
const DEFAULT_ACCENT = '#C7A45A';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export function BrandingForm({
  initialPrimary,
  initialAccent,
  initialLogoUrl,
  organizationName,
}: BrandingFormProps) {
  const [primary, setPrimary] = useState(initialPrimary ?? DEFAULT_PRIMARY);
  const [accent, setAccent] = useState(initialAccent ?? DEFAULT_ACCENT);
  const [logoS3Key, setLogoS3Key] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpload, startUpload] = useTransition();

  function onLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Format non supporté (JPEG, PNG, WebP, SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo trop lourd (2 Mo max).');
      return;
    }

    startUpload(async () => {
      const presign = await requestLogoUploadUrlAction({ contentType: file.type });
      if (!presign.ok) {
        setError(`Erreur d'autorisation: ${presign.error}`);
        return;
      }
      const upload = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!upload.ok) {
        setError("L'envoi a échoué. Réessayez.");
        return;
      }
      setLogoS3Key(presign.s3Key);
      setLogoPreview(URL.createObjectURL(file));
    });
  }

  return (
    <form action={updateBrandingAction} className="flex flex-col gap-8" data-testid="branding-form">
      <input type="hidden" name="logoS3Key" value={logoS3Key ?? ''} />

      <section className="grid gap-6 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Couleur primaire</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="primaryColor"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="h-12 w-16 cursor-pointer rounded border border-[color:var(--color-border)]"
              aria-label="Couleur primaire"
            />
            <code className="text-sm text-[color:var(--color-muted)]">{primary}</code>
          </div>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Couleur accent</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="accentColor"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-12 w-16 cursor-pointer rounded border border-[color:var(--color-border)]"
              aria-label="Couleur accent"
            />
            <code className="text-sm text-[color:var(--color-muted)]">{accent}</code>
          </div>
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium">Logo</span>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt={`Logo ${organizationName}`}
              className="h-20 w-20 rounded-lg border border-[color:var(--color-border)] bg-white object-contain p-2"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] text-xs text-[color:var(--color-muted)]">
              Aucun
            </div>
          )}
          <label className="cursor-pointer rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-sm hover:bg-[color:var(--color-ivory-100)]">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="sr-only"
              onChange={onLogoChange}
              disabled={pendingUpload}
              data-testid="logo-input"
            />
            {pendingUpload ? 'Téléversement…' : logoPreview ? 'Changer' : 'Téléverser un logo'}
          </label>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
            {error}
          </p>
        ) : null}
      </section>

      <section
        className="rounded-2xl border border-[color:var(--color-border)] p-6"
        style={
          {
            '--brand-primary': primary,
            '--brand-accent': accent,
          } as React.CSSProperties
        }
        aria-label="Aperçu du branding"
      >
        <h3 className="mb-3 text-sm font-medium text-[color:var(--color-muted)]">Aperçu</h3>
        <div
          className="flex items-center gap-4 rounded-xl p-4"
          style={{ backgroundColor: primary, color: 'white' }}
        >
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt=""
              className="h-12 w-12 rounded bg-white object-contain p-1"
            />
          ) : null}
          <div>
            <p className="text-lg font-semibold">{organizationName}</p>
            <p className="text-sm opacity-80">Bienvenue à votre événement</p>
          </div>
          <button
            type="button"
            className="ml-auto rounded-full px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: accent, color: 'black' }}
          >
            Action principale
          </button>
        </div>
      </section>

      <div>
        <Button type="submit" data-testid="save-branding">
          Enregistrer le branding
        </Button>
      </div>
    </form>
  );
}
