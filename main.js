/**
 * Helper script to convert confluence exported html files to better WikiJS files
 */
const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');
const HTMLParser = require('node-html-parser');
const encoding = 'utf8';
const select = require('@inquirer/prompts').select;

/**
 * @type {'NONE'|'filenames'|'codeblocks'|'confluence-id'|'confluence-cleanup'}
 */
const STEPS = [
  { value: 'NONE', name: 'Nothing', description: 'Do nothing :D' },
  {
    value: 'create-hierarchy',
    name: 'CREATE: Page Hierarchy',
    description: 'Create a page hierarchy from parent to child pages',
  },
  {
    value: 'filenames',
    name: 'Fix filenames',
    description: '[confluence migration] fix the filenames',
  },
  {
    value: 'codeblocks',
    name: 'Fix codeblocks',
    description: '[confluence migration] fix codeblocks',
  },
  {
    value: 'confluence-cleanup',
    name: 'Cleanup files',
    description:
      '[confluence migration] cleanup files from confluence boilerplate',
  },
  {
    value: 'confluence-id',
    name: 'Confluence ID',
    description:
      '[confluence migration] will add the confluence id (if found) as a tag',
  },
]; // due to "circumstances", do each step by step

const confIdInNameRegex = /_?(\d{4,})html\.html$/;
const numOnlyFilename = /(\d{4,})\.html$/;
const fixClosingTagIssue = /<(\/?\w+)(?:\s+)>/g;

const EMOJI_MAP = {
  ':heart:': '❤️',
  ':wink:': '😉',
  ':thumbs-up:': '👍',
  ':smile:': '🙂',
  ':yellow-star:': '⭐',
  ':laugh:': '😁',
  ':tick:': '✔️',
  ':cheeky:': '😜',
  ':light-on:': '💡',
  ':warning:': '⚠️',
  ':sad:': '😥',
};

const directoryPath = process.cwd();

async function main() {
  const answer = await select({
    message: 'What do you want to do?',
    choices: STEPS,
  });

  const files = (
    await fs.promises.readdir(directoryPath, { recursive: true })
  ).filter((f) => !/node_modules[\\/]/.test(f) && f.endsWith('.html'));
  console.log(`Found ${files.length}x HTML files`);

  switch (answer) {
    case 'create-hierarchy':
      createPageHierarchy(files);
      break;
    case 'filenames':
      fixFileNames(files);
      fixNumberFileNameOnly(files);
      break;
    case 'codeblocks':
      fixCodeBlocks(files);
      break;
    case 'confluence-cleanup':
      cleanupConfluenceHtml(files);
      break;
    case 'confluence-id':
      addConfluenceCommentAsTag(files);
      break;
    case 'NONE':
    default:
      console.log('NOOP - nothing changed');
      return;
  }
}
main();

