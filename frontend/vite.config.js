import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const PUBLIC_DIR = path.resolve(import.meta.dirname, 'public');
const MANIFEST = '/site.webmanifest';

/** 8 hex characters of the SHA-256 of a content (same rule in backend/src/mail.js). */
const fingerprint = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8);

/** Every image of public/ (sub-folders included) → its fingerprint: { '/logo-mark.png': '3f9a1c2e', … }. */
function imageVersions() {
  const versions = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(png|svg|ico|jpe?g|webp|gif)$/i.test(entry.name)) {
        versions[`/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`] = fingerprint(fs.readFileSync(file));
      }
    }
  };
  walk(PUBLIC_DIR);
  return versions;
}

const versioned = (url, versions) => (versions[url] ? `${url}?v=${versions[url]}` : url);

/** The web manifest with versioned icons (written over the copied one at build time). */
function versionedManifest(versions) {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, MANIFEST), 'utf8'));
  for (const icon of manifest.icons ?? []) icon.src = versioned(icon.src, versions);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Cache busting for the files of public/ (Vite only fingerprints the files it bundles):
 * an image's address ends with ?v=<fingerprint of its content>, which changes only when the image changes.
 * - code: asset('/logo-mark.png') (src/lib/assets.js) reads __ASSET_VERSIONS__;
 * - index.html: its images and its manifest link are versioned;
 * - site.webmanifest: its icons are versioned in the built copy.
 */
function publicAssetVersions() {
  const versions = imageVersions();
  versions[MANIFEST] = fingerprint(versionedManifest(versions));
  let outDir;
  return {
    name: 'public-asset-versions',
    config: () => ({ define: { __ASSET_VERSIONS__: JSON.stringify(versions) } }),
    configResolved: (config) => {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml: (html) =>
      html.replace(/(href|src)="(\/[^"?#]+)"/g, (match, attr, url) => `${attr}="${versioned(url, versions)}"`),
    closeBundle() {
      const target = path.join(outDir, MANIFEST);
      if (fs.existsSync(target)) fs.writeFileSync(target, versionedManifest(versions));
    },
  };
}

export default defineConfig({
  plugins: [svelte(), tailwindcss(), publicAssetVersions()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: API_URL, changeOrigin: false },
      '/socket.io': { target: API_URL, ws: true, changeOrigin: false },
    },
  },
});
