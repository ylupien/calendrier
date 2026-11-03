import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tFor } from './i18n.js';

// Outgoing email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// RESEND_API_KEY: API key; MAIL_FROM: sender, e.g. "Disponibilités <connexion@example.com>"
// (the domain must be verified in Resend; onboarding@resend.dev only reaches the Resend account's own address).

export const mailEnabled = () => !!process.env.RESEND_API_KEY;

export async function sendMail({ to, subject, html, text }) {
  if (!mailEnabled()) throw new Error('Envoi de courriels non configuré (RESEND_API_KEY).');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Disponibilités <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
}

// Fingerprints of the compiled frontend's files (STATIC_DIR), as in frontend/vite.config.js.
const fingerprints = new Map();

/** Absolute address of a file of the site with its cache buster, e.g. …/logo-disponibilites.png?v=3f9a1c2e. */
export function staticAssetUrl(base, file) {
  if (!fingerprints.has(file)) {
    let version = null;
    try {
      const content = fs.readFileSync(path.join(process.env.STATIC_DIR || '', file));
      version = createHash('sha256').update(content).digest('hex').slice(0, 8);
    } catch {
      // No compiled frontend (development server): address without version.
    }
    fingerprints.set(file, version);
  }
  const version = fingerprints.get(file);
  return `${base}${file}${version ? `?v=${version}` : ''}`;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Translation for the HTML of an email: the interpolated values are escaped (texts: mail.* in locales). */
const htmlT = (t) => (key, params) => t(key, { ...params, interpolation: { escapeValue: true } });

const logoBlock = (logoUrl) =>
  logoUrl
    ? `<p style="margin:0 0 24px"><img src="${escapeHtml(logoUrl)}" alt="Disponibilités" width="200" height="47" style="display:block;width:200px;height:auto;border:0"></p>`
    : '';

/**
 * Email with a one-time sign-in link. t: translation function of the email's language (req.t, tFor(lang)).
 * logoUrl: absolute address of the application's logo (optional).
 */
export function signInMail({ t = tFor('fr'), name, url, minutes, logoUrl = null }) {
  const h = htmlT(t);
  const hello = name ? t('mail.hello', { name }) : t('mail.helloAnonymous');
  return {
    subject: t('mail.signIn.subject'),
    text: `${hello}\n\n${t('mail.signIn.text', { minutes })}\n\n${url}\n\n${t('mail.signIn.ignore')}`,
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;color:#1e293b;line-height:1.5">
  ${logoBlock(logoUrl)}
  <p>${escapeHtml(hello)}</p>
  <p>${h('mail.signIn.html', { minutes })}</p>
  <p style="margin:28px 0">
    <a href="${escapeHtml(url)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(t('mail.signIn.button'))}</a>
  </p>
  <p style="font-size:13px;color:#64748b">${escapeHtml(t('mail.signIn.copy'))}<br>${escapeHtml(url)}</p>
  <p style="font-size:13px;color:#64748b">${escapeHtml(t('mail.signIn.ignore'))}</p>
</div>`,
  };
}

/**
 * Invitation to an occasion. url: personal link (signs the device in to the invited account, then opens
 * the occasion). message: optional words of the person who invites (plain text). t: as for signInMail.
 */
export function inviteMail({ t = tFor('fr'), name, inviterName, title, url, days, message = '', logoUrl = null }) {
  const h = htmlT(t);
  const hello = name ? t('mail.hello', { name }) : t('mail.helloAnonymous');
  const who = inviterName || t('mail.invite.someone');
  const lines = message ? message.split(/\r?\n/) : [];
  return {
    subject: t('mail.invite.subject', { who, title }),
    text:
      `${hello}\n\n${t('mail.invite.text', { who, title })}\n\n` +
      (message ? `${message}\n\n` : '') +
      `${t('mail.invite.textLink', { days })}\n\n${url}\n\n${t('mail.invite.textWarning')}`,
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;color:#1e293b;line-height:1.5">
  ${logoBlock(logoUrl)}
  <p>${escapeHtml(hello)}</p>
  <p>${h('mail.invite.html', { who, title })}</p>
  ${lines.length ? `<p style="margin:20px 0;padding:12px 16px;border-left:3px solid #c7d2fe;background:#eef2ff;border-radius:4px;color:#334155">${lines.map(escapeHtml).join('<br>')}</p>` : ''}
  <p style="margin:28px 0">
    <a href="${escapeHtml(url)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(t('mail.invite.button'))}</a>
  </p>
  <p style="font-size:13px;color:#64748b">${escapeHtml(t('mail.invite.copy', { days }))}<br>${escapeHtml(url)}</p>
  <p style="font-size:13px;color:#64748b">${escapeHtml(t('mail.invite.warning'))}</p>
</div>`,
  };
}
