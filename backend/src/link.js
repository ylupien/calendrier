import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from './db.js';
import { HttpError } from './http.js';
import { setIdentityCookie } from './auth.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const TTL_MINUTES = 10;
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Valid (unused, not expired) link token → its row with the target user's name. */
async function findValid(token) {
  if (!TOKEN_RE.test(String(token))) return null;
  const [rows] = await pool.query(
    `SELECT t.id, t.user_id, u.name, u.token AS user_token
     FROM link_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > NOW()`,
    [hash(token)],
  );
  return rows[0] || null;
}

/**
 * Moves everything of user `fromId` (the phone's previous identity) to user `toId`, then deletes `fromId`.
 * When both took part in the same occasion, the target's participation and availabilities win.
 */
export async function mergeUsers(conn, fromId, toId) {
  await conn.query(
    `INSERT IGNORE INTO participants (occasion_id, user_id, joined_at, removed_at)
     SELECT occasion_id, ?, joined_at, removed_at FROM participants WHERE user_id = ?`,
    [toId, fromId],
  );
  // Availabilities are moved only for days where the target has none (ranges may not overlap).
  await conn.query(
    `UPDATE availabilities a SET a.user_id = ?
     WHERE a.user_id = ? AND NOT EXISTS (
       SELECT 1 FROM (SELECT occasion_id, day FROM availabilities WHERE user_id = ?) t
       WHERE t.occasion_id = a.occasion_id AND t.day = a.day)`,
    [toId, fromId, toId],
  );
  await conn.query('UPDATE occasions SET creator_id = ? WHERE creator_id = ?', [toId, fromId]);
  await conn.query('UPDATE organizations SET owner_id = ? WHERE owner_id = ?', [toId, fromId]);
  await conn.query(
    `INSERT IGNORE INTO organization_members (organization_id, user_id, can_create, is_admin, joined_at, removed_at)
     SELECT organization_id, ?, can_create, is_admin, joined_at, removed_at FROM organization_members WHERE user_id = ?`,
    [toId, fromId],
  );
  // Keep a name/email if only the phone had one.
  await conn.query(
    `UPDATE users t JOIN users f ON f.id = ?
     SET t.name = COALESCE(t.name, f.name), t.email = COALESCE(t.email, f.email)
     WHERE t.id = ?`,
    [fromId, toId],
  );
  await conn.query('DELETE FROM users WHERE id = ?', [fromId]); // leftovers are removed by cascade
}

/** What the phone's current identity holds, to offer a merge when there is something to keep. */
async function accountSummary(userId) {
  const [[row]] = await pool.query(
    `SELECT u.name, u.email,
       (SELECT COUNT(*) FROM participants p WHERE p.user_id = u.id AND p.removed_at IS NULL) AS occasions,
       (SELECT COUNT(*) FROM availabilities a WHERE a.user_id = u.id) AS slots,
       (SELECT COUNT(*) FROM organization_members m WHERE m.user_id = u.id AND m.removed_at IS NULL) AS organizations
     FROM users u WHERE u.id = ?`,
    [userId],
  );
  const summary = {
    name: row.name,
    email: row.email,
    occasions: Number(row.occasions),
    slots: Number(row.slots),
    organizations: Number(row.organizations),
  };
  return { ...summary, hasData: !!(summary.name || summary.occasions || summary.organizations) };
}

/**
 * One-time token that signs a device in to `userId` (page /lier/<token>).
 * Replaces the user's pending token: only the latest QR code or sign-in link works.
 */
export async function createLinkToken(userId, ttlMinutes = TTL_MINUTES) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM link_tokens WHERE user_id = ? AND used_at IS NULL', [userId]);
  const [result] = await pool.query(
    'INSERT INTO link_tokens (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL ? MINUTE)',
    [hash(token), userId, ttlMinutes],
  );
  return { id: result.insertId, token, ttlSeconds: ttlMinutes * 60 };
}

export function createLinkRoutes() {
  const r = Router();

  /** Creates a one-time token for the QR code (valid 10 minutes). */
  r.post('/link', async (req, res) => {
    res.status(201).json(await createLinkToken(req.user.id));
  });

  /** Lets the computer know when the phone has used its QR code. */
  r.get('/link/:id/status', async (req, res) => {
    const [rows] = await pool.query(
      'SELECT used_at, expires_at > NOW() AS valid FROM link_tokens WHERE id = ? AND user_id = ?',
      [Number(req.params.id), req.user.id],
    );
    // A used token's row stays; a missing row means it was replaced or the user merged.
    if (!rows.length) return res.json({ used: false, expired: true });
    res.json({ used: !!rows[0].used_at, expired: !rows[0].used_at && !rows[0].valid });
  });

  /** Shown on the phone before confirming. */
  r.get('/link/preview/:token', async (req, res) => {
    const t = await findValid(req.params.token);
    if (!t) throw new HttpError(404, 'Ce code QR est expiré ou a déjà été utilisé. Affichez-en un nouveau sur votre ordinateur.');
    const sameUser = t.user_id === req.user?.id;
    res.json({
      name: t.name,
      target: await accountSummary(t.user_id),
      sameUser,
      // The phone's current account; when it holds data the page offers to merge it.
      current: sameUser || !req.user ? null : await accountSummary(req.user.id),
    });
  });

  /**
   * Phone confirms: it becomes the computer's user.
   * merge = true (default): the phone's previous account is merged into it (then deleted).
   * merge = false: the previous account is left untouched, just no longer used on this device.
   */
  r.post('/link/claim', async (req, res) => {
    const t = await findValid(req.body?.token);
    if (!t) throw new HttpError(404, 'Ce code QR est expiré ou a déjà été utilisé. Affichez-en un nouveau sur votre ordinateur.');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [mark] = await conn.query('UPDATE link_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL', [t.id]);
      if (!mark.affectedRows) throw new HttpError(409, 'Ce code QR vient déjà d’être utilisé.');
      if (req.user && req.user.id !== t.user_id && req.body?.merge !== false) await mergeUsers(conn, req.user.id, t.user_id);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    setIdentityCookie(res, t.user_token);
    const [[user]] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [t.user_id]);
    res.json(user);
  });

  return r;
}
