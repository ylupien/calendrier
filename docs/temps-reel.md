[← Documentation technique](README.md)

# Temps réel

Socket.IO, une salle par occasion. Les modifications passent par l'API REST, qui diffuse ensuite l'événement.
Avec `REDIS_URL`, plusieurs serveurs de production partagent leurs événements ; la présence est calculée sur les
connexions de tous les serveurs. Le serveur de développement, qui a sa propre base, ne s'y relie pas.

| Événement | Sens | Contenu |
|-----------|------|---------|
| `occasion:join` / `occasion:leave` | client → serveur | `slug` (accusé : `{ ok, presence }`) |
| `editing` | client → serveur | `{ day, start, end, slotId?, deleting? }` ou `null` |
| `presence` | serveur → clients | `{ online: [userId], editing: [{ userId, day, start, end, slotId, deleting }] }` |
| `slots:day` | serveur → clients | `{ userId, day, slots }` — remplace les plages de ce jour pour cette personne |
| `participant:upsert` | serveur → clients | `{ id, name, email, active }` |
| `participant:removed` | serveur → clients | `{ userId }` |
| `occasion:updated` | serveur → clients | occasion |
| `occasion:deleted` | serveur → clients | `{ slug }` — supprimée par l'administrateur |
| `organization:updated` | serveur → clients | `{ id, name, mode, logoUrl, logoDarkUrl, logoBackground }` — nom ou logo changé |
| `organization:deleted` | serveur → clients | `{ id }` |

**Organisations** : à sa connexion, chaque socket rejoint la salle `org:<id>` de chaque organisation dont la
personne est membre (et `site-admins` pour l'administrateur) ; ouvrir une occasion fait aussi rejoindre la salle de
son organisation. Toute modification d'une organisation (nom, mode, logos) y est diffusée : l'en-tête et les logos
(`OrgLogo`, via `frontend/src/lib/orgLive.svelte.js`) changent tout de suite, les listes (Occasions, Organisations,
Administration) et la page de l'organisation se rechargent.
