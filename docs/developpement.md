[← Documentation technique](README.md)

# Développement

- Le serveur de développement utilise sa propre base, `calendar_dev`, jamais celle de la production :
  `scripts/dev-db.sh create` la crée vide, `scripts/dev-db.sh copy` la remplace par une copie de la production.
- `backend/src` et `frontend/src` sont montés dans les conteneurs : rechargement automatique (`node --watch`, HMR Vite).
- Après l'ajout d'une dépendance npm, reconstruire le conteneur concerné : `docker compose up -d --build frontend` (ou `backend`).
- Accès MySQL : `localhost:3307` (identifiants du `.env`).
- Réinitialiser la base : `docker compose down -v`.
- Journaux : `docker compose logs -f backend`.
- `index.html` et `vite.config.js` sont montés fichier par fichier : si un outil les **remplace** (au lieu de les
  modifier), le conteneur ne voit plus la nouvelle version. Le recréer : `docker compose up -d --force-recreate frontend`.
- **Images de `public/`** : leur adresse reçoit à la compilation `?v=<empreinte du contenu>` (Cloudflare et les
  navigateurs reprennent l'image dès qu'elle change). Dans le code, toujours `asset('/mon-image.png')`
  (`src/lib/assets.js`) ; `index.html` et `site.webmanifest` sont traités automatiquement (`vite.config.js`).
