<script>
  // Presentation page for a visitor without an account (accounts are only created by an invitation link).
  import { REPO_URL } from '../lib/project.js';
  import { session } from '../lib/session.svelte.js';
  import { link } from '../lib/router.svelte.js';

  const FEATURES = [
    { icon: '🗓️', title: 'Journées au choix', text: "Choisissez précisément les journées et les heures de l'occasion, puis partagez son lien." },
    { icon: '🖱️', title: 'Plages à la souris', text: 'Glissez pour indiquer vos disponibilités, plusieurs plages par jour, au doigt sur cellulaire.' },
    { icon: '⚡', title: 'En temps réel', text: "Chacun voit les disponibilités des autres s'afficher pendant qu'elles sont saisies." },
    { icon: '📊', title: 'Meilleurs moments', text: 'Une carte de chaleur fait ressortir les moments où le plus de personnes sont libres.' },
    { icon: '🏢', title: 'Organisations', text: 'Regroupez vos membres sous un logo et invitez-les tous en un clic.' },
    { icon: '🔒', title: 'Sans compte', text: 'Ni mot de passe ni pistage : un seul témoin essentiel, et un code QR pour passer au cellulaire.' },
  ];

  const SHOTS = [
    {
      src: '/captures/calendrier-semaine.png?v=2', w: 1440, h: 900,
      title: 'Le calendrier de tout le monde',
      text: "Vue Jour, Semaine ou Mois : la barre de chaque invité montre l'heure de début, ses initiales et l'heure de fin. Survolez un nom pour le repérer.",
      alt: "Vue Semaine : barres de disponibilité de chaque invité, avec heure de début, initiales et heure de fin",
    },
    {
      src: '/captures/rapport-sombre.png?v=2', w: 1440, h: 900,
      title: 'Le bon moment, en un coup d’œil',
      text: 'Le rapport classe les meilleurs moments et les situe sur une carte de chaleur. Mode sombre inclus.',
      alt: 'Rapport : carte de chaleur et meilleurs moments, en mode sombre',
    },
    {
      src: '/captures/mes-occasions.png?v=2', w: 1440, h: 760,
      title: 'Toutes vos occasions',
      text: 'En cours, à venir, celles que vous gérez et les archives, filtrées par organisation.',
      alt: "Liste des occasions avec logos d'organisations et couronne pour celles que l'on gère",
    },
  ];
  const [HERO, ...OTHER_SHOTS] = SHOTS;
</script>

<div class="space-y-16 pb-6 sm:space-y-20">
  <!-- Hero -->
  <section class="mx-auto max-w-3xl pt-4 text-center sm:pt-8">
    <img src="/logo-disponibilites.png?v=2" alt="Disponibilités" class="mx-auto h-14 w-auto sm:h-20" />
    <h1 class="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Trouvez le moment où tout le monde est libre</h1>
    <p class="mt-4 text-lg text-slate-600">
      <em>Disponibilités</em> est un calendrier de groupe : on crée une occasion, on partage son lien, et chaque invité
      indique ses plages de disponibilité. Tout le monde voit celles des autres, en temps réel.
    </p>

    {#if session.me?.id}
      <!-- Already invited (page opened from the footer's "À propos") -->
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <a href="/" onclick={link} class="btn-primary px-5 py-2.5">🗓️ Mes occasions</a>
        <a href="/organisations" onclick={link} class="btn-outline px-5 py-2.5">🏢 Organisations</a>
      </div>
    {:else}
    <div class="mx-auto mt-8 max-w-xl rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-left">
      <h2 class="flex items-center gap-2 font-semibold text-indigo-900">✉️ Accès sur invitation</h2>
      <p class="mt-1.5 text-sm text-indigo-900/80">
        Ouvrez le lien d'une occasion qu'on vous a partagé : vous y serez associé automatiquement et pourrez
        ensuite créer vos propres occasions.
      </p>
      <p class="mt-2 text-sm text-indigo-900/70">
        Vous utilisez déjà l'application sur un autre appareil ? Choisissez-y « 📱 Lier un cellulaire » et scannez
        le code QR avec celui-ci.
      </p>
      <p class="mt-2 text-sm text-indigo-900/70">
        Vous avez un mot de passe ? <a href="/connexion" onclick={link} class="text-link font-medium">Connectez-vous</a>
        pour retrouver votre compte.
      </p>
    </div>
    {/if}
  </section>

  <!-- Main screenshot -->
  <figure class="mx-auto max-w-5xl">
    <img
      src={HERO.src} width={HERO.w} height={HERO.h} alt={HERO.alt}
      class="h-auto w-full rounded-xl border border-slate-200 shadow-xl"
    />
    <figcaption class="mx-auto mt-5 max-w-2xl text-center">
      <span class="block text-lg font-semibold text-slate-900">{HERO.title}</span>
      <span class="mt-1 block text-slate-600">{HERO.text}</span>
    </figcaption>
  </figure>

  <!-- Features -->
  <section>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each FEATURES as f (f.title)}
        <div class="card p-5">
          <div class="text-2xl">{f.icon}</div>
          <h3 class="mt-2 font-semibold text-slate-900">{f.title}</h3>
          <p class="mt-1 text-sm text-slate-600">{f.text}</p>
        </div>
      {/each}
    </div>
  </section>

  <!-- Screenshots with their explanation, alternating sides -->
  {#each OTHER_SHOTS as s, i (s.src)}
    <section class="grid items-center gap-6 lg:grid-cols-[2fr_3fr] lg:gap-10">
      <div class={i % 2 ? 'lg:order-2' : ''}>
        <h2 class="text-2xl font-bold text-slate-900">{s.title}</h2>
        <p class="mt-2 text-slate-600">{s.text}</p>
      </div>
      <img
        src={s.src} width={s.w} height={s.h} alt={s.alt} loading="lazy"
        class="h-auto w-full rounded-xl border border-slate-200 shadow-lg {i % 2 ? 'lg:order-1' : ''}"
      />
    </section>
  {/each}

  <section class="grid items-center gap-6 lg:grid-cols-[3fr_2fr] lg:gap-10">
    <div>
      <h2 class="text-2xl font-bold text-slate-900">Pensé pour le cellulaire</h2>
      <p class="mt-2 text-slate-600">
        L'éditeur se replie sur deux lignes, avant-midi et après-midi : touchez pour ajouter une plage, glissez ses
        bords pour l'ajuster. Un code QR suffit pour retrouver vos occasions sur votre téléphone.
      </p>
    </div>
    <img
      src="/captures/mobile-editeur.png?v=2" width="780" height="1688" loading="lazy"
      alt="Éditeur de plages sur cellulaire : deux lignes avant-midi / après-midi"
      class="mx-auto h-auto w-full max-w-[280px] rounded-3xl border border-slate-200 shadow-lg"
    />
  </section>

  <section class="text-center text-sm text-slate-500">
    Projet libre, versé dans le domaine public.
    <a href={REPO_URL} target="_blank" rel="noopener" class="text-link font-medium">Voir le code source sur GitHub</a>
  </section>
</div>
