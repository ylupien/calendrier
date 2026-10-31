import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { migrate } from './db.js';
import { identify } from './auth.js';
import { createSocketServer } from './socket.js';
import { createRoutes, errorHandler } from './routes.js';
import { createOrganizationRoutes } from './organizations.js';
import { createLinkRoutes } from './link.js';

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
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const server = http.createServer(app);
const io = await createSocketServer(server);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', identify, createRoutes(io), createOrganizationRoutes(), createLinkRoutes());
app.use('/api', (_req, res) => res.status(404).json({ error: 'Introuvable.' }));

// Production: serve the compiled frontend (STATIC_DIR=/app/public, see the root Dockerfile).
const staticDir = process.env.STATIC_DIR;
if (staticDir && fs.existsSync(staticDir)) {
  // Vite file names contain a content hash: they can be cached forever. index.html must not be cached.
  app.use(
    '/assets',
    express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
  );
  app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

app.use(errorHandler);

server.listen(PORT, () => console.log(`[server] API + Socket.IO sur le port ${PORT}`));
