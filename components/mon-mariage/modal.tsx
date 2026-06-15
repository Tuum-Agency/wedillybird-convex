'use client';
// AUTO-PORTED from Claude Design bundle (couple/mc-modal.jsx), typed.
// Primitives de formulaire & modale : McModal · McField · McInput · McSelect ·
// McTextarea · Attachments · AttachChip.

import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';
import type { McAttachment } from './data';

/* ---------- Modale ---------- */
export function McModal({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslations('MonMariage.common');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      className="mc-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={'mc-modal' + (wide ? ' wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="mc-modal-head">
          <div>
            {eyebrow && <span className="mc-eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className="mc-modal-x" onClick={onClose} aria-label={t('close')}>
            <Icon name="X" size={18} stroke={2} />
          </button>
        </header>
        <div className="mc-modal-body">{children}</div>
        {footer && <footer className="mc-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- Champs ---------- */
export function McField({
  label,
  hint,
  children,
  full,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={'mc-fld' + (full ? ' full' : '')}>
      <span className="lab">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      {children}
    </label>
  );
}

export function McInput({
  icon,
  prefix,
  ...props
}: { icon?: string; prefix?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="mc-inp">
      {icon && <Icon name={icon} size={15} stroke={1.85} />}
      {prefix && <span className="pfx">{prefix}</span>}
      <input {...props} />
    </span>
  );
}

export function McSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<[string, string]>;
}) {
  return (
    <span className="mc-inp select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <Icon name="ChevronDown" size={15} stroke={2} />
    </span>
  );
}

export function McTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <span className="mc-inp area">
      <textarea rows={3} {...props} />
    </span>
  );
}

/* ---------- Pièces jointes (mock : on lit juste le nom du fichier) ----------
   Les libellés de type sont des clés i18n (traduites au render via `t(label)`). */
export const ATTACH_KINDS: ReadonlyArray<[string, string]> = [
  ['devis', 'MonMariage.data.attachKinds.devis'],
  ['contrat', 'MonMariage.data.attachKinds.contrat'],
  ['photo', 'MonMariage.data.attachKinds.photo'],
  ['facture', 'MonMariage.data.attachKinds.facture'],
  ['autre', 'MonMariage.data.attachKinds.autre'],
];
export function attachIcon(kind: string): string {
  return kind === 'photo'
    ? 'Image'
    : kind === 'facture'
      ? 'Receipt'
      : kind === 'autre'
        ? 'Paperclip'
        : 'FileText';
}

export function Attachments({
  value = [],
  onChange,
  kinds,
  label,
}: {
  value?: McAttachment[];
  onChange: (v: McAttachment[]) => void;
  kinds?: ReadonlyArray<[string, string]>;
  label?: string;
}) {
  const t = useTranslations('MonMariage.common');
  const tRoot = useTranslations('MonMariage');
  const tKind = (key: string): string => tRoot(key.replace(/^MonMariage\./, ''));
  const inputRef = useRef<HTMLInputElement>(null);
  const kindList = kinds || ATTACH_KINDS;
  const [pendingKind, setPendingKind] = useState<string>(kindList[0]?.[0] ?? 'autre');
  // libellés traduits pour le Select (les tuples portent des clés i18n)
  const kindOptions: ReadonlyArray<[string, string]> = kindList.map(([v, key]) => [v, tKind(key)]);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    const added = files.map((f, i) => ({
      id: 'at' + Date.now() + i,
      name: f.name,
      kind: pendingKind,
      size: f.size,
    }));
    onChange([...(value || []), ...added]);
    e.target.value = '';
  };
  const remove = (id: string) => onChange(value.filter((a) => a.id !== id));
  const kindLabel = (kind: string): string => {
    const found = kindList.find((k) => k[0] === kind);
    return found ? tKind(found[1]) : kind;
  };
  return (
    <div className="mc-attach">
      <div className="mc-attach-head">
        <span className="lab">{label ?? t('attachments')}</span>
        <div className="mc-attach-add">
          <McSelect value={pendingKind} onChange={setPendingKind} options={kindOptions} />
          <button
            type="button"
            className="mc-btn sm outline"
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="Upload" size={14} stroke={1.9} />
            {t('attach')}
          </button>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            onChange={pick}
            accept="image/*,.pdf,.doc,.docx"
          />
        </div>
      </div>
      {value && value.length > 0 ? (
        <ul className="mc-files">
          {value.map((a) => (
            <li key={a.id} className="mc-file">
              <span className="fic">
                <Icon name={attachIcon(a.kind)} size={15} stroke={1.8} />
              </span>
              <div className="fn">
                <b>{a.name}</b>
                <span>{kindLabel(a.kind)}</span>
              </div>
              <button
                type="button"
                className="rm"
                onClick={() => remove(a.id)}
                aria-label={t('remove')}
              >
                <Icon name="Trash2" size={14} stroke={1.9} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mc-attach-empty">{t('attachEmpty')}</p>
      )}
    </div>
  );
}

export function AttachChip({ a }: { a: McAttachment }) {
  return (
    <span className="mc-attach-chip">
      <Icon name={attachIcon(a.kind)} size={11} stroke={1.9} />
      {a.name.length > 18 ? a.name.slice(0, 16) + '…' : a.name}
    </span>
  );
}
