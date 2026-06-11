/**
 * Marque blanche — helpers purs (validation domaine + e-mail expéditeur).
 * Partagés UI (formulaire) + tests. Validation volontairement souple : on
 * normalise et on rejette l'évidemment invalide, le DNS/SPF réel se vérifie
 * côté infra.
 */

/**
 * Normalise un domaine sur mesure : retire le protocole, le chemin, les espaces
 * et le `www.`, met en minuscules. Retourne `''` si le résultat n'a pas la forme
 * d'un nom de domaine (`label.tld`).
 */
export function cleanDomain(input: string): string {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
  if (!host) return '';
  // Au moins deux labels alphanumériques séparés par des points, TLD ≥ 2.
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) ? host : '';
}

/** Validation e-mail souple (présence d'un `@` et d'un domaine plausible). */
export function isLikelyEmail(input: string): boolean {
  const v = input.trim().toLowerCase();
  return /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,}$/.test(v);
}

/** Adresse publique par défaut d'une agence (sous-domaine Wedillybird). */
export function defaultSubdomain(slug: string): string {
  return `${slug}.wedillybird.fr`;
}
