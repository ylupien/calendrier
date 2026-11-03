/**
 * Current tab kept in the address (#hash), so that reloading the page or sharing its link keeps it.
 * tabs: { tabId: 'hash' }; an unknown or missing hash gives `fallback`.
 * Call during a component's initialization; use `.value` to read or change the tab.
 */
export function hashTab(tabs, fallback) {
  const fromHash = () => {
    const hash = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    return Object.keys(tabs).find((id) => tabs[id] === hash) ?? fallback;
  };
  let current = $state(fromHash());

  // Back/forward or a link to another #hash of the same page.
  $effect(() => {
    const onHashChange = () => (current = fromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  return {
    get value() {
      return current;
    },
    set value(id) {
      current = id;
      // replaceState: switching tabs does not add an entry to the browser history.
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${tabs[id]}`);
    },
  };
}
