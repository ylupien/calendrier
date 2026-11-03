import crypto from 'node:crypto';
import { parseCookie } from 'cookie';
import { pool } from './db.js';
import { explicitLang } from './i18n.js';

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

/** Fields of req.user (and of the socket's user). */
export const USER_COLUMNS =
  'id, name, email, locale, password_hash IS NOT NULL AS has_password, is_site_admin, activated_at IS NOT NULL AS is_active';

export const toUser = (row) =>
  row && {
    id: row.id,
    name: row.name,
    email: row.email,
    hasPassword: !!row.has_password,
    isSiteAdmin: !!row.is_site_admin,
    active: !!row.is_active,
    locale: row.locale ?? null,
  };

export async function findUserByToken(token) {
  if (!token || !TOKEN_RE.test(token)) return null;
  const [rows] = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE token = ?`, [token]);
  return toUser(rows[0]) || null;
}

/** Site administrators pass every organization and occasion permission check. */
export async function isSiteAdmin(userId) {
  const [rows] = await pool.query('SELECT 1 FROM users WHERE id = ? AND is_site_admin = 1', [userId]);
  return rows.length > 0;
}

// ---- Passwords (scrypt, salted; stored as "scrypt$<salt>$<hash>", hex) ----

const SCRYPT_KEYLEN = 64;
export const PASSWORD_MIN = 8;
const scrypt = (password, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => (err ? reject(err) : resolve(key))),
  );

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${(await scrypt(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(password, Buffer.from(salt, 'hex'));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * Express middleware: identifies the visitor by cookie. A visitor without a cookie stays
 * anonymous (req.user = null): accounts are only created by an invitation (see createVisitor).
 */
export async function identify(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const user = await findUserByToken(token);
  if (user) {
    if (user.active) {
      pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [user.id]).catch(() => {});
    } else {
      // First use of an account prepared by an invitation (or by the administrator).
      await pool.query('UPDATE users SET last_seen_at = NOW(), activated_at = NOW() WHERE id = ?', [user.id]);
      user.active = true;
      Promise.resolve(onActivated(user)).catch((err) => console.error('[auth] activation', err));
    }
    // Language chosen in the application, kept for the emails sent to this person.
    const lang = explicitLang(req);
    if (lang && lang !== user.locale) {
      user.locale = lang;
      pool.query('UPDATE users SET locale = ? WHERE id = ?', [lang, user.id]).catch(() => {});
    }
    res.cookie(COOKIE_NAME, token, cookieOptions());
  }
  req.user = user;
  next();
}

// Called once, when an account is used for the first time (index.js shows it as a member of its occasions).
let onActivated = () => {};
export function setActivationListener(fn) {
  onActivated = fn;
}

/** Creates the visitor and its permanent cookie (opening an occasion's invitation link). */
export async function createVisitor(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const locale = explicitLang(req);
  const [result] = await pool.query('INSERT INTO users (token, locale, activated_at) VALUES (?, ?, NOW())', [token, locale]);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  req.user = { id: result.insertId, name: null, email: null, hasPassword: false, isSiteAdmin: false, active: true, locale };
  return req.user;
}

/** An account prepared for someone who has not used the site yet (invitation by email, in `locale`). */
export async function createPreparedUser(conn, { name, email, locale = null }) {
  const token = crypto.randomBytes(32).toString('hex');
  const [result] = await conn.query('INSERT INTO users (token, name, email, locale) VALUES (?, ?, ?, ?)', [
    token, name, email, locale,
  ]);
  return result.insertId;
}

// Routes reachable without a cookie: everything else needs an invitation first.
const OPEN_ROUTES = [
  ['GET', /^\/me\/?$/],
  ['GET', /^\/occasions\/[\w-]+\/?$/], // invitation link: creates the visitor
  ['GET', /^\/link\/preview\/[\w-]+\/?$/], // phone linking to an existing account
  ['POST', /^\/link\/claim\/?$/],
  ['POST', /^\/auth\/login\/?$/], // email + password: back to an existing account
  ['POST', /^\/auth\/email-link\/?$/], // sign-in link by email
  ['GET', /^\/organizations\/\d+\/logo\/?$/],
  ['GET', /^\/logos\/\d+\/?$/], // organization logos (public)
];

/** Express middleware: refuses anonymous visitors outside the open routes. */
export function requireUser(req, res, next) {
  if (req.user || OPEN_ROUTES.some(([m, re]) => m === req.method && re.test(req.path))) return next();
  res.status(401).json({ error: req.t('errors.inviteOnly') });
}

/** Removes the identification cookie (sign out on this device). */
export function clearIdentityCookie(res) {
  const { expires: _expires, ...options } = cookieOptions();
  res.clearCookie(COOKIE_NAME, options);
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
