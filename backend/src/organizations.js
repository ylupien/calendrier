import express, { Router } from 'express';
import { pool } from './db.js';
import { HttpError, cleanText } from './http.js';
import { isSiteAdmin } from './auth.js';
import { orgRoom, SITE_ADMINS_ROOM } from './socket.js';

const MODES = new Set(['free', 'restricted']);
const MAX_GENERIC_LOGOS = 30; // logos made in the gallery, per organization
const NAME_RE = /^[a-z0-9-]{1,40}$/; // ids of the gallery's emblems and fonts
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

/** Address of a logo (public, cached for good: the version changes with the image); variant 'dark': on dark. */
export const logoUrl = (id, version, variant = null) => `/api/logos/${id}?v=${version}${variant ? `&variant=${variant}` : ''}`;
const BACKGROUNDS = new Set(['theme', 'light', 'dark']);

/** SQL columns of the logo shown, from `LEFT JOIN logos <alias> ON <alias>.id = <organization>.logo_id`. */
export const shownLogoColumns = (alias, prefix = '') =>
  `${alias}.id AS ${prefix}logo_id, ${alias}.version AS ${prefix}logo_version, ` +
  `${alias}.background AS ${prefix}logo_background, ${alias}.data_dark IS NOT NULL AS ${prefix}logo_has_dark, ` +
  `${alias}.kind AS ${prefix}logo_kind`;

/**
 * { logoUrl, logoDarkUrl, logoBackground } of the logo shown (columns of shownLogoColumns).
 * logoDarkUrl: image for a dark background, when the logo has one (gallery logo following the theme).
 */
export function shownLogo(row, prefix = '') {
  const id = row[`${prefix}logo_id`];
  if (!id) return { logoUrl: null, logoDarkUrl: null, logoBackground: 'theme' };
  const version = row[`${prefix}logo_version`];
  return {
    logoUrl: logoUrl(id, version),
    logoDarkUrl: Number(row[`${prefix}logo_has_dark`]) ? logoUrl(id, version, 'dark') : null,
    logoBackground: row[`${prefix}logo_background`],
  };
}

/** Public info shown wherever an occasion of the organization appears. */
export const orgBranding = (row) =>
  row.organization_id ? { id: row.organization_id, name: row.org_name, ...shownLogo(row, 'org_') } : null;

/** SQL columns for orgBranding(), with ORG_BRANDING_JOIN (occasions are `o`). */
export const ORG_BRANDING_COLUMNS = `g.name AS org_name, ${shownLogoColumns('gl', 'org_')}`;
export const ORG_BRANDING_JOIN =
  'LEFT JOIN organizations g ON g.id = o.organization_id LEFT JOIN logos gl ON gl.id = g.logo_id';

/**
 * Who may create occasions in an organization:
 * the owner always; in "free" mode every member; in "restricted" mode only checked members.
 */
const canCreate = (org, member, userId) =>
  !!org.site_admin ||
  (!!member && (org.owner_id === userId || !!member.is_admin || org.mode === 'free' || !!member.can_create));

/** Owner and administrators manage the organization (members, rights, logo, mode); so does a site administrator. */
const isManager = (org, userId) => org.owner_id === userId || !!org.is_admin || !!org.site_admin;

export async function canCreateIn(organizationId, userId) {
  const [rows] = await pool.query(
    `SELECT o.owner_id, o.mode, m.can_create, m.is_admin, m.user_id AS member
     FROM organizations o
     ${ORG_LOGO_JOIN}
     LEFT JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ? AND m.removed_at IS NULL
     WHERE o.id = ?`,
    [userId, organizationId],
  );
  if (!rows.length) return false;
  return canCreate(rows[0], rows[0].member ? rows[0] : null, userId) || (await isSiteAdmin(userId));
}

