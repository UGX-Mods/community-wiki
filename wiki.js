/**
 * Frontend JavaScript for WikiJs
 */

window.boot.register('page-ready', () => {
  const expendables = document.querySelectorAll('.expandable-container');
  expendables.forEach((n) => {
    /**
     * @type {HTMLElement}
     */
    const btn = n.querySelector('button.expandable-button');
    const nodeContent = n.querySelector('div.expandable-content');
    btn.onclick = () => {
      const expanded = nodeContent.classList.contains('expanded');
      nodeContent.classList.toggle('expanded', !expanded);
      btn.classList.toggle('expanded', !expanded);
    };
  });
});
