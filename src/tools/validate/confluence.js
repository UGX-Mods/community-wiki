/**
 * The confluence page ids of the imported pages (src/theme/confluence-ids.json, page path
 * without extension -> id) are used by the theme for the admin link to the old Confluence page.
 * Every entry must point to an existing page: a renamed or moved page needs its key updated.
 */
import fs from 'node:fs';
import path from 'node:path';
import { encoding, getPageFiles, stripPageExtension } from '../lib/pages.js';

const CONFLUENCE_IDS_FILE = 'src/theme/confluence-ids.json';

/**
 * @param {Record<string, number>} ids
 * @param {string[]} files pages relative to the repository root
 * @returns {string[]} errors
 */
function checkConfluenceIds(ids, files) {
  const pages = new Set(
    files.map((f) => stripPageExtension(f).split(path.sep).join('/')),
  );
  return Object.entries(ids).flatMap(([page, id]) => {
    if (!pages.has(page))
      return [`${page}: page not found (renamed or moved?)`];
    if (!Number.isInteger(id) || id <= 0) return [`${page}: invalid id ${id}`];
    return [];
  });
}

/**
 * Checks against all pages, also when only some pages are validated
 *
 * @param {string} root repository root
 * @returns {Promise<number>} amount of errors
 */
async function confluenceIdsValidation(root = process.cwd()) {
  const ids = JSON.parse(
    await fs.promises.readFile(path.join(root, CONFLUENCE_IDS_FILE), encoding),
  );
  const errors = checkConfluenceIds(ids, await getPageFiles(root));
  if (errors.length) {
    console.error(`## ${CONFLUENCE_IDS_FILE} has errors!`, errors);
    console.error('🚨 Found', errors.length, 'confluence id errors!');
  }
  return errors.length;
}

export { checkConfluenceIds, confluenceIdsValidation };
