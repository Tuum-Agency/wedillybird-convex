/**
 * Préférences de notification de l'agence — types purs + valeurs par défaut.
 * Partagés UI (panneau Réglages) + tests. Chaque type a deux canaux : e-mail
 * et in-app.
 */

export const NOTIF_TYPES = [
  { key: 'rsvp', label: 'Réponse RSVP reçue', desc: 'Un invité confirme ou décline.' },
  { key: 'payment', label: 'Paiement reçu', desc: 'Acompte ou solde encaissé.' },
  { key: 'newLead', label: 'Nouveau client / lead', desc: 'Un prospect entre dans le pipeline.' },
  {
    key: 'taskDue',
    label: 'Échéance de tâche proche',
    desc: 'Une tâche du rétroplanning arrive à terme.',
  },
  {
    key: 'weeklyDigest',
    label: 'Résumé hebdomadaire',
    desc: 'Synthèse de l’activité chaque lundi.',
  },
] as const;

export type NotifKey = (typeof NOTIF_TYPES)[number]['key'];

export interface NotifChannel {
  email: boolean;
  app: boolean;
}

export type NotifPrefs = Record<NotifKey, NotifChannel>;

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  rsvp: { email: true, app: true },
  payment: { email: true, app: true },
  newLead: { email: false, app: true },
  taskDue: { email: false, app: true },
  weeklyDigest: { email: true, app: false },
};

/** Fusionne les préférences stockées (partielles) avec les valeurs par défaut. */
export function mergeNotifPrefs(stored?: Partial<NotifPrefs> | null): NotifPrefs {
  const out = {} as NotifPrefs;
  for (const t of NOTIF_TYPES) {
    const s = stored?.[t.key];
    out[t.key] = {
      email: s?.email ?? DEFAULT_NOTIF_PREFS[t.key].email,
      app: s?.app ?? DEFAULT_NOTIF_PREFS[t.key].app,
    };
  }
  return out;
}
