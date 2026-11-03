[← Documentation technique](README.md)

# Publication sur Internet (Cloudflare Tunnel)

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
