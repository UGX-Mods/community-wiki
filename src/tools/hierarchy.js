/**
 * Page hierarchy widget (<ul class="widget-page-hierarchy">), a generated list of all child pages
 */
const fs = require('node:fs');
const path = require('node:path');
const { select } = require('@inquirer/prompts');
const {
  encoding,
  isPage,
  stripPageExtension,
  filterPagesWithChildren,
  readPage,
} = require('./lib/pages');
const { parseHtmlContent, writeFileFormat } = require('./lib/html');
const { getPageTitle } = require('./lib/header');

const WIDGET_SELECTOR = 'ul.widget-page-hierarchy';

/**
 * Interactive: add (or replace) the widget on a selected page
 *
 * @param {string[]} files
 */
async function setupPageHierarchy(files) {
  const choices = filterPagesWithChildren(files).map((f) => ({ value: f }));

  /**
   * @type {string}
   */
  const filePath = await select({
    message: 'Where do you want to add the Page Hierarchy?',
    choices,
  });
  if (!filePath) throw new Error('No file path was set!');

  const data = await readPage(filePath);
  if (!data) throw new Error('Invalid file content!');

  const htmlHierarchy = await createPageHierarchy(filePath);
  if (!htmlHierarchy) return;

  const parsedHtml = parseHtmlContent(data);
  const $hierarchies = parsedHtml.querySelectorAll(WIDGET_SELECTOR);

  if ($hierarchies.length === 0) {
    parsedHtml.innerHTML += htmlHierarchy;
  } else {
    $hierarchies.at(0).replaceWith(htmlHierarchy);
    $hierarchies.slice(1).forEach((n) => n.remove());
  }

  await writeFileFormat(parsedHtml.innerHTML, filePath);
}

/**
 * Regenerate all existing widgets
 *
 * @param {string[]} files
 */
async function refreshPageHierarchy(files) {
  let refreshed = 0;
  for (const filePath of filterPagesWithChildren(files)) {
    const data = await readPage(filePath);
    if (!data) throw new Error('Invalid file content!');

    const parsedHtml = parseHtmlContent(data);
    const $hierarchies = parsedHtml.querySelectorAll(WIDGET_SELECTOR);

    if ($hierarchies.length === 0) continue;

    const htmlHierarchy = await createPageHierarchy(filePath);
    if (!htmlHierarchy) return;

    $hierarchies.at(0).replaceWith(htmlHierarchy);
    $hierarchies.slice(1).forEach((n) => n.remove());

    refreshed++;
    await writeFileFormat(parsedHtml.innerHTML, filePath);
  }

  console.log('Refreshed', refreshed, 'page hierarchy widgets 🚀');
}

/**
 *
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
async function createPageHierarchy(filePath) {
  const lis = await createPageHierarchyLiElements(stripPageExtension(filePath));
  if (!lis) return null;

  return `<ul class="widget-page-hierarchy"><li>${lis}</li></ul>`;
}

/**
 * Case-insensitive ordinal order (like NTFS lists files), so the generated
 * widget is the same on every OS (readdir order is not defined on Linux)
 *
 * @param {string} a
 * @param {string} b
 */
function compareFileNames(a, b) {
  const [upperA, upperB] = [a.toUpperCase(), b.toUpperCase()];
  if (upperA !== upperB) return upperA < upperB ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 *
 * @param {string} rootFolderPath
 * @param {string} subPaths optional sub path with ending forward slash
 * @returns {Promise<string|null>}
 */
async function createPageHierarchyLiElements(rootFolderPath, subPaths = '') {
  const childPages = (await fs.promises.readdir(rootFolderPath).catch(() => []))
    .filter((f) => isPage(f))
    .sort(compareFileNames);

  if (childPages.length === 0) {
    return null;
  }

  return (
    await Promise.all(
      childPages.map(async (page) => {
        const fullPath = rootFolderPath + path.sep + page;
        const childFolder = stripPageExtension(fullPath);
        const title = await fs.promises
          .readFile(fullPath, encoding)
          .then(getPageTitle)
          .catch((err) => {
            console.error(err);
            return stripPageExtension(page);
          });

        if (!title) {
          console.warn('⚠️ Title not found for page:', page);
        }

        // check if there is a subfolder
        const subLi = await createPageHierarchyLiElements(
          childFolder,
          `${subPaths}${childFolder.split(path.sep).at(-1)}/`,
        );

        const href = subPaths + stripPageExtension(page);
        return (
          `<a href="${href}">${title}</a>` +
          (subLi ? `<ul><li>${subLi}</li></ul>` : '')
        );
      }),
    )
  ).join('</li><li>');
}

module.exports = {
  setupPageHierarchy,
  refreshPageHierarchy,
  createPageHierarchy,
};
