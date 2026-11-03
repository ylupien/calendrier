[← Documentation technique](README.md)

# API REST

Préfixe `/api`. Toutes les routes identifient le visiteur par son cookie ; sans cookie, seules `GET /me`,
`GET /occasions/:slug` (qui crée le visiteur), `GET /link/preview/:token`, `POST /link/claim`, `POST /auth/login`, `POST /auth/email-link` et
`GET /logos/:id` (et l'ancienne adresse `GET /organizations/:id/logo`) répondent. Les routes `/admin/…` sont réservées à l'administrateur du site. Les heures sont en minutes depuis minuit.

| Méthode | Route | Description |
|---------|-------|-------------|
| GET / PUT | `/me` | Profil (nom, courriel) |
| GET / POST | `/occasions` | Mes occasions / créer `{ title, days: ['YYYY-MM-DD', …], dayStart, dayEnd, … }` |
| GET / PATCH | `/occasions/:slug` | Détail avec `days` (rejoint l'occasion) / paramètres (dont `days`) |
| POST | `/occasions/:slug/archive` | Archiver `{ archived }` |
| POST · PATCH · DELETE | `/occasions/:slug/slots[/:id]` | Plages : ajouter `{ day, start, end }`, modifier, supprimer |
| GET | `/occasions/:slug/candidates` | Personnes ajoutables comme invités |
| POST · DELETE | `/occasions/:slug/participants[/:userId]` | Ajouter `{ userIds }` / retirer un invité |
| POST | `/occasions/:slug/invitations` | Inviter par courriel `{ invitees: [{ name?, email }], message? }` (50 max ; renvoie aussi) |
| POST | `/occasions/:slug/owner` | Donner la propriété à un invité `{ userId }` |
| GET / POST | `/organizations` | Mes organisations / créer |
| GET · PATCH · DELETE | `/organizations/:id` | Détail (membres pour les gestionnaires) / modifier / supprimer |
| PUT · DELETE | `/organizations/:id/members/:userId` | Droits `{ canCreate, isAdmin }` / retirer |
| POST | `/organizations/:id/members/:userId/restore` | Réintégrer un membre |
| PUT · DELETE | `/organizations/:id/logo` | Logo personnalisé (PNG, JPEG, WebP, GIF, SVG ; 2 Mo) |
| POST | `/organizations/:id/generic-logos` | Créer un logo de la galerie (PNG composé ; `?emblem=&font=&caption=&background=`) |
| PUT | `/organizations/:id/logos/:logoId/dark` | Image d'un logo de la galerie pour fond sombre |
| DELETE | `/organizations/:id/logos/:logoId` | Effacer un logo |
| PATCH | `/organizations/:id` | … `{ logoId }` : logo affiché ; `{ logoBackground }` : fond du logo personnalisé |
| GET | `/logos/:id?v=` | Image d'un logo (publique) |
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
