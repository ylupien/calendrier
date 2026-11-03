import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from './db.js';
import { clock } from './clock.js';
import { roomOf } from './socket.js';
import { HttpError, cleanText } from './http.js';
import { tFor } from './i18n.js';
import { createVisitor, createPreparedUser, isSiteAdmin } from './auth.js';
import { EMAIL_RE, assertLoginEmailFree, findUserByEmail, siteBase } from './account.js';
import { createLinkToken } from './link.js';
import { mailEnabled, sendMail, inviteMail, staticAssetUrl } from './mail.js';
import {
  orgBranding, ORG_BRANDING_COLUMNS, ORG_BRANDING_JOIN, canCreateIn, joinOrganization, inviteAllMembers, isOrgAdmin, isActiveMember,
} from './organizations.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/;

const isValidDate = (s) => {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Days chosen for an occasion: valid dates, deduplicated and sorted, 1 to 366.
 * Past days are refused, except those in `keep` (already part of the occasion when editing it).
 */
function parseDays(list, keep = new Set()) {
  if (!Array.isArray(list)) throw new HttpError(400, 'chooseOneDay');
  const days = [...new Set(list.map(String))].sort();
  if (!days.length) throw new HttpError(400, 'chooseOneDay');
  if (days.length > 366) throw new HttpError(400, 'tooManyDays');
  const { today } = clock();
  for (const d of days) {
    if (!isValidDate(d)) throw new HttpError(400, 'invalidDayValue', { day: d });
    if (d < today && !keep.has(d)) throw new HttpError(400, 'pastDay');
  }
  return days;
}

/** Accepts "YYYY-MM-DDTHH:MM" (datetime-local), returns "YYYY-MM-DD HH:MM:00" or null. */
function parseDeadline(value) {
  if (value === null || value === undefined || value === '') return null;
  const m = DATETIME_RE.exec(String(value));
  if (!m || !isValidDate(m[1])) throw new HttpError(400, 'invalidDeadline');
  return `${m[1]} ${m[2]}:00`;
}

/** Hours of the day (minutes, multiples of 15, at least one hour). Returns { dayStart, dayEnd }. */
function parseDayHours(body, current = { dayStart: 0, dayEnd: 1440 }) {
  const dayStart = body?.dayStart !== undefined ? Number(body.dayStart) : current.dayStart;
  const dayEnd = body?.dayEnd !== undefined ? Number(body.dayEnd) : current.dayEnd;
  const ok = (m) => Number.isInteger(m) && m >= 0 && m <= 1440 && m % 15 === 0;
  if (!ok(dayStart) || !ok(dayEnd) || dayEnd - dayStart < 60) {
    throw new HttpError(400, 'invalidDayHours');
  }
  return { dayStart, dayEnd };
}

/** undefined = not provided, null = no organization, otherwise an id the user may create occasions in. */
async function parseOrganization(value, userId) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || !(await canCreateIn(id, userId))) {
    throw new HttpError(403, 'cannotCreateInOrg');
  }
  return id;
}

function withStatus(o) {
  const { today, now } = clock();
  // Archived automatically once its last day has passed, or manually by the creator.
  const ended = !!o.last_day && o.last_day < today;
  const archived = ended || !!o.archived_at;
  const editClosed = !!o.edit_deadline && o.edit_deadline <= now;
  return { ...o, ended, archived, editClosed, editable: !archived && !editClosed };
}

