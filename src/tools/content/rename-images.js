/**
 * Mirrored / imported images have meaningless names (imgur ids, gyazo hashes,
 * confluence attachment ids). This step renames them after their alt text or
 * the heading they appear under, e.g. using-the-script-placer-2.png, and
 * updates every page referencing them.
 *
 * Environment: DRY_RUN=1 only prints the new names
 */
import fs from 'node:fs';
import path from 'node:path';
import { encoding, readPage } from '../lib/pages.js';
import { parseHtmlContent } from '../lib/html.js';
import { pageToHtml } from '../lib/markdown.js';

const MAX_NAME_LENGTH = 50;

// imgur ids (5-7 chars with a digit or capital, so words like "zones" don't match),
// gyazo hashes (32 hex), confluence attachment ids (digits)
const REGEX_MEANINGLESS_NAME =
  /^(?:(?=[a-z]*[A-Z0-9])[A-Za-z0-9]{5,7}|[0-9a-f]{32}|\d+)$/;

// alt texts which do not describe the image
const REGEX_GENERIC_ALT = /^(?:fig(?:ure)?\.?\s*\d*|image|screenshot|img)$/i;

/**
 * @param {string} text
 * @returns {string} lowercase file name part, words separated by "-"
 */
function slugify(text) {
  const slug = text
    .toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-');
  if (slug.length <= MAX_NAME_LENGTH) return slug;
  const cut = slug.slice(0, MAX_NAME_LENGTH);
  return cut.includes('-') ? cut.slice(0, cut.lastIndexOf('-')) : cut;
}

/**
 * @param {string} src image src (/attachments/...)
 * @returns {boolean} true for local images with a meaningless name
 */
function hasMeaninglessName(src) {
  if (!src.startsWith('/attachments/') || src.startsWith('/attachments/icons/'))
    return false;
  return REGEX_MEANINGLESS_NAME.test(path.posix.parse(src).name);
}

/**
 * Name proposals for the images of a page, in document order
 *
 * @param {string} html page html
 * @param {string} fallback name if there is neither alt text nor heading
 * @returns {{src: string, base: string}[]}
 */
function proposeImageNames(html, fallback) {
  const proposals = [];
  let heading = '';
  for (const node of parseHtmlContent(html).querySelectorAll(
    'h2, h3, h4, h5, h6, img',
  )) {
    if (node.tagName !== 'IMG') {
      heading = slugify(node.text);
      continue;
    }
    const src = node.getAttribute('src') ?? '';
    if (!hasMeaninglessName(src)) continue;

    const alt = (node.getAttribute('alt') ?? '').trim();
    const fromAlt = REGEX_GENERIC_ALT.test(alt) ? '' : slugify(alt);
    proposals.push({ src, base: fromAlt || heading || fallback });
  }
  return proposals;
}

/**
 * @param {{filePath: string, html: string}[]} pages
 * @param {(file: string) => boolean} exists whether a file (/attachments/...) already exists
 * @returns {Map<string, string>} old src -> new src
 */
function planImageNames(pages, exists) {
  /** @type {Map<string, string>} */
  const plan = new Map();
  const taken = new Set();

  for (const { filePath, html } of pages) {
    const fallback = slugify(path.parse(filePath).name);
    // first occurrence wins (images already planned by an earlier page or used twice)
    const seen = new Set(plan.keys());
    const proposals = proposeImageNames(html, fallback).filter(
      (p) => !seen.has(p.src) && seen.add(p.src),
    );
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const { src, base } of proposals) {
      const key = `${path.posix.dirname(src)}/${base}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    /** @type {Map<string, number>} */
    const numbers = new Map();
    for (const { src, base } of proposals) {
      const { dir, ext } = path.posix.parse(src);
      const key = `${dir}/${base}`;
      let n = (numbers.get(key) ?? 0) + 1;
      const numbered = (counts.get(key) ?? 0) > 1;
      const suffix = numbered ? `-${n}` : '';
      let target = `${key}${suffix}${ext.toLowerCase()}`;
      while (taken.has(target) || exists(target)) {
        n++;
        target = `${key}-${n}${ext.toLowerCase()}`;
      }
      numbers.set(key, n);
      taken.add(target);
      plan.set(src, target);
    }
  }
  return plan;
}

/**
 * @param {string[]} files pages
 * @param {string} root repository root
 * @returns {Promise<number>} errors
 */
async function renameImages(files, root = process.cwd()) {
  const dryRun = !!process.env.DRY_RUN;
  const toPath = (/** @type {string} */ src) =>
    path.join(root, ...src.split('/').filter(Boolean));

  /** @type {{filePath: string, content: string, html: string}[]} */
  const pages = [];
  for (const filePath of files) {
    const content = await readPage(filePath);
    if (content)
      pages.push({ filePath, content, html: pageToHtml(filePath, content) });
  }

  const plan = planImageNames(pages, (src) => fs.existsSync(toPath(src)));
  let errors = 0;
  for (const [from, to] of plan) {
    if (dryRun) {
      console.log(`${from} -> ${path.posix.basename(to)}`);
    } else if (fs.existsSync(toPath(from))) {
      await fs.promises.rename(toPath(from), toPath(to));
    } else {
      errors++;
      console.error('🚨 Image not found:', from);
      plan.delete(from);
    }
  }

  let changed = 0;
  for (const { filePath, content } of pages) {
    let result = content;
    for (const [from, to] of plan) result = result.split(from).join(to);
    if (result === content) continue;
    changed++;
    if (!dryRun) await fs.promises.writeFile(filePath, result, encoding);
  }

  console.log(
    `${dryRun ? 'DRY_RUN: would rename' : 'Renamed'} ${plan.size} images in ${changed} pages 🏷️`,
  );
  return errors;
}

export {
  slugify,
  hasMeaninglessName,
  proposeImageNames,
  planImageNames,
  renameImages,
};
