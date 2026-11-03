import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { migrate, pool } from './db.js';
import { identify, requireUser, setActivationListener } from './auth.js';
import { roomOf } from './socket.js';
import { language } from './i18n.js';
import { createSocketServer } from './socket.js';
import { createRoutes, errorHandler } from './routes.js';
import { createOrganizationRoutes } from './organizations.js';
import { createLinkRoutes } from './link.js';
import { createAccountRoutes } from './account.js';
import { createAdminRoutes } from './admin.js';

const PORT = Number(process.env.PORT || 3000);

await migrate();

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
});
app.use(language); // req.lang, req.t (before the body parser: its errors are translated too)
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const server = http.createServer(app);
const io = await createSocketServer(server);

// An invited person uses their account for the first time: they become a member (in colour) in their occasions.
setActivationListener(async (user) => {
  if (!user.name) return;
  const [occ] = await pool.query(
    `SELECT o.slug FROM participants p JOIN occasions o ON o.id = p.occasion_id
     WHERE p.user_id = ? AND p.removed_at IS NULL`,
    [user.id],
  );
  const payload = { id: user.id, name: user.name, email: user.email, active: true };
  for (const { slug } of occ) io.to(roomOf(slug)).emit('participant:upsert', payload);
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use(
  '/api',
  identify,
  requireUser,
  createRoutes(io),
  createOrganizationRoutes(io),
  createLinkRoutes(),
  createAccountRoutes(),
  createAdminRoutes(io),
);
app.use('/api', (req, res) => res.status(404).json({ error: req.t('errors.notFound') }));

// Production: serve the compiled frontend (STATIC_DIR=/app/public, see the root Dockerfile).
const staticDir = process.env.STATIC_DIR;
if (staticDir && fs.existsSync(staticDir)) {
  // Vite file names contain a content hash: they can be cached forever. index.html must not be cached.
  app.use(
    '/assets',
    express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
  );
  app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
  // Addresses of the application's pages (same list as frontend/src/App.svelte): any other address still
  // gets the application, which shows its "page not found" page, but with the HTTP 404 status.
  const APP_PAGE = /^\/(?:a-propos|confidentialite|conditions|connexion|organisations(?:\/(?:\d+|nouvelle))?|admin(?:\/(?:comptes|occasions|organisations(?:\/\d+)?))?|o\/[\w-]+|lier\/[\w-]+)?\/?$/;
  app.get(/^\/(?!api\/|socket\.io\/).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.status(APP_PAGE.test(req.path) ? 200 : 404).sendFile(path.join(staticDir, 'index.html'));
  });
}

app.use(errorHandler);

server.listen(PORT, () => console.log(`[server] API + Socket.IO sur le port ${PORT}`));
