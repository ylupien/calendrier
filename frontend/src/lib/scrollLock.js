// While an overlay (dialog, phone menu) is open, the page behind it must not scroll.
// position:fixed on <body> also works on iOS Safari, where overflow:hidden alone does not.
// A counter supports nested overlays (e.g. "New range" opened over the day editor).
let count = 0;
let saved = null;

/** Locks page scrolling; returns the function that unlocks it. */
export function lockScroll() {
  if (count++ === 0) {
    const { body, documentElement: html } = document;
    saved = { y: window.scrollY, body: body.getAttribute('style') ?? '', html: html.style.overflow };
    const scrollbar = window.innerWidth - html.clientWidth; // keep the layout from shifting on desktop
    Object.assign(body.style, { position: 'fixed', top: `-${saved.y}px`, left: '0', right: '0', paddingRight: `${scrollbar}px` });
    html.style.overflow = 'hidden';
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--count === 0 && saved) {
      document.body.setAttribute('style', saved.body);
      document.documentElement.style.overflow = saved.html;
      window.scrollTo(0, saved.y);
      saved = null;
    }
  };
}
