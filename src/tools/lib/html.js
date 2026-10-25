/**
 * HTML parsing and writing helpers
 */
import fs from 'node:fs';
import path from 'node:path';
import * as prettier from 'prettier';
import * as HTMLParser from 'node-html-parser';

const REGEX_FIX_CLOSING_TAG_ISSUE = /<(\/?\w+)(?:\s+)>/g;

/**
 * @type {Partial<HTMLParser.Options>}
 */
const HTML_PARSER_OPTIONS = {
  comment: true,
  lowerCaseTagName: true,
  fixNestedATags: false,
  parseNoneClosedTags: true,
  voidTag: { closingSlash: true },
};

/**
 *
 * @param {string} content
 * @returns
 */
function parseHtmlContent(content) {
  return HTMLParser.parse(
    content.replace(REGEX_FIX_CLOSING_TAG_ISSUE, '<$1>'),
    HTML_PARSER_OPTIONS,
  );
}

/**
 * Formats the html with the prettier config of the repository
 *
 * @param {string} source
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function formatHtml(source, filePath) {
  const config = {
    ...(await prettier.resolveConfig(path.resolve(filePath), {
      editorconfig: true,
    })),
    filepath: filePath,
  };
  return prettier.format(source, config);
}

/**
 * Writes the html formatted with the prettier config of the repository
 *
 * @param {string} source
 * @param {string} filePath
 */
async function writeFileFormat(source, filePath) {
  try {
    return fs.promises.writeFile(filePath, await formatHtml(source, filePath));
  } catch (err) {
    console.error('Formatting error @', filePath, String(err));
  }
}

/**
 * Escape for text content (quotes are fine there)
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtmlText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * Escape for text content and attribute values
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return escapeHtmlText(value)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export {
  HTMLParser,
  escapeHtml,
  escapeHtmlText,
  parseHtmlContent,
  formatHtml,
  writeFileFormat,
};
