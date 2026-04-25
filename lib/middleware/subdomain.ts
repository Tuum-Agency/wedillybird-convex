/**
 * Reserved subdomains that must NEVER be rewritten to /orgs/<slug>.
 * - apex/www: marketing site
 * - api/cdn/media: infra hostnames
 * - app/dashboard: future product hostnames
 */
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'cdn',
  'media',
  'app',
  'dashboard',
  'admin',
  'static',
  'assets',
]);

const ROOT_DOMAINS = ['wedillybird.com'];

export interface SubdomainMatch {
  slug: string;
}

/**
 * Returns the org slug if `host` is a subdomain of one of our root domains
 * AND the subdomain is not reserved (www, api, etc.). Returns null otherwise.
 *
 * Examples (with ROOT_DOMAINS = ['wedillybird.com']):
 *   tuum.wedillybird.com         -> { slug: 'tuum' }
 *   tuum.wedillybird.com:443     -> { slug: 'tuum' }
 *   www.wedillybird.com          -> null   (reserved)
 *   wedillybird.com              -> null   (apex)
 *   tuum.preview.wedillybird.com -> null   (multi-level not supported)
 *   localhost:3000               -> null
 *   tuum.localhost:3000          -> { slug: 'tuum' }  (when ROOT_DOMAINS includes 'localhost')
 */
export function matchOrgSubdomain(
  host: string | null,
  rootDomains: readonly string[] = ROOT_DOMAINS,
): SubdomainMatch | null {
  if (!host) return null;
  const noPort = host.split(':')[0]!.toLowerCase();
  for (const root of rootDomains) {
    const normalizedRoot = root.toLowerCase();
    if (noPort === normalizedRoot) return null; // apex
    const suffix = `.${normalizedRoot}`;
    if (!noPort.endsWith(suffix)) continue;
    const sub = noPort.slice(0, -suffix.length);
    if (sub.length === 0 || sub.includes('.')) return null;
    if (RESERVED_SUBDOMAINS.has(sub)) return null;
    if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(sub)) return null;
    return { slug: sub };
  }
  return null;
}

export function getRootDomains(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  const raw = env.ALLOWED_SUBDOMAIN_ROOTS;
  if (!raw) return ROOT_DOMAINS;
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}
