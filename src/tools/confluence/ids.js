/**
 * Confluence page ids, stored as `confluence:<id>` tag in the wiki.js page header
 */
import { getHtmlFiles, readPage } from '../lib/pages.js';
import {
  HTMLParser,
  parseHtmlContent,
  writeFileFormat,
  getWikiJsCommentNode,
} from '../lib/html.js';

const REGEX_TAGS_MATCH = /^tags: ?(.*)$/im;
const REGEX_CONFLUENCE_ID_TAG = /confluence:(\d)/;

/**
 * Add the confluence id to the tag
 * NOTE: The page must be created and recognized by wikijs already! (the top comment header must be present!)
 * NOTE: Additionally the comment with the confluence id must be present!
 *
 * @param {string[]} files
 */
async function addConfluenceCommentAsTag(files) {
  for (const filePath of files) {
    const data = await readPage(filePath);
    if (!data) continue;

    const parsedHtml = parseHtmlContent(data);
    const wikiJsCommentNode = getWikiJsCommentNode(parsedHtml);
    if (!wikiJsCommentNode) {
      console.error(`No wikiJs comment found: ${filePath}`);
      continue;
    }

    let wikiJsComment = wikiJsCommentNode.innerText;
    const tagMatch = REGEX_TAGS_MATCH.exec(wikiJsComment);
    if (tagMatch?.length !== 2) {
      console.error(`No tag regex match: ${filePath}`);
      continue;
    }

    const tags = tagMatch[1].split(' ');
    if (tags.find((t) => REGEX_CONFLUENCE_ID_TAG.test(t))) {
      continue; // already added
    }

    const regexConfIdMatch = /(?:conf id|Confluence Id):?\s*(\d+)/;
    const confIdCommentNode = parsedHtml.childNodes
      .filter((n) => n.nodeType === HTMLParser.NodeType.COMMENT_NODE)
      .find((n) => regexConfIdMatch.test(n.text));

    if (confIdCommentNode) {
      const confId = regexConfIdMatch.exec(confIdCommentNode.text)[1];
      if (confId) {
        tags.splice(0, 0, `confluence:${confId}`);
      } else {
        console.log(`Empty confluence id - skipping! ${filePath}`);
        continue;
      }

      parsedHtml.removeChild(confIdCommentNode);
    } else {
      console.log(
        `No comment node with confluence id found - skipping! ${filePath}`,
      );
      continue;
    }

    wikiJsComment = wikiJsComment.replace(
      REGEX_TAGS_MATCH,
      `tags: ${tags.join(' ')}`,
    );

    wikiJsCommentNode.innerText = wikiJsComment;

    await writeFileFormat(parsedHtml.innerHTML, filePath);
  }
}

const confIdToPathMap = {};

/**
 *
 * @param {string} confluenceId
 * @returns {Promise<string|null>}
 */
async function getPathForConfluenceId(confluenceId) {
  if (confIdToPathMap[confluenceId]) {
    return confIdToPathMap[confluenceId];
  }

  const files = await getHtmlFiles();
  for (const filePath of files) {
    const data = await readPage(filePath);
    if (!data) continue;

    const parsedHtml = parseHtmlContent(data);
    const wikiJsComment = getWikiJsCommentNode(parsedHtml)?.innerText;
    if (!wikiJsComment) {
      console.error(`No wikiJs comment found: ${filePath}`);
      continue;
    }

    const tagMatch = REGEX_TAGS_MATCH.exec(wikiJsComment);
    if (tagMatch?.length !== 2) {
      console.error(`No tag regex match: ${filePath}`);
      continue;
    }

    const confluenceIdTag = tagMatch[1]
      .split(' ')
      .find((t) => REGEX_CONFLUENCE_ID_TAG.test(t));
    if (!confluenceIdTag) continue;
    const id = confluenceIdTag.split(':')[1];

    confIdToPathMap[id] = filePath;

    if (confluenceId === id) return filePath;
  }

  return null;
}

export { addConfluenceCommentAsTag, getPathForConfluenceId };
