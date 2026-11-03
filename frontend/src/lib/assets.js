/* global __ASSET_VERSIONS__ */
// Fingerprints of the images of public/, computed at build time (see vite.config.js).
const VERSIONS = __ASSET_VERSIONS__;

/** Address of an image of public/ with its cache buster: asset('/logo-mark.png') → '/logo-mark.png?v=3f9a1c2e'. */
export const asset = (path) => (VERSIONS[path] ? `${path}?v=${VERSIONS[path]}` : path);
