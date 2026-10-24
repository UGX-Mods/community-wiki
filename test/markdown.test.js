import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parsePageHeader, getPageTitle } from '../src/tools/lib/header.js';
import { pageToHtml } from '../src/tools/lib/markdown.js';
import { getPageFiles } from '../src/tools/lib/pages.js';
import { checkPageMetadata } from '../src/tools/validate/metadata.js';
import { checkPageSecurity } from '../src/tools/validate/security.js';
import { checkPageLinks } from '../src/tools/validate/links.js';
import { createPageHierarchy } from '../src/tools/hierarchy.js';
import { htmlPage, createFixture, removeFixture } from './helpers.js';

/**
 * @param {string} title
 * @param {string} body
 * @param {Record<string, string>} fields
 */
function mdPage(title, body = '', fields = {}) {
  const header = {
    title,
    description: `About ${title}`,
    published: 'true',
    date: '2026-10-20T00:00:00.000Z',
    tags: '',
    editor: 'markdown',
    dateCreated: '2026-10-20T00:00:00.000Z',
    ...fields,
  };
  const lines = Object.entries(header).map(([k, v]) => `${k}: ${v}`.trim());
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}

test('front matter is the header of markdown pages', () => {
  const content = mdPage('README', '# Readme');
  assert.equal(parsePageHeader(content, true)?.title, 'README');
  assert.equal(parsePageHeader(content, true)?.tags, '');
  assert.equal(parsePageHeader(content), null);
  assert.equal(getPageTitle(content), 'README');
});

test('pageToHtml renders markdown without front matter', () => {
  const html = pageToHtml('README.md', mdPage('README', '# Hi\n\n[x](/Foo)'));
  assert.doesNotMatch(html, /title:/);
  assert.match(html, /<h1>Hi<\/h1>/);
  assert.match(html, /<a href="\/Foo">x<\/a>/);
  assert.equal(pageToHtml('Foo.html', '<p>x</p>'), '<p>x</p>');
});

test('checkPageMetadata for markdown pages', () => {
  assert.deepEqual(checkPageMetadata('README.md', mdPage('README')), {
    errors: [],
    warnings: [],
  });
  assert.deepEqual(checkPageMetadata('README.md', '# no front matter').errors, [
    'Missing wiki.js front matter at top of file',
  ]);
  assert.deepEqual(
    checkPageMetadata('README.md', mdPage('README', '', { editor: 'ckeditor' }))
      .warnings,
    ['"editor" should be markdown, not ckeditor'],
  );
});

test('checkPageSecurity checks iframes in markdown', () => {
  const html = pageToHtml(
    'Foo.md',
    mdPage('Foo', '<iframe src="https://evil.example"></iframe>'),
  );
  assert.equal(checkPageSecurity(html).length, 1);
});

test('links from and to markdown pages', async (t) => {
  const root = createFixture({
    'README.md': mdPage('README'),
    'CONTRIBUTING.md': mdPage('CONTRIBUTING', '## Setup\n\ntext'),
    'Guide.html': htmlPage('Guide', '<h2 id="intro">Intro</h2>'),
  });
  t.after(() => removeFixture(root));

  const errorsOf = async (/** @type {string} */ body) =>
    (await checkPageLinks('README.md', mdPage('README', body), root)).map(
      (i) => `${i.href} ${i.error}`,
    );

  // wiki.js style and GitHub style links
  assert.deepEqual(
    await errorsOf(
      '[a](/CONTRIBUTING) [b](CONTRIBUTING.md) [c](/CONTRIBUTING.md) [d](/Guide#intro)',
    ),
    [],
  );
  assert.deepEqual(await errorsOf('[a](/Nope) [b](/Guide#nope)'), [
    '/Nope Not Found!',
    '/Guide#nope No anchor id found!',
  ]);
  // links in code are not links
  assert.deepEqual(
    await errorsOf('`[a](/Nope)`\n\n```html\n<a href="/Nope">x</a>\n```'),
    [],
  );
});

test('page hierarchy lists markdown child pages', async (t) => {
  const root = createFixture({
    'Guide.html': htmlPage('Guide'),
    'Guide/Notes.md': mdPage('Notes'),
  });
  t.after(() => removeFixture(root));

  assert.equal(
    await createPageHierarchy(path.join(root, 'Guide.html')),
    '<ul class="widget-page-hierarchy"><li><a href="Notes">Notes</a></li></ul>',
  );
});

test('getPageFiles skips .github, github/ and git ignored files', async (t) => {
  const root = createFixture({
    'Guide.html': htmlPage('Guide'),
    'README.md': mdPage('README'),
    'PERSONAL.md': '# notes',
    '.gitignore': 'PERSONAL.md\n',
    '.github/PULL_REQUEST_TEMPLATE.md': '# PR',
    'github/PULL_REQUEST_TEMPLATE.md': '# PR',
    'attachments/img.png': 'png',
  });
  t.after(() => removeFixture(root));
  execFileSync('git', ['init', '-q'], { cwd: root });

  assert.deepEqual((await getPageFiles(root)).sort(), [
    'Guide.html',
    'README.md',
  ]);
});
