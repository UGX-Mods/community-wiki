/**
 * Helper script to convert confluence exported html files to better WikiJS files
 */
const path = require('path');
const fs = require('fs');
const HTMLParser = require('node-html-parser');

const confIdInNameRegex = /_?(\d{4,})html\.html$/;
const numOnlyFilename = /(\d{4,})\.html$/;

const directoryPath = process.cwd();
fs.readdir(directoryPath, { recursive: true }, function (err, files) {
  if (err) {
    return console.error(err);
  }

  fixFileNames(files);
  fixNumberFileNameOnly(files);

  console.log(
    'HTML File Count:',
    files.filter((f) => !f.includes('/node_modules/') && f.endsWith('.html'))
      .length
  );
});

/**
 *
 * @param {string[]} files
 */
function fixFileNames(files) {
  files.forEach(
    (
      /**
       * @type {string} file
       */
      file
    ) => {
      if (file.endsWith('.html') && confIdInNameRegex.test(file)) {
        const match = file.match(confIdInNameRegex);

        const id = match[1];

        fs.readFile(
          path.join(directoryPath, file),
          'utf8',
          function (err, data) {
            const parsedHtml = HTMLParser.parse(data, { comment: true });

            const comment = `\n\n<!-- conf id: ${id} -->\n`;

            const index = parsedHtml.childNodes.findIndex(
              (child) => child.nodeType == HTMLParser.NodeType.COMMENT_NODE
            );
            if (index === -1) return;

            parsedHtml.childNodes.splice(
              index + 1,
              0,
              HTMLParser.parse(comment, { comment: true })
            );

            let newFile = file.replace(confIdInNameRegex, '.html');
            if (newFile.endsWith('\\.html')) {
              newFile = newFile.replace('\\.html', `\\${id}.html`);
            }

            const page_data = parsedHtml.innerHTML;

            fs.writeFileSync(newFile, page_data);
            fs.rmSync(file);
          }
        );
      }
    }
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
       * @type {string} file
       */
      file
    ) => {
      if (file.endsWith('.html') && numOnlyFilename.test(file)) {
        fs.readFile(
          path.join(directoryPath, file),
          'utf8',
          function (err, data) {
            const parsedHtml = HTMLParser.parse(data, { comment: true });

            //

            let title = parsedHtml.innerHTML.match(
              new RegExp(/^title: (.*)$/, 'm')
            )[1];
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

            const newFile = file.replace(numOnlyFilename, `${newTitle}.html`);
            console.log(`${title} -> ${newTitle}`);

            fs.renameSync(file, newFile);
          }
        );
      }
    }
  );
}
