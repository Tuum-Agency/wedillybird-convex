import type { ClientStage } from '@/lib/pro/clients';

/** Couleurs des pastilles d'étape (reprises de `clients/crm.css` du design). */
export const STAGE_PILL: Record<ClientStage, { bg: string; fg: string; dot: string }> = {
  lead: { bg: 'oklch(29% 0.012 28)', fg: 'oklch(76% 0.02 65)', dot: 'oklch(60% 0.02 65)' },
  contacted: { bg: 'oklch(27% 0.045 222)', fg: 'oklch(80% 0.10 225)', dot: 'oklch(66% 0.11 220)' },
  quote: { bg: 'oklch(28% 0.045 78)', fg: 'oklch(86% 0.085 80)', dot: 'oklch(80% 0.09 80)' },
  booked: { bg: 'oklch(29% 0.06 22)', fg: 'oklch(84% 0.075 22)', dot: 'oklch(78% 0.085 22)' },
  in_progress: {
    bg: 'oklch(28% 0.055 300)',
    fg: 'oklch(82% 0.09 300)',
    dot: 'oklch(74% 0.10 298)',
  },
  delivered: { bg: 'oklch(26% 0.045 145)', fg: 'oklch(82% 0.075 145)', dot: 'oklch(72% 0.08 145)' },
};
