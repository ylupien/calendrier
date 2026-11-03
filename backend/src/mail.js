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

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Email with a one-time sign-in link. logoUrl: absolute address of the application's logo (optional). */
export function signInMail({ name, url, minutes, logoUrl = null }) {
  const hello = name ? `Bonjour ${name},` : 'Bonjour,';
  return {
    subject: 'Votre lien de connexion — Disponibilités',
    text:
      `${hello}\n\nPour retrouver votre compte Disponibilités sur cet appareil, ouvrez ce lien ` +
      `(valide ${minutes} minutes, une seule fois) :\n\n${url}\n\n` +
      "Si vous n'avez pas demandé ce lien, ignorez ce courriel : rien ne change sur votre compte.",
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;color:#1e293b;line-height:1.5">
  ${logoUrl ? `<p style="margin:0 0 24px"><img src="${escapeHtml(logoUrl)}" alt="Disponibilités" width="200" height="47" style="display:block;width:200px;height:auto;border:0"></p>` : ''}
  <p>${escapeHtml(hello)}</p>
  <p>Pour retrouver votre compte <strong>Disponibilités</strong> sur cet appareil, cliquez sur ce bouton
     (valide ${minutes} minutes, une seule fois) :</p>
  <p style="margin:28px 0">
    <a href="${escapeHtml(url)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Me connecter</a>
  </p>
  <p style="font-size:13px;color:#64748b">Ou copiez cette adresse dans votre navigateur :<br>${escapeHtml(url)}</p>
  <p style="font-size:13px;color:#64748b">Si vous n'avez pas demandé ce lien, ignorez ce courriel : rien ne change sur votre compte.</p>
</div>`,
  };
}
