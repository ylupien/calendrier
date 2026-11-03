# Calendrier de disponibilités

Application web de planification de groupe, dans l'esprit de Doodle : on crée une **occasion**, on partage son
lien, et chaque invité indique ses **plages de disponibilité** sur un calendrier. Tout le monde voit les
disponibilités de tout le monde, **en temps réel**, et un **rapport** fait ressortir les moments où le plus de
personnes sont disponibles en même temps.

Pas d'inscription : chaque visiteur est reconnu par un cookie permanent, et peut retrouver son identité sur un
autre appareil grâce à un code QR, un mot de passe facultatif ou un lien de connexion reçu par courriel. L'accès
se fait **sur invitation** : le cookie n'est créé qu'en ouvrant le lien d'une occasion.

Interface en français. Stack : **Svelte 5 + Vite + Tailwind CSS 4** (frontend), **Node.js + Express 5 +
Socket.IO** (backend), **MySQL 8.4**, **Redis**, le tout sous **Docker Compose**. Code versé dans le
**domaine public** ([Unlicense](LICENSE)).

---

## Aperçu

*Captures réalisées avec des données de démonstration (personnes, organisations et occasions fictives).*

| Calendrier d'une occasion (vue Semaine) | Rapport : meilleurs moments (mode sombre) |
|---|---|
| ![Vue Semaine : barres de disponibilité de chaque invité, avec heure de début, initiales et heure de fin](frontend/public/captures/calendrier-semaine.png) | ![Rapport : carte de chaleur et meilleurs moments, en mode sombre](frontend/public/captures/rapport-sombre.png) |

| Mes occasions | Éditeur de plages sur cellulaire |
|---|---|
| ![Liste des occasions avec logos d'organisations et couronne pour celles que l'on gère](frontend/public/captures/mes-occasions.png) | <img src="frontend/public/captures/mobile-editeur.png" alt="Éditeur de plages sur cellulaire : deux lignes avant-midi / après-midi" width="300"> |

---

## Sommaire

