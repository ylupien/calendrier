import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from './db.js';
import { HttpError, cleanText } from './http.js';
import { hashPassword } from './auth.js';
import { EMAIL_RE, assertLoginEmailFree, parsePassword } from './account.js';
import { joinOrganization, logoUrl } from './organizations.js';
import { mergeUsers, createLinkToken } from './link.js';
import { roomOf } from './socket.js';

// A sign-in link made by the administrator stays valid one week (a QR code: 10 minutes).
const SIGN_IN_LINK_MINUTES = 7 * 24 * 60;

const userPayload = (u) => ({ id: u.id, name: u.name, email: u.email });

function parseId(value, what = 'Identifiant') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `${what} invalide.`);
  return id;
}

const parseIds = (list) => [...new Set((Array.isArray(list) ? list : []).map(Number))].filter((n) => Number.isInteger(n) && n > 0);

async function loadUser(id) {
  const [rows] = await pool.query(
    `SELECT id, name, email, password_hash IS NOT NULL AS has_password, is_site_admin, created_at, last_seen_at
     FROM users WHERE id = ?`,
    [id],
  );
  if (!rows.length) throw new HttpError(404, 'Compte introuvable.');
  return rows[0];
}

/** Accounts and what they hold. */
async function listUsers(where = '1 = 1', params = []) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.password_hash IS NOT NULL AS has_password, u.is_site_admin,
       u.created_at, u.last_seen_at,
       (SELECT COUNT(*) FROM availabilities a WHERE a.user_id = u.id) AS slot_count,
       (SELECT COUNT(*) FROM participants p WHERE p.user_id = u.id AND p.removed_at IS NULL) AS occasion_count,
       (SELECT COUNT(*) FROM organization_members m WHERE m.user_id = u.id AND m.removed_at IS NULL) AS organization_count,
       (SELECT COUNT(*) FROM occasions o WHERE o.creator_id = u.id)
         + (SELECT COUNT(*) FROM organizations g WHERE g.owner_id = u.id) AS owned_count
     FROM users u WHERE ${where}
     ORDER BY u.name IS NULL, u.name, u.id`,
    params,
  );
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    hasPassword: !!u.has_password,
    isSiteAdmin: !!u.is_site_admin,
    createdAt: u.created_at,
    lastSeenAt: u.last_seen_at,
    slotCount: Number(u.slot_count),
    occasionCount: Number(u.occasion_count),
    organizationCount: Number(u.organization_count),
    ownedCount: Number(u.owned_count),
  }));
}

async function userDetail(id) {
  const [user] = await listUsers('u.id = ?', [id]);
  if (!user) throw new HttpError(404, 'Compte introuvable.');
  const [organizations] = await pool.query(
    `SELECT g.id, g.name, g.owner_id = m.user_id AS is_owner, m.is_admin, m.removed_at
     FROM organization_members m JOIN organizations g ON g.id = m.organization_id
     WHERE m.user_id = ? ORDER BY g.name`,
    [id],
  );
  const [occasions] = await pool.query(
    `SELECT o.id, o.slug, o.title, o.creator_id = p.user_id AS is_creator, p.removed_at,
       (SELECT MIN(d.day) FROM occasion_days d WHERE d.occasion_id = o.id) AS first_day,
       (SELECT COUNT(*) FROM availabilities a WHERE a.occasion_id = o.id AND a.user_id = p.user_id) AS slot_count
     FROM participants p JOIN occasions o ON o.id = p.occasion_id
     WHERE p.user_id = ? ORDER BY first_day DESC, o.id DESC`,
    [id],
  );
  return {
    ...user,
    organizations: organizations.map((g) => ({
      id: g.id,
      name: g.name,
      isOwner: !!g.is_owner,
      isAdmin: !!g.is_admin,
      removed: !!g.removed_at,
    })),
    occasions: occasions.map((o) => ({
      id: o.id,
      slug: o.slug,
      title: o.title,
      firstDay: o.first_day,
      isCreator: !!o.is_creator,
      removed: !!o.removed_at,
      slotCount: Number(o.slot_count),
    })),
  };
}

/** Name, email and password checks shared by account creation and edition. */
async function parseIdentity(body, current = null) {
  const name = body?.name !== undefined ? cleanText(body.name, 100) : current?.name;
  const email = body?.email !== undefined ? cleanText(body.email, 255).toLowerCase() || null : current?.email ?? null;
  // password: a string sets it, null removes it, undefined keeps it.
  const password = body?.password === null || body?.password === undefined ? body?.password : parsePassword(body.password);
  if (!name) throw new HttpError(400, 'Le nom est requis.');
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Courriel invalide.');
  const willHavePassword = password === undefined ? !!current?.has_password : password !== null;
  if (willHavePassword) {
    if (!email) throw new HttpError(400, 'Un courriel est requis pour se connecter avec un mot de passe.');
    await assertLoginEmailFree(email, current?.id ?? 0);
  }
  return { name, email, password };
}

export function createAdminRoutes(io) {
  const r = Router();

  r.use((req, _res, next) => {
    if (!req.user?.isSiteAdmin) throw new HttpError(403, 'Réservé à l’administrateur du site.');
    next();
  });

  /** Shows the account in the occasions it belongs to (new name, new guest). */
  async function broadcastUser(userId) {
    const [[u]] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [userId]);
    if (!u?.name) return;
    const [occ] = await pool.query(
      `SELECT o.slug FROM participants p JOIN occasions o ON o.id = p.occasion_id
       WHERE p.user_id = ? AND p.removed_at IS NULL`,
      [userId],
    );
    for (const { slug } of occ) io.to(roomOf(slug)).emit('participant:upsert', userPayload(u));
  }

  /** Member of the organization again (or for the first time), with its "all members" occasions. */
  async function addToOrganization(userId, organizationId) {
    const [[org]] = await pool.query('SELECT id FROM organizations WHERE id = ?', [organizationId]);
    if (!org) throw new HttpError(404, 'Organisation introuvable.');
    await pool.query(
      'UPDATE organization_members SET removed_at = NULL WHERE organization_id = ? AND user_id = ?',
      [organizationId, userId],
    );
    await joinOrganization(organizationId, userId);
  }

  /** Guest of the occasion again (or for the first time), and member of its organization. */
  async function addToOccasion(userId, occasionId) {
    const [[o]] = await pool.query('SELECT id, organization_id FROM occasions WHERE id = ?', [occasionId]);
    if (!o) throw new HttpError(404, 'Occasion introuvable.');
    await pool.query(
      `INSERT INTO participants (occasion_id, user_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE removed_at = NULL`,
      [o.id, userId],
    );
    if (o.organization_id) await addToOrganization(userId, o.organization_id);
  }

  // ---- Accounts ----

  r.get('/admin/users', async (_req, res) => {
    res.json(await listUsers());
  });

  r.get('/admin/users/:id', async (req, res) => {
    res.json(await userDetail(parseId(req.params.id)));
  });

  /** New account, already associated with organizations and occasions; optionally with a password. */
  r.post('/admin/users', async (req, res) => {
    const { name, email, password } = await parseIdentity(req.body);
    const token = crypto.randomBytes(32).toString('hex');
    const [result] = await pool.query(
      'INSERT INTO users (token, name, email, password_hash) VALUES (?, ?, ?, ?)',
      [token, name, email, password ? await hashPassword(password) : null],
    );
    const id = result.insertId;
    for (const orgId of parseIds(req.body?.organizationIds)) await addToOrganization(id, orgId);
    for (const occId of parseIds(req.body?.occasionIds)) await addToOccasion(id, occId);
    await broadcastUser(id);
    res.status(201).json(await userDetail(id));
  });

  /** { name?, email?, password? (string: set, null: remove), isSiteAdmin? } */
  r.patch('/admin/users/:id', async (req, res) => {
    const current = await loadUser(parseId(req.params.id));
    const { name, email, password } = await parseIdentity(req.body, current);
    let isAdmin = !!current.is_site_admin;
    if (req.body?.isSiteAdmin !== undefined) {
      if (current.id === req.user.id && !req.body.isSiteAdmin) {
        throw new HttpError(400, 'Vous ne pouvez pas retirer vos propres droits d’administrateur.');
      }
      isAdmin = !!req.body.isSiteAdmin;
    }
    const sets = ['name = ?', 'email = ?', 'is_site_admin = ?'];
    const params = [name, email, isAdmin ? 1 : 0];
    if (password !== undefined) {
      sets.push('password_hash = ?');
      params.push(password === null ? null : await hashPassword(password));
    }
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, current.id]);
    await broadcastUser(current.id);
    res.json(await userDetail(current.id));
  });

  /** Sign-in link for this account (one-time, one week): opening it signs the device in. */
  r.post('/admin/users/:id/link', async (req, res) => {
    const user = await loadUser(parseId(req.params.id));
    const { token, ttlSeconds } = await createLinkToken(user.id, SIGN_IN_LINK_MINUTES);
    res.status(201).json({ path: `/lier/${token}`, ttlSeconds });
  });

  r.post('/admin/users/:id/organizations', async (req, res) => {
    const userId = (await loadUser(parseId(req.params.id))).id;
    await addToOrganization(userId, parseId(req.body?.organizationId, 'Organisation'));
    await broadcastUser(userId);
    res.json(await userDetail(userId));
  });

  r.delete('/admin/users/:id/organizations/:orgId', async (req, res) => {
    const userId = parseId(req.params.id);
    const orgId = parseId(req.params.orgId, 'Organisation');
    const [[org]] = await pool.query('SELECT owner_id FROM organizations WHERE id = ?', [orgId]);
    if (org?.owner_id === userId) throw new HttpError(400, 'Le responsable ne peut pas être retiré de son organisation.');
    await pool.query(
      `UPDATE organization_members SET removed_at = NOW(), can_create = 0, is_admin = 0
       WHERE organization_id = ? AND user_id = ? AND removed_at IS NULL`,
      [orgId, userId],
    );
    res.json(await userDetail(userId));
  });

  r.post('/admin/users/:id/occasions', async (req, res) => {
    const userId = (await loadUser(parseId(req.params.id))).id;
    await addToOccasion(userId, parseId(req.body?.occasionId, 'Occasion'));
    await broadcastUser(userId);
    res.json(await userDetail(userId));
  });

  /** Removes the guest from the occasion, with their availabilities (same as the creator's action). */
  r.delete('/admin/users/:id/occasions/:occasionId', async (req, res) => {
    const userId = parseId(req.params.id);
    const [[o]] = await pool.query('SELECT id, slug, creator_id FROM occasions WHERE id = ?', [
      parseId(req.params.occasionId, 'Occasion'),
    ]);
    if (!o) throw new HttpError(404, 'Occasion introuvable.');
    if (o.creator_id === userId) throw new HttpError(400, "Le créateur de l'occasion ne peut pas être retiré.");
    await pool.query(
      'UPDATE participants SET removed_at = NOW() WHERE occasion_id = ? AND user_id = ? AND removed_at IS NULL',
      [o.id, userId],
    );
    await pool.query('DELETE FROM availabilities WHERE occasion_id = ? AND user_id = ?', [o.id, userId]);
    io.to(roomOf(o.slug)).emit('participant:removed', { userId });
    res.json(await userDetail(userId));
  });

  /**
   * Merges this account into another one (same person, several accounts after lost cookies):
   * everything moves to the target, then this account is deleted. Where both have ranges on the
   * same day of an occasion, the target's ranges are kept.
   */
  r.post('/admin/users/:id/merge', async (req, res) => {
    const from = await loadUser(parseId(req.params.id));
    const into = await loadUser(parseId(req.body?.intoUserId, 'Compte cible'));
    if (from.id === into.id) throw new HttpError(400, 'Choisissez un autre compte.');
    if (from.id === req.user.id) throw new HttpError(400, 'Vous ne pouvez pas fusionner votre propre compte.');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await mergeUsers(conn, from.id, into.id);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    await broadcastUser(into.id);
    res.json(await userDetail(into.id));
  });

  /** Deletes an account that owns nothing (its ranges and memberships go with it). */
  r.delete('/admin/users/:id', async (req, res) => {
    const [user] = await listUsers('u.id = ?', [parseId(req.params.id)]);
    if (!user) throw new HttpError(404, 'Compte introuvable.');
    if (user.id === req.user.id) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte.');
    if (user.ownedCount) {
      throw new HttpError(400, 'Ce compte possède des occasions ou des organisations : transférez-les ou fusionnez le compte.');
    }
    const [occ] = await pool.query(
      `SELECT o.slug FROM participants p JOIN occasions o ON o.id = p.occasion_id
       WHERE p.user_id = ? AND p.removed_at IS NULL`,
      [user.id],
    );
    await pool.query('DELETE FROM users WHERE id = ?', [user.id]);
    for (const { slug } of occ) io.to(roomOf(slug)).emit('participant:removed', { userId: user.id });
    res.json({ ok: true });
  });

  // ---- Organizations and occasions (managed on their own pages, where the administrator has every right) ----

  r.get('/admin/organizations', async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT g.id, g.name, g.mode, g.logo_mime, g.logo_version, g.logo_dark_bg, u.name AS owner_name,
         (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = g.id AND m.removed_at IS NULL) AS member_count,
         (SELECT COUNT(*) FROM occasions o WHERE o.organization_id = g.id) AS occasion_count
       FROM organizations g JOIN users u ON u.id = g.owner_id
       ORDER BY g.name`,
    );
    res.json(
      rows.map((g) => ({
        id: g.id,
        name: g.name,
        mode: g.mode,
        logoUrl: logoUrl(g.id, g.logo_mime, g.logo_version),
        logoDarkBg: !!g.logo_dark_bg,
        ownerName: g.owner_name,
        memberCount: Number(g.member_count),
        occasionCount: Number(g.occasion_count),
      })),
    );
  });

  r.get('/admin/occasions', async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT o.id, o.slug, o.title, o.archived_at, g.name AS org_name, u.name AS creator_name,
         (SELECT MIN(d.day) FROM occasion_days d WHERE d.occasion_id = o.id) AS first_day,
         (SELECT MAX(d.day) FROM occasion_days d WHERE d.occasion_id = o.id) AS last_day,
         (SELECT COUNT(*) FROM participants p JOIN users pu ON pu.id = p.user_id
           WHERE p.occasion_id = o.id AND p.removed_at IS NULL AND pu.name IS NOT NULL) AS guest_count
       FROM occasions o
       JOIN users u ON u.id = o.creator_id
       LEFT JOIN organizations g ON g.id = o.organization_id
       ORDER BY first_day DESC, o.id DESC`,
    );
    res.json(
      rows.map((o) => ({
        id: o.id,
        slug: o.slug,
        title: o.title,
        organizationName: o.org_name,
        creatorName: o.creator_name,
        firstDay: o.first_day,
        lastDay: o.last_day,
        archived: !!o.archived_at,
        guestCount: Number(o.guest_count),
      })),
    );
  });

  /** Deletes an occasion with its days, guests and availabilities; open pages are told right away. */
  r.delete('/admin/occasions/:id', async (req, res) => {
    const [[o]] = await pool.query('SELECT id, slug FROM occasions WHERE id = ?', [parseId(req.params.id, 'Occasion')]);
    if (!o) throw new HttpError(404, 'Occasion introuvable.');
    await pool.query('DELETE FROM occasions WHERE id = ?', [o.id]);
    io.to(roomOf(o.slug)).emit('occasion:deleted', { slug: o.slug });
    res.json({ ok: true });
  });

  return r;
}
