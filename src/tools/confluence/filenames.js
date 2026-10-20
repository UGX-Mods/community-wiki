/**
 * Rename confluence exported files (`Page-Name_12345html.html`, `12345.html`) to wiki.js page names
 */
import fs from 'node:fs';
import { encoding } from '../lib/pages.js';
import { HTMLParser, parseHtmlContent } from '../lib/html.js';
import { getPageTitle } from '../lib/header.js';

const REGEX_CONF_ID_IN_NAME = /_?(\d{4,})html\.html$/;
const REGEX_NUM_ONLY_FILENAME = /(\d{4,})\.html$/;

/**
 * Page name derived from the page title, e.g. `WaW | Radiant (Tips)` -> `Radiant-Tips`
 *
 * @param {string} title
 * @returns {string}
 */
function titleToFileName(title) {
  return title
    .replace('&#39;', '')
    .replace('&amp;', 'and')
    .replace(/(\s+|,|\||\(|\)|\/|\?)/g, '-')
    .replace(/\./g, '_')
    .replace(/-+/g, '-')
    .replace(/^WaW-/, '')
    .replace(/^BO3-/, '')
    .replace(/-$/, '');
}

/**
 *
 * @param {string[]} files
 */
function fixFileNames(files) {
  files.forEach(
    (
      /**
       * @type {string} filePath
       */
      filePath,
    ) => {
      const id = REGEX_CONF_ID_IN_NAME.exec(filePath)?.[1];
      if (!id) return;

      fs.readFile(filePath, encoding, (err, data) => {
        if (err) {
          return console.error(err);
        }

        const parsedHtml = parseHtmlContent(data);

        const comment = `\n\n<!-- conf id: ${id} -->\n`;

        const index = parsedHtml.childNodes.findIndex(
          (child) => child.nodeType == HTMLParser.NodeType.COMMENT_NODE,
        );
        if (index === -1) return;

        parsedHtml.childNodes.splice(
          index + 1,
          0,
          HTMLParser.parse(comment, { comment: true }),
        );

        let newFile = filePath.replace(REGEX_CONF_ID_IN_NAME, '.html');
        if (newFile.endsWith('\\.html')) {
          newFile = newFile.replace('\\.html', `\\${id}.html`);
        }

        fs.writeFileSync(newFile, parsedHtml.innerHTML);
        fs.rmSync(filePath);
      });
    },
  );
}

/**
 *
 * @param {string[]} files
 */
function fixNumberFileNameOnly(files) {
  files.forEach(
    (
      /**
       * @type {string} filePath
       */
      filePath,
    ) => {
      if (!REGEX_NUM_ONLY_FILENAME.test(filePath)) return;
      fs.readFile(filePath, encoding, (err, data) => {
        if (err) {
          return console.error(err);
        }

        const title = getPageTitle(parseHtmlContent(data).innerHTML);
        if (!title) return;

        const newTitle = titleToFileName(title);
        const newFile = filePath.replace(
          REGEX_NUM_ONLY_FILENAME,
          `${newTitle}.html`,
        );
        console.log(`Title change from: ${title} -> ${newTitle}`);

        fs.renameSync(filePath, newFile);
      });
    },
  );
}

export { titleToFileName, fixFileNames, fixNumberFileNameOnly };
