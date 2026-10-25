/**
 * Frontend JavaScript for WikiJs
 */

window.boot.register('page-ready', () => {
  const expendables = document.querySelectorAll('.expandable-container');
  expendables.forEach((n, i) => {
    const btn = /** @type {HTMLButtonElement | null} */ (
      n.querySelector('button.expandable-button')
    );
    const nodeContent = n.querySelector('div.expandable-content');
    if (!btn || !nodeContent) return;

    // screen readers announce the state of the button and what it controls
    if (!nodeContent.id) nodeContent.id = `expandable-content-${i}`;
    btn.setAttribute('aria-controls', nodeContent.id);
    btn.setAttribute('aria-expanded', 'false');

    btn.onclick = () => {
      const expanded = nodeContent.classList.contains('expanded');
      nodeContent.classList.toggle('expanded', !expanded);
      btn.classList.toggle('expanded', !expanded);
      btn.setAttribute('aria-expanded', String(!expanded));
    };
  });
});
