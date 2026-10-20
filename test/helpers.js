/**
 * Test helpers. Fixtures are created in a temp folder at runtime, never commit
 * .html / .md fixtures: every such file in the repository becomes a wiki page.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * @param {string} title
 * @param {string} body
 * @param {Record<string, string>} fields overrides / additional header fields
 * @returns {string} html page with wiki.js header
 */
function htmlPage(title, body = '', fields = {}) {
  const header = {
    title,
    description: `About ${title}`,
    published: 'true',
    date: '2026-10-20T00:00:00.000Z',
    tags: 'test',
    editor: 'ckeditor',
    dateCreated: '2026-10-20T00:00:00.000Z',
    ...fields,
  };
  const lines = Object.entries(header).map(([k, v]) => `${k}: ${v}`);
  return `<!--\n${lines.join('\n')}\n-->\n${body}\n`;
}

/**
 * @param {Record<string, string>} files relative path (forward slashes) -> content
 * @returns {string} absolute path of the created temp folder
 */
function createFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ugx-wiki-test-'));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

function removeFixture(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

module.exports = { htmlPage, createFixture, removeFixture };
