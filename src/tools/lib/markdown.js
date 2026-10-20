/**
 * Markdown pages are rendered to html, so the html validators can check them as well
 */
import MarkdownIt from 'markdown-it';
import { MARKDOWN_EXTENSION } from './pages.js';
import { stripFrontMatter } from './header.js';

// wiki.js renders markdown with markdown-it and allows inline html
const markdown = new MarkdownIt({ html: true });

/**
 * @param {string} filePath
 */
function isMarkdownPage(filePath) {
  return filePath.endsWith(MARKDOWN_EXTENSION);
}

/**
 * @param {string} filePath
 * @param {string} content page source
 * @returns {string} html of the page body (markdown is rendered, html is returned as is)
 */
function pageToHtml(filePath, content) {
  return isMarkdownPage(filePath)
    ? markdown.render(stripFrontMatter(content))
    : content;
}

export { isMarkdownPage, pageToHtml };
