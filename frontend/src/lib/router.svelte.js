export const route = $state({ path: location.pathname });

export function navigate(path) {
  if (path === route.path) return;
  history.pushState({}, '', path);
  route.path = path;
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
