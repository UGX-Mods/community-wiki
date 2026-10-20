/**
 * Frontend JavaScript for WikiJs
 */

window.boot.register('page-ready', () => {
  const expendables = document.querySelectorAll('.expandable-container');
  expendables.forEach((n) => {
    const btn = /** @type {HTMLButtonElement | null} */ (
      n.querySelector('button.expandable-button')
    );
    const nodeContent = n.querySelector('div.expandable-content');
    if (!btn || !nodeContent) return;

    btn.onclick = () => {
      const expanded = nodeContent.classList.contains('expanded');
      nodeContent.classList.toggle('expanded', !expanded);
      btn.classList.toggle('expanded', !expanded);
    };
  });
});
