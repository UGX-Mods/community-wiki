/**
 * Rewrites relative page links (href="Child-Page") of html pages to absolute
 * paths (href="/Parent/Child-Page"). Wiki.js 2 resolves relative links against
 * the page folder, wiki.js 3 like GitHub (against the folder of the file), an
 * absolute path means the same page in both.
 */
import fs from 'node:fs';
import { encoding, readPage } from '../lib/pages.js';
import {
  findLinkTarget,
  getLinkCandidates,
  isRelativeLink,
  toAbsoluteHref,
} from '../validate/links.js';

const REGEX_LINK_HREF = /(<a\b[^>]*?\shref=")([^"]*)(")/gi;

/**
 * @param {string} content html page source
 * @param {string} filePath page path relative to root
 * @param {string} root
 * @returns {{content: string, changed: number, unresolved: string[]}}
 */
function absoluteLinks(content, filePath, root) {
  let changed = 0;
  /** @type {string[]} */
  const unresolved = [];

  const result = content.replace(
    REGEX_LINK_HREF,
    (match, before, href, after) => {
      if (!isRelativeLink(href)) return match;

      const target = findLinkTarget(getLinkCandidates(href, filePath, root));
      if (!target) {
        unresolved.push(href);
        return match;
      }

      const anchor = href.includes('#') ? href.slice(href.indexOf('#')) : '';
      changed++;
      return before + toAbsoluteHref(target, root) + anchor + after;
    },
  );
  return { content: result, changed, unresolved };
}

/**
 * @param {string[]} files html pages relative to root
 * @param {string} root
 * @returns {Promise<number>} amount of links which could not be resolved
 */
async function absolutePageLinks(files, root = process.cwd()) {
  const dryRun = !!process.env.DRY_RUN;
  let links = 0;
  let pages = 0;
  let errors = 0;
  for (const filePath of files) {
    const data = await readPage(filePath);
    if (!data) continue;

    const result = absoluteLinks(data, filePath, root);
    for (const href of result.unresolved) {
      errors++;
      console.error('🚨', filePath, 'link target not found:', href);
    }
    if (result.changed === 0) continue;

    links += result.changed;
    pages++;
    if (dryRun) {
      console.log('DRY_RUN:', filePath, result.changed, 'link(s)');
    } else {
      await fs.promises.writeFile(filePath, result.content, encoding);
    }
  }

  console.log(
    dryRun ? 'Would change' : 'Changed',
    links,
    'relative links on',
    pages,
    'pages to absolute paths 🔗',
  );
  return errors;
}

export { absoluteLinks, absolutePageLinks };
