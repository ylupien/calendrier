<script>
  import { link } from '../lib/router.svelte.js';
  import { session } from '../lib/session.svelte.js';

  const UPDATED = '1er novembre 2026';
  const contact = $derived(session.me?.legal ?? {});
</script>

{#snippet contactBlock()}
  {#if contact.contactEmail}
    <p>
      <strong>{contact.contactName ?? 'Responsable de la protection des renseignements personnels'}</strong><br />
      Responsable de la protection des renseignements personnels<br />
      <a class="text-link" href="mailto:{contact.contactEmail}">{contact.contactEmail}</a>
    </p>
  {:else}
    <p class="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
      Les coordonnées du responsable de la protection des renseignements personnels ne sont pas encore configurées.
    </p>
  {/if}
{/snippet}

<article class="legal">
  <a href="/" onclick={link} class="text-link text-sm font-medium">← Mes occasions</a>
  <h1>Confidentialité et témoins</h1>
  <p class="updated">Dernière mise à jour : {UPDATED}</p>

  <p>
    Cette page explique, en termes simples, quels renseignements l'application <em>Disponibilités</em> recueille,
    pourquoi, qui peut les voir et quels sont vos droits. Elle s'appuie sur la <em>Loi sur la protection des
    renseignements personnels dans le secteur privé</em> du Québec, modernisée par la Loi 25.
  </p>

  <h2>En bref</h2>
  <ul>
    <li>L'application utilise <strong>un seul témoin (cookie)</strong>, strictement nécessaire à son fonctionnement.
      Il n'est créé que lorsque vous ouvrez le lien d'une occasion qu'on vous a partagé (ou liez un appareil) :
      une simple visite de la page d'accueil n'en crée aucun.</li>
    <li><strong>Aucun</strong> témoin publicitaire, de mesure d'audience, de pistage ou de réseau social.</li>
    <li>Aucune vente, location ni communication de vos renseignements à des fins commerciales.</li>
    <li>Pas de compte ni de mot de passe : seul votre nom est demandé, le courriel est facultatif.</li>
  </ul>

  <h2>Témoins et stockage dans votre navigateur</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Nom</th><th>Type</th><th>Utilité</th><th>Durée</th></tr></thead>
      <tbody>
        <tr>
          <td data-label="Nom"><code>rc_uid</code></td>
          <td data-label="Type">Témoin essentiel</td>
          <td data-label="Utilité">Reconnaître votre navigateur pour retrouver vos occasions et vos disponibilités, sans compte ni mot de passe.
            Il contient un identifiant aléatoire, rien d'autre. Créé à l'ouverture d'un lien d'invitation ou à la liaison d'un appareil.</td>
          <td data-label="Durée">Renouvelé à chaque visite (les navigateurs le limitent à environ 400 jours sans visite)</td>
        </tr>
        <tr>
          <td data-label="Nom"><code>theme</code></td>
          <td data-label="Type">Préférence (stockage local)</td>
          <td data-label="Utilité">Retenir le thème choisi (clair, sombre ou celui de l'appareil). Reste sur votre appareil.</td>
          <td data-label="Durée">Jusqu'à ce que vous le changiez ou effaciez les données du site</td>
        </tr>
        <tr>
          <td data-label="Nom"><code>occasions.orgFilter</code></td>
          <td data-label="Type">Préférence (stockage local)</td>
          <td data-label="Utilité">Retenir le filtre par organisation de « Mes occasions ». Reste sur votre appareil.</td>
          <td data-label="Durée">Idem</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>
    Comme ces éléments sont nécessaires au service demandé ou ne servent qu'à retenir vos préférences, aucune bannière
    de consentement n'est affichée. L'application n'utilise aucune technologie permettant de vous localiser ou de
    vous profiler. Effacer les témoins de ce site vous déconnecte de votre identité : utilisez alors
    « Lier un cellulaire » au préalable si vous voulez la conserver sur un autre appareil.
  </p>

  <h2>Renseignements recueillis</h2>
  <ul>
    <li><strong>Votre nom</strong> (obligatoire) et <strong>votre courriel</strong> (facultatif), saisis par vous.</li>
    <li><strong>Vos plages de disponibilité</strong> et les occasions auxquelles vous participez.</li>
    <li>Les occasions et organisations que vous créez (titre, description, journées, heures, logo).</li>
    <li>Des renseignements techniques : l'identifiant du témoin, la date de création et de dernière visite.
      L'application ne conserve pas votre adresse IP.</li>
  </ul>

  <h2>Pourquoi</h2>
  <p>
    Uniquement pour faire fonctionner le service : afficher les disponibilités de chacun, trouver les moments communs,
    gérer les invités et les organisations, et lier vos appareils. Aucune autre utilisation n'en est faite.
  </p>

  <h2>Qui peut voir vos renseignements</h2>
  <ul>
    <li><strong>Les autres participants d'une occasion</strong> voient votre nom, votre courriel si vous l'avez fourni,
      et vos plages de disponibilité pour cette occasion. Toute personne qui reçoit le lien d'une occasion peut s'y joindre.</li>
    <li><strong>Les responsables et administrateurs d'une organisation</strong> voient la liste de ses membres (nom et courriel).</li>
    <li><strong>Le responsable du service</strong>, pour l'exploitation technique.</li>
  </ul>

  <h2>Hébergement et prestataire</h2>
  <p>
    L'application est hébergée sur un serveur exploité par le responsable du service. Pour la publier sur Internet,
    le trafic transite par <strong>Cloudflare</strong> (entreprise établie aux États-Unis), qui assure la connexion
    sécurisée (HTTPS). Cloudflare traite à cette fin des données techniques de connexion, comme votre adresse IP,
    sans les stocker dans l'application.
  </p>

  <h2>Conservation</h2>
  <p>
    Vos renseignements sont conservés tant que vous utilisez le service. Lorsqu'un invité est retiré d'une occasion,
    ses plages de disponibilité pour cette occasion sont supprimées. Vous pouvez demander en tout temps la suppression
    de vos renseignements (voir ci-dessous). Les codes de liaison d'appareil expirent après 10 minutes.
  </p>

  <h2>Sécurité</h2>
  <p>
    Connexion chiffrée (HTTPS), témoin inaccessible aux scripts (<code>HttpOnly</code>), codes de liaison stockés sous
    forme d'empreinte et valables une seule fois, serveurs isolés avec des droits minimaux.
  </p>

  <h2>Vos droits</h2>
  <p>Vous pouvez en tout temps :</p>
  <ul>
    <li><strong>consulter et corriger</strong> votre nom et votre courriel (menu de votre profil, en haut à droite) ;</li>
    <li>demander <strong>l'accès</strong> à l'ensemble des renseignements vous concernant, ou leur <strong>communication</strong>
      dans un format technologique structuré et couramment utilisé ;</li>
    <li>demander leur <strong>suppression</strong> ou retirer votre consentement ;</li>
    <li>porter plainte auprès de la <a class="text-link" href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener">Commission
      d'accès à l'information du Québec</a>.</li>
  </ul>
  <p>Pour exercer ces droits ou pour toute question, écrivez au responsable :</p>
  {@render contactBlock()}

  <h2>Modifications</h2>
  <p>Cette page peut être mise à jour ; la date en haut indique la dernière version.</p>

  <p class="note">
    Voir aussi les <a href="/conditions" onclick={link} class="text-link">conditions d'utilisation</a>.
  </p>
</article>
