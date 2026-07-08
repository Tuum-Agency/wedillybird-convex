/**
 * Déroulé de la journée sur la page d'invitation publique (guest-facing).
 * Composant présentiel pur (server-rendered avec le contenu) — timeline
 * éditoriale : filet vertical, pastille par étape, heure en mono + intitulé
 * Bodoni. Rien si aucune étape. Partagé par les 3 pages d'invitation.
 */

export type ScheduleStep = { time: string; title: string; note?: string };

export function InvitationSchedule({
  schedule,
  title,
}: {
  schedule: ReadonlyArray<ScheduleStep>;
  /** Titre localisé de la section (ex. « Le déroulé de la journée »). */
  title: string;
}) {
  const steps = schedule.filter((s) => s.title.trim() || s.time.trim());
  if (steps.length === 0) return null;

  return (
    <section className="flex flex-col items-center gap-8 text-center">
      <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
        {title}
      </span>

      <ol className="relative flex w-full max-w-md flex-col gap-6 text-left">
        {/* Filet vertical de la timeline */}
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-[7px] w-px"
          style={{ background: 'var(--color-border-strong)' }}
        />
        {steps.map((step, i) => (
          <li key={i} className="relative flex gap-5 pl-8">
            <span
              aria-hidden
              className="absolute top-1.5 left-0 h-[15px] w-[15px] rounded-full border-2"
              style={{
                borderColor: 'var(--invitation-accent, var(--color-blush-700))',
                background: 'var(--color-surface)',
              }}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {step.time.trim() && (
                <span
                  className="font-mono text-[11px] tracking-[0.18em] uppercase"
                  style={{ color: 'var(--invitation-accent, var(--color-blush-700))' }}
                >
                  {step.time}
                </span>
              )}
              <span
                className="font-display text-xl italic"
                style={{ color: 'var(--color-ink-900)', letterSpacing: '-0.018em' }}
              >
                {step.title}
              </span>
              {step.note?.trim() && (
                <span className="text-sm text-[color:var(--color-ink-500)]">{step.note}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
