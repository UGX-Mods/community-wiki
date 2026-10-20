import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { checkPageLinks } from '../src/tools/validate/links.js';
import { htmlPage, createFixture, removeFixture } from './helpers.js';

const page = (body) => htmlPage('Test', body);

let root;
test.before(() => {
  root = createFixture({
    'Foo.html': page('<a href="/Foo/Bar">x</a>'),
    'Foo/Bar.html': page(
      '<h2 id="setup">Setup</h2><h2 id="dup"></h2><h2 id="dup"></h2>',
    ),
    'Foo/Baz.html': page(''),
    'attachments/img.png': 'png',
  });
});
test.after(() => removeFixture(root));

/**
 * @param {string} filePath page path with forward slashes
 * @param {string} body
 */
async function errorsOf(filePath, body) {
  const issues = await checkPageLinks(
    filePath.split('/').join(path.sep),
    page(body),
    root,
  );
  return issues.map((i) => `${i.href} ${i.error}`);
}

test('absolute links to pages, folders and assets', async () => {
  assert.deepEqual(
    await errorsOf(
      'Foo.html',
      '<a href="/Foo">x</a><a href="/Foo/Bar">x</a><a href="/attachments/img.png">x</a>',
    ),
    [],
  );
});

test('relative links resolve to child and sibling pages', async () => {
  assert.deepEqual(await errorsOf('Foo.html', '<a href="Bar">child</a>'), []);
  assert.deepEqual(
    await errorsOf('Foo/Bar.html', '<a href="Baz">sibling</a>'),
    [],
  );
});

test('missing targets and empty hrefs', async () => {
  assert.deepEqual(
    await errorsOf(
      'Foo.html',
      '<a href="/Nope">x</a><a href="Nope">x</a><a>x</a>',
    ),
    ['/Nope Not Found!', 'Nope Not Found!', ' Empty HREF!'],
  );
});

test('external links are not checked', async () => {
  assert.deepEqual(
    await errorsOf(
      'Foo.html',
      '<a href="https://example.com/x">x</a><a href="//example.com">x</a><a href="mailto:a@b.c">x</a>',
    ),
    [],
  );
});

test('anchors on the same page', async () => {
  assert.deepEqual(
    await errorsOf(
      'Foo.html',
      '<h2 id="a">A</h2><h3 id="b"></h3><h3 id="b"></h3><a href="#a">ok</a><a href="#b">dup</a><a href="#c">missing</a>',
    ),
    ['#b Multiple anchors found!', `#c ${missingAnchor}`],
  );
});

test('anchors on other pages', async () => {
  assert.deepEqual(
    await errorsOf(
      'Foo.html',
      '<a href="/Foo/Bar#setup">ok</a><a href="Bar#dup">dup</a><a href="/Foo/Bar#nope">missing</a>',
    ),
    ['Bar#dup Multiple anchors found!', `/Foo/Bar#nope ${missingAnchor}`],
  );
});

const missingAnchor =
  'No anchor id found! (Eventually selector contains invalid characters?)';
