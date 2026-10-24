/**
 * Link validation: internal links must point to an existing page / file / anchor
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  encoding,
  PAGE_EXTENSIONS,
  readPage,
  stripPageExtension,
} from '../lib/pages.js';
import { parseHtmlContent } from '../lib/html.js';
import { pageToHtml } from '../lib/markdown.js';

const REGEX_EXTERNAL_HREF = /^(https?:|\/\/|mailto:)/;

/**
 * @typedef {object} LinkIssue
 * @property {string} href
 * @property {string} error
 * @property {string} [text] html of the link (empty href)
 * @property {number} [amount] number of matching anchors
 */

const ERROR_NO_ANCHOR = 'No anchor id found!';

/**
 * Compares ids instead of using an `#id` selector: confluence ids contain
 * characters like `(` or `?` which are invalid in css selectors.
 *
 * @param {import('node-html-parser').HTMLElement} parsedHtml
 * @param {string} anchor id from the href (without `#`)
 * @param {string} href
 * @returns {LinkIssue|null}
 */
function checkAnchor(parsedHtml, anchor, href) {
  let id = anchor;
  try {
    id = decodeURIComponent(anchor);
  } catch (_) {
    // not percent encoded
  }
  const $anchors = parsedHtml
    .querySelectorAll('[id]')
    .filter((el) => el.getAttribute('id') === id);
  if ($anchors.length === 0) {
    return { href, error: ERROR_NO_ANCHOR };
  }
  if ($anchors.length > 1) {
    return { href, error: 'Multiple anchors found!', amount: $anchors.length };
  }
  return null;
}

/**
 * Files a (non external, non anchor) href can point to, wiki.js style:
 * absolute links start at the repository root, relative links resolve against
 * the page folder (child pages) or the folder of the page (sibling pages).
 *
 * @param {string} href
 * @param {string} filePath page path relative to root
 * @param {string} root
 * @returns {string[]}
 */
function getLinkCandidates(href, filePath, root) {
  const hrefAsPath = href.replace(/\//g, path.sep).split('#')[0];

  if (href.startsWith('/')) {
    return [root + path.sep + hrefAsPath];
  }

  const rootFolderPath = stripPageExtension(filePath);
  const rootFolderPathOmitted = rootFolderPath
    .split(path.sep)
    .slice(0, -1)
    .join(path.sep);

  return [
    root + path.sep + rootFolderPath + path.sep + hrefAsPath,
    // relative links also resolve to same directory, when we omit the first part, so try this as well
    root + path.sep + rootFolderPathOmitted + path.sep + hrefAsPath,
  ];
}

/**
 * @param {string} p
 * @returns {string[]} the path itself and the page files it can stand for
 */
function withPageExtensions(p) {
  return PAGE_EXTENSIONS.some((ext) => p.endsWith(ext))
    ? [p]
    : [p, ...PAGE_EXTENSIONS.map((ext) => `${p}${ext}`)];
}

/**
 * @param {string[]} candidates
 * @returns {string|undefined} first candidate which exists (as file/folder or as page)
 */
function findLinkTarget(candidates) {
  return candidates.find((p) => withPageExtensions(p).some(fs.existsSync));
}

/**
 * @param {string} target result of findLinkTarget
 * @returns {Promise<string>} html of the linked page (or file)
 */
async function readLinkTarget(target) {
  for (const file of withPageExtensions(target)) {
    const content = await fs.promises
      .readFile(file, encoding)
      .catch(() => null);
    if (content !== null) return pageToHtml(file, content);
  }
  throw new Error(`Can't read link target ${target}`);
}

/**
 * @param {string} filePath page path relative to root
 * @param {string} fileContent
 * @param {string} root
 * @returns {Promise<LinkIssue[]>}
 */
async function checkPageLinks(filePath, fileContent, root) {
  const parsedHtml = parseHtmlContent(pageToHtml(filePath, fileContent));
  const invalid = [];

  for (const a of parsedHtml.querySelectorAll('a')) {
    const href = a.getAttribute('href');
    if (!href) {
      invalid.push({ href: '', error: 'Empty HREF!', text: a.outerHTML });
      continue;
    }

    if (REGEX_EXTERNAL_HREF.test(href)) {
      continue; // absolute external should be okay
    }

    // anchor link ?
    if (href.startsWith('#')) {
      const issue = checkAnchor(parsedHtml, href.slice(1), href);
      if (issue) invalid.push(issue);
      continue;
    }

    const foundFile = findLinkTarget(getLinkCandidates(href, filePath, root));
    if (!foundFile) {
      invalid.push({ href, error: 'Not Found!' });
      continue;
    }

    const anchor = href.split('#').at(1);
    if (!anchor) continue;

    // check if the anchor exists!
    const issue = checkAnchor(
      parseHtmlContent(await readLinkTarget(foundFile)),
      anchor,
      href,
    );
    if (issue) invalid.push(issue);
  }

  invalid.push(...checkImages(parsedHtml, filePath, root));
  return invalid;
}

/**
 * Local images (attachments) must exist
 *
 * @param {import('node-html-parser').HTMLElement} parsedHtml
 * @param {string} filePath page path relative to root
 * @param {string} root
 * @returns {LinkIssue[]}
 */
function checkImages(parsedHtml, filePath, root) {
  /** @type {LinkIssue[]} */
  const invalid = [];
  for (const img of parsedHtml.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (!src) {
      invalid.push({
        href: '',
        error: 'Empty image src!',
        text: img.outerHTML,
      });
      continue;
    }
    if (REGEX_EXTERNAL_HREF.test(src) || src.startsWith('data:')) continue;

    const candidates = getLinkCandidates(decodeURI(src), filePath, root);
    if (!candidates.some((p) => fs.existsSync(p))) {
      invalid.push({ href: src, error: 'Image not found!' });
    }
  }
  return invalid;
}

/**
 * @param {string[]} files page paths relative to root
 * @param {string} root
 * @returns {Promise<number>} amount of errors
 */
async function validateAllLinks(files, root = process.cwd()) {
  let invalidCounter = 0;
  for (const filePath of files) {
    const fileContent = await readPage(filePath);
    if (!fileContent) continue;

    const invalid = await checkPageLinks(filePath, fileContent, root);
    if (invalid.length > 0) {
      invalidCounter += invalid.length;
      console.error('## File', filePath, 'has', invalid.length, 'link errors!');
      console.error(invalid);
    }
  }

  if (invalidCounter > 0) {
    console.error('🚨 There are', invalidCounter, 'invalid links - fix them!');
  }

  return invalidCounter;
}

export { getLinkCandidates, findLinkTarget, checkPageLinks, validateAllLinks };
