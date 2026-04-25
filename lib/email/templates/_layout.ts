export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BRAND_COLOR = '#4F46E5';

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
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
<span style="display:none;color:transparent;height:0;width:0;overflow:hidden;">${escapedPreheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
<tr><td style="padding:24px 32px;background:${BRAND_COLOR};color:#fff;font-size:20px;font-weight:600;">Wedillybird</td></tr>
<tr><td style="padding:32px;line-height:1.6;font-size:16px;">${body}</td></tr>
${footer ? `<tr><td style="padding:16px 32px;background:#fafafa;color:#666;font-size:13px;line-height:1.5;border-top:1px solid #eee;">${footer}</td></tr>` : ''}
</table>
</td></tr></table>
</body></html>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px 0;">${escapeHtml(text)}</p>`;
}

export function button(label: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background:${BRAND_COLOR};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a></td></tr></table>`;
}
