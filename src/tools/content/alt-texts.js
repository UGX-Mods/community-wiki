/**
 * Sets alt texts of images from a JSON file ({ "/attachments/...png": "alt text" }).
 * Only images with a missing or empty alt are changed, existing texts stay.
 * The rest of the page (formatting included) stays untouched.
 *
 * Environment: ALT_TEXTS=path/to/alt-texts.json (keep it outside the repository,
 * every file in the repository becomes a wiki asset)
 */
import fs from 'node:fs';
import { encoding, readPage } from '../lib/pages.js';

/**
 * @param {string} text
 * @returns {string} text for a double quoted html attribute
 */
function escapeAttribute(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string} content page source
 * @param {Record<string, string>} altTexts image src -> alt text
 * @returns {{content: string, changed: number}}
 */
function applyAltTexts(content, altTexts) {
  let changed = 0;
  const result = content.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /\ssrc="([^"]*)"/i.exec(tag)?.[1];
    const alt = src ? altTexts[src] : undefined;
    if (!alt) return tag;

    const value = `alt="${escapeAttribute(alt)}"`;
    // alt="" / alt (boolean attribute) -> set, non-empty alt -> keep
    if (/\salt="[^"]+"/i.test(tag)) return tag;
    changed++;
    if (/\salt=""/i.test(tag)) return tag.replace(/(\s)alt=""/i, `$1${value}`);
    if (/\salt(?=[\s/>])/i.test(tag)) {
      return tag.replace(/(\s)alt(?=[\s/>])/i, `$1${value}`);
    }
    return tag.replace(/(\ssrc="[^"]*")/i, `$1 ${value}`);
  });
  return { content: result, changed };
}

/**
 * @param {string[]} files pages
 * @returns {Promise<number>} errors
 */
async function setAltTexts(files) {
  const file = process.env.ALT_TEXTS;
  if (!file) {
    console.error('🚨 ALT_TEXTS (path to the JSON file) is not set');
    return 1;
  }
  /** @type {Record<string, string>} */
  const altTexts = JSON.parse(await fs.promises.readFile(file, encoding));

  let images = 0;
  let pages = 0;
  for (const filePath of files) {
    const content = await readPage(filePath);
    if (!content) continue;
    const result = applyAltTexts(content, altTexts);
    if (!result.changed) continue;
    await fs.promises.writeFile(filePath, result.content, encoding);
    images += result.changed;
    pages++;
  }

  console.log('Set', images, 'alt texts in', pages, 'pages 🦯');
  return 0;
}

export { applyAltTexts, setAltTexts };
