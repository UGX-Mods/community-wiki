/**
 * The tag set of the wiki (see AGENTS.md). Most pages get one product tag, one content type
 * and, for modding pages, a topic. `confluence:<id>` tags are kept for the tooling.
 */

const PRODUCT_TAGS = [
  'waw',
  'bo3',
  'ugxl',
  'ugxlin',
  'forum',
  'ugxmp',
  'services',
];
const TYPE_TAGS = [
  'guide',
  'reference',
  'changelog',
  'troubleshooting',
  'overview',
];
const TOPIC_TAGS = ['mapping', 'scripting', 'sound', 'menu', 'models', 'tools'];
const EXTRA_TAGS = ['legacy', 'meta'];

const TAGS = [...PRODUCT_TAGS, ...TYPE_TAGS, ...TOPIC_TAGS, ...EXTRA_TAGS];

/**
 * @param {string|undefined} value tags field of the page header
 * @returns {string[]}
 */
function parseTags(value) {
  return (value ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * @param {string} tag
 * @returns {boolean} tag of the tag set or a confluence id
 */
function isKnownTag(tag) {
  return TAGS.includes(tag) || /^confluence:\d+$/.test(tag);
}

export {
  PRODUCT_TAGS,
  TYPE_TAGS,
  TOPIC_TAGS,
  EXTRA_TAGS,
  TAGS,
  parseTags,
  isKnownTag,
};
