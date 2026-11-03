[← Documentation technique](README.md)

# Sécurité

- Cookie `httpOnly`, `SameSite=Lax`, `Secure` en production.
- Jetons de liaison stockés sous forme d'empreinte, usage unique (code QR : 10 minutes ; lien de connexion : 7 jours ;
  invitation à une occasion : 30 jours, une par invitation).
- Mots de passe hachés avec `scrypt` (sel aléatoire) ; 10 échecs de connexion par adresse ou par IP bloquent 15 minutes.
- Liens de connexion par courriel : même réponse que l'adresse existe ou non (on ne peut pas deviner qui est inscrit),
  3 demandes par adresse et 10 par IP toutes les 15 minutes ; l'adresse de retour n'accepte que des pages du site.
- Invitations par courriel : réservées au créateur et aux admins de l'organisation ; la réponse ne dit pas si une
  adresse avait déjà un compte ; au plus 50 adresses par envoi et 200 par heure et par personne.
- Logos : type et signature vérifiés ; servis avec `nosniff` et une politique CSP `sandbox` (un SVG ne peut pas exécuter de script).
  Logos de la galerie : symbole et police limités à des identifiants simples, 30 logos au plus par organisation.
- Conteneurs `web`, `tunnel` et `redis` verrouillés : système de fichiers en lecture seule, aucune capacité Linux,
  `no-new-privileges`, mémoire limitée. Le port de `web` n'est publié que sur `127.0.0.1`.
- Les fichiers sensibles (`.env`, `deploy/`) sont exclus de Git.
- Les mots de passe MySQL par défaut sont destinés au développement : changez-les dans `.env`.
