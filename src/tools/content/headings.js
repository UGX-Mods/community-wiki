/**
 * The page title is rendered as <h1>, so page bodies should start at <h2>.
 * Pages using <h1> in the body get all headings shifted down one level
 * (h1 -> h2 ... h5 -> h6). Wiki.js uses <h2> as top TOC level when a page has
 * no <h1>, so the table of contents keeps its structure, ids stay the same.
 */
import fs from 'node:fs';
import { encoding, readPage } from '../lib/pages.js';

/**
 * @param {string} content html page source
 * @returns {{content: string, changed: boolean, error?: string}}
 */
function demoteHeadings(content) {
  if (!/<h1[\s>]/i.test(content)) return { content, changed: false };
  if (/<h6[\s>]/i.test(content)) {
    return { content, changed: false, error: 'uses <h1> and <h6>' };
  }

  let result = content;
  for (let level = 5; level >= 1; level--) {
    result = result
      .replace(new RegExp(`<h${level}(?=[\\s>])`, 'gi'), `<h${level + 1}`)
      .replace(new RegExp(`</h${level}>`, 'gi'), `</h${level + 1}>`);
  }
  return { content: result, changed: true };
}

/**
 * @param {string[]} files html pages
 * @returns {Promise<number>} amount of pages which could not be changed
 */
async function demotePageHeadings(files) {
  let changed = 0;
  let errors = 0;
  for (const filePath of files) {
    const data = await readPage(filePath);
    if (!data) continue;

    const result = demoteHeadings(data);
    if (result.error) {
      errors++;
      console.error('🚨', filePath, result.error);
      continue;
    }
    if (!result.changed) continue;

    await fs.promises.writeFile(filePath, result.content, encoding);
    changed++;
  }

  console.log('Shifted the headings of', changed, 'pages down one level 📑');
  return errors;
}

export { demoteHeadings, demotePageHeadings };
