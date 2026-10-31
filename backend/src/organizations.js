import express, { Router } from 'express';
import { pool } from './db.js';
import { HttpError, cleanText } from './http.js';

const MODES = new Set(['free', 'restricted']);
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

export const logoUrl = (id, mime, version) => (mime ? `/api/organizations/${id}/logo?v=${version}` : null);

/** Public info shown wherever an occasion of the organization appears. */
export const orgBranding = (row) =>
  row.organization_id
    ? {
        id: row.organization_id,
        name: row.org_name,
        logoUrl: logoUrl(row.organization_id, row.org_logo_mime, row.org_logo_version),
        logoDarkBg: !!row.org_logo_dark_bg,
      }
    : null;

/** SQL columns for orgBranding(), to use with `LEFT JOIN organizations g ON g.id = o.organization_id`. */
export const ORG_BRANDING_COLUMNS =
  'g.name AS org_name, g.logo_mime AS org_logo_mime, g.logo_version AS org_logo_version, g.logo_dark_bg AS org_logo_dark_bg';

/**
 * Who may create occasions in an organization:
 * the owner always; in "free" mode every member; in "restricted" mode only checked members.
 */
const canCreate = (org, member, userId) =>
  !!member && (org.owner_id === userId || !!member.is_admin || org.mode === 'free' || !!member.can_create);

/** Owner and administrators manage the organization (members, rights, logo, mode). */
const isManager = (org, userId) => org.owner_id === userId || !!org.is_admin;

export async function canCreateIn(organizationId, userId) {
  const [rows] = await pool.query(
    `SELECT o.owner_id, o.mode, m.can_create, m.is_admin, m.user_id AS member
     FROM organizations o
     LEFT JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ? AND m.removed_at IS NULL
     WHERE o.id = ?`,
    [userId, organizationId],
  );
  if (!rows.length) return false;
  return canCreate(rows[0], rows[0].member ? rows[0] : null, userId);
}

export async function isOrgAdmin(organizationId, userId) {
  const [rows] = await pool.query(
    `SELECT 1 FROM organizations o
     LEFT JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ? AND m.removed_at IS NULL
     WHERE o.id = ? AND (o.owner_id = ? OR m.is_admin = 1)`,
    [userId, organizationId, userId],
  );
  return rows.length > 0;
}

export async function isActiveMember(organizationId, userId) {
  const [rows] = await pool.query(
    'SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ? AND removed_at IS NULL',
    [organizationId, userId],
  );
  return rows.length > 0;
}

/**
 * People are associated automatically with the organization of an occasion they open
 * (unless the owner removed them: INSERT IGNORE keeps the removed row as is).
 * A new member is also invited to the organization's "all members" occasions.
 * Returns the slugs of the occasions the user was just added to.
 */
export async function joinOrganization(organizationId, userId) {
  const [ins] = await pool.query('INSERT IGNORE INTO organization_members (organization_id, user_id) VALUES (?, ?)', [
    organizationId,
    userId,
  ]);
  if (!ins.affectedRows) return [];
  const [occ] = await pool.query(
    `SELECT o.id, o.slug FROM occasions o
     LEFT JOIN participants p ON p.occasion_id = o.id AND p.user_id = ?
     WHERE o.organization_id = ? AND o.all_members = 1 AND p.user_id IS NULL`,
    [userId, organizationId],
  );
  if (occ.length) {
    await pool.query('INSERT IGNORE INTO participants (occasion_id, user_id) VALUES ?', [occ.map((o) => [o.id, userId])]);
  }
  return occ.map((o) => o.slug);
}

/** Invites every current member of the organization to an occasion. Returns the users added. */
export async function inviteAllMembers(occasionId, organizationId) {
  const [added] = await pool.query(
    `SELECT u.id, u.name, u.email FROM organization_members m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN participants p ON p.occasion_id = ? AND p.user_id = m.user_id
     WHERE m.organization_id = ? AND m.removed_at IS NULL AND p.user_id IS NULL`,
    [occasionId, organizationId],
  );
  if (added.length) {
    await pool.query('INSERT IGNORE INTO participants (occasion_id, user_id) VALUES ?', [added.map((u) => [occasionId, u.id])]);
  }
  return added;
}

function serializeOrg(o, userId) {
  return {
    id: o.id,
    name: o.name,
    mode: o.mode,
    logoUrl: logoUrl(o.id, o.logo_mime, o.logo_version),
    logoDarkBg: !!o.logo_dark_bg,
    ownerId: o.owner_id,
    isOwner: o.owner_id === userId,
    isAdmin: isManager(o, userId),
    canCreate: canCreate(o, o, userId),
    memberCount: o.member_count !== undefined ? Number(o.member_count) : undefined,
  };
}

