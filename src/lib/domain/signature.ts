import { normaliseHex } from './colour';

/**
 * Email signature builder. Produces table-based HTML with inline styles, which is what
 * Gmail, Outlook and Apple Mail render reliably.
 */

export interface SignatureInput {
  name: string;
  role: string;
  business: string;
  phone: string;
  email: string;
  website: string;
  accent: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function websiteParts(raw: string): { href: string; label: string } | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!url.hostname.includes('.')) return null;
    const label = `${url.hostname.replace(/^www\./, '')}${url.pathname === '/' ? '' : url.pathname}`;
    return { href: url.toString(), label };
  } catch {
    return null;
  }
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

export function signatureHtml(input: SignatureInput): string {
  const accent = normaliseHex(input.accent) ?? '#0A0E0F';
  const name = escapeHtml(input.name.trim() || 'Your name');
  const role = input.role.trim();
  const business = input.business.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const website = websiteParts(input.website);

  const roleLine = [role, business].filter(Boolean).map(escapeHtml).join(', ');
  const link = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="color:#0A0E0F;text-decoration:none;">${escapeHtml(label)}</a>`;
  const contacts = [
    phone ? link(telHref(phone), phone) : '',
    email && /.+@.+\..+/.test(email) ? link(`mailto:${email}`, email) : '',
    website ? link(website.href, website.label) : '',
  ].filter(Boolean);

  return [
    `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${FONT};color:#0A0E0F;">`,
    '<tr>',
    `<td style="border-left:3px solid ${accent};padding:2px 0 2px 12px;">`,
    `<div style="font-size:15px;font-weight:bold;line-height:1.4;">${name}</div>`,
    roleLine ? `<div style="font-size:13px;line-height:1.4;color:#555B5E;">${roleLine}</div>` : '',
    contacts.length
      ? `<div style="font-size:13px;line-height:1.6;padding-top:6px;">${contacts.join(' &nbsp;|&nbsp; ')}</div>`
      : '',
    '</td>',
    '</tr>',
    '</table>',
  ]
    .filter(Boolean)
    .join('');
}

/** Plain-text version for clients that strip HTML. */
export function signatureText(input: SignatureInput): string {
  const website = websiteParts(input.website);
  return [
    input.name.trim(),
    [input.role.trim(), input.business.trim()].filter(Boolean).join(', '),
    [input.phone.trim(), input.email.trim(), website?.label ?? ''].filter(Boolean).join(' | '),
  ]
    .filter(Boolean)
    .join('\n');
}
