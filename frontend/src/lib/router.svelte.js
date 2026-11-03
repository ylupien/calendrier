export const route = $state({ path: location.pathname });

export function navigate(path) {
  if (path === location.pathname + location.search) return;
  history.pushState({}, '', path);
  // Path only: a query string (?retour=…) stays in the address, read by the page itself.
  route.path = location.pathname;
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', () => {
  route.path = location.pathname;
});

/** onclick handler for <a href> elements: client-side navigation. */
export function link(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  navigate(event.currentTarget.getAttribute('href'));
}