function serializeOccasion(o, userId) {
  return {
    id: o.id,
    slug: o.slug,
    title: o.title,
    description: o.description || '',
    firstDay: o.first_day,
    lastDay: o.last_day,
    dayCount: Number(o.day_count ?? o.days?.length ?? 0),
    days: o.days, // detail only: every day open for availabilities
    dayStart: o.day_start_min ?? 0,
    dayEnd: o.day_end_min ?? 1440,
    editDeadline: o.edit_deadline ? o.edit_deadline.slice(0, 16).replace(' ', 'T') : null,
    creatorId: o.creator_id,
    isCreator: o.creator_id === userId,
    archived: o.archived,
    // Manual archive (can be undone as long as the end date has not passed).
    archivedManually: !!o.archived_at && !o.ended,
    editClosed: o.editClosed,
    editable: o.editable,
    guestCount: o.guest_count !== undefined ? Number(o.guest_count) : undefined,
    // List only: I created it or administer its organization.
    canManage: o.can_manage !== undefined ? !!Number(o.can_manage) : undefined,
    organization: orgBranding(o),
    allMembers: !!o.organization_id && !!o.all_members,
  };
}

const serializeSlot = (r) => ({
  id: r.id,
  userId: r.user_id,
  day: r.day,
  start: r.start_min,
  end: r.end_min,
});

// active: has already used the site (false: account prepared by an invitation, shown greyed out).
const serializeUser = (u) => ({ id: u.id, name: u.name, email: u.email, active: u.active === undefined ? true : !!Number(u.active) });

async function loadOccasion(slug) {
  const [rows] = await pool.query(
    `SELECT o.*, ${ORG_BRANDING_COLUMNS} FROM occasions o
     ${ORG_BRANDING_JOIN}
     WHERE o.slug = ?`,
    [String(slug)],
  );
  if (!rows.length) throw new HttpError(404, 'occasionNotFound');
  const o = rows[0];
  const [days] = await pool.query('SELECT day FROM occasion_days WHERE occasion_id = ? ORDER BY day', [o.id]);
  o.days = days.map((d) => d.day);
  o.first_day = o.days[0] ?? null;
  o.last_day = o.days.at(-1) ?? null;
  return withStatus(o);
}

async function isParticipant(occasionId, userId) {
  const [rows] = await pool.query(
    'SELECT 1 FROM participants WHERE occasion_id = ? AND user_id = ? AND removed_at IS NULL',
    [occasionId, userId],
  );
  return rows.length > 0;
}

/** The occasion's creator, or an administrator of its organization, manages its guests. */
async function canManageGuests(o, userId) {
  if (o.creator_id === userId) return true;
  return (!!o.organization_id && (await isOrgAdmin(o.organization_id, userId))) || (await isSiteAdmin(userId));
}

/** Creator-only actions (settings, archive); a site administrator may also do them. key: error message. */
async function assertCreator(o, user, key) {
  if (o.creator_id !== user.id && !user.isSiteAdmin) throw new HttpError(403, key);
}

