[← Documentation technique](README.md)

# Architecture

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

## Structure du projet

```
.
├── docker-compose.yml        services (développement, Redis, production, tunnel)
├── Dockerfile                image de production (frontend compilé + backend)
├── scripts/web.sh            publication Cloudflare Tunnel
├── scripts/dev-db.sh         base de développement (création, copie de la production)
├── LICENSE                   domaine public (Unlicense)
├── docs/                     documentation technique (ce dossier)
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
