import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { absoluteLinks } from '../src/tools/content/absolute-links.js';
import { htmlPage, createFixture, removeFixture } from './helpers.js';

/** @type {string} */
let root;
test.before(() => {
  root = createFixture({
    'Foo.html': htmlPage('Foo'),
    'Foo/Bar.html': htmlPage('Bar'),
    'Foo/Baz.html': htmlPage('Baz'),
    'Foo/Bar/Deep.html': htmlPage('Deep'),
  });
});
test.after(() => removeFixture(root));

/**
 * @param {string} filePath page path with forward slashes
 * @param {string} body
 */
const convert = (filePath, body) =>
  absoluteLinks(body, filePath.split('/').join(path.sep), root);

test('absoluteLinks resolves child and sibling pages like wiki.js 2', () => {
  assert.deepEqual(
    convert(
      'Foo.html',
      '<a href="Bar">child</a> <a class="x" href="Bar/Deep" target="_self">deep</a>',
    ),
    {
      content:
        '<a href="/Foo/Bar">child</a> <a class="x" href="/Foo/Bar/Deep" target="_self">deep</a>',
      changed: 2,
      unresolved: [],
    },
  );
  assert.equal(
    convert('Foo/Bar.html', '<a href="Baz.html#setup">sibling</a>').content,
    '<a href="/Foo/Baz#setup">sibling</a>',
  );
});

test('absoluteLinks keeps absolute, external and anchor links and other tags', () => {
  const body =
    '<a href="/Foo/Bar">a</a><a href="#top">b</a><a href="https://example.com/Bar">c</a>' +
    '<a href="mailto:a@b.c">d</a><img src="Bar" alt="" /><code>href="Bar"</code>';
  assert.deepEqual(convert('Foo.html', body), {
    content: body,
    changed: 0,
    unresolved: [],
  });
});

test('absoluteLinks reports links without a target and keeps them', () => {
  assert.deepEqual(convert('Foo.html', '<a href="Nope">x</a>'), {
    content: '<a href="Nope">x</a>',
    changed: 0,
    unresolved: ['Nope'],
  });
});
