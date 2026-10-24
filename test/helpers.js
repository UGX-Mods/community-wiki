/**
 * Test helpers. Fixtures are created in a temp folder at runtime, never commit
 * .html / .md fixtures: every such file in the repository becomes a wiki page.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
    tags: 'guide',
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

/**
 * @param {string} root result of createFixture
 */
function removeFixture(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

export { htmlPage, createFixture, removeFixture };
