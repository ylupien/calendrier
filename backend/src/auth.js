import crypto from 'node:crypto';
import { parseCookie } from 'cookie';
import { pool } from './db.js';

export const COOKIE_NAME = 'rc_uid';
const TOKEN_RE = /^[a-f0-9]{64}$/;

// Browsers cap cookie lifetime (Chrome: 400 days), so the cookie is re-issued on every
// API call: as long as the user comes back at least once in that window it never expires.
const FAR_FUTURE = new Date('9999-12-31T23:59:59Z');

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: FAR_FUTURE,
    secure: process.env.COOKIE_SECURE === 'true',
  };
}

export async function findUserByToken(token) {
  if (!token || !TOKEN_RE.test(token)) return null;
  const [rows] = await pool.query('SELECT id, name, email FROM users WHERE token = ?', [token]);
  return rows[0] || null;
}

/** Express middleware: identifies the visitor by cookie, creating a user on first visit. */
export async function identify(req, res, next) {
  let token = req.cookies?.[COOKIE_NAME];
  let user = await findUserByToken(token);
  if (!user) {
    token = crypto.randomBytes(32).toString('hex');
    const [result] = await pool.query('INSERT INTO users (token) VALUES (?)', [token]);
    user = { id: result.insertId, name: null, email: null };
  } else {
    pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [user.id]).catch(() => {});
  }
  res.cookie(COOKIE_NAME, token, cookieOptions());
  req.user = user;
  next();
}

/** Replaces the identification cookie of this response (used when linking a device to another user). */
export function setIdentityCookie(res, token) {
  const current = [].concat(res.getHeader('Set-Cookie') || []);
  res.setHeader('Set-Cookie', current.filter((c) => !String(c).startsWith(`${COOKIE_NAME}=`)));
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

/** Resolves the user from a raw Cookie header (used by the socket server). */
export async function userFromCookieHeader(header) {
  if (!header) return null;
  return findUserByToken(parseCookie(header)[COOKIE_NAME]);
}
