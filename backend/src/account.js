import { Router } from 'express';
import { pool } from './db.js';
import { HttpError, cleanText } from './http.js';
import {
  USER_COLUMNS, toUser, hashPassword, verifyPassword, PASSWORD_MIN, setIdentityCookie, clearIdentityCookie,
} from './auth.js';
import { createLinkToken } from './link.js';
import { mailEnabled, sendMail, signInMail, staticAssetUrl } from './mail.js';

const EMAIL_LINK_MINUTES = 30;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Login emails are unique among accounts that have a password (older accounts may share an address). */
export async function assertLoginEmailFree(email, exceptUserId = 0) {
  const [rows] = await pool.query(
    'SELECT 1 FROM users WHERE email = ? AND password_hash IS NOT NULL AND id <> ?',
    [email, exceptUserId],
  );
  if (rows.length) throw new HttpError(409, 'emailInUse');
}

export function parsePassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < PASSWORD_MIN) {
    throw new HttpError(400, 'passwordTooShort', { min: PASSWORD_MIN });
  }
  if (password.length > 200) throw new HttpError(400, 'passwordTooLong');
  return password;
}

/** An account that holds nothing (typically created by an invitation link after a lost cookie). */
async function isEmptyAccount(userId) {
  const [[row]] = await pool.query(
    `SELECT u.password_hash IS NULL AND u.is_site_admin = 0
       AND NOT EXISTS (SELECT 1 FROM availabilities a WHERE a.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM occasions o WHERE o.creator_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM organizations g WHERE g.owner_id = u.id) AS is_empty
     FROM users u WHERE u.id = ?`,
    [userId],
  );
  return !!row?.is_empty;
}

// Failed sign-ins, per address and per IP: at most MAX_FAILURES per WINDOW_MS.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map();

function tooManyFailures(keys) {
  const now = Date.now();
  return keys.some((k) => {
    const f = failures.get(k);
    if (f && f.until < now) failures.delete(k);
    return f && f.until >= now && f.count >= MAX_FAILURES;
  });
}

function recordFailure(keys) {
  const now = Date.now();
  for (const k of keys) {
    const f = failures.get(k);
    if (f && f.until >= now) f.count++;
    else failures.set(k, { count: 1, until: now + WINDOW_MS });
  }
}

// Sign-in links sent by email: at most 3 per address and 10 per IP every 15 minutes.
const sent = new Map();
function overLimit(key, max) {
  const now = Date.now();
  const s = sent.get(key);
  if (!s || s.until < now) {
    sent.set(key, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  return ++s.count > max;
}

/**
 * The account that uses this email. Older accounts may share an address: the one with a password,
 * otherwise the one with the most ranges, otherwise the most recently seen.
 */
export async function findUserByEmail(email, conn = pool) {
  const [[user]] = await conn.query(
    `SELECT u.id, u.name, u.email, u.locale, u.activated_at IS NOT NULL AS active FROM users u WHERE u.email = ?
     ORDER BY u.password_hash IS NOT NULL DESC,
       (SELECT COUNT(*) FROM availabilities a WHERE a.user_id = u.id) DESC, u.last_seen_at DESC
     LIMIT 1`,
    [email],
  );
  return user ?? null;
}

/** Address of the site for links in emails (https://PUBLIC_HOSTNAME, or the address of the request). */
export function siteBase(req) {
  const host = process.env.PUBLIC_HOSTNAME;
  return host ? `https://${host}` : `${req.protocol}://${req.get('host')}`;
}

/** Path of this site only ("//site" and "/\\site" would leave it). */
export const safeReturnPath = (value) => (typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : null);

export function createAccountRoutes() {
  const r = Router();

  /** Signs this device in to the account with this email and password. */
  r.post('/auth/login', async (req, res) => {
    const email = cleanText(req.body?.email, 255).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const keys = [`ip:${req.ip}`, `email:${email}`];
    if (tooManyFailures(keys)) throw new HttpError(429, 'tooManyAttempts');

    const [rows] = await pool.query(
      `SELECT ${USER_COLUMNS}, token, password_hash FROM users WHERE email = ? AND password_hash IS NOT NULL`,
      [email],
    );
    if (!email || !rows.length || !(await verifyPassword(password, rows[0].password_hash))) {
      recordFailure(keys);
      throw new HttpError(401, 'badCredentials');
    }
    const target = rows[0];

    // The account this device was using until now: removed if it holds nothing (lost-cookie duplicate).
    if (req.user && req.user.id !== target.id && (await isEmptyAccount(req.user.id))) {
      await pool.query('DELETE FROM users WHERE id = ?', [req.user.id]);
    }
    setIdentityCookie(res, target.token);
    pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [target.id]).catch(() => {});
    res.json(toUser(target));
  });

  /**
   * Emails a one-time sign-in link (no password needed). The answer is the same whether the address
   * has an account or not, so that it cannot be used to find out who uses the site.
   */
  r.post('/auth/email-link', async (req, res) => {
    if (!mailEnabled()) throw new HttpError(503, 'mailDisabled');
    const email = cleanText(req.body?.email, 255).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'invalidEmail');
    if (overLimit(`ip:${req.ip}`, 10) || overLimit(`email:${email}`, 3)) {
      throw new HttpError(429, 'tooManyRequests');
    }

    const user = await findUserByEmail(email);
    if (user) {
      const { token } = await createLinkToken(user.id, EMAIL_LINK_MINUTES);
      const base = siteBase(req);
      const back = safeReturnPath(req.body?.retour);
      const url = `${base}/lier/${token}${back ? `?retour=${encodeURIComponent(back)}` : ''}`;
      try {
        // In the language of the person asking (they are on the site right now).
        const mail = signInMail({
          t: req.t, name: user.name, url, minutes: EMAIL_LINK_MINUTES, logoUrl: staticAssetUrl(base, '/logo-disponibilites.png'),
        });
        await sendMail({ to: email, ...mail });
      } catch (err) {
        // Not shown to the visitor (same answer for every address), but logged for the administrator.
        console.error('[mail] lien de connexion', err.message);
      }
    }
    res.json({ ok: true, minutes: EMAIL_LINK_MINUTES });
  });

  /** Forgets the account on this device only (the account and its other devices are untouched). */
  r.post('/auth/logout', (req, res) => {
    clearIdentityCookie(res);
    res.json({ ok: true });
  });

  /** Chooses or changes my password (the current one is required to change it). */
  r.put('/me/password', async (req, res) => {
    if (!req.user.email) throw new HttpError(400, 'emailFirst');
    const password = parsePassword(req.body?.password);
    if (req.user.hasPassword) {
      const [[row]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      if (!(await verifyPassword(String(req.body?.currentPassword ?? ''), row.password_hash))) {
        throw new HttpError(403, 'wrongCurrentPassword');
      }
    }
    await assertLoginEmailFree(req.user.email, req.user.id);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(password), req.user.id]);
    res.json({ ...req.user, hasPassword: true });
  });

  return r;
}
