<script>
  import { link } from '../lib/router.svelte.js';
  import { session } from '../lib/session.svelte.js';
  import { REPO_URL } from '../lib/project.js';

  const UPDATED = '31 octobre 2026';
  const contact = $derived(session.me?.legal ?? {});
</script>

<article class="legal">
  <a href="/" onclick={link} class="text-link text-sm font-medium">← Mes occasions</a>
  <h1>Conditions d'utilisation</h1>
  <p class="updated">Dernière mise à jour : {UPDATED}</p>

  <p>
    En utilisant l'application <em>Disponibilités</em>, vous acceptez les conditions suivantes. Elles sont rédigées
    simplement ; en cas de question, écrivez au responsable du service (coordonnées en bas de page).
  </p>

  <h2>1. Le service</h2>
  <p>
    <em>Disponibilités</em> permet de créer des occasions, de partager un lien et d'indiquer ses plages de
    disponibilité afin de trouver un moment commun. Le service est offert gratuitement, sans compte ni mot de passe :
    votre navigateur est reconnu par un témoin essentiel (voir la page
    <a href="/confidentialite" onclick={link} class="text-link">Confidentialité et témoins</a>).
  </p>

  <h2>2. Liens de partage et accès</h2>
  <ul>
    <li>Toute personne qui reçoit le lien d'une occasion peut s'y joindre et voir les disponibilités des participants.
      Ne partagez le lien qu'avec les personnes concernées.</li>
    <li>Le créateur d'une occasion, ainsi que les responsables et administrateurs de son organisation, peuvent
      retirer des participants, modifier l'occasion ou l'archiver.</li>
    <li>Le code de liaison d'appareil (code QR) donne accès à votre identité dans l'application : ne le partagez pas.</li>
  </ul>

  <h2>3. Votre contenu et votre comportement</h2>
  <p>Vous êtes responsable de ce que vous saisissez (nom, titres, descriptions, logos). Vous vous engagez à :</p>
  <ul>
    <li>ne publier aucun contenu illégal, injurieux, discriminatoire ou portant atteinte aux droits d'autrui ;</li>
    <li>ne pas saisir de renseignements sensibles (santé, finances, numéros d'identification, etc.) dans les titres ou descriptions ;</li>
    <li>utiliser un nom qui ne se fait pas passer pour une autre personne ;</li>
    <li>ne pas tenter de perturber le service, d'y accéder sans autorisation ou de contourner ses mesures de sécurité.</li>
  </ul>
  <p>
    Le responsable du service peut retirer un contenu ou restreindre un accès qui ne respecte pas ces conditions.
  </p>

  <h2>4. Disponibilité du service</h2>
  <p>
    Le service est fourni « tel quel », sans garantie de disponibilité continue ni d'absence d'erreurs. Il peut être
    interrompu, notamment pour maintenance. Ne l'utilisez pas comme seul moyen de conserver une information importante.
  </p>

  <h2>5. Responsabilité</h2>
  <p>
    Dans la mesure permise par la loi, le responsable du service ne peut être tenu responsable des dommages indirects
    découlant de l'utilisation ou de l'impossibilité d'utiliser le service, ni du contenu publié par les utilisateurs.
  </p>

  <h2>6. Renseignements personnels</h2>
  <p>
    Le traitement de vos renseignements est décrit dans la page
    <a href="/confidentialite" onclick={link} class="text-link">Confidentialité et témoins</a>, qui fait partie des présentes conditions.
  </p>

  <h2>7. Code source</h2>
  <p>
    Le code source de l'application est public et versé dans le <strong>domaine public</strong>
    (<a class="text-link" href="{REPO_URL}/blob/main/LICENSE" target="_blank" rel="noopener">Unlicense</a>) :
    <a class="text-link" href={REPO_URL} target="_blank" rel="noopener">{REPO_URL.replace('https://', '')}</a>.
    Cette liberté porte sur le code, pas sur les contenus et renseignements saisis par les utilisateurs.
  </p>

  <h2>8. Modifications</h2>
  <p>
    Ces conditions peuvent être mises à jour ; la date en haut indique la dernière version. Continuer d'utiliser le
    service après une modification vaut acceptation de la nouvelle version.
  </p>

  <h2>9. Droit applicable</h2>
  <p>Ces conditions sont régies par les lois applicables au Québec.</p>

  <h2>10. Contact</h2>
  {#if contact.contactEmail}
    <p>
      {contact.contactName ?? 'Responsable du service'} —
      <a class="text-link" href="mailto:{contact.contactEmail}">{contact.contactEmail}</a>
    </p>
  {:else}
    <p class="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">Les coordonnées du responsable ne sont pas encore configurées.</p>
  {/if}
</article>
