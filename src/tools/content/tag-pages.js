/**
 * Adds the tags of the tag set (src/tools/lib/tags.js) to the page headers:
 * product and modding topic from the path, the content type from rules
 * (changelog folder, pages with child pages, title) with optional per-page
 * overrides. Existing tags are kept.
 *
 * Environment: DRY_RUN=1 prints the tags per page, TAG_OVERRIDES=path to a JSON
 * file { "Page/Path.html": { "type": "reference", "topic": "tools" } } (keep it
 * outside the repository)
 */
import fs from 'node:fs';
import path from 'node:path';
import { encoding, readPage, stripPageExtension } from '../lib/pages.js';
import { parsePageHeader } from '../lib/header.js';
import { parseTags } from '../lib/tags.js';

/** @type {[RegExp, string][]} first match wins */
const PRODUCTS = [
  [/^Modding\/World-at-War-Modtools\b/, 'waw'],
  [/^Modding\/Black-Ops-3-Modtools\b/, 'bo3'],
  [/^UGXLIN\b/, 'ugxlin'],
  [/^UGXL\b/, 'ugxl'],
  [/^Applications-and-Services\/UGX-Mods-Forum\b/, 'forum'],
  [/^Applications-and-Services\/Modder-Mapper\/UGX-MapPacker\b/, 'ugxmp'],
  [/^(Applications-and-Services|Careers|UGX-Help-Center)\b/, 'services'],
];

/** @type {Record<string, string>} modding folder -> topic */
const TOPICS = {
  Radiant: 'mapping',
  Mapping: 'mapping',
  Script: 'scripting',
  Sound: 'sound',
  Sounds: 'sound',
  Menu: 'menu',
  Maya: 'models',
  'Asset-Conversion': 'models',
  'Applications-and-Tools': 'tools',
  'UGX-Applications': 'tools',
};

const REGEX_TROUBLESHOOTING =
  /troubleshoot|faq|known-issues|disallowed|overflow|untrustworthy|crash/i;
const REGEX_GUIDE_TITLE =
  /^(how|adding|add|creating|create|setting|setup|install|using|use|guide|rip|properly|patching|scripting|playing)\b/i;

/**
 * @typedef {object} PageInfo
 * @property {string} page page path with forward slashes
 * @property {string} title
 * @property {boolean} hasChildren page has a folder with child pages
 */

/**
 * @param {string} page page path with forward slashes
 * @returns {string|undefined}
 */
function getProduct(page) {
  for (const [regex, product] of PRODUCTS) {
    if (regex.test(page)) return product;
  }
  return undefined;
}

/**
 * @param {string} page page path with forward slashes
 * @param {string|undefined} product
 * @returns {string|undefined}
 */
function getTopic(page, product) {
  if (product !== 'waw' && product !== 'bo3') return undefined;
  if (/Adding-custom-sounds/.test(page)) return 'sound';
  const folder = stripPageExtension(page).split('/')[2];
  return folder ? TOPICS[folder] : undefined;
}

/**
 * @param {PageInfo} info
 * @param {string|undefined} product
 * @returns {string}
 */
function getType({ page, title, hasChildren }, product) {
  if (/(^|\/)Changelog/i.test(page)) return 'changelog';
  if (REGEX_TROUBLESHOOTING.test(page)) return 'troubleshooting';
  if (hasChildren || !product) return 'overview';
  if (/Getting-Started|Community-Contributions/i.test(page)) return 'guide';
  if (/\/(Features|Information)/.test(page)) return 'reference';
  const name = title.replace(/^(WaW|BO3)\s*\|\s*/, '');
  if (REGEX_GUIDE_TITLE.test(name)) return 'guide';
  return product === 'waw' || product === 'bo3' ? 'guide' : 'reference';
}

/**
 * @param {PageInfo} info
 * @param {{type?: string, topic?: string, product?: string, add?: string[]}} [override]
 * @returns {string[]} suggested tags (product, type, topic, extras)
 */
function suggestTags(info, override = {}) {
  if (!info.page.includes('/') && info.page.endsWith('.md')) return ['meta'];
  const product = override.product ?? getProduct(info.page);
  const type = override.type ?? getType(info, product);
  const topic = override.topic ?? getTopic(info.page, product);
  const legacy = /legacy/i.test(info.page) ? 'legacy' : undefined;
  return [product, type, topic, legacy, ...(override.add ?? [])].flatMap((t) =>
    t ? [t] : [],
  );
}

/**
 * @param {string} content page source
 * @param {string[]} tags tags to add (existing tags stay)
 * @param {boolean} markdown
 * @returns {string|null} new content, null if the page has no header
 */
function setTags(content, tags, markdown) {
  const header = parsePageHeader(content, markdown);
  if (!header) return null;
  const existing = parseTags(header.tags);
  const others = existing.filter((t) => !tags.includes(t));
  const value = [...tags, ...others].join(', ');

  const end = content.indexOf(markdown ? '\n---' : '\n-->', 4);
  const head = content.slice(0, end);
  const rest = content.slice(end);
  const line = value ? `tags: ${value}` : 'tags:';
  if (/^tags:.*$/m.test(head)) return head.replace(/^tags:.*$/m, line) + rest;
  return head.replace(/^(editor:)/m, `${line}\n$1`) + rest;
}

/**
 * @param {string[]} files pages
 * @param {string} root repository root
 * @returns {Promise<number>} errors
 */
async function tagPages(files, root = process.cwd()) {
  const dryRun = !!process.env.DRY_RUN;
  /** @type {Record<string, {type?: string, topic?: string, product?: string, add?: string[]}>} */
  const overrides = process.env.TAG_OVERRIDES
    ? JSON.parse(
        await fs.promises.readFile(process.env.TAG_OVERRIDES, encoding),
      )
    : {};

  let changed = 0;
  let errors = 0;
  for (const file of files) {
    const content = await readPage(file);
    if (!content) continue;
    const page = file.split(path.sep).join('/');
    const markdown = page.endsWith('.md');
    const title = parsePageHeader(content, markdown)?.title ?? '';
    const hasChildren = fs.existsSync(
      path.join(root, stripPageExtension(file)),
    );

    const tags = suggestTags({ page, title, hasChildren }, overrides[page]);
    const result = setTags(content, tags, markdown);
    if (result === null) {
      errors++;
      console.error('🚨 No page header:', page);
      continue;
    }
    if (dryRun) console.log([page, title, tags.join(', ')].join('\t'));
    if (result === content) continue;
    changed++;
    if (!dryRun) await fs.promises.writeFile(file, result, encoding);
  }

  console.log(
    `${dryRun ? 'DRY_RUN: would tag' : 'Tagged'} ${changed} pages 🏷️`,
  );
  return errors;
}

export { getProduct, getTopic, getType, suggestTags, setTags, tagPages };
