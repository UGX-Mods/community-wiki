import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePageHeader,
  getPageTitle,
  PAGE_HEADER_FIELDS,
  checkDescription,
} from '../src/tools/lib/header.js';
import { checkPageMetadata } from '../src/tools/validate/metadata.js';
import { htmlPage } from './helpers.js';

test('parsePageHeader reads all fields', () => {
  const meta = parsePageHeader(htmlPage('BO3 | Adding Zones', '<p>x</p>'));
  assert.ok(meta);
  assert.deepEqual(Object.keys(meta), PAGE_HEADER_FIELDS);
  assert.equal(meta.title, 'BO3 | Adding Zones');
  assert.equal(meta.published, 'true');
});

test('parsePageHeader handles CRLF and empty values', () => {
  const meta = parsePageHeader(
    '<!--\r\ntitle: Foo\r\ndescription:\r\ntags: a, b\r\n-->\r\n<p></p>',
  );
  assert.deepEqual(meta, { title: 'Foo', description: '', tags: 'a, b' });
});

test('parsePageHeader requires the header to be the first bytes', () => {
  assert.equal(parsePageHeader('\n<!--\ntitle: Foo\n-->'), null);
  assert.equal(parsePageHeader('<p>no header</p>'), null);
});

test('getPageTitle', () => {
  assert.equal(getPageTitle(htmlPage('WaW | Radiant')), 'WaW | Radiant');
  assert.equal(getPageTitle('<p></p>'), undefined);
});

test('checkPageMetadata accepts a complete page', () => {
  assert.deepEqual(checkPageMetadata('Foo/Bar.html', htmlPage('Bar')), {
    errors: [],
    warnings: [],
  });
});

test('checkPageMetadata errors', () => {
  assert.deepEqual(checkPageMetadata('Foo.html', '<p></p>').errors, [
    'Missing wiki.js page header comment at top of file',
  ]);
  assert.deepEqual(
    checkPageMetadata('Foo.html', htmlPage('', '', { published: 'yes' }))
      .errors,
    ['Missing or empty "title"', 'Invalid "published" value: yes'],
  );
});

test('checkPageMetadata warnings', () => {
  const { errors, warnings } = checkPageMetadata(
    'UGXL/UGX-WeaponsEditor++.html',
    '<!--\ntitle: Foo\ndescription:\n-->',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, [
    'Missing fields: published,date,tags,editor,dateCreated',
    'Empty "description"',
    'Path segment(s) violate wiki.js naming restrictions: UGX-WeaponsEditor++',
  ]);
});

test('checkPageMetadata warns about tags outside the tag set', () => {
  assert.deepEqual(
    checkPageMetadata(
      'Foo.html',
      htmlPage('Foo', '', { tags: 'confluence:12, ugxl, guide, mod tools' }),
    ).warnings,
    ['Tags outside the tag set: mod tools'],
  );
});

test('checkPageMetadata requires the AI banner and tag together', () => {
  const banner = '<div class="banner banner-note banner-ai"><p>AI</p></div>';
  const errorsOf = (/** @type {string} */ body, /** @type {string} */ tags) =>
    checkPageMetadata('Foo.html', htmlPage('Foo', body, { tags })).errors;
  assert.deepEqual(errorsOf(banner, 'waw, guide, ai-generated'), []);
  assert.deepEqual(errorsOf('<p>x</p>', 'waw, guide'), []);
  assert.deepEqual(errorsOf('<p>x</p>', 'waw, guide, ai-generated'), [
    'Tag "ai-generated" without the AI banner (class banner-ai)',
  ]);
  assert.deepEqual(errorsOf(banner, 'waw, guide'), [
    'AI banner (class banner-ai) without the tag "ai-generated"',
  ]);
});

test('checkPageMetadata ignores AI banner examples in markdown code', () => {
  const page = [
    '---',
    'title: Docs',
    'description: x',
    'published: true',
    'date: x',
    'tags: meta',
    'editor: markdown',
    'dateCreated: x',
    '---',
    '',
    '```html',
    '<div class="banner banner-ai"></div>',
    '```',
    '',
  ].join('\n');
  assert.deepEqual(checkPageMetadata('Docs.md', page).errors, []);
});

test('checkDescription only accepts plain one-line YAML values', () => {
  assert.equal(checkDescription('How to add zones to a Black Ops 3 map'), null);
  assert.equal(checkDescription(''), 'empty');
  assert.equal(checkDescription('a\nb'), 'line break');
  assert.match(checkDescription('Note: something') ?? '', /YAML/);
  assert.match(checkDescription('Item #1') ?? '', /YAML/);
  assert.match(checkDescription('"quoted"') ?? '', /special character/);
  assert.match(checkDescription('x'.repeat(201)) ?? '', /longer/);
});

test('checkPageMetadata warns about descriptions that break the YAML header', () => {
  assert.deepEqual(
    checkPageMetadata(
      'Foo.html',
      htmlPage('Foo', '', { description: 'Note: x' }),
    ).warnings,
    ['"description" contains ": " or " #" (YAML)'],
  );
});
