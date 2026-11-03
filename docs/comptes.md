[← Documentation technique](README.md)

# Comptes, connexion et administration

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
