/**
 * Cleanup of confluence exported html: remove boilerplate, convert macros into wiki widgets
 */
const fs = require('node:fs');
const path = require('node:path');
const { encoding } = require('../lib/pages');
const {
  parseHtmlContent,
  writeFileFormat,
  getWikiJsCommentNode,
  removeClassFromNode,
} = require('../lib/html');
const { createPageHierarchy } = require('../hierarchy');
const { getPathForConfluenceId } = require('./ids');

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

        const parsedHtml = parseHtmlContent(data);
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
    if (data === null) {
      continue;
    } else if (data.length === 0) {
      console.error('EMPTY FILE @', filePath);
      continue;
    }

    const parsedHtml = parseHtmlContent(data);
    const wikiJsCommentNode = getWikiJsCommentNode(parsedHtml);
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

      parsedHtml.innerHTML =
        `<!--${wikiJsCommentNode.textContent}-->\n` +
        layouts.map((l) => l.innerHTML).join('\n');
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
        console.warn('⚠️ Missing emoji map entry for:', emoji);
        return;
      }

      i.replaceWith(EMOJI_MAP[emoji] ?? emoji);
    });

    // remove toc macro
    parsedHtml.querySelectorAll('div.toc-macro').forEach((d) => d.remove());

    // remove style tags
    parsedHtml.querySelectorAll('style').forEach((s) => s.remove());

    // replace youtube iframes with correct embed (+ privacy option!)
    parsedHtml.querySelectorAll('iframe.youtube-player').forEach((s) => {
      s.replaceWith(createPrivacyYoutubeEmbed(s.getAttribute('src')));
    });

    // fix iframe invalid attributes
    parsedHtml.querySelectorAll('iframe').forEach((s) => {
      s.removeAttribute('frameborder')
        .removeAttribute('webkitallowfullscreen')
        .removeAttribute('mozallowfullscreen');

      //
    });

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

    // remove boilerplate from th tags
    parsedHtml.querySelectorAll('th').forEach((th) => {
      if (th.getAttribute('colspan') === '1') {
        th.removeAttribute('colspan');
      }
      removeClassFromNode(th, 'confluenceTh');
    });

    // remove boilerplate from td tags
    parsedHtml.querySelectorAll('td').forEach((td) => {
      td.removeAttribute('nowrap');
      if (td.getAttribute('colspan') === '1') {
        td.removeAttribute('colspan');
      }
      removeClassFromNode(td, 'confluenceTd');
    });

    // remove content wrapper boilerplate
    parsedHtml.querySelectorAll('div.content-wrapper').forEach((div) => {
      div.replaceWith(div.innerHTML);
    });

    // remove some confluence / jira classes
    parsedHtml.querySelectorAll('td,th,span').forEach((n) => {
      removeClassFromNode(
        n,
        n.classList.value.filter(
          (c) => c.startsWith('jira-') || c.startsWith('jim-'),
        ),
      );
    });
    parsedHtml.querySelectorAll('span[sort-column-key]').forEach((n) => {
      n.replaceWith(n.innerHTML);
    });
    parsedHtml.querySelectorAll('tr').forEach((n) => {
      removeClassFromNode(n, ['rowNormal', 'rowAlternate']);
    });
    parsedHtml.querySelectorAll('table').forEach((n) => {
      removeClassFromNode(n, 'aui');
    });

    // ensure external links use target _blank
    parsedHtml.querySelectorAll('a').forEach((n) => {
      const href = n.getAttribute('href');
      if (!href || !/^(http|\/\/)/i.test(href)) return;

      if (!n.hasAttribute('target')) {
        n.setAttribute('target', '_blank');
      }
    });

    // replace userlink macro
    parsedHtml.querySelectorAll('a.confluence-userlink').forEach((n) => {
      n.replaceWith(`<em>${n.innerHTML}</em>`);
    });

    const $pagetree = parsedHtml.querySelector('div.plugin_pagetree');
    if ($pagetree) {
      $pagetree.replaceWith(await createPageHierarchy(filePath));
    }

    parsedHtml.querySelectorAll('div.preformatted.panel').forEach(($panel) => {
      const $panelContent = $panel.querySelector('.panelContent');
      if ($panelContent) {
        $panel.replaceWith(
          `<div class="widget-panel pre-formatted">${$panelContent.innerHTML}</div>`,
        );
      }
    });

    // replace code panel with spoiler or remove completely
    parsedHtml.querySelectorAll('div.panel:not(.code)').forEach(($panel) => {
      const $panelContent = $panel.querySelector('.panelContent');
      if (!$panelContent) {
        return;
      }

      $panel.replaceWith(
        `<div class="widget-panel">${$panelContent.innerHTML}</div>`,
      );
    });

    parsedHtml.querySelectorAll('div.code.panel').forEach(($panel) => {
      const $codeContent = $panel.querySelector('.codeContent');
      if (!$codeContent) {
        return;
      }

      const $codeHeader = $panel.querySelector('.codeHeader');
      if (!$codeHeader) {
        // replace with simple widget
        $panel.replaceWith(
          `<div class="widget-panel widget-code-panel">${$codeContent.innerHTML}</div>`,
        );
        return;
      }

      const isCollapsable = !!$codeHeader.querySelector('.collapse-source');
      if (isCollapsable) {
        const title = $panel.querySelector('.code-title')?.innerHTML || '';
        $panel.replaceWith(`<div class="expandable-container widget-code-panel">
            <div class="expandable-header widget-code-panel-header">
              <div class="expandable-title widget-code-panel-title">${title}</div>
              <button class="expandable-button" type="button">Expand source...</button>
            </div>
            <div class="expandable-content widget-code-panel-content">${$codeContent.innerHTML}</div>
          </div>`);
      } else {
        const title =
          $codeHeader.querySelector('b')?.innerHTML || $codeHeader.innerHTML;
        $panel.replaceWith(`<div class="widget-code-panel">
        <div class="widget-code-panel-header">
          <div class="widget-code-panel-title">${title}</div>
        </div>
        <div class="widget-code-panel-content">${$codeContent.innerHTML}</div>
      </div>`);
      }
    });

    // try to fix invalid wiki links from confluence id to correct wikijs path
    let invalidLinks = parsedHtml
      .querySelectorAll('a')
      .filter(
        (a) =>
          a.hasAttribute('href') &&
          /(?:^|_)(\d{3,}).html$/.test(a.getAttribute('href')) &&
          !a.getAttribute('href').includes('/forum/'),
      );

    for (const a of invalidLinks) {
      const href = a.getAttribute('href');
      const match = /(?:^|_)(\d{3,}).html$/.exec(href);
      if (!match) continue;

      const wikiJsPath = await getPathForConfluenceId(match[1]);
      if (wikiJsPath) {
        a.setAttribute('href', `/${wikiJsPath.replace(/\\/g, '/')}`);
        console.log('Fix url from', href, '->', a.getAttribute('href'));
      }
    }

    // warn about old invalid confluence links!
    invalidLinks = parsedHtml
      .querySelectorAll('a')
      .filter(
        (a) =>
          a.hasAttribute('href') &&
          /(^\/display\/|(?:^|_)\d{3,}.html$|jira\.ugx-mods\.com|confluence\.ugx-mods\.com)/.test(
            a.getAttribute('href'),
          ) &&
          !a.getAttribute('href').includes('/forum/'),
      );

    if (invalidLinks.length > 0) {
      console.warn(
        '⚠️',
        invalidLinks.length,
        'invalid links @',
        path.sep + filePath,
        invalidLinks.map((a) => a.getAttribute('href')),
      );
    }

    await writeFileFormat(parsedHtml.innerHTML, filePath);
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

function createPrivacyYoutubeEmbed(url) {
  // https://www.youtube-nocookie.com/embed/6eUsg4VI2zk?si=jX_wopnqkNk64IDX

  if (!url) {
    return '';
  }

  url = url.replace(
    /(\/\/|https?:\/\/)?(www.)?youtube\.com/,
    'https://www.youtube-nocookie.com',
  );

  return `<iframe
    width="560" height="315"
    src="${url}"
    title="YouTube video player"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen></iframe>`;
}

module.exports = {
  cleanupConfluenceHtml,
  fixCodeBlocks,
  createHtmlBanner,
  createPrivacyYoutubeEmbed,
};
