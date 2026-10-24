/**
 * Sets empty page descriptions from a JSON file ({ "Page/Path.html": "One sentence." }).
 * Existing descriptions stay. Only the description line of the header changes.
 *
 * Environment: DESCRIPTIONS=path/to/descriptions.json (keep it outside the repository)
 */
import fs from 'node:fs';
import path from 'node:path';
import { encoding, readPage } from '../lib/pages.js';
import { parsePageHeader } from '../lib/header.js';

const MAX_LENGTH = 200;

/**
 * Wiki.js reads the header as YAML, a description must be a plain one-line scalar
 *
 * @param {string} description
 * @returns {string|null} problem or null if valid
 */
function checkDescription(description) {
  if (!description.trim()) return 'empty';
  if (/[\r\n]/.test(description)) return 'line break';
  if (/: |\s#/.test(description)) return 'contains ": " or " #" (YAML)';
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(description))
    return 'starts with a YAML special character';
  if (description.length > MAX_LENGTH)
    return `longer than ${MAX_LENGTH} characters`;
  return null;
}

/**
 * @param {string} content page source
 * @param {string} description
 * @param {boolean} markdown
 * @returns {string|null} new content, null if there is no header or the description is set
 */
function setDescription(content, description, markdown) {
  const header = parsePageHeader(content, markdown);
  if (!header || header.description) return null;
  const end = content.indexOf(markdown ? '\n---' : '\n-->', 4);
  const head = content.slice(0, end);
  const rest = content.slice(end);
  const line = `description: ${description}`;
  if (/^description:[ \t]*$/m.test(head)) {
    return head.replace(/^description:[ \t]*$/m, line) + rest;
  }
  return head.replace(/^(title:.*)$/m, `$1\n${line}`) + rest;
}

/**
 * @param {string[]} files pages
 * @returns {Promise<number>} errors
 */
async function setDescriptions(files) {
  const file = process.env.DESCRIPTIONS;
  if (!file) {
    console.error('🚨 DESCRIPTIONS (path to the JSON file) is not set');
    return 1;
  }
  /** @type {Record<string, string>} */
  const descriptions = JSON.parse(await fs.promises.readFile(file, encoding));

  let errors = 0;
  for (const [page, description] of Object.entries(descriptions)) {
    const problem = checkDescription(description);
    if (problem) {
      errors++;
      console.error(`🚨 ${page}: ${problem}`);
    }
  }
  if (errors) return errors;

  let changed = 0;
  for (const filePath of files) {
    const page = filePath.split(path.sep).join('/');
    const description = descriptions[page];
    if (!description) continue;
    const content = await readPage(filePath);
    if (!content) continue;
    const result = setDescription(content, description, page.endsWith('.md'));
    if (result === null) continue;
    await fs.promises.writeFile(filePath, result, encoding);
    changed++;
  }

  console.log('Set', changed, 'descriptions 📝');
  return 0;
}

export { checkDescription, setDescription, setDescriptions };
