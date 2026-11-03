// Current visitor (identified by the permanent cookie) and the profile modal state.
export const session = $state({
  me: null,
  profileOpen: false,
  profileRequired: false,
  afterProfile: null,
  // Organization shown in the header (logo) while viewing one of its occasions.
  branding: null,
  // Names of the other guests of the occasion being viewed (welcome form: possible duplicate account).
  occasionNames: [],
});

export function askProfile({ required = false, then = null } = {}) {
  session.profileRequired = required;
  session.afterProfile = then;
  session.profileOpen = true;
}
