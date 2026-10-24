import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkDescription,
  setDescription,
} from '../src/tools/content/descriptions.js';

test('checkDescription only accepts plain one-line YAML values', () => {
  assert.equal(checkDescription('How to add zones to a Black Ops 3 map'), null);
  assert.equal(checkDescription(''), 'empty');
  assert.equal(checkDescription('a\nb'), 'line break');
  assert.match(checkDescription('Note: something') ?? '', /YAML/);
  assert.match(checkDescription('Item #1') ?? '', /YAML/);
  assert.match(checkDescription('"quoted"') ?? '', /special character/);
  assert.match(checkDescription('x'.repeat(201)) ?? '', /longer/);
});

test('setDescription fills an empty description only', () => {
  const html =
    '<!--\ntitle: Foo\ndescription:\npublished: true\n-->\n<p>description: no</p>';
  assert.equal(
    setDescription(html, 'About foo', false),
    '<!--\ntitle: Foo\ndescription: About foo\npublished: true\n-->\n<p>description: no</p>',
  );
  const filled = '<!--\ntitle: Foo\ndescription: Old\n-->\n<p></p>';
  assert.equal(setDescription(filled, 'New', false), null);
});

test('setDescription adds a missing line and handles front matter', () => {
  assert.equal(
    setDescription(
      '<!--\ntitle: Foo\neditor: ckeditor\n-->\n',
      'About foo',
      false,
    ),
    '<!--\ntitle: Foo\ndescription: About foo\neditor: ckeditor\n-->\n',
  );
  assert.equal(
    setDescription(
      '---\ntitle: README\ndescription: \n---\n\n# x',
      'About',
      true,
    ),
    '---\ntitle: README\ndescription: About\n---\n\n# x',
  );
});