export async function isOrgAdmin(organizationId, userId) {
  const [rows] = await pool.query(
    `SELECT 1 FROM organizations o
     LEFT JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ? AND m.removed_at IS NULL
     WHERE o.id = ? AND (o.owner_id = ? OR m.is_admin = 1)`,
    [userId, organizationId, userId],
  );
  return rows.length > 0 || (await isSiteAdmin(userId));
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
    `SELECT u.id, u.name, u.email, u.activated_at IS NOT NULL AS active FROM organization_members m
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
    ...shownLogo(o),
    logoMode: o.logo_kind ?? null, // kind of the logo shown: 'custom', 'generic' or none
    ownerId: o.owner_id,
    isOwner: o.owner_id === userId,
    isAdmin: isManager(o, userId),
    canCreate: canCreate(o, o, userId),
    memberCount: o.member_count !== undefined ? Number(o.member_count) : undefined,
  };
}

const ORG_COLUMNS = `o.id, o.name, o.mode, o.owner_id, ${shownLogoColumns('ol')}`;
const ORG_LOGO_JOIN = 'LEFT JOIN logos ol ON ol.id = o.logo_id';

/**
 * Logos of the organization, for its editor: the custom file and the logos made in the gallery (most recent
 * first), each with its choices; shownLogoId: the one shown.
 */
async function logosOf(org) {
  const [rows] = await pool.query(
    `SELECT l.id, l.kind, l.version, l.background, l.data_dark IS NOT NULL AS has_dark, l.emblem, l.font, l.caption,
       l.id = o.logo_id AS shown
     FROM logos l JOIN organizations o ON o.id = l.organization_id
     WHERE l.organization_id = ? ORDER BY l.created_at DESC, l.id DESC`,
    [org.id],
  );
  const custom = rows.find((l) => l.kind === 'custom');
  return {
    shownLogoId: rows.find((l) => Number(l.shown))?.id ?? null,
    customLogoId: custom?.id ?? null,
    customLogoUrl: custom ? logoUrl(custom.id, custom.version) : null,
    customLogoBackground: custom?.background ?? 'theme',
    genericLogos: rows
      .filter((l) => l.kind === 'generic')
      .map((l) => ({
        id: l.id,
        url: logoUrl(l.id, l.version),
        darkUrl: Number(l.has_dark) ? logoUrl(l.id, l.version, 'dark') : null,
        background: l.background,
        emblem: l.emblem,
        font: l.font,
        caption: l.caption ?? org.name,
      })),
  };
}

/** Shows this logo of the organization (null: none). */
const showLogo = (orgId, logoId) => pool.query('UPDATE organizations SET logo_id = ? WHERE id = ?', [logoId, orgId]);

/** After a logo is removed: when none is shown any more, shows the custom file, otherwise the latest made. */
async function showAnotherLogo(orgId) {
  await pool.query(
    `UPDATE organizations SET logo_id = (
       SELECT id FROM logos WHERE organization_id = ? ORDER BY kind = 'custom' DESC, created_at DESC, id DESC LIMIT 1)
     WHERE id = ? AND logo_id IS NULL`,
    [orgId, orgId],
  );
}

/** Choices of a gallery logo: ?emblem=<id>&font=<id>&caption=<text>&background=theme|light|dark. */
function parseLogoChoices(query, org) {
  const emblem = String(query.emblem ?? '');
  const font = String(query.font ?? '');
  const caption = cleanText(query.caption, 150) || org.name;
  const background = String(query.background ?? 'theme');
  if (!NAME_RE.test(emblem) || !NAME_RE.test(font) || !BACKGROUNDS.has(background)) {
    throw new HttpError(400, 'invalidLogoChoice');
  }
  return { emblem, font, caption, background };
}

/** A logo of this organization, or 404. */
async function orgLogo(orgId, logoId) {
  const [[logo]] = await pool.query('SELECT id, kind FROM logos WHERE id = ? AND organization_id = ?', [
    Number(logoId),
    orgId,
  ]);
  if (!logo) throw new HttpError(404, 'noLogo');
  return logo;
}

/** The organization as seen by `user`: a member, or a site administrator (who sees them all). */
async function loadOrgFor(id, user) {
  const [rows] = await pool.query(
    `SELECT ${ORG_COLUMNS}, m.can_create, m.is_admin, m.user_id AS member, ? AS site_admin
     FROM organizations o
     ${ORG_LOGO_JOIN}
     LEFT JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ? AND m.removed_at IS NULL
     WHERE o.id = ?`,
    [user.isSiteAdmin ? 1 : 0, user.id, Number(id)],
  );
  if (!rows.length || (!rows[0].member && !user.isSiteAdmin)) throw new HttpError(404, 'organizationNotFound');
  return rows[0];
}

async function loadManagedOrg(id, user) {
  const org = await loadOrgFor(id, user);
  if (!isManager(org, user.id)) {
    throw new HttpError(403, 'orgManagersOnly');
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

export function createOrganizationRoutes(io) {
  const r = Router();

  /** Organizations the current user belongs to. */
  r.get('/organizations', async (req, res) => {
    // A site administrator sees every organization.
    const [rows] = await pool.query(
      `SELECT ${ORG_COLUMNS}, m.can_create, m.is_admin, ? AS site_admin,
         (SELECT COUNT(*) FROM organization_members m2 JOIN users u ON u.id = m2.user_id
           WHERE m2.organization_id = o.id AND m2.removed_at IS NULL AND u.name IS NOT NULL) AS member_count
       FROM organizations o
       ${ORG_LOGO_JOIN}
       ${req.user.isSiteAdmin ? 'LEFT ' : ''}JOIN organization_members m
         ON m.organization_id = o.id AND m.user_id = ? AND m.removed_at IS NULL
       ORDER BY o.name`,
      [req.user.isSiteAdmin ? 1 : 0, req.user.id],
    );
    res.json(rows.map((o) => serializeOrg(o, req.user.id)));
  });

  r.post('/organizations', async (req, res) => {
    if (!req.user.name) throw new HttpError(400, 'profileBeforeOrg');
    const name = cleanText(req.body?.name, 150);
    const mode = MODES.has(req.body?.mode) ? req.body.mode : 'free';
    if (!name) throw new HttpError(400, 'nameRequired');

    const [result] = await pool.query('INSERT INTO organizations (name, mode, owner_id) VALUES (?, ?, ?)', [
      name,
      mode,
      req.user.id,
    ]);
    await pool.query('INSERT INTO organization_members (organization_id, user_id, can_create) VALUES (?, ?, 1)', [
      result.insertId,
      req.user.id,
    ]);
    res.status(201).json(serializeOrg(await loadOrgFor(result.insertId, req.user), req.user.id));
  });

  /** Organization details; the member list is only visible to the owner and administrators (editor). */
  r.get('/organizations/:id', async (req, res) => {
    const org = await loadOrgFor(req.params.id, req.user);
    const manager = isManager(org, req.user.id);
    res.json({
      ...serializeOrg(org, req.user.id),
      ...(manager ? await logosOf(org) : {}),
      members: manager ? await members(org.id) : undefined,
    });
  });

  /** Tells everyone who sees the organization (see orgRoom) its new name and logo. */
  const broadcastOrg = (org) =>
    io.to([orgRoom(org.id), SITE_ADMINS_ROOM]).emit('organization:updated', {
      id: org.id,
      name: org.name,
      mode: org.mode,
      ...shownLogo(org),
    });

  /** The organization for its editor, after a change (with its logos); the change is shown to everyone. */
  const editorView = async (orgId, user) => {
    const org = await loadOrgFor(orgId, user);
    broadcastOrg(org);
    return { ...serializeOrg(org, user.id), ...(await logosOf(org)) };
  };

  r.patch('/organizations/:id', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user);
    const name = req.body?.name !== undefined ? cleanText(req.body.name, 150) : org.name;
    const mode = req.body?.mode !== undefined ? req.body.mode : org.mode;
    if (!name) throw new HttpError(400, 'nameRequired');
    if (!MODES.has(mode)) throw new HttpError(400, 'invalidMode');
    await pool.query('UPDATE organizations SET name = ?, mode = ? WHERE id = ?', [name, mode, org.id]);

    // Background of the custom logo (the gallery logo has its own, chosen when it is made).
    if (req.body?.logoBackground !== undefined) {
      if (!BACKGROUNDS.has(req.body.logoBackground)) throw new HttpError(400, 'invalidLogoChoice');
      await pool.query(
        `UPDATE logos SET background = ?, version = version + 1
         WHERE organization_id = ? AND kind = 'custom' AND background <> ?`,
        [req.body.logoBackground, org.id, req.body.logoBackground],
      );
    }
    // Logo shown: one of the organization's logos (its custom file or one made in the gallery).
    if (req.body?.logoId !== undefined) {
      await showLogo(org.id, (await orgLogo(org.id, req.body.logoId)).id);
    }
    res.json(await editorView(org.id, req.user));
  });

  r.delete('/organizations/:id', async (req, res) => {
    const org = await loadOrgFor(req.params.id, req.user);
    if (org.owner_id !== req.user.id && !req.user.isSiteAdmin) {
      throw new HttpError(403, 'ownerOnlyDelete');
    }
    // Occasions are kept; they simply lose their organization (FK ON DELETE SET NULL).
    await pool.query('DELETE FROM organizations WHERE id = ?', [org.id]);
    io.to([orgRoom(org.id), SITE_ADMINS_ROOM]).emit('organization:deleted', { id: org.id });
    res.json({ ok: true });
  });

  /** Manager edits a member's rights: { canCreate?, isAdmin? }. */
  r.put('/organizations/:id/members/:userId', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user);
    const userId = Number(req.params.userId);
    if (userId === org.owner_id) throw new HttpError(400, 'ownerRightsLocked');
    const sets = [];
    const params = [];
    if (req.body?.canCreate !== undefined) sets.push('can_create = ?') && params.push(req.body.canCreate ? 1 : 0);
    if (req.body?.isAdmin !== undefined) sets.push('is_admin = ?') && params.push(req.body.isAdmin ? 1 : 0);
    if (!sets.length) throw new HttpError(400, 'nothingToChange');
    const [result] = await pool.query(
      `UPDATE organization_members SET ${sets.join(', ')} WHERE organization_id = ? AND user_id = ? AND removed_at IS NULL`,
      [...params, org.id, userId],
    );
    if (!result.affectedRows) throw new HttpError(404, 'memberNotFound');
    res.json(await members(org.id));
  });

  /**
   * Owner removes a member: no more access to the organization, its "all members" occasions
   * or the right to create. Opening a link later does not re-add them (see joinOrganization).
   */
  r.delete('/organizations/:id/members/:userId', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user);
    const userId = Number(req.params.userId);
    if (userId === org.owner_id) throw new HttpError(400, 'ownerNotRemovable');
    const [result] = await pool.query(
      'UPDATE organization_members SET removed_at = NOW(), can_create = 0, is_admin = 0 WHERE organization_id = ? AND user_id = ? AND removed_at IS NULL',
      [org.id, userId],
    );
    if (!result.affectedRows) throw new HttpError(404, 'memberNotFound');
    res.json(await members(org.id));
  });

  r.post('/organizations/:id/members/:userId/restore', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user);
    const [result] = await pool.query(
      'UPDATE organization_members SET removed_at = NULL WHERE organization_id = ? AND user_id = ? AND removed_at IS NOT NULL',
      [org.id, Number(req.params.userId)],
    );
    if (!result.affectedRows) throw new HttpError(404, 'memberNotFound');
    res.json(await members(org.id));
  });

  r.put(
    '/organizations/:id/logo',
    express.raw({ type: LOGO_TYPES, limit: '2mb' }),
    async (req, res) => {
      const org = await loadManagedOrg(req.params.id, req.user);
      const mime = String(req.headers['content-type'] || '').split(';')[0].trim();
      if (!LOGO_TYPES.includes(mime) || !Buffer.isBuffer(req.body) || !req.body.length) {
        throw new HttpError(415, 'badImageFormat');
      }
      if (!looksLikeImage(req.body, mime)) throw new HttpError(415, 'invalidImage');
      // A new custom file is shown right away (the gallery logos are kept); its background setting stays.
      const [[custom]] = await pool.query("SELECT id FROM logos WHERE organization_id = ? AND kind = 'custom'", [org.id]);
      let logoId = custom?.id;
      if (logoId) {
        await pool.query('UPDATE logos SET mime = ?, data = ?, version = version + 1 WHERE id = ?', [mime, req.body, logoId]);
      } else {
        const [result] = await pool.query("INSERT INTO logos (organization_id, kind, mime, data) VALUES (?, 'custom', ?, ?)", [
          org.id,
          mime,
          req.body,
        ]);
        logoId = result.insertId;
      }
      await showLogo(org.id, logoId);
      res.json(await editorView(org.id, req.user));
    },
  );

  /** Removes the custom file; another logo, if there is one, is then shown. */
  r.delete('/organizations/:id/logo', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user);
    await pool.query("DELETE FROM logos WHERE organization_id = ? AND kind = 'custom'", [org.id]);
    await showAnotherLogo(org.id);
    res.json(await editorView(org.id, req.user));
  });

  /**
   * Makes a new gallery logo (PNG composed by the browser) and shows it; the other logos are kept.
   * ?emblem=<id>&font=<id>&caption=<text>&background=theme|light|dark: the choices made.
   * With 'theme', its image for a dark background follows (PUT …/logos/:logoId/dark). Answer: createdLogoId.
   */
  r.post(
    '/organizations/:id/generic-logos',
    express.raw({ type: 'image/png', limit: '2mb' }),
    async (req, res) => {
      const org = await loadManagedOrg(req.params.id, req.user);
      const { emblem, font, caption, background } = parseLogoChoices(req.query, org);
      if (!Buffer.isBuffer(req.body) || !req.body.length || !looksLikeImage(req.body, 'image/png')) {
        throw new HttpError(415, 'invalidImage');
      }
      const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM logos WHERE organization_id = ? AND kind = 'generic'", [org.id]);
      if (Number(n) >= MAX_GENERIC_LOGOS) throw new HttpError(400, 'tooManyLogos', { max: MAX_GENERIC_LOGOS });
      const [result] = await pool.query(
        `INSERT INTO logos (organization_id, kind, mime, data, background, emblem, font, caption)
         VALUES (?, 'generic', 'image/png', ?, ?, ?, ?, ?)`,
        [org.id, req.body, background, emblem, font, caption],
      );
      await showLogo(org.id, result.insertId);
      res.status(201).json({ ...(await editorView(org.id, req.user)), createdLogoId: result.insertId });
    },
  );

  /**
   * Edits a gallery logo: new image and choices (same parameters as its creation); it stays shown or not.
   * With 'theme', its image for a dark background follows (PUT …/logos/:logoId/dark).
   */
  r.put(
    '/organizations/:id/logos/:logoId',
    express.raw({ type: 'image/png', limit: '2mb' }),
    async (req, res) => {
      const org = await loadManagedOrg(req.params.id, req.user);
      const logo = await orgLogo(org.id, req.params.logoId);
      if (logo.kind !== 'generic') throw new HttpError(400, 'invalidLogoChoice');
      const { emblem, font, caption, background } = parseLogoChoices(req.query, org);
      if (!Buffer.isBuffer(req.body) || !req.body.length || !looksLikeImage(req.body, 'image/png')) {
        throw new HttpError(415, 'invalidImage');
      }
      await pool.query(
        `UPDATE logos SET data = ?, data_dark = NULL, background = ?, emblem = ?, font = ?, caption = ?,
           version = version + 1 WHERE id = ?`,
        [req.body, background, emblem, font, caption, logo.id],
      );
      res.json(await editorView(org.id, req.user));
    },
  );

  /** Image of a gallery logo for a dark background (logo following the theme). */
  r.put(
    '/organizations/:id/logos/:logoId/dark',
    express.raw({ type: 'image/png', limit: '2mb' }),
    async (req, res) => {
      const org = await loadManagedOrg(req.params.id, req.user);
      const logo = await orgLogo(org.id, req.params.logoId);
      if (logo.kind !== 'generic') throw new HttpError(400, 'invalidLogoChoice');
      if (!Buffer.isBuffer(req.body) || !req.body.length || !looksLikeImage(req.body, 'image/png')) {
        throw new HttpError(415, 'invalidImage');
      }
      await pool.query('UPDATE logos SET data_dark = ?, version = version + 1 WHERE id = ?', [req.body, logo.id]);
      res.json(await editorView(org.id, req.user));
    },
  );

  /** Removes one of the organization's logos; when it was shown, another one is then shown. */
  r.delete('/organizations/:id/logos/:logoId', async (req, res) => {
    const org = await loadManagedOrg(req.params.id, req.user);
    const logo = await orgLogo(org.id, req.params.logoId);
    await pool.query('DELETE FROM logos WHERE id = ?', [logo.id]);
    await showAnotherLogo(org.id);
    res.json(await editorView(org.id, req.user));
  });

  /** Logos are public: they appear on every occasion of the organization. Addresses are versioned (?v=). */
  r.get('/logos/:id', async (req, res) => {
    const [[logo]] = await pool.query(
      // ?variant=dark: the image for a dark background, when there is one.
      `SELECT mime, ${req.query.variant === 'dark' ? 'COALESCE(data_dark, data)' : 'data'} AS data FROM logos WHERE id = ?`,
      [Number(req.params.id)],
    );
    sendLogo(res, logo);
  });

  /** Former address (pages opened before the logos table): the logo shown. */
  r.get('/organizations/:id/logo', async (req, res) => {
    const [[logo]] = await pool.query(
      'SELECT l.mime, l.data FROM organizations o JOIN logos l ON l.id = o.logo_id WHERE o.id = ?',
      [Number(req.params.id)],
    );
    sendLogo(res, logo);
  });

  return r;
}

function sendLogo(res, logo) {
  if (!logo) throw new HttpError(404, 'noLogo');
  res.set({
    'Content-Type': logo.mime,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    // An SVG opened directly must not be able to run scripts.
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  res.send(logo.data);
}
