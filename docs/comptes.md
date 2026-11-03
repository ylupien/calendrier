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

## Invitation par courriel

Le créateur d'une occasion (ou un administrateur de son organisation) invite des personnes par courriel depuis
la boîte **Participants** (« ✉️ Inviter par courriel ») :

- chaque adresse est rattachée au compte qui l'utilise déjà ; sinon un compte est **préparé** (nom tiré de
  l'adresse s'il n'est pas indiqué, modifiable ensuite dans « Mon profil ») ;
- la personne est ajoutée à l'occasion et reçoit un **lien personnel** (`/lier/<jeton>?retour=/o/<slug>&invitation=1`,
  usage unique, 30 jours) qui connecte l'appareil à ce compte puis ouvre l'occasion. Ces jetons (`kind = 'invite'`)
  ne remplacent pas les codes QR ni les liens de connexion, et inversement ;
- la réponse ne dit pas si une adresse avait déjà un compte ; au plus 200 adresses par heure et par personne.

**Membres et invités** : `users.activated_at` note la première vraie utilisation du compte (une requête avec son
cookie). Tant qu'il est vide, la personne est « invitée » : affichée en gris, sous une ligne, dans la boîte
Participants, avec « Renvoyer l'invitation » dans son menu. À sa première visite, elle passe en couleur chez tout
le monde, en temps réel. Les comptes créés par l'administrateur sont aussi « invités » jusqu'à leur première visite.

## Administration

L'**administrateur du site** voit et gère toutes les organisations et occasions (comme leur responsable, sans y
être ajouté), et tous les comptes depuis la page **Administration** : créer un compte déjà associé à des
organisations et occasions, définir son courriel et son mot de passe, fusionner des doublons, supprimer.

Le premier administrateur est désigné sur le serveur :

```bash
docker compose exec web node src/cli.js admin <courriel ou numéro de compte>    # unadmin pour retirer
docker compose exec web node src/cli.js merge <numéro source> <numéro cible>     # fusionner deux comptes
```

(`backend` au lieu de `web` pour la base de développement.)