async function activeGuests(occasionId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.activated_at IS NOT NULL AS active FROM participants p JOIN users u ON u.id = p.user_id
     WHERE p.occasion_id = ? AND p.removed_at IS NULL AND u.name IS NOT NULL ORDER BY p.joined_at, u.id`,
    [occasionId],
  );
  return rows.map(serializeUser);
}

function assertEditable(o) {
  if (o.archived) throw new HttpError(403, 'occasionArchived');
  if (o.editClosed) throw new HttpError(403, 'editingClosed');
}

async function daySlots(conn, occasionId, userId, day) {
  const [rows] = await conn.query(
    `SELECT id, user_id, day, start_min, end_min FROM availabilities
     WHERE occasion_id = ? AND user_id = ? AND day = ? ORDER BY start_min`,
    [occasionId, userId, day],
  );
  return rows.map(serializeSlot);
}

/**
 * Saves the range [start, end] for a user's day. Overlaps are refused; adjacent ranges are joined.
 * `replaceId` (optional) is a slot being edited: it is removed first.
 */
async function saveMerged(occasionId, userId, day, start, end, replaceId = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (replaceId) {
      await conn.query('DELETE FROM availabilities WHERE id = ? AND user_id = ?', [replaceId, userId]);
    }
    const [own] = await conn.query(
      `SELECT id, start_min, end_min FROM availabilities
       WHERE occasion_id = ? AND user_id = ? AND day = ? FOR UPDATE`,
      [occasionId, userId, day],
    );
    // Ranges of the same user may not overlap; ranges that touch end-to-end are joined.
    if (own.some((row) => row.start_min < end && row.end_min > start)) {
      throw new HttpError(409, 'slotsOverlap');
    }
    let s = start;
    let e = end;
    const merged = new Set();
    for (const row of own) {
      if (row.end_min === start || row.start_min === end) {
        s = Math.min(s, row.start_min);
        e = Math.max(e, row.end_min);
        merged.add(row.id);
      }
    }
    if (merged.size) await conn.query('DELETE FROM availabilities WHERE id IN (?)', [[...merged]]);
    await conn.query(
      'INSERT INTO availabilities (occasion_id, user_id, day, start_min, end_min) VALUES (?, ?, ?, ?, ?)',
      [occasionId, userId, day, s, e],
    );
    const slots = await daySlots(conn, occasionId, userId, day);
    await conn.commit();
    return slots;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function parseRange(body, o) {
  const start = Number(body?.start);
  const end = Number(body?.end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end) {
    throw new HttpError(400, 'endBeforeStart');
  }
  if (start < o.day_start_min || end > o.day_end_min) {
    const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    throw new HttpError(400, 'slotsOutsideHours', { start: hhmm(o.day_start_min), end: hhmm(o.day_end_min) });
  }
  return { start, end };
}

// ---- Invitations by email ----

const INVITE_DAYS = 30; // validity of the personal link
const INVITE_MAX = 50; // addresses per sending
const INVITE_LIMIT = 200; // addresses per person and per hour
const invitesSent = new Map();

function overInviteLimit(userId, count) {
  const now = Date.now();
  let s = invitesSent.get(userId);
  if (!s || s.until < now) invitesSent.set(userId, (s = { count: 0, until: now + 60 * 60 * 1000 }));
  if (s.count + count > INVITE_LIMIT) return true;
  s.count += count;
  return false;
}

/** [{ name?, email }] → validated, emails in lower case, without duplicates. */
function parseInvitees(list) {
  if (!Array.isArray(list) || !list.length) throw new HttpError(400, 'atLeastOneEmail');
  const seen = new Map();
  for (const item of list) {
    const email = cleanText(item?.email, 255).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, email ? 'invalidEmailValue' : 'invalidEmailEmpty', { email });
    if (!seen.has(email)) seen.set(email, { email, name: cleanText(item?.name, 100) });
  }
  if (seen.size > INVITE_MAX) throw new HttpError(400, 'tooManyEmails', { max: INVITE_MAX });
  return [...seen.values()];
}

/** "jean-luc.tremblay@exemple.com" → "Jean-Luc Tremblay" (name of a prepared account, changeable in its profile). */
function nameFromEmail(email) {
  return email
    .split('@')[0]
    .replace(/[._+\d]+/g, ' ')
    .trim()
    .replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase())
    .slice(0, 100) || email.split('@')[0].slice(0, 100);
}

export function createRoutes(io) {
  const r = Router();

  r.get('/me', (req, res) => {
    // publicUrl: address phones can reach (QR codes), e.g. https://disponibilites.example.com
    const host = process.env.PUBLIC_HOSTNAME;
    res.json({
      // Without a cookie: anonymous (id null) until an invitation link is opened.
      ...(req.user
        ? { ...serializeUser(req.user), hasPassword: req.user.hasPassword, isSiteAdmin: req.user.isSiteAdmin }
        : { id: null, name: null, email: null }),
      timezone: clock().timezone,
      publicUrl: host ? `https://${host}` : null,
      // Person in charge of personal information (Quebec law: title and contact details must be published).
      legal: {
        contactName: process.env.LEGAL_CONTACT_NAME || null,
        contactEmail: process.env.LEGAL_CONTACT_EMAIL || null,
      },
    });
  });

  r.put('/me', async (req, res) => {
    const name = cleanText(req.body?.name, 100);
    // Email is optional; when given it must look like an address.
    const email = cleanText(req.body?.email, 255).toLowerCase() || null;
    if (!name) throw new HttpError(400, 'nameRequired');
    if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'invalidEmail');
    if (req.user.hasPassword) {
      // The email is the login of an account with a password.
      if (!email) throw new HttpError(400, 'emailRequiredLogin');
      await assertLoginEmailFree(email, req.user.id);
    }

    await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.id]);
    const user = { id: req.user.id, name, email, active: true };

    // Show the (new or renamed) guest in every occasion they belong to.
    const [occ] = await pool.query(
      `SELECT o.slug FROM participants p JOIN occasions o ON o.id = p.occasion_id
       WHERE p.user_id = ? AND p.removed_at IS NULL`,
      [user.id],
    );
    for (const { slug } of occ) io.to(roomOf(slug)).emit('participant:upsert', user);

    res.json({ ...user, hasPassword: req.user.hasPassword, isSiteAdmin: req.user.isSiteAdmin });
  });

  /** Occasions the current user created or joined. */
  r.get('/occasions', async (req, res) => {
    const [rows] = await pool.query(
      `SELECT o.*, ${ORG_BRANDING_COLUMNS},
         (SELECT MIN(d.day) FROM occasion_days d WHERE d.occasion_id = o.id) AS first_day,
         (SELECT MAX(d.day) FROM occasion_days d WHERE d.occasion_id = o.id) AS last_day,
         (SELECT COUNT(*) FROM occasion_days d WHERE d.occasion_id = o.id) AS day_count,
         (SELECT COUNT(*) FROM participants p2 JOIN users u ON u.id = p2.user_id
           WHERE p2.occasion_id = o.id AND p2.removed_at IS NULL AND u.name IS NOT NULL) AS guest_count,
         -- Managed by me: I created it, or I own / administer its organization.
         (o.creator_id = ? OR g.owner_id = ? OR EXISTS (
            SELECT 1 FROM organization_members m
            WHERE m.organization_id = o.organization_id AND m.user_id = ? AND m.is_admin = 1 AND m.removed_at IS NULL
         )) AS can_manage
       FROM occasions o
       JOIN participants p ON p.occasion_id = o.id AND p.user_id = ? AND p.removed_at IS NULL
       ${ORG_BRANDING_JOIN}
       ORDER BY first_day, o.id`,
      [req.user.id, req.user.id, req.user.id, req.user.id],
    );
    res.json(rows.map((o) => serializeOccasion(withStatus(o), req.user.id)));
  });

  r.post('/occasions', async (req, res) => {
    if (!req.user.name) throw new HttpError(400, 'profileBeforeOccasion');
    const title = cleanText(req.body?.title, 200);
    const description = cleanText(req.body?.description, 5000);
    const days = parseDays(req.body?.days);
    const editDeadline = parseDeadline(req.body?.editDeadline);
    const organizationId = (await parseOrganization(req.body?.organizationId, req.user.id)) ?? null;
    const allMembers = !!organizationId && !!req.body?.allMembers;
    const { dayStart, dayEnd } = parseDayHours(req.body, { dayStart: 8 * 60, dayEnd: 22 * 60 });

    if (!title) throw new HttpError(400, 'titleRequired');

    const slug = crypto.randomBytes(9).toString('base64url');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO occasions (slug, title, description, day_start_min, day_end_min,
           edit_deadline, creator_id, organization_id, all_members)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [slug, title, description || null, dayStart, dayEnd, editDeadline, req.user.id, organizationId, allMembers ? 1 : 0],
      );
      await conn.query('INSERT INTO occasion_days (occasion_id, day) VALUES ?', [days.map((d) => [result.insertId, d])]);
      await conn.query('INSERT INTO participants (occasion_id, user_id) VALUES (?, ?)', [result.insertId, req.user.id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const o = await loadOccasion(slug);
    if (allMembers) await inviteAllMembers(o.id, organizationId);
    res.status(201).json(serializeOccasion(o, req.user.id));
  });

  /** Opening an occasion link automatically associates the visitor with it (and with its organization). */
  r.get('/occasions/:slug', async (req, res) => {
    const o = await loadOccasion(req.params.slug);
    // The invitation link is the only way to get an account (and its cookie).
    if (!req.user) await createVisitor(req, res);
    // A site administrator only looks: never added as a guest (nor as a member) by opening the link.
    const viewOnly = req.user.isSiteAdmin && !(await isParticipant(o.id, req.user.id));
    if (o.organization_id && !viewOnly) {
      const newlyInvited = await joinOrganization(o.organization_id, req.user.id);
      if (req.user.name) {
        for (const slug of newlyInvited) io.to(roomOf(slug)).emit('participant:upsert', serializeUser(req.user));
      }
    }

    const [ins] = viewOnly
      ? [{ affectedRows: 0 }]
      : await pool.query('INSERT IGNORE INTO participants (occasion_id, user_id) VALUES (?, ?)', [o.id, req.user.id]);
    if (ins.affectedRows && req.user.name) {
      io.to(roomOf(o.slug)).emit('participant:upsert', serializeUser(req.user));
    }
    if (!viewOnly && !ins.affectedRows && !(await isParticipant(o.id, req.user.id))) {
      throw new HttpError(403, 'removedFromOccasion');
    }

    const participants = await activeGuests(o.id);
    const [slots] = await pool.query(
      `SELECT id, user_id, day, start_min, end_min FROM availabilities
       WHERE occasion_id = ? ORDER BY day, start_min`,
      [o.id],
    );
    res.json({
      occasion: {
        ...serializeOccasion(o, req.user.id),
        canManageGuests: await canManageGuests(o, req.user.id),
        isGuest: !viewOnly,
      },
      participants,
      slots: slots.map(serializeSlot),
    });
  });

  /** Creator-only settings: title, description, days, hours, edit deadline, organization. */
  r.patch('/occasions/:slug', async (req, res) => {
    const o = await loadOccasion(req.params.slug);
    await assertCreator(o, req.user, 'creatorOnlyEdit');
    if (o.archived) throw new HttpError(403, 'occasionArchived');

    const title = req.body?.title !== undefined ? cleanText(req.body.title, 200) : o.title;
    const description = req.body?.description !== undefined ? cleanText(req.body.description, 5000) : o.description;
    const editDeadline = req.body?.editDeadline !== undefined ? parseDeadline(req.body.editDeadline) : o.edit_deadline;
    if (!title) throw new HttpError(400, 'titleRequired');
    let organizationId = o.organization_id;
    if (req.body?.organizationId !== undefined && (req.body.organizationId || null) !== o.organization_id) {
      organizationId = await parseOrganization(req.body.organizationId, req.user.id);
    }

    const allMembers = !!organizationId && (req.body?.allMembers !== undefined ? !!req.body.allMembers : !!o.all_members);
    const { dayStart, dayEnd } = parseDayHours(req.body, { dayStart: o.day_start_min, dayEnd: o.day_end_min });
    // Days: past days already chosen may stay; removing a day also removes its availabilities.
    const days = req.body?.days !== undefined ? parseDays(req.body.days, new Set(o.days)) : o.days;
    const removed = o.days.filter((d) => !days.includes(d));
    const added = days.filter((d) => !o.days.includes(d));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE occasions SET title = ?, description = ?, edit_deadline = ?, organization_id = ?, all_members = ?,
           day_start_min = ?, day_end_min = ? WHERE id = ?`,
        [title, description || null, editDeadline, organizationId, allMembers ? 1 : 0, dayStart, dayEnd, o.id],
      );
      if (removed.length) {
        await conn.query('DELETE FROM occasion_days WHERE occasion_id = ? AND day IN (?)', [o.id, removed]);
        await conn.query('DELETE FROM availabilities WHERE occasion_id = ? AND day IN (?)', [o.id, removed]);
      }
      if (added.length) {
        await conn.query('INSERT INTO occasion_days (occasion_id, day) VALUES ?', [added.map((d) => [o.id, d])]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    if (allMembers) {
      for (const u of await inviteAllMembers(o.id, organizationId)) {
        if (u.name) io.to(roomOf(o.slug)).emit('participant:upsert', serializeUser(u));
      }
    }
    const updated = await loadOccasion(o.slug);
    // Broadcast without the per-user isCreator flag; clients compute it from creatorId.
    const payload = serializeOccasion(updated, null);
    io.to(roomOf(o.slug)).emit('occasion:updated', payload);
    res.json(serializeOccasion(updated, req.user.id));
  });

  // ---- Guests (creator or organization administrators) ----

  async function loadManagedOccasion(req) {
    const o = await loadOccasion(req.params.slug);
    if (!(await canManageGuests(o, req.user.id))) {
      throw new HttpError(403, 'guestsManagersOnly');
    }
    if (o.archived) throw new HttpError(403, 'occasionArchived');
    return o;
  }

  /** People who can be added: active organization members not invited yet, and removed guests. */
  r.get('/occasions/:slug/candidates', async (req, res) => {
    const o = await loadManagedOccasion(req);
    const [removed] = await pool.query(
      `SELECT u.id, u.name, u.email, u.activated_at IS NOT NULL AS active FROM participants p JOIN users u ON u.id = p.user_id
       WHERE p.occasion_id = ? AND p.removed_at IS NOT NULL AND u.name IS NOT NULL ORDER BY u.name`,
      [o.id],
    );
    let members = [];
    if (o.organization_id) {
      [members] = await pool.query(
        `SELECT u.id, u.name, u.email, u.activated_at IS NOT NULL AS active FROM organization_members m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN participants p ON p.occasion_id = ? AND p.user_id = m.user_id
         WHERE m.organization_id = ? AND m.removed_at IS NULL AND p.user_id IS NULL AND u.name IS NOT NULL
         ORDER BY u.name`,
        [o.id, o.organization_id],
      );
    }
    res.json({ members: members.map(serializeUser), removed: removed.map(serializeUser) });
  });

  r.post('/occasions/:slug/participants', async (req, res) => {
    const o = await loadManagedOccasion(req);
    const userIds = [...new Set((Array.isArray(req.body?.userIds) ? req.body.userIds : []).map(Number))].filter(Number.isInteger);
    if (!userIds.length) throw new HttpError(400, 'nobodySelected');
    for (const userId of userIds) {
      const [rows] = await pool.query('SELECT removed_at FROM participants WHERE occasion_id = ? AND user_id = ?', [o.id, userId]);
      const wasRemoved = rows.length && rows[0].removed_at;
      const isMember = o.organization_id && (await isActiveMember(o.organization_id, userId));
      if (!wasRemoved && !isMember) throw new HttpError(403, 'notOrgMember');
      await pool.query(
        `INSERT INTO participants (occasion_id, user_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE removed_at = NULL`,
        [o.id, userId],
      );
    }
    const participants = await activeGuests(o.id);
    for (const p of participants.filter((x) => userIds.includes(x.id))) io.to(roomOf(o.slug)).emit('participant:upsert', p);
    res.json({ participants });
  });

  /**
   * Invites people by email: each one is found by their email (or an account is prepared for them),
   * added to the occasion and receives a personal link. The answer does not tell whether an address
   * already had an account. Also used to send an invitation again.
   */
  r.post('/occasions/:slug/invitations', async (req, res) => {
    const o = await loadManagedOccasion(req);
    if (!mailEnabled()) throw new HttpError(503, 'mailDisabled');
    const invitees = parseInvitees(req.body?.invitees);
    const message = cleanText(req.body?.message, 1000);
    if (overInviteLimit(req.user.id, invitees.length)) {
      throw new HttpError(429, 'inviteLimit', { max: INVITE_LIMIT });
    }

    const base = siteBase(req);
    const logoUrl = staticAssetUrl(base, '/logo-disponibilites.png');
    const results = [];
    for (const invitee of invitees) {
      let user = await findUserByEmail(invitee.email);
      if (!user) {
        const name = invitee.name || nameFromEmail(invitee.email);
        // A prepared account takes the language of the person who invites, until its first visit.
        user = {
          id: await createPreparedUser(pool, { name, email: invitee.email, locale: req.lang }), name, active: 0, locale: req.lang,
        };
      } else if (!user.name) {
        user.name = invitee.name || nameFromEmail(invitee.email);
        await pool.query('UPDATE users SET name = ? WHERE id = ?', [user.name, user.id]);
      }
      const already = await isParticipant(o.id, user.id);
      if (!already) {
        await pool.query(
          `INSERT INTO participants (occasion_id, user_id) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE removed_at = NULL`,
          [o.id, user.id],
        );
        io.to(roomOf(o.slug)).emit('participant:upsert', serializeUser({ ...user, email: invitee.email }));
      }

      const { token } = await createLinkToken(user.id, INVITE_DAYS * 24 * 60, 'invite');
      const url = `${base}/lier/${token}?retour=${encodeURIComponent(`/o/${o.slug}`)}&invitation=1`;
      let mailed = true;
      try {
        await sendMail({
          to: invitee.email,
          // In the invitee's language when known, otherwise in the inviter's.
          ...inviteMail({
            t: user.locale ? tFor(user.locale) : req.t,
            name: user.name, inviterName: req.user.name, title: o.title, url, days: INVITE_DAYS, message, logoUrl,
          }),
        });
      } catch (err) {
        mailed = false;
        console.error('[mail] invitation', invitee.email, err.message);
      }
      results.push({ email: invitee.email, already, mailed });
    }
    res.json({ results, participants: await activeGuests(o.id) });
  });

  /** Removes a guest and their availabilities. Opening the link again does not re-add them. */
  r.delete('/occasions/:slug/participants/:userId', async (req, res) => {
    const o = await loadManagedOccasion(req);
    const userId = Number(req.params.userId);
    if (userId === o.creator_id) throw new HttpError(400, 'creatorNotRemovable');
    const [result] = await pool.query(
      'UPDATE participants SET removed_at = NOW() WHERE occasion_id = ? AND user_id = ? AND removed_at IS NULL',
      [o.id, userId],
    );
    if (!result.affectedRows) throw new HttpError(404, 'guestNotFound');
    await pool.query('DELETE FROM availabilities WHERE occasion_id = ? AND user_id = ?', [o.id, userId]);
    io.to(roomOf(o.slug)).emit('participant:removed', { userId });
    res.json({ participants: await activeGuests(o.id) });
  });

  /** Gives the occasion to another guest (creator or organization administrator). */
  r.post('/occasions/:slug/owner', async (req, res) => {
    const o = await loadOccasion(req.params.slug);
    if (!(await canManageGuests(o, req.user.id))) {
      throw new HttpError(403, 'transferManagersOnly');
    }
    const userId = Number(req.body?.userId);
    if (!Number.isInteger(userId)) throw new HttpError(400, 'invalidPerson');
    if (userId === o.creator_id) throw new HttpError(400, 'alreadyOwner');
    if (!(await activeGuests(o.id)).some((p) => p.id === userId)) {
      throw new HttpError(400, 'ownerMustBeGuest');
    }

    await pool.query('UPDATE occasions SET creator_id = ? WHERE id = ?', [userId, o.id]);
    const updated = await loadOccasion(o.slug);
    io.to(roomOf(o.slug)).emit('occasion:updated', serializeOccasion(updated, null));
    res.json({ ...serializeOccasion(updated, req.user.id), canManageGuests: await canManageGuests(updated, req.user.id) });
  });

  /** Creator archives the occasion (read-only for everyone), or undoes a manual archive. */
  r.post('/occasions/:slug/archive', async (req, res) => {
    const o = await loadOccasion(req.params.slug);
    await assertCreator(o, req.user, 'creatorOnlyArchive');
    const archive = req.body?.archived !== false;
    if (!archive && o.ended) throw new HttpError(400, 'occasionEnded');

    await pool.query('UPDATE occasions SET archived_at = ? WHERE id = ?', [archive ? clock().now : null, o.id]);
    const updated = await loadOccasion(o.slug);
    io.to(roomOf(o.slug)).emit('occasion:updated', serializeOccasion(updated, null));
    res.json(serializeOccasion(updated, req.user.id));
  });

  /** Adds an availability range; overlapping/adjacent ranges of the same user are merged. */
  r.post('/occasions/:slug/slots', async (req, res) => {
    const o = await loadOccasion(req.params.slug);
    assertEditable(o);
    if (!req.user.name) throw new HttpError(400, 'profileRequired');
    if (!(await isParticipant(o.id, req.user.id))) throw new HttpError(403, 'notParticipant');

    const { day } = req.body || {};
    if (!isValidDate(day)) throw new HttpError(400, 'invalidDay');
    if (!o.days.includes(day)) throw new HttpError(400, 'dayNotInOccasion');
    const { start, end } = parseRange(req.body, o);

    const slots = await saveMerged(o.id, req.user.id, day, start, end);

    const payload = { userId: req.user.id, day, slots };
    io.to(roomOf(o.slug)).emit('slots:day', payload);
    res.status(201).json(payload);
  });

  /** Changes the hours of one of the user's ranges (drag & resize in the UI). */
  r.patch('/occasions/:slug/slots/:id', async (req, res) => {
    const o = await loadOccasion(req.params.slug);
    assertEditable(o);
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      'SELECT day FROM availabilities WHERE id = ? AND occasion_id = ? AND user_id = ?',
      [id, o.id, req.user.id],
    );
    if (!rows.length) throw new HttpError(404, 'slotNotFound');
    const { start, end } = parseRange(req.body, o);
    const day = rows[0].day;
    const payload = { userId: req.user.id, day, slots: await saveMerged(o.id, req.user.id, day, start, end, id) };
    io.to(roomOf(o.slug)).emit('slots:day', payload);
    res.json(payload);
  });

  r.delete('/occasions/:slug/slots/:id', async (req, res) => {
    const o = await loadOccasion(req.params.slug);
    assertEditable(o);
    const [rows] = await pool.query(
      'SELECT day FROM availabilities WHERE id = ? AND occasion_id = ? AND user_id = ?',
      [Number(req.params.id), o.id, req.user.id],
    );
    if (!rows.length) throw new HttpError(404, 'slotNotFound');
    await pool.query('DELETE FROM availabilities WHERE id = ?', [Number(req.params.id)]);

    const day = rows[0].day;
    const payload = { userId: req.user.id, day, slots: await daySlots(pool, o.id, req.user.id, day) };
    io.to(roomOf(o.slug)).emit('slots:day', payload);
    res.json(payload);
  });

  return r;
}

export function errorHandler(err, req, res, _next) {
  // Messages in the language of the request (errors.* in locales/<lang>.json).
  const t = req.t ?? tFor('fr');
  if (err instanceof HttpError) return res.status(err.status).json({ error: t(`errors.${err.key}`, err.params) });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: t('errors.invalidJson') });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: t('errors.fileTooLarge') });
  console.error(err);
  res.status(500).json({ error: t('errors.serverError') });
}
