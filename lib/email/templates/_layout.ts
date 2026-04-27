export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Couleurs brand alignées avec la palette V4 (blush + ivory + ink charbon).
 * Hex car les clients mail (Outlook, Gmail) ne supportent pas OKLCH.
 */
const BRAND_BLUSH = '#C68567'; // ~ oklch(62% 0.095 22), proche du #D68D6B du logo
const BRAND_INK = '#2E250F'; // charbon brun-rosé, comme le wordmark du logo
const BRAND_IVORY = '#FBF6EE'; // ivoire chaud, fond global

/**
 * Bird mark Wedillybird en SVG inline. ~1 KB. Toléré par Gmail / Outlook /
 * Apple Mail. Utilisé dans le header email à la place de l'ancien wordmark
 * texte-only.
 */
const BIRD_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="220 130 560 740" fill="#ffffff" style="vertical-align:middle;display:inline-block;"><g><path d="M546.68,770.37c0.42,1.19,0.83,2.38,1.29,3.59c20.45,54.37,105.44,86.3,105.44,86.3c9.17-47.39-35.11-99.27-35.11-99.27c70.34,26.44,111.74-10.47,111.74-10.47c-44.18-11.11-81.18-37.69-107.29-61.72C583.73,709.85,552.45,733.09,546.68,770.37z"/><path d="M500,431.35c0.82,0,9-38.28,31.9-55.29c0,0-3.6-96.84,99.13-101.1s178.98,119.51,115.82,246.69c-57.45,115.66-247.34,160.97-175.69,285.62c0,0-105.12-89.76-52.76-225.75c53.41-138.72,176.16-93.43,172.83-198.92c-0.55-17.33-17.67-68.38-71-68.38c-53.33,0-95.58,64.19-59.55,117.78C560.69,432,528.63,403.54,500,431.35z"/></g><g><path d="M453.32,770.37c-0.42,1.19-0.83,2.38-1.29,3.59c-20.45,54.37-105.44,86.3-105.44,86.3c-9.17-47.39,35.11-99.27,35.11-99.27c-70.34,26.44-111.74-10.47-111.74-10.47c44.18-11.11,81.18-37.69,107.29-61.72C416.27,709.85,447.55,733.09,453.32,770.37z"/><path d="M500,431.35c-0.82,0-9-38.28-31.9-55.29c0,0,3.6-96.84-99.13-101.1S189.98,394.47,253.15,521.65c57.45,115.66,247.34,160.97,175.69,285.62c0,0,105.12-89.76,52.76-225.75C428.19,442.8,305.44,488.09,308.77,382.6c0.55-17.33,17.67-68.38,71-68.38c53.33,0,95.58,64.19,59.55,117.78C439.31,432,471.37,403.54,500,431.35z"/></g><circle cx="500" cy="217.3" r="77.56"/></svg>`;

export function htmlLayout({
  preheader,
  body,
  footer,
}: {
  preheader: string;
  body: string;
  footer?: string;
}): string {
  const escapedPreheader = escapeHtml(preheader);
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Wedillybird</title></head>
<body style="margin:0;padding:0;background:${BRAND_IVORY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND_INK};">
<span style="display:none;color:transparent;height:0;width:0;overflow:hidden;">${escapedPreheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_IVORY};padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;width:100%;border:1px solid #efe6d8;">
<tr><td style="padding:24px 32px;background:${BRAND_BLUSH};color:#fff;font-size:20px;font-weight:600;font-style:italic;letter-spacing:-0.018em;">${BIRD_MARK_SVG}<span style="margin-left:10px;vertical-align:middle;">Wedillybird</span></td></tr>
<tr><td style="padding:32px;line-height:1.6;font-size:16px;color:${BRAND_INK};">${body}</td></tr>
${footer ? `<tr><td style="padding:16px 32px;background:${BRAND_IVORY};color:#7a6b50;font-size:13px;line-height:1.5;border-top:1px solid #efe6d8;">${footer}</td></tr>` : ''}
</table>
</td></tr></table>
</body></html>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px 0;">${escapeHtml(text)}</p>`;
}

export function button(label: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background:${BRAND_BLUSH};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a></td></tr></table>`;
}
