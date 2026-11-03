import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { pool } from './db.js';
import { userFromCookieHeader } from './auth.js';

export const roomOf = (slug) => `occ:${slug}`;
/** Everyone who may see an organization: its members, the viewers of its occasions, site administrators. */
export const orgRoom = (id) => `org:${id}`;
export const SITE_ADMINS_ROOM = 'site-admins';

/**
 * Real-time layer.
 * - Data changes (slots, guests, occasion settings) are pushed by the REST routes via `io.to(room).emit`.
 * - Presence: who is viewing an occasion, and who is editing which day (with the range being edited).
 *
 * Several servers can run at once (development on localhost and production behind the Cloudflare tunnel).
 * With REDIS_URL, they share events through the Redis adapter, and presence is computed from the sockets
 * of every server (fetchSockets), so all visitors see each other whichever address they use.
 */
export async function createSocketServer(httpServer) {
  const io = new Server(httpServer, { path: '/socket.io' });

  if (process.env.REDIS_URL) {
    const pub = createClient({ url: process.env.REDIS_URL });
    const sub = pub.duplicate();
    for (const client of [pub, sub]) client.on('error', (err) => console.error('[redis]', err.message));
    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub));
    console.log('[socket] adaptateur Redis actif (événements partagés entre serveurs)');
  }

  async function snapshot(slug) {
    const sockets = await io.in(roomOf(slug)).fetchSockets();
    return {
      online: [...new Set(sockets.map((s) => s.data.userId))],
      editing: sockets.filter((s) => s.data.editing).map((s) => ({ userId: s.data.userId, ...s.data.editing })),
    };
  }

  async function broadcastPresence(slug) {
    try {
      io.to(roomOf(slug)).emit('presence', await snapshot(slug));
    } catch (err) {
      console.error('[socket] presence', err.message);
    }
  }

  function leave(socket) {
    const slug = socket.data.slug;
    if (!slug) return;
    socket.leave(roomOf(slug));
    socket.data.slug = null;
    socket.data.editing = null;
    broadcastPresence(slug);
  }

  io.use(async (socket, next) => {
    try {
      const user = await userFromCookieHeader(socket.handshake.headers.cookie);
      if (!user) return next(new Error('unauthorized'));
      socket.data.userId = user.id;
      socket.data.isSiteAdmin = user.isSiteAdmin;
      socket.data.editing = null;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', async (socket) => {
    // Changes of the organizations one belongs to (name, logo) are shown right away on every page.
    try {
      const [orgs] = await pool.query(
        'SELECT organization_id FROM organization_members WHERE user_id = ? AND removed_at IS NULL',
        [socket.data.userId],
      );
      for (const { organization_id } of orgs) socket.join(orgRoom(organization_id));
      if (socket.data.isSiteAdmin) socket.join(SITE_ADMINS_ROOM);
    } catch (err) {
      console.error('[socket] organizations', err.message);
    }

    socket.on('occasion:join', async (slug, ack) => {
      try {
        const [rows] = await pool.query(
          `SELECT o.id, o.organization_id FROM occasions o
           JOIN participants p ON p.occasion_id = o.id AND p.user_id = ? AND p.removed_at IS NULL
           WHERE o.slug = ?`,
          [socket.data.userId, String(slug)],
        );
        if (!rows.length) return ack?.({ ok: false });
        if (socket.data.slug !== slug) leave(socket);
        socket.join(roomOf(slug));
        // Its organization's changes too (the header shows its logo).
        if (rows[0].organization_id) socket.join(orgRoom(rows[0].organization_id));
        socket.data.slug = slug;
        socket.data.editing = null;
        ack?.({ ok: true, presence: await snapshot(slug) });
        broadcastPresence(slug);
      } catch (err) {
        console.error('[socket] join', err);
        ack?.({ ok: false });
      }
    });

    socket.on('occasion:leave', () => leave(socket));

    // state: { day: 'YYYY-MM-DD', start, end (minutes), slotId? (range being moved/resized),
    //         deleting? (dragged out to be deleted) } or null when nothing is being edited.
    socket.on('editing', (state) => {
      if (!socket.data.slug) return;
      const valid =
        state &&
        /^\d{4}-\d{2}-\d{2}$/.test(state.day) &&
        Number.isInteger(state.start) &&
        Number.isInteger(state.end);
      socket.data.editing = valid
        ? {
            day: state.day,
            start: state.start,
            end: state.end,
            slotId: Number.isInteger(state.slotId) ? state.slotId : null,
            deleting: state.deleting === true,
          }
        : null;
      broadcastPresence(socket.data.slug);
    });

    // The socket has already left its rooms here, so the snapshot no longer includes it.
    socket.on('disconnect', () => {
      if (socket.data.slug) broadcastPresence(socket.data.slug);
    });
  });

  return io;
}
