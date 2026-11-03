// Live changes of organizations (name, logo): the server sends them to everyone who sees the organization.
// OrgLogo and the header use the latest version right away; list pages reload when `orgChanges.count` moves.
import { getSocket } from './socket.js';

/** Latest version of each changed organization: id → { id, name, mode, logoUrl, logoDarkUrl, logoBackground }. */
export const liveOrgs = $state({});
/** Number of changes received (any organization), and the last one ({ id, deleted? }). */
export const orgChanges = $state({ count: 0, last: null });

let watching = false;

/** Listens once for the whole application. */
export function watchOrganizations() {
  if (watching) return;
  watching = true;
  const socket = getSocket();
  socket.on('organization:updated', (o) => {
    liveOrgs[o.id] = o;
    orgChanges.last = { id: o.id };
    orgChanges.count++;
  });
  socket.on('organization:deleted', ({ id }) => {
    orgChanges.last = { id, deleted: true };
    orgChanges.count++;
  });
}

/** The organization with its latest name and logo. */
export const withLive = (org) => (org && liveOrgs[org.id] ? { ...org, ...liveOrgs[org.id] } : org);

/** Calls `fn` after each change of an organization (in a $effect): `onOrgChange(() => load())`. */
export function onOrgChange(fn, { delay = 300 } = {}) {
  let first = true;
  let timer;
  $effect(() => {
    orgChanges.count;
    if (first) {
      first = false;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => fn(orgChanges.last), delay);
    return () => clearTimeout(timer);
  });
}
