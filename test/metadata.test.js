const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePageHeader,
  getPageTitle,
  PAGE_HEADER_FIELDS,
} = require('../src/tools/lib/header');
const { checkPageMetadata } = require('../src/tools/validate/metadata');
const { htmlPage } = require('./helpers');

test('parsePageHeader reads all fields', () => {
  const meta = parsePageHeader(htmlPage('BO3 | Adding Zones', '<p>x</p>'));
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