- [Aperçu](#aperçu)
- [Fonctionnalités](#fonctionnalités)
- [Démarrage rapide](#démarrage-rapide)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Fonctionnement détaillé](#fonctionnement-détaillé)
- [Temps réel](#temps-réel)
- [API REST](#api-rest)
- [Publication sur Internet (Cloudflare Tunnel)](#publication-sur-internet-cloudflare-tunnel)
- [Comptes, connexion et administration](#comptes-connexion-et-administration)
- [Développement](#développement)
- [Structure du projet](#structure-du-projet)
- [Sécurité](#sécurité)
- [Confidentialité, conditions et licence](#confidentialité-conditions-et-licence)

---

## Fonctionnalités

**Occasions**
- Titre, description, **journées choisies une à une** dans un calendrier (clic, glisser, ou tout un jour de la semaine),
  **heures de la journée** (ex. 9 h → 22 h) et date de fin d'édition facultative. Le créateur peut ajouter ou retirer
  des journées ensuite ; retirer une journée supprime ses plages.
- Lien de partage : l'ouvrir associe automatiquement le visiteur à l'occasion.
- Liste « Mes occasions » avec onglets *En cours et à venir* / *Que je gère* / *Archives* et filtre par organisation.
  Une couronne 👑 signale les occasions que l'on gère (créées par soi, ou d'une organisation que l'on administre).
- Archivage automatique après la dernière journée, ou manuel par le créateur (annulable tant qu'elle n'est pas passée).
  Une occasion archivée ou dont l'édition est fermée est en lecture seule.

**Calendrier et plages**
- Vues **Jour**, **Semaine** et **Mois** (semaines du dimanche au samedi). Seules les journées choisies sont ouvertes,
  les autres sont grisées ; dans l'éditeur, ‹ › passent d'une journée choisie à la suivante.
- En vues Jour et Semaine, chaque plage est une barre étroite : heure de début en haut, initiales de la personne au
  milieu, heure de fin en bas.
- Un clic sur une journée ouvre l'éditeur de plages :
  - **ordinateur** : timeline horizontale (ma ligne, en pointillé, est la seule où l'on dessine) ; cliquer ou glisser
    pour créer, déplacer ou étirer une plage, la glisser hors de la ligne pour la supprimer. Les lignes des autres
    invités sont affichées en dessous, alignées sur les mêmes heures ;
  - **cellulaire** : deux lignes, *avant-midi* et *après-midi*, pour voir toute la journée d'un coup ; toucher ou glisser
    pour créer, poignées pour redimensionner, glisser pour déplacer (même d'une ligne à l'autre). Les plages des autres
    invités sont listées en dessous.
- « Nouvelle plage » ouvre une petite fenêtre (heures de début et de fin, ajouts rapides : Matin, Après-midi, Soirée,
  Journée). L'en-tête de l'éditeur et le bouton Fermer restent visibles pendant le défilement.
- Plusieurs plages par jour, sans chevauchement (deux plages bout à bout sont fusionnées). Pas de 15 minutes.

**Rapport**
- Carte de chaleur de toutes les plages superposées : plus la couleur est foncée, plus il y a de monde disponible ;
  le pourcentage s'affiche dans les zones les plus foncées.
- « Meilleurs moments » (top 5), liés par survol à la carte de chaleur ; un clic ouvre la journée.

**Personnes**
- Nom demandé une seule fois (courriel facultatif) ; la personne apparaît dans la liste des invités, visible de tous.
  La fenêtre « Bienvenue ! » propose de **se connecter** à un compte existant, et avertit quand le nom tapé est déjà
  celui d'un invité de l'occasion (pour éviter les comptes en double).
- Liste des invités : survoler un nom grise les plages des autres dans le calendrier ; cliquer sur des noms (icône 👁)
  n'affiche temporairement que ces personnes (« Tout afficher » pour revenir).
- Présence en direct : qui est en ligne, qui modifie quelle journée (la plage bouge chez les autres pendant qu'on la déplace).
- Le créateur d'une occasion (ou un admin de son organisation) peut **retirer** ou **ajouter** des invités.

**Organisations**
- Nom, logo (affiché en haut des pages de ses occasions, agrandissable d'un clic) et responsable.
- Ouvrir le lien d'une occasion d'une organisation en rend membre automatiquement.
- *Mode libre* : tous les membres créent des occasions. *Mode autorisé* : seuls les membres cochés.
- Rôle **administrateur** : gère l'organisation (membres, droits, logo) et les invités de ses occasions.
- À la création d'une occasion, « **Tous les membres** » l'associe à tous les membres, actuels et futurs.

**Comptes et appareils**
- Bouton 📱 : un code QR à usage unique (10 min) lie le cellulaire à la même identité.
  Si le cellulaire avait déjà un compte, il propose de **fusionner** les deux comptes.
- **Mot de passe** facultatif, choisi dans « Mon profil » : on se reconnecte à `/connexion` avec son courriel.
- **Lien de connexion par courriel** (sans mot de passe), à usage unique, valide 30 minutes ; il ramène à la page
  d'où l'on venait.

**Administration du site**
- Page **Administration** (onglets Comptes, Organisations, Occasions) réservée à l'administrateur du site :
  créer un compte déjà associé à des organisations et occasions, définir courriel et mot de passe, créer un lien
  de connexion (7 jours), fusionner des comptes en double, supprimer comptes, occasions et organisations.
- L'administrateur gère toutes les organisations et occasions depuis leurs propres pages, sans y être ajouté.

**Interface**
- Adaptée au cellulaire (menu compact, éditeur tactile) et à l'ordinateur.
- **Mode sombre** : suit le thème de l'appareil par défaut ; bouton ☀️ / 🌙 / 🖥️ pour forcer clair ou sombre (mémorisé).
- Quand une fenêtre est ouverte, la page derrière ne défile plus.
- Les onglets ont leur adresse (`#calendrier`, `#rapport`, `/admin#comptes`…) : un rechargement garde l'onglet.

---

## Démarrage rapide

Prérequis : Docker et Docker Compose.

```bash
cp .env.example .env          # facultatif : des valeurs par défaut sont prévues
docker compose up -d --build
```

Ouvrir **http://localhost:5173**.

Le schéma de la base est créé (et mis à jour) automatiquement au démarrage du backend.

---

## Architecture

```
 Navigateur ──► frontend (Vite, :5173) ──proxy /api, /socket.io──► backend (Node, :3000) ──► db : calendar_dev
 Internet ──► Cloudflare ──► tunnel (cloudflared) ──► web (Node, prod) ──► db : calendar
                                                                      └──► redis (temps réel entre serveurs)
```

| Service    | Rôle |
|------------|------|
| `frontend` | Serveur de développement Vite (Svelte 5 + Tailwind 4). Relaie `/api` et `/socket.io` vers le backend. |
| `backend`  | Développement : API REST (Express 5), cookie d'identification, Socket.IO, sur la base `calendar_dev`. Rechargé à chaque modification. |
| `db`       | MySQL 8.4 : base `calendar` (production) et `calendar_dev` (développement). |
| `redis`    | Temps réel partagé entre serveurs de production (adaptateur Socket.IO). Le développement ne s'y relie pas. |
| `web`      | *Profil `public`* — image de production : frontend compilé servi par le backend. |
| `tunnel`   | *Profil `public`* — `cloudflared`, publie `web` sur Internet. |

Tous les services ont `restart: unless-stopped` : ils repartent seuls après un redémarrage de la machine
(dès que Docker démarre), sauf s'ils ont été arrêtés volontairement.

---

## Configuration

Variables du fichier `.env` (modèle : `.env.example`) :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `APP_PORT` | `5173` | Port local du serveur de développement. |
| `APP_TIMEZONE` | `America/Toronto` | Fuseau utilisé pour « aujourd'hui » (archivage) et les dates limites d'édition. |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD` | `calendar` / `root` | Accès MySQL. **À changer** pour un usage réel. |
| `DEV_DB_NAME` | `calendar_dev` | Base du serveur de développement (voir [Développement](#développement)). |
| `DB_PUBLIC_PORT` | `3307` | Port MySQL exposé sur la machine (outils d'administration). |
| `COOKIE_SECURE` | `false` | Cookie `Secure` pour le serveur de développement (le service `web` l'active toujours). |
| `PUBLIC_HOSTNAME` | — | Adresse publique (ex. `disponibilites.example.com`) : publication et codes QR. |
| `TUNNEL_NAME` | `disponibilites` | Nom du tunnel Cloudflare. |
| `WEB_PORT` | `8090` | Port local (127.0.0.1) du service de production. |
| `COMPOSE_PROFILES` | — | `public` pour que `docker compose up -d` démarre aussi `web` et `tunnel`. |
| `RESEND_API_KEY` | — | Clé du service [Resend](https://resend.com) : envoi des liens de connexion par courriel. Sans elle, cette option est désactivée. |
| `MAIL_FROM` | `Disponibilités <onboarding@resend.dev>` | Expéditeur des courriels, sur un domaine vérifié dans Resend (l'adresse par défaut n'écrit qu'au titulaire du compte Resend). |

---

## Fonctionnement détaillé

### Identification sans compte
- **Sur invitation** : seule l'ouverture du lien d'une occasion (`GET /api/occasions/:slug`) crée un utilisateur et
  pose le cookie `rc_uid` (httpOnly, expiration en 9999). Sans cookie, l'accueil affiche une page de présentation
  du projet (avec ces captures ; accessible à tous à `/a-propos`, lien « À propos » du pied de page) et l'API
  refuse tout le reste (401), sauf `GET /me`, la liaison d'appareil, la connexion et les logos : impossible de
  créer une occasion ou une organisation sans avoir été invité.
  Les navigateurs plafonnant la durée des cookies (400 jours pour Chrome), il est réémis à chaque appel : il
  n'expire pas tant que la personne revient.
- **Lier un appareil** : l'ordinateur génère un jeton aléatoire (stocké sous forme d'empreinte SHA-256, valable
  10 minutes, utilisable une fois) affiché en code QR. Le cellulaire qui l'ouvre reçoit le cookie de la même personne.
  Fusion : participations, plages (celles de l'ordinateur gagnent en cas de doublon le même jour), occasions créées
  et organisations sont rattachées au compte de l'ordinateur ; l'ancien compte est supprimé.

### Règles
- **Journées** : au moins une, aucune dans le passé à l'ajout ; stockées dans la table `occasion_days`.
- **Plages** : sur une journée choisie, dans les heures de l'occasion, sans chevauchement pour une même personne.
- **Lecture seule** : occasion archivée, ou date de fin d'édition dépassée.
- **Retrait** : un invité ou un membre retiré n'est pas réintégré en rouvrant un lien ; seul un responsable,
  un admin ou le créateur peut le réintégrer.
- Toutes les règles sont vérifiées par le serveur, pas seulement par l'interface.

### Droits

| Action | Qui |
|--------|-----|
| Modifier / archiver une occasion | Son créateur, l'administrateur du site |
| Retirer / ajouter des invités | Le créateur, un admin de l'organisation de l'occasion, l'administrateur du site |
| Créer une occasion dans une organisation | Responsable, admins ; tous les membres en mode libre ; membres cochés en mode autorisé |
| Gérer une organisation (membres, droits, logo, mode) | Responsable et admins, l'administrateur du site |
| Supprimer une organisation | Le responsable, l'administrateur du site |
| Supprimer une occasion ; gérer les comptes | L'administrateur du site |

---

## Temps réel

Socket.IO, une salle par occasion. Les modifications passent par l'API REST, qui diffuse ensuite l'événement.
Avec `REDIS_URL`, plusieurs serveurs de production partagent leurs événements ; la présence est calculée sur les
connexions de tous les serveurs. Le serveur de développement, qui a sa propre base, ne s'y relie pas.

| Événement | Sens | Contenu |
|-----------|------|---------|
| `occasion:join` / `occasion:leave` | client → serveur | `slug` (accusé : `{ ok, presence }`) |
| `editing` | client → serveur | `{ day, start, end, slotId?, deleting? }` ou `null` |
| `presence` | serveur → clients | `{ online: [userId], editing: [{ userId, day, start, end, slotId, deleting }] }` |
| `slots:day` | serveur → clients | `{ userId, day, slots }` — remplace les plages de ce jour pour cette personne |
| `participant:upsert` | serveur → clients | `{ id, name, email }` |
| `participant:removed` | serveur → clients | `{ userId }` |
| `occasion:updated` | serveur → clients | occasion |
| `occasion:deleted` | serveur → clients | `{ slug }` — supprimée par l'administrateur |

---

## API REST

Préfixe `/api`. Toutes les routes identifient le visiteur par son cookie ; sans cookie, seules `GET /me`,
`GET /occasions/:slug` (qui crée le visiteur), `GET /link/preview/:token`, `POST /link/claim`, `POST /auth/login`, `POST /auth/email-link` et
`GET /organizations/:id/logo` répondent. Les routes `/admin/…` sont réservées à l'administrateur du site. Les heures sont en minutes depuis minuit.

| Méthode | Route | Description |
|---------|-------|-------------|
| GET / PUT | `/me` | Profil (nom, courriel) |
| GET / POST | `/occasions` | Mes occasions / créer `{ title, days: ['YYYY-MM-DD', …], dayStart, dayEnd, … }` |
| GET / PATCH | `/occasions/:slug` | Détail avec `days` (rejoint l'occasion) / paramètres (dont `days`) |
| POST | `/occasions/:slug/archive` | Archiver `{ archived }` |
| POST · PATCH · DELETE | `/occasions/:slug/slots[/:id]` | Plages : ajouter `{ day, start, end }`, modifier, supprimer |
| GET | `/occasions/:slug/candidates` | Personnes ajoutables comme invités |
| POST · DELETE | `/occasions/:slug/participants[/:userId]` | Ajouter `{ userIds }` / retirer un invité |
| POST | `/occasions/:slug/owner` | Donner la propriété à un invité `{ userId }` |
| GET / POST | `/organizations` | Mes organisations / créer |
| GET · PATCH · DELETE | `/organizations/:id` | Détail (membres pour les gestionnaires) / modifier / supprimer |
| PUT · DELETE | `/organizations/:id/members/:userId` | Droits `{ canCreate, isAdmin }` / retirer |
| POST | `/organizations/:id/members/:userId/restore` | Réintégrer un membre |
| GET · PUT · DELETE | `/organizations/:id/logo` | Logo (PNG, JPEG, WebP, GIF, SVG ; 2 Mo) |
| POST | `/link` | Créer un code QR de liaison |
| GET | `/link/:id/status` | Le code a-t-il été utilisé ? |
| GET | `/link/preview/:token` | Comptes concernés (avant confirmation) |
| POST | `/link/claim` | Lier l'appareil `{ token, merge }` |
| POST | `/auth/login` · `/auth/logout` | Connexion `{ email, password }` / oublier le compte sur cet appareil |
| POST | `/auth/email-link` | Recevoir un lien de connexion par courriel `{ email, retour }` |
| PUT | `/me/password` | Choisir ou changer mon mot de passe `{ password, currentPassword }` |
| GET / POST | `/admin/users` | Tous les comptes / créer `{ name, email, password, organizationIds, occasionIds }` |
| GET · PATCH · DELETE | `/admin/users/:id` | Fiche / modifier `{ name, email, password, isSiteAdmin }` / supprimer |
| POST | `/admin/users/:id/link` | Lien de connexion (usage unique, 7 jours) |
| POST | `/admin/users/:id/merge` | Fusionner dans un autre compte `{ intoUserId }` |
| POST · DELETE | `/admin/users/:id/organizations[/:orgId]` | Ajouter à une organisation / retirer |
| POST · DELETE | `/admin/users/:id/occasions[/:occasionId]` | Inviter à une occasion / retirer |
| GET | `/admin/organizations` · `/admin/occasions` | Toutes les organisations / occasions |
| DELETE | `/admin/occasions/:id` | Supprimer une occasion (journées, invités, plages) ; une organisation se supprime par `DELETE /organizations/:id` |

---

## Publication sur Internet (Cloudflare Tunnel)

Le service `tunnel` (image officielle `cloudflare/cloudflared`) ouvre une connexion **sortante** vers Cloudflare :
aucun port n'est ouvert sur la machine ni sur le routeur, HTTPS et WebSocket sont gérés par Cloudflare. Il publie le
service `web` (production) ; le serveur de développement Vite n'est jamais exposé.

Prérequis : `cloudflared` installé et connecté au compte (`cloudflared tunnel login`), `jq`, et un domaine géré par Cloudflare.

```bash
# .env : PUBLIC_HOSTNAME=disponibilites.example.com
scripts/web.sh publish   # une seule fois : tunnel + DNS, active le profil « public », démarre
docker compose up -d     # ensuite : démarre aussi web + tunnel
scripts/web.sh status    # état des conteneurs, du tunnel et du site
scripts/web.sh stop      # retire le site public (le développement continue)
scripts/web.sh logs      # journaux du tunnel
```

Les identifiants du tunnel sont écrits dans `deploy/cloudflared/` (mode 600, hors Git).
Après une modification du code, reconstruire la production : `docker compose up -d --build web`.

---

## Comptes, connexion et administration

Un compte naît en ouvrant le lien d'une occasion ; l'appareil le garde par un cookie permanent. Si ce cookie se
perd (autre navigateur, données effacées), on retrouve son compte :

- **par mot de passe** : chacun peut en choisir un dans « Mon profil » (le courriel sert d'identifiant), puis se
  connecter à la page `/connexion`. Un compte vide créé entre-temps sur l'appareil est supprimé à la connexion ;
- **par lien reçu par courriel** : sur `/connexion`, « Recevoir un lien par courriel » (usage unique, 30 minutes).
  La réponse est la même que l'adresse ait un compte ou non ; envoi par [Resend](https://resend.com) (`RESEND_API_KEY`,
  `MAIL_FROM`). Pour écrire à n'importe quelle adresse, le domaine de `MAIL_FROM` doit être vérifié dans Resend
  (enregistrements SPF et DKIM dans le DNS) ;
- **par lien de connexion** : l'administrateur en crée un (usage unique, 7 jours) depuis la fiche du compte.

L'**administrateur du site** voit et gère toutes les organisations et occasions (comme leur responsable, sans y
être ajouté), et tous les comptes depuis la page **Administration** : créer un compte déjà associé à des
organisations et occasions, définir son courriel et son mot de passe, fusionner des doublons, supprimer.

Le premier administrateur est désigné sur le serveur :

```bash
docker compose exec web node src/cli.js admin <courriel ou numéro de compte>    # unadmin pour retirer
docker compose exec web node src/cli.js merge <numéro source> <numéro cible>     # fusionner deux comptes
```

(`backend` au lieu de `web` pour la base de développement.)

---

## Développement

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

---

## Structure du projet

```
.
├── docker-compose.yml        services (développement, Redis, production, tunnel)
├── Dockerfile                image de production (frontend compilé + backend)
├── scripts/web.sh            publication Cloudflare Tunnel
├── scripts/dev-db.sh         base de développement (création, copie de la production)
├── LICENSE                   domaine public (Unlicense)
├── logos/                    logo de l'application, original haute résolution
├── backend/
│   └── src/
│       ├── index.js          serveur HTTP, en-têtes de sécurité, fichiers statiques
│       ├── db.js             connexion MySQL et migrations
│       ├── auth.js           cookie d'identification, mots de passe
│       ├── account.js        connexion, lien par courriel, déconnexion, choix du mot de passe
│       ├── mail.js           envoi des courriels (Resend)
│       ├── admin.js          administration du site (comptes, organisations, occasions)
│       ├── cli.js            commandes serveur (désigner un administrateur, fusionner des comptes)
│       ├── routes.js         occasions, plages, invités, archives
│       ├── organizations.js  organisations, membres, rôles, logos
│       ├── link.js           liaison d'appareils par code QR, fusion de comptes
│       ├── socket.js         temps réel et présence (adaptateur Redis)
│       └── clock.js          date et heure dans le fuseau de l'application
└── frontend/
    ├── public/captures/  captures d'écran (README et page de présentation)
    └── src/
        ├── App.svelte        en-tête, menu, routage
        ├── pages/            Landing, Home, Occasion, Organizations, LinkClaim, Login, Admin, Privacy, Terms
        ├── components/       calendrier (Calendar, MonthView, TimeGrid, DayOverlay), Report,
        │                     GuestList, éditeurs d'occasion et d'organisation, LinkDevice…
        └── lib/              API, dates, socket, routeur, session, thème, verrouillage du défilement,
                              onglets dans l'adresse (hashTab), version des images (assets)
```

---

## Sécurité

- Cookie `httpOnly`, `SameSite=Lax`, `Secure` en production.
- Jetons de liaison stockés sous forme d'empreinte, usage unique (code QR : 10 minutes ; lien de connexion : 7 jours).
- Mots de passe hachés avec `scrypt` (sel aléatoire) ; 10 échecs de connexion par adresse ou par IP bloquent 15 minutes.
- Liens de connexion par courriel : même réponse que l'adresse existe ou non (on ne peut pas deviner qui est inscrit),
  3 demandes par adresse et 10 par IP toutes les 15 minutes ; l'adresse de retour n'accepte que des pages du site.
- Logos : type et signature vérifiés ; servis avec `nosniff` et une politique CSP `sandbox` (un SVG ne peut pas exécuter de script).
- Conteneurs `web`, `tunnel` et `redis` verrouillés : système de fichiers en lecture seule, aucune capacité Linux,
  `no-new-privileges`, mémoire limitée. Le port de `web` n'est publié que sur `127.0.0.1`.
- Les fichiers sensibles (`.env`, `deploy/`) sont exclus de Git.
- Les mots de passe MySQL par défaut sont destinés au développement : changez-les dans `.env`.

---

## Confidentialité, conditions et licence

- Pages **Confidentialité et témoins** (`/confidentialite`) et **Conditions d'utilisation** (`/conditions`), liées dans le
  pied de page. Elles suivent la loi québécoise sur la protection des renseignements personnels (Loi 25) : un seul témoin,
  essentiel (`rc_uid`), aucun pistage ; renseignements recueillis, finalités, destinataires, prestataire (Cloudflare),
  conservation et droits.
- Le responsable de la protection des renseignements personnels se configure dans `.env` :
  `LEGAL_CONTACT_NAME`, `LEGAL_CONTACT_EMAIL` (affichés sur ces pages).
- **Licence** : domaine public ([Unlicense](LICENSE)).

