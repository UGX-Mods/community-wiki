/**
 * The wiki.js page header (metadata comment at the top of each html page)
 */

// fields wiki.js writes into the page header comment
const PAGE_HEADER_FIELDS = [
  'title',
  'description',
  'published',
  'date',
  'tags',
  'editor',
  'dateCreated',
];

// wiki.js only picks up the header if it is the very first node
const REGEX_HTML_HEADER = /^<!--\r?\n([\s\S]*?)\r?\n-->/;

/**
 * @param {string} content page source
 * @returns {Record<string, string>|null} header fields (values trimmed) or null if there is no header
 */
function parsePageHeader(content) {
  const header = REGEX_HTML_HEADER.exec(content)?.[1];
  if (!header) return null;

  return Object.fromEntries(
    header
      .split(/\r?\n/)
      .map((line) => /^(\w+):(.*)$/.exec(line))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );
}

/**
 * @param {string} content page source
 * @returns {string|undefined}
 */
function getPageTitle(content) {
  return /^title: (.*)$/m.exec(content)?.[1];
}

module.exports = { PAGE_HEADER_FIELDS, parsePageHeader, getPageTitle };
