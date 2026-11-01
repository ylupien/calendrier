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

/**
 * Express middleware: identifies the visitor by cookie. A visitor without a cookie stays
 * anonymous (req.user = null): accounts are only created by an invitation (see createVisitor).
 */
export async function identify(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const user = await findUserByToken(token);
  if (user) {
    pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [user.id]).catch(() => {});
    res.cookie(COOKIE_NAME, token, cookieOptions());
  }
  req.user = user;
  next();
}

/** Creates the visitor and its permanent cookie (opening an occasion's invitation link). */
export async function createVisitor(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const [result] = await pool.query('INSERT INTO users (token) VALUES (?)', [token]);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  req.user = { id: result.insertId, name: null, email: null };
  return req.user;
}

// Routes reachable without a cookie: everything else needs an invitation first.
const OPEN_ROUTES = [
  ['GET', /^\/me\/?$/],
  ['GET', /^\/occasions\/[\w-]+\/?$/], // invitation link: creates the visitor
  ['GET', /^\/link\/preview\/[\w-]+\/?$/], // phone linking to an existing account
  ['POST', /^\/link\/claim\/?$/],
  ['GET', /^\/organizations\/\d+\/logo\/?$/],
];

/** Express middleware: refuses anonymous visitors outside the open routes. */
export function requireUser(req, res, next) {
  if (req.user || OPEN_ROUTES.some(([m, re]) => m === req.method && re.test(req.path))) return next();
  res.status(401).json({ error: "Accès sur invitation : ouvrez le lien d'une occasion qu'on vous a partagé." });
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
