/**
 * Carte d'état d'un template WhatsApp custom soumis à Meta. Affiche le nom
 * (mono italique), un badge de status, la raison de refus si présente, et
 * un hint contextuel selon le canal de notification choisi par le couple.
 *
 * Côté server component pour pouvoir formater les dates avec Intl.DateTimeFormat
 * sans coût client.
 */

interface TemplateStatusCardProps {
  template: {
    name: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
    rejectionReason?: string;
    submittedAt?: number;
    reviewedAt?: number;
  };
  notifyChannel: 'whatsapp' | 'email' | 'both';
}

const STATUS_LABEL: Record<TemplateStatusCardProps['template']['status'], string> = {
  draft: 'Brouillon',
  pending: 'En attente de validation',
  approved: 'Validé',
  rejected: 'Refusé',
  paused: 'Suspendu',
  disabled: 'Désactivé',
};

const STATUS_BG: Record<TemplateStatusCardProps['template']['status'], string> = {
  draft: 'oklch(94% 0.012 78)',
  pending: 'oklch(94% 0.045 78)',
  approved: 'oklch(94% 0.05 145)',
  rejected: 'oklch(94% 0.05 25)',
  paused: 'oklch(92% 0.04 60)',
  disabled: 'oklch(94% 0.012 78)',
};

const STATUS_FG: Record<TemplateStatusCardProps['template']['status'], string> = {
  draft: 'var(--color-ink-500)',
  pending: 'oklch(48% 0.12 78)',
  approved: 'oklch(45% 0.12 145)',
  rejected: 'var(--color-blush-700)',
  paused: 'oklch(48% 0.12 60)',
  disabled: 'var(--color-ink-500)',
};

function channelLabel(c: 'whatsapp' | 'email' | 'both'): string {
  if (c === 'whatsapp') return 'WhatsApp';
  if (c === 'email') return 'email';
  return 'WhatsApp et email';
}

function fmt(ts: number | undefined): string | null {
  if (!ts) return null;
  return new Intl.DateTimeFormat('fr', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(ts),
  );
}

export function TemplateStatusCard({ template, notifyChannel }: TemplateStatusCardProps) {
  const submitted = fmt(template.submittedAt);
  const reviewed = fmt(template.reviewedAt);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
            Template Meta
          </span>
          <span className="font-mono text-sm [overflow-wrap:anywhere] text-[color:var(--color-ink-900)] italic">
            {template.name}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase"
          style={{ background: STATUS_BG[template.status], color: STATUS_FG[template.status] }}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: STATUS_FG[template.status] }}
          />
          {STATUS_LABEL[template.status]}
        </span>
      </div>

      {template.status === 'pending' ? (
        <p className="text-sm text-[color:var(--color-ink-500)]">
          Validation Meta sous 24-48h. Vous serez prévenu·e par {channelLabel(notifyChannel)} dès la
          décision.
        </p>
      ) : null}
      {template.status === 'approved' ? (
        <p className="text-sm text-[color:var(--color-ink-500)]">
          ✓ Votre template est utilisable. Il sera envoyé à vos invités à la place du style
          préfabriqué.
        </p>
      ) : null}
      {(template.status === 'rejected' || template.status === 'disabled') &&
      template.rejectionReason ? (
        <div
          className="rounded-xl px-4 py-3 text-sm leading-relaxed"
          style={{
            background: 'oklch(96% 0.025 25)',
            color: 'var(--color-blush-700)',
            borderLeft: '3px solid var(--color-blush-700)',
          }}
        >
          <strong>Raison communiquée par WhatsApp :</strong>
          <br />
          {template.rejectionReason}
        </div>
      ) : null}
      {template.status === 'paused' ? (
        <p className="text-sm text-[color:var(--color-ink-500)]">
          WhatsApp a suspendu temporairement votre template suite à des signaux qualité.
        </p>
      ) : null}

      {(submitted || reviewed) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[color:var(--color-border)] pt-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase">
          {submitted ? <span>Soumis : {submitted}</span> : null}
          {reviewed ? <span>Décision : {reviewed}</span> : null}
        </div>
      )}
    </div>
  );
}
