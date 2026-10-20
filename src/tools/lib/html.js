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
 * Writes the html formatted with the prettier config of the repository
 *
 * @param {string} source
 * @param {string} filePath
 */
async function writeFileFormat(source, filePath) {
  try {
    const config = {
      ...(await prettier.resolveConfig(path.resolve(filePath), {
        editorconfig: true,
      })),
      filepath: filePath,
    };

    return fs.promises.writeFile(
      filePath,
      await prettier.format(source, config),
    );
  } catch (err) {
    console.error('Formatting error @', filePath, String(err));
  }
}

/**
 * @param {HTMLParser.Node} rootNode
 * @returns
 */
function getWikiJsCommentNode(rootNode) {
  return rootNode.childNodes
    .filter((n) => n.nodeType === HTMLParser.NodeType.COMMENT_NODE)
    .find((n) => n.text.includes('title:'));
}

/**
 *
 * @param {HTMLParser.HTMLElement} node
 * @param {string|string[]} className single or array of classnames to remove
 */
function removeClassFromNode(node, className) {
  if (!Array.isArray(className)) {
    className = [className];
  }

  for (const clName of className) {
    node.classList.remove(clName);
  }

  if (node.classList.length === 0) {
    node.removeAttribute('class');
  }
}

export {
  HTMLParser,
  parseHtmlContent,
  writeFileFormat,
  getWikiJsCommentNode,
  removeClassFromNode,
};
