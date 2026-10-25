/**
 * Frontend JavaScript for WikiJs
 */
import confluenceIds from './confluence-ids.json' with { type: 'json' };

const CONFLUENCE_PAGE_URL =
  'https://ugxmods.atlassian.net/wiki/pages/viewpage.action?pageId=';

/**
 * Collapsible content (`.expandable-container`).
 */
function initExpandables() {
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
}

/**
 * Tabs (`.widget-tabs` > `.widget-tab` > `.widget-tab-title` + `.widget-tab-content`).
 * Without JavaScript the tabs are shown one below the other.
 * Keyboard support follows the WAI-ARIA tabs pattern (arrow keys, Home, End).
 */
function initTabs() {
  document.querySelectorAll('.widget-tabs').forEach((tabs, t) => {
    const items = [...tabs.querySelectorAll(':scope > .widget-tab')];
    if (!items.length) return;

    const list = document.createElement('div');
    list.className = 'widget-tabs-list';
    list.setAttribute('role', 'tablist');

    /** @type {HTMLButtonElement[]} */
    const buttons = [];
    /** @type {HTMLElement[]} */
    const panels = [];
    items.forEach((item, i) => {
      const title = item.querySelector(':scope > .widget-tab-title');
      const panel = /** @type {HTMLElement | null} */ (
        item.querySelector(':scope > .widget-tab-content')
      );
      if (!title || !panel) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'widget-tabs-button';
      btn.id = `widget-tab-${t}-${i}`;
      btn.textContent = title.textContent?.trim() ?? `Tab ${i + 1}`;
      btn.setAttribute('role', 'tab');

      panel.id = panel.id || `widget-tab-panel-${t}-${i}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', btn.id);
      btn.setAttribute('aria-controls', panel.id);

      buttons.push(btn);
      panels.push(panel);
      list.append(btn);
    });
    if (!buttons.length) return;

    /** @param {number} index */
    const select = (index) => {
      buttons.forEach((btn, i) => {
        const selected = i === index;
        btn.setAttribute('aria-selected', String(selected));
        btn.tabIndex = selected ? 0 : -1;
        panels[i].hidden = !selected;
      });
    };

    buttons.forEach((btn, i) => {
      btn.addEventListener('click', () => select(i));
      btn.addEventListener('keydown', (e) => {
        const last = buttons.length - 1;
        /** @type {Record<string, number>} */
        const keys = {
          ArrowRight: i === last ? 0 : i + 1,
          ArrowLeft: i === 0 ? last : i - 1,
          Home: 0,
          End: last,
        };
        if (!(e.key in keys)) return;
        e.preventDefault();
        select(keys[e.key]);
        buttons[keys[e.key]].focus();
      });
    });

    tabs.prepend(list);
    tabs.classList.add('is-ready');
    select(0);
  });
}

/**
 * Image gallery (`.widget-gallery` > `figure` > `img` + optional `figcaption`).
 * A click on an image opens it large in a dialog with previous / next buttons.
 */
function initGalleries() {
  const app = document.querySelector('.v-application') ?? document.body;

  document.querySelectorAll('.widget-gallery').forEach((gallery) => {
    const figures = [...gallery.querySelectorAll(':scope > figure')];
    const images = figures
      .map((figure) => ({
        img: figure.querySelector('img'),
        caption: figure.querySelector('figcaption')?.textContent?.trim() ?? '',
      }))
      .filter((entry) => entry.img);
    if (!images.length) return;

    const dialog = document.createElement('dialog');
    dialog.className = 'widget-gallery-dialog';
    dialog.innerHTML = `
      <figure>
        <img alt="" />
        <figcaption></figcaption>
      </figure>
      <div class="widget-gallery-dialog-nav">
        <button type="button" data-action="prev" aria-label="Previous image">&#8592;</button>
        <span aria-live="polite"></span>
        <button type="button" data-action="next" aria-label="Next image">&#8594;</button>
        <button type="button" data-action="close" aria-label="Close">&#10005;</button>
      </div>`;
    app.append(dialog);

    const dialogImg = /** @type {HTMLImageElement} */ (
      dialog.querySelector('img')
    );
    const dialogCaption = /** @type {HTMLElement} */ (
      dialog.querySelector('figcaption')
    );
    const counter = /** @type {HTMLElement} */ (dialog.querySelector('span'));
    let current = 0;

    /** @param {number} index */
    const show = (index) => {
      current = (index + images.length) % images.length;
      const { img, caption } = images[current];
      dialogImg.src = img?.currentSrc || img?.src || '';
      dialogImg.alt = img?.alt ?? '';
      dialogCaption.textContent = caption;
      dialogCaption.hidden = !caption;
      counter.textContent = `${current + 1} / ${images.length}`;
    };

    dialog.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const action = target.closest('button')?.dataset.action;
      if (action === 'prev') show(current - 1);
      else if (action === 'next') show(current + 1);
      else if (action === 'close' || target === dialog) dialog.close();
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(current - 1);
      else if (e.key === 'ArrowRight') show(current + 1);
    });

    images.forEach(({ img }, i) => {
      if (!img) return;
      // the image becomes the content of a button, so it works with the keyboard
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'widget-gallery-open';
      btn.setAttribute('aria-label', `Open image: ${img.alt || i + 1}`);
      img.replaceWith(btn);
      btn.append(img);
      btn.addEventListener('click', () => {
        show(i);
        dialog.showModal();
      });
    });
  });
}

/**
 * Admins only: a button to the Confluence page the page was imported from
 * (`confluence-ids.json`, page path -> id). The Confluence space needs a login anyway.
 */
function initConfluenceLink() {
  const state = window.WIKI?.$store?.state;
  if (!state?.user?.permissions?.includes('manage:system')) return;
  /** @type {Record<string, number>} */
  const ids = confluenceIds;
  const id = ids[state.page?.path ?? ''];
  const header = document.querySelector('.page-header-section .is-page-header');
  if (!id || !header) return;

  // the edit buttons are optional (Administration > Theme), the wiki.js styles
  // of their container position the button in the same place
  let shortcuts = header.querySelector('.page-edit-shortcuts');
  if (!shortcuts) {
    shortcuts = document.createElement('div');
    shortcuts.className = 'page-edit-shortcuts is-right';
    header.append(shortcuts);
  }

  const link = document.createElement('a');
  link.className = 'v-btn v-btn--depressed v-size--small ugx-confluence-link';
  link.href = CONFLUENCE_PAGE_URL + id;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = `Open the original Confluence page (${id})`;
  const label = document.createElement('span');
  label.className = 'v-btn__content text-none';
  label.textContent = 'Confluence';
  link.append(label);
  shortcuts.append(link);
}

window.boot.register('page-ready', () => {
  initExpandables();
  initTabs();
  initGalleries();
  initConfluenceLink();
});
