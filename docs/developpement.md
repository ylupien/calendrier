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

## Traductions (français / anglais)

L'application est traduite avec [i18next](https://www.i18next.com/), en français (langue par défaut) et en anglais.

- **Frontend** : un fichier par composant ou page, `frontend/src/locales/<fr|en>/<Nom>.json`, plus `common.json`
  (mots partagés) et `dates.json`. Le nom du fichier est l'espace de ses clés : `t('GuestList.title')`,
  `t('common.cancel')`. `t()` et `th()` viennent de `src/lib/i18n.svelte.js` ; `th()` sert aux textes qui
  contiennent du HTML (`{@html th('…', { nom })}`) et échappe les valeurs insérées. Pluriels : `clé_one`,
  `clé_other` (et `clé_zero`) avec `{ count }`. Les dates passent par `src/lib/dates.js`, qui suit la langue.
- **Langue choisie** : bouton EN / FR de l'en-tête (« 🌐 » dans le menu du cellulaire), retenue dans le navigateur
  (`localStorage`), sinon celle du navigateur. Elle est envoyée au serveur dans l'en-tête `Accept-Language`.
- **Backend** : `backend/src/locales/<fr|en>.json`. Les erreurs sont lancées avec une clé,
  `new HttpError(404, 'occasionNotFound')`, et traduites dans la langue de la requête (`errors.<clé>`). La langue
  de chaque compte est gardée (`users.locale`) pour ses courriels : un lien de connexion part dans la langue de la
  personne qui le demande, une invitation dans celle de la personne invitée (sinon celle de l'organisateur).
- **Vérifier** (mêmes clés dans les deux langues, aucune clé inconnue dans le code) :

```bash
python3 scripts/check-locales.py
```

## Logos de l'organisation : personnalisé ou galerie

La gestion d'une organisation a sa page, `/organisations/<numéro>` (création : `/organisations/nouvelle`).
Une organisation garde son fichier téléversé (onglet **Personnalisé**, un seul) et **tous les logos créés** dans la
**Galerie** (« ＋ Créer un logo » ouvre l'éditeur dans une fenêtre ; un clic sur un logo l'affiche, ✕ l'efface).
Tout ce qui fait un logo est dans la table **`logos`** (une ligne par logo, `custom` ou `generic` : image, type MIME,
fond, version, et pour la galerie le symbole, la police et le texte choisis). L'organisation ne garde qu'une
référence, **`organizations.logo_id`**, vers le logo affiché ; effacer celui-ci en affiche un autre.

**Fond** (`logos.background`) : `theme` suit le mode de l'application (clair / sombre), `light` est toujours sur
fond blanc, `dark` toujours sur le bleu foncé. Un logo de la galerie en `theme` a deux images : `data` (texte foncé,
mode clair) et `data_dark` (texte pâle, mode sombre, servie par `?variant=dark`). L'affichage est réglé à un seul
endroit, `frontend/src/lib/logoDisplay.svelte.js`.

Le logo de la galerie est composé par le navigateur au format des logos faits à la main (symbole à gauche, texte à
droite, fond transparent, 587 px de haut) : symbole générique, **texte modifiable** (par défaut le nom de
l'organisation, p. ex. « Lupien » pour « Famille Lupien »), **police** au choix et **fond** (thème, clair ou sombre). Le PNG est envoyé à `POST /api/organizations/:id/generic-logos?emblem=&font=&caption=&background=` (et son image pour fond sombre à `PUT /api/organizations/:id/logos/:logoId/dark`).
Les images sont publiques à `GET /api/logos/:id?v=<version>` (mises en cache pour de bon : la version change avec
l'image).

Ajouter un symbole :
1. un SVG carré (`viewBox="0 0 512 512"`, `width`/`height` 512) dans `frontend/public/logos-generiques/<id>.svg` ;
2. une entrée dans `EMBLEMS` de `frontend/src/lib/logoGallery.js` (`id`, couleurs du texte sur fond clair et
   sombre, mots-clés français et anglais pour la recherche) ;
3. son libellé dans `frontend/src/locales/<fr|en>/LogoGallery.json` (`items.<id>`).

Ajouter une police : son fichier `.woff2` dans `frontend/public/fonts/` (avec sa licence), une entrée dans `FONTS`
(`logoGallery.js`) et son libellé (`fonts.<id>`). Les polices actuelles (DM Serif Display, Playfair Display,
Montserrat, Fredoka, Pacifico) sont sous licence SIL Open Font License (fichiers `*-OFL.txt`).