const ORG_COLUMNS = 'o.id, o.name, o.mode, o.logo_mime, o.logo_dark_bg, o.logo_version, o.owner_id';

async function loadOrgFor(id, userId) {
  const [rows] = await pool.query(
    `SELECT ${ORG_COLUMNS}, m.can_create, m.is_admin
     FROM organizations o
     JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ? AND m.removed_at IS NULL
     WHERE o.id = ?`,
    [userId, Number(id)],
  );
  if (!rows.length) throw new HttpError(404, 'Organisation introuvable.');
  return rows[0];
}

async function loadManagedOrg(id, userId) {
  const org = await loadOrgFor(id, userId);
  if (!isManager(org, userId)) {
    throw new HttpError(403, "Seuls le responsable et les administrateurs peuvent gérer l'organisation.");
  }
  return org;
}

async function members(orgId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, m.can_create, m.is_admin, m.joined_at, m.removed_at, o.owner_id
     FROM organization_members m
     JOIN users u ON u.id = m.user_id
     JOIN organizations o ON o.id = m.organization_id
     WHERE m.organization_id = ? AND u.name IS NOT NULL
     ORDER BY (u.id = o.owner_id) DESC, u.name`,
    [orgId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    isOwner: r.id === r.owner_id,
    isAdmin: r.id === r.owner_id || !!r.is_admin,
    canCreate: r.id === r.owner_id || !!r.is_admin || !!r.can_create,
    removed: !!r.removed_at,
  }));
}

/** Basic signature check so only real images are stored. */
function looksLikeImage(buf, mime) {
  if (mime === 'image/png') return buf.subarray(0, 4).toString('hex') === '89504e47';
  if (mime === 'image/jpeg') return buf.subarray(0, 3).toString('hex') === 'ffd8ff';
  if (mime === 'image/gif') return buf.subarray(0, 3).toString() === 'GIF';
  if (mime === 'image/webp') return buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  if (mime === 'image/svg+xml') return /<svg[\s>]/i.test(buf.subarray(0, 4096).toString());
  return false;
}

export function createOrganizationRoutes() {
  const r = Router();

  /** Organizations the current user belongs to. */
  r.get('/organizations', async (req, res) => {
    const [rows] = await pool.query(
      `SELECT ${ORG_COLUMNS}, m.can_create, m.is_admin,
         (SELECT COUNT(*) FROM organization_members m2 JOIN users u ON u.id = m2.user_id
           WHERE m2.organization_id = o.id AND m2.removed_at IS NULL AND u.name IS NOT NULL) AS member_count
       FROM organizations o
       JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ? AND m.removed_at IS NULL
       ORDER BY o.name`,
      [req.user.id],
    );
    res.json(rows.map((o) => serializeOrg(o, req.user.id)));
  });

  r.post('/organizations', async (req, res) => {
    if (!req.user.name) throw new HttpError(400, 'Indiquez votre nom et courriel avant de créer une organisation.');
    const name = cleanText(req.body?.name, 150);
    const mode = MODES.has(req.body?.mode) ? req.body.mode : 'free';
    if (!name) throw new HttpError(400, 'Le nom est requis.');

    const [result] = await pool.query('INSERT INTO organizations (name, mode, owner_id) VALUES (?, ?, ?)', [
      name,
      mode,
      req.user.id,
    ]);
    await pool.query('INSERT INTO organization_members (organization_id, user_id, can_create) VALUES (?, ?, 1)', [
      result.insertId,
      req.user.id,
    ]);
    res.status(201).json(serializeOrg(await loadOrgFor(result.insertId, req.user.id), req.user.id));
  });

  /** Organization details; the member list is only visible to the owner and administrators (editor). */
  r.get('/organizations/:id', async (req, res) => {
    const org = await loadOrgFor(req.params.id, req.user.id);
    res.json({
      ...serializeOrg(org, req.user.id),
      members: isManager(org, req.user.id) ? await members(org.id) : undefined,
    });
  });

  r.patch('/organizations/:id', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user.id);
    const name = req.body?.name !== undefined ? cleanText(req.body.name, 150) : org.name;
    const mode = req.body?.mode !== undefined ? req.body.mode : org.mode;
    const darkBg = req.body?.logoDarkBg !== undefined ? !!req.body.logoDarkBg : !!org.logo_dark_bg;
    if (!name) throw new HttpError(400, 'Le nom est requis.');
    if (!MODES.has(mode)) throw new HttpError(400, 'Mode invalide.');

    await pool.query('UPDATE organizations SET name = ?, mode = ?, logo_dark_bg = ? WHERE id = ?', [
      name,
      mode,
      darkBg ? 1 : 0,
      org.id,
    ]);
    res.json(serializeOrg(await loadOrgFor(org.id, req.user.id), req.user.id));
  });

  r.delete('/organizations/:id', async (req, res) => {
    const org = await loadOrgFor(req.params.id, req.user.id);
    if (org.owner_id !== req.user.id) throw new HttpError(403, "Seul le responsable peut supprimer l'organisation.");
    // Occasions are kept; they simply lose their organization (FK ON DELETE SET NULL).
    await pool.query('DELETE FROM organizations WHERE id = ?', [org.id]);
    res.json({ ok: true });
  });

  /** Manager edits a member's rights: { canCreate?, isAdmin? }. */
  r.put('/organizations/:id/members/:userId', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user.id);
    const userId = Number(req.params.userId);
    if (userId === org.owner_id) throw new HttpError(400, 'Les droits du responsable ne peuvent pas être modifiés.');
    const sets = [];
    const params = [];
    if (req.body?.canCreate !== undefined) sets.push('can_create = ?') && params.push(req.body.canCreate ? 1 : 0);
    if (req.body?.isAdmin !== undefined) sets.push('is_admin = ?') && params.push(req.body.isAdmin ? 1 : 0);
    if (!sets.length) throw new HttpError(400, 'Rien à modifier.');
    const [result] = await pool.query(
      `UPDATE organization_members SET ${sets.join(', ')} WHERE organization_id = ? AND user_id = ? AND removed_at IS NULL`,
      [...params, org.id, userId],
    );
    if (!result.affectedRows) throw new HttpError(404, 'Membre introuvable.');
    res.json(await members(org.id));
  });

  /**
   * Owner removes a member: no more access to the organization, its "all members" occasions
   * or the right to create. Opening a link later does not re-add them (see joinOrganization).
   */
  r.delete('/organizations/:id/members/:userId', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user.id);
    const userId = Number(req.params.userId);
    if (userId === org.owner_id) throw new HttpError(400, 'Le responsable ne peut pas être retiré.');
    const [result] = await pool.query(
      'UPDATE organization_members SET removed_at = NOW(), can_create = 0, is_admin = 0 WHERE organization_id = ? AND user_id = ? AND removed_at IS NULL',
      [org.id, userId],
    );
    if (!result.affectedRows) throw new HttpError(404, 'Membre introuvable.');
    res.json(await members(org.id));
  });

  r.post('/organizations/:id/members/:userId/restore', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user.id);
    const [result] = await pool.query(
      'UPDATE organization_members SET removed_at = NULL WHERE organization_id = ? AND user_id = ? AND removed_at IS NOT NULL',
      [org.id, Number(req.params.userId)],
    );
    if (!result.affectedRows) throw new HttpError(404, 'Membre introuvable.');
    res.json(await members(org.id));
  });

  r.put(
    '/organizations/:id/logo',
    express.raw({ type: LOGO_TYPES, limit: '2mb' }),
    async (req, res) => {
      const org = await loadManagedOrg(req.params.id, req.user.id);
      const mime = String(req.headers['content-type'] || '').split(';')[0].trim();
      if (!LOGO_TYPES.includes(mime) || !Buffer.isBuffer(req.body) || !req.body.length) {
        throw new HttpError(415, 'Format accepté : PNG, JPEG, WebP, GIF ou SVG.');
      }
      if (!looksLikeImage(req.body, mime)) throw new HttpError(415, "Le fichier n'est pas une image valide.");
      await pool.query(
        'UPDATE organizations SET logo = ?, logo_mime = ?, logo_version = logo_version + 1 WHERE id = ?',
        [req.body, mime, org.id],
      );
      res.json(serializeOrg(await loadOrgFor(org.id, req.user.id), req.user.id));
    },
  );

  r.delete('/organizations/:id/logo', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user.id);
    await pool.query(
      'UPDATE organizations SET logo = NULL, logo_mime = NULL, logo_version = logo_version + 1 WHERE id = ?',
      [org.id],
    );
    res.json(serializeOrg(await loadOrgFor(org.id, req.user.id), req.user.id));
  });

  /** Logos are public: they appear on every occasion of the organization. URLs are versioned (?v=). */
  r.get('/organizations/:id/logo', async (req, res) => {
    const [rows] = await pool.query('SELECT logo, logo_mime FROM organizations WHERE id = ?', [Number(req.params.id)]);
    if (!rows.length || !rows[0].logo) throw new HttpError(404, 'Aucun logo.');
    res.set({
      'Content-Type': rows[0].logo_mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // An SVG opened directly must not be able to run scripts.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    res.send(rows[0].logo);
  });

  return r;
}
