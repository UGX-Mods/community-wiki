/**
 * Link validation: internal links must point to an existing page / file / anchor
 */
const fs = require('node:fs');
const path = require('node:path');
const { encoding, PAGE_EXTENSION, readPage } = require('../lib/pages');
const { parseHtmlContent } = require('../lib/html');

const REGEX_EXTERNAL_HREF = /^(https?:|\/\/|mailto:)/;

const ERROR_NO_ANCHOR =
  'No anchor id found! (Eventually selector contains invalid characters?)';

/**
 * @param {import('node-html-parser').HTMLElement} parsedHtml
 * @param {string} selector
 * @param {string} href
 * @returns {object|null} issue
 */
function checkAnchor(parsedHtml, selector, href) {
  const $anchors = parsedHtml.querySelectorAll(selector);
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

  const rootFolderPath = filePath.endsWith(PAGE_EXTENSION)
    ? filePath.slice(0, -PAGE_EXTENSION.length)
    : filePath;
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
 * @param {string[]} candidates
 * @returns {string|undefined} first candidate which exists (as file/folder or as page)
 */
function findLinkTarget(candidates) {
  return candidates.find(
    (p) =>
      fs.existsSync(p) ||
      (!p.endsWith(PAGE_EXTENSION) && fs.existsSync(`${p}${PAGE_EXTENSION}`)),
  );
}

/**
 * @param {string} filePath page path relative to root
 * @param {string} fileContent
 * @param {string} root
 * @returns {Promise<object[]>} issues
 */
async function checkPageLinks(filePath, fileContent, root) {
  const parsedHtml = parseHtmlContent(fileContent);
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
      try {
        const issue = checkAnchor(parsedHtml, href, href);
        if (issue) invalid.push(issue);
      } catch (e) {
        invalid.push({
          href,
          error: 'Invalid CSS selector for anchor!',
          queryError: e.toString(),
        });
      }
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
    try {
      const targetFileContent = await fs.promises
        .readFile(foundFile, encoding)
        .catch((err) => {
          if (!foundFile.endsWith(PAGE_EXTENSION)) {
            return fs.promises.readFile(
              `${foundFile}${PAGE_EXTENSION}`,
              encoding,
            );
          }
          throw err;
        });

      const issue = checkAnchor(
        parseHtmlContent(targetFileContent),
        `#${anchor}`,
        href,
      );
      if (issue) invalid.push(issue);
    } catch (e) {
      invalid.push({ href, error: 'Invalid anchor', queryError: e.toString() });
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

module.exports = {
  getLinkCandidates,
  findLinkTarget,
  checkPageLinks,
  validateAllLinks,
};
