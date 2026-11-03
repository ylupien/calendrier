[← Documentation technique](README.md)

# Fonctionnement détaillé

## Identification sans compte
- **Sur invitation** : seule l'ouverture du lien d'une occasion (`GET /api/occasions/:slug`) crée un utilisateur et
  pose le cookie `rc_uid` (httpOnly, expiration en 9999). Sans cookie, l'accueil affiche une page de présentation
  du projet (avec les captures du [README](../README.md#aperçu) ; accessible à tous à `/a-propos`, lien « À propos » du pied de page) et l'API
  refuse tout le reste (401), sauf `GET /me`, la liaison d'appareil, la connexion et les logos : impossible de
  créer une occasion ou une organisation sans avoir été invité.
  Les navigateurs plafonnant la durée des cookies (400 jours pour Chrome), il est réémis à chaque appel : il
  n'expire pas tant que la personne revient.
- **Page introuvable** : une adresse qui ne correspond à aucune page affiche une page 404 dans le cadre habituel
  (en-tête, menu, pied de page). En production, le serveur renvoie alors aussi le statut HTTP 404 ; la liste des
  pages est tenue à deux endroits, `frontend/src/App.svelte` (`PAGES`) et `backend/src/index.js` (`APP_PAGE`).
- **Lier un appareil** : l'ordinateur génère un jeton aléatoire (stocké sous forme d'empreinte SHA-256, valable
  10 minutes, utilisable une fois) affiché en code QR. Le cellulaire qui l'ouvre reçoit le cookie de la même personne.
  Fusion : participations, plages (celles de l'ordinateur gagnent en cas de doublon le même jour), occasions créées
  et organisations sont rattachées au compte de l'ordinateur ; l'ancien compte est supprimé.

## Règles
- **Journées** : au moins une, aucune dans le passé à l'ajout ; stockées dans la table `occasion_days`.
- **Logos** : table `logos` (fichier personnalisé et logos de la galerie) ; l'organisation pointe vers le logo affiché
  (`organizations.logo_id`). Voir [Développement](developpement.md#logos-de-lorganisation--personnalisé-ou-galerie).
- **Plages** : sur une journée choisie, dans les heures de l'occasion, sans chevauchement pour une même personne.
- **Lecture seule** : occasion archivée, ou date de fin d'édition dépassée.
- **Retrait** : un invité ou un membre retiré n'est pas réintégré en rouvrant un lien ; seul un responsable,
  un admin ou le créateur peut le réintégrer.
- Toutes les règles sont vérifiées par le serveur, pas seulement par l'interface.

## Droits

| Action | Qui |
|--------|-----|
| Modifier / archiver une occasion | Son créateur, l'administrateur du site |
| Retirer / ajouter des invités | Le créateur, un admin de l'organisation de l'occasion, l'administrateur du site |
| Créer une occasion dans une organisation | Responsable, admins ; tous les membres en mode libre ; membres cochés en mode autorisé |
| Gérer une organisation (membres, droits, logo, mode) | Responsable et admins, l'administrateur du site |
| Supprimer une organisation | Le responsable, l'administrateur du site |
| Supprimer une occasion ; gérer les comptes | L'administrateur du site |