async function createPageHierarchy(files) {
  const choices = files
    .filter((f) => {
      try {
        fs.accessSync(f.substring(0, f.length - 5));
        return true;
      } catch (_) {
        return false;
      }
    })
    .map((f) => ({ value: f }));

  /**
   * @type {string}
   */
  const filePath = await select({
    message: 'Where do you want to add the Page Hierarchy?',
    choices,
  });
  if (!filePath) throw new Error('No file path was set!');

  const data = await fs.promises.readFile(filePath, encoding).catch((err) => {
    console.error(err);
    return null;
  });
  if (!data) throw new Error('Invalid file content!');

  const parsedHtml = HTMLParser.parse(data, { comment: true });
  const rootFolderPath = filePath.substring(0, filePath.length - 5);
  const rootFolder = rootFolderPath.split(path.sep).slice(-1);

  const childPages = (
    await fs.promises.readdir(rootFolderPath, {
      recursive: true,
    })
  ).filter((f) => f.endsWith('.html'));

  if (childPages.length > 0) {
    const lis = (
      await Promise.all(
        childPages.map(async (page) => {
          const title = await fs.promises
            .readFile(rootFolderPath + path.sep + page, encoding)
            .then((pageData) => {
              const parsedPageHtml = HTMLParser.parse(pageData, {
                comment: true,
              });
              return /^title: (.*)$/m.exec(parsedPageHtml.innerHTML)?.[1];
            })
            .catch((err) => {
              console.error(err);
              return page.substring(0, page.length - 5);
            });

          if (!title) {
            console.warn('Title not found for page:', page);
          }

          const href = `${rootFolder}/${page
            .substring(0, page.length - 5)
            .split(path.sep)
            .join('/')}`;
          return `<a href="${href}">${title}</a>`;
        }),
      )
    ).join('</li><li>');
    parsedHtml.innerHTML += `<ul><li>${lis}</li></ul>`;
  }

  await writeFileFormat(parsedHtml.innerHTML, filePath);
}

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
      fs.readFile(filePath, encoding, (err, data) => {
        if (err) {
          return console.error(err);
        }

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

      fs.readFile(filePath, encoding, (err, data) => {
        if (err) {
          return console.error(err);
        }

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
      fs.readFile(filePath, encoding, (err, data) => {
        if (err) {
          return console.error(err);
        }

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

/**
 * Add the confluence id to the tag
 * NOTE: The page must be created and recognized by wikijs already! (the top comment header must be present!)
 * NOTE: Additionally the comment with the confluence id must be present!
 *
 * @param {string[]} files
 */
async function addConfluenceCommentAsTag(files) {
  const tagsMatch = /^tags: ?(.*)$/im;

  for (const filePath of files) {
    const data = await fs.promises.readFile(filePath, encoding).catch((err) => {
      console.error(err);
      return null;
    });
    if (!data) continue;

    const parsedHtml = HTMLParser.parse(data, { comment: true });
    const wikiJsCommentNode = parsedHtml.childNodes
      .filter((n) => n.nodeType === HTMLParser.NodeType.COMMENT_NODE)
      .find((n) => n.text.includes('dateCreated:') && n.text.includes('tags:'));
    if (!wikiJsCommentNode) {
      console.error(`No wikiJs comment found: ${filePath}`);
      continue;
    }

    let wikiJsComment = wikiJsCommentNode.innerText;
    const tagMatch = tagsMatch.exec(wikiJsComment);
    if (tagMatch?.length !== 2) {
      console.error(`No tag regex match: ${filePath}`);
      continue;
    }

    const tags = tagMatch[1].split(' ');
    if (tags.find((t) => /confluence:\d+/.test(t))) {
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

    wikiJsComment = wikiJsComment.replace(tagsMatch, `tags: ${tags.join(' ')}`);

    await writeFileFormat(
      parsedHtml.innerHTML.replace(wikiJsCommentNode.innerText, wikiJsComment),
      filePath,
    );
  }
}

/**
 * This will remove confluence classes and html boilerplate
 *
 * @param {string[]} files
 */
async function cleanupConfluenceHtml(files) {
  const REGEX_JIRA_JQL =
    /.+?jira\.ugx-mods\.com.+jqlQuery=(.+?)(?:&amp;|$|&src=)/i;
  const REGEX_JIRA_ISSUE = /.+?jira\.ugx-mods\.com\/browse\/(\w+-\d+)/i;

  for (const filePath of files) {
    const data = await fs.promises.readFile(filePath, encoding).catch((err) => {
      console.error(err);
      return null;
    });
    if (!data) continue;

    const parsedHtml = HTMLParser.parse(data, { comment: true });
    const wikiJsCommentNode = parsedHtml.childNodes
      .filter((n) => n.nodeType === HTMLParser.NodeType.COMMENT_NODE)
      .find((n) => n.text.includes('dateCreated:') && n.text.includes('tags:'));
    if (!wikiJsCommentNode) {
      console.error(`No wikiJs comment found: ${filePath}`);
      continue;
    }

    const layout2 = parsedHtml.querySelector('> div.contentLayout2');
    if (layout2) {
      const layouts = layout2.querySelectorAll('> div.columnLayout');
      layouts.forEach((layout) => {
        const cells = layout.querySelectorAll('> .cell > .innerCell');
        layout.innerHTML = cells
          .filter((c) => c.innerText.trim().length > 0)
          .map((c) => c.innerHTML)
          .join('\n');
      });
      parsedHtml.innerHTML = layouts.map((l) => l.innerHTML).join('\n');
    }

    // replace confluence classes
    parsedHtml
      .querySelectorAll('a.external-link')
      .forEach((a) => removeClassFromNode(a, 'external-link'));

    parsedHtml
      .querySelectorAll('ul.childpages-macro')
      .forEach((a) => removeClassFromNode(a, 'childpages-macro'));

    // replace emoticon with emojis
    parsedHtml.querySelectorAll('img.emoticon').forEach((i) => {
      const emoji =
        i.attributes['data-emoji-short-name'] ?? i.attributes['alt'] ?? '';

      if (!EMOJI_MAP[emoji]) {
        console.log('Missing emoji map entry for:', emoji);
        return;
      }

      i.replaceWith(EMOJI_MAP[emoji] ?? emoji);
    });

    // remove toc macro
    parsedHtml.querySelectorAll('div.toc-macro').forEach((d) => d.remove());

    // remove style tags
    parsedHtml.querySelectorAll('style').forEach((s) => s.remove());

    // remove black color
    parsedHtml.querySelectorAll('span').forEach((s) => {
      if (!s.hasAttribute('style')) return;

      s.setAttribute(
        'style',
        s.getAttribute('style').replace(/color: *?rgb\(0, *?0, *?0\);?/gi, ''),
      );

      if (!s.attributes['style']) {
        s.removeAttribute('style');
      }
    });

    // remove search macro
    parsedHtml.querySelectorAll('div.search-macro').forEach((d) => d.remove());

    // simplify images
    parsedHtml
      .querySelectorAll('span.confluence-embedded-file-wrapper')
      .forEach((n) => {
        const $img = n.querySelector('.confluence-embedded-image');

        if (!$img.hasAttribute('alt')) {
          $img.setAttribute('alt', '');
        }

        $img
          .removeAttribute('draggable')
          .removeAttribute('data-image-src')
          .removeAttribute('class');
        n.replaceWith(n.innerHTML);
      });

    // convert confluence expander into custom one
    parsedHtml.querySelectorAll('div.expand-container').forEach((d) => {
      const title = d.querySelector('> .expand-control')?.text;
      const content = d.querySelector('> .expand-content')?.innerHTML;
      if (!content) {
        d.remove();
        return;
      }

      d.replaceWith(
        `<div class="expandable-container">
          <button class="expandable-button" type="button">${title ?? 'Click to expand...'}</button>
          <div class="expandable-content">${content}</div>
        </div>`,
      );
    });

    // Convert confluence information macro into banner
    parsedHtml
      .querySelectorAll('.confluence-information-macro')
      .forEach((m) => {
        const title = m.querySelector('p.title')?.text;
        const content = m.querySelector(
          'div.confluence-information-macro-body',
        ).innerHTML;
        const typeMatch = /confluence-information-macro-(\w+)/.exec(
          m.classNames,
        );
        m.replaceWith(
          createHtmlBanner(
            title,
            content,
            typeMatch?.length === 2 ? typeMatch[1] : 'info',
          ),
        );
      });

    // convert some links
    parsedHtml.querySelectorAll('a').forEach((a) => {
      let match = REGEX_JIRA_JQL.exec(a.getAttribute('href'));
      if (match?.length === 2) {
        return a.setAttribute(
          'href',
          `https://ugxmods.atlassian.net/issues/?jql=${match[1].replace(/\++$/, '')}`,
        );
      }

      match = REGEX_JIRA_ISSUE.exec(a.getAttribute('href'));
      if (match?.length === 2) {
        return a.setAttribute(
          'href',
          `https://ugxmods.atlassian.net/browse/${match[1]}`,
        );
      }
    });

    // warn about old invalid confluence links!
    const invalidLinks = parsedHtml
      .querySelectorAll('a')
      .filter(
        (a) =>
          a.hasAttribute('href') &&
          /(^\/display\/|(?:^|_)\d+.html$|jira\.ugx-mods\.com|confluence\.ugx-mods\.com)/.test(
            a.getAttribute('href'),
          ) &&
          !a.getAttribute('href').includes('/forum/'),
      );
    if (invalidLinks.length > 0) {
      console.warn(
        invalidLinks.length,
        'invalid links @',
        path.sep + filePath,
        invalidLinks.map((a) => a.getAttribute('href')),
      );
    }

    await writeFileFormat(parsedHtml.innerHTML, filePath);
  }
}

async function writeFileFormat(source, filePath) {
  try {
    const config = await prettier.resolveConfig(path.resolve(filePath), {
      editorconfig: true,
    });
    config.filepath = filePath;

    return fs.promises.writeFile(
      filePath,
      await prettier.format(source, config),
    );
  } catch (err) {
    console.error('Formatting error:', filePath); //, err);
  }
}

function createHtmlBanner(title, content, type) {
  if (type === 'information') {
    type = 'info';
  }

  let icon;
  switch (type) {
    case 'tip':
      icon = 'check-decagram';
      break;
    case 'warning':
      icon = 'alert-octagon';
      break;
    case 'note':
      icon = 'alert';
      break;
    default:
      icon = 'information-outline';
      break;
  }

  if (title) {
    title = `<p class="banner-title">${title}</p>`;
  } else {
    title = '';
  }

  return `<div class="banner banner-${type}">
    <img  src="/attachments/icons/${icon}.png" alt="" class="banner-icon">
    ${title}
    <div class="banner-body">${content}</div>
  </div>`;
}

/**
 *
 * @param {HTMLParser.HTMLElement} node
 */
function removeClassFromNode(node, className) {
  node.classList.remove(className);

  if (node.classList.length === 0) {
    node.removeAttribute('class');
  }
}
