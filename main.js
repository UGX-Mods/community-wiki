/**
 * Helper script to convert confluence exported html files to better WikiJS files
 */
const path = require('path');
const fs = require('fs');
const HTMLParser = require('node-html-parser');
const encoding = 'utf8';
//
const FIX_FILENAMES = false;
const FIX_CODEBLOCKS = false;
//

const confIdInNameRegex = /_?(\d{4,})html\.html$/;
const numOnlyFilename = /(\d{4,})\.html$/;
const fixClosingTagIssue = /<(\/?\w+)(?:\s+)>/g;

const directoryPath = process.cwd();
fs.readdir(directoryPath, { recursive: true }, function (err, files) {
  if (err) {
    return console.error(err);
  }

  files = files.filter(
    (f) => !f.includes('node_modules/') && f.endsWith('.html'),
  );

  if (FIX_FILENAMES) {
    fixFileNames(files);
    fixNumberFileNameOnly(files);
  } else if (FIX_CODEBLOCKS) {
    fixCodeBlocks(files);
  }

  console.log(`Found ${files.length}x HTML files`);
});

/**
 *
 * @param {string[]} files
 */
function fixCodeBlocks(files) {
  const fncCodeBlock = (code, language = 'none') =>
    `<pre><code class="language-${language}">${code}</code></pre>`;

  files.forEach(
    (
      /**
       * @type {string} filePath
       */
      filePath,
    ) => {
      fs.readFile(filePath, encoding, function (err, data) {
        const parsedHtml = HTMLParser.parse(
          data.replace(fixClosingTagIssue, '<$1>'),
          {
            comment: true,
            lowerCaseTagName: true,
            fixNestedATags: true,
            parseNoneClosedTags: true,
            voidTag: { closingSlash: false },
          },
        );

        const preConfluence = parsedHtml.querySelectorAll(
          'pre.syntaxhighlighter-pre',
        );

        if (!preConfluence.length) return;

        preConfluence.forEach((pre) => {
          let lang = 'none';
          if (pre.attributes['data-syntaxhighlighter-params']) {
            const match = /brush:\s+?(.*?);/.exec(
              pre.attributes['data-syntaxhighlighter-params'],
            );
            if (match?.[1]) {
              lang = match[1];
            }
          }

          pre.replaceWith(fncCodeBlock(pre.innerHTML, lang));
        });

        fs.writeFileSync(filePath, parsedHtml.innerHTML, { encoding });
      });
    },
  );
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
      if (!confIdInNameRegex.test(filePath)) return;
      const match = confIdInNameRegex.exec(filePath);
      const id = match[1];

      fs.readFile(filePath, encoding, function (err, data) {
        const parsedHtml = HTMLParser.parse(data, { comment: true });

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

        let newFile = filePath.replace(confIdInNameRegex, '.html');
        if (newFile.endsWith('\\.html')) {
          newFile = newFile.replace('\\.html', `\\${id}.html`);
        }

        const page_data = parsedHtml.innerHTML;

        fs.writeFileSync(newFile, page_data);
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
      if (!numOnlyFilename.test(filePath)) return;
      fs.readFile(filePath, encoding, function (err, data) {
        const parsedHtml = HTMLParser.parse(data, { comment: true });

        //

        let title = /^title: (.*)$/m.exec(parsedHtml.innerHTML)?.[1];
        if (!title) return;

        const newTitle = title
          .replace('&#39;', '')
          .replace('&amp;', 'and')
          .replace(/(\s+|,|\||\(|\)|\/|\?)/g, '-')
          .replace(/\./g, '_')
          .replace(/-+/g, '-')
          .replace(/^WaW-/, '')
          .replace(/^BO3-/, '')
          .replace(/-$/, '');

        const newFile = filePath.replace(numOnlyFilename, `${newTitle}.html`);
        console.log(`${title} -> ${newTitle}`);

        fs.renameSync(filePath, newFile);
      });
    },
  );
}
