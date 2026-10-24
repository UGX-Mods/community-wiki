import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProduct,
  getTopic,
  suggestTags,
  setTags,
} from '../src/tools/content/tag-pages.js';
import { htmlPage } from './helpers.js';

test('getProduct and getTopic follow the folder structure', () => {
  assert.equal(
    getProduct('Modding/World-at-War-Modtools/Radiant/Creating-a-Map.html'),
    'waw',
  );
  assert.equal(getProduct('Modding/Black-Ops-3-Modtools.html'), 'bo3');
  assert.equal(getProduct('UGXLIN/Features/Settings.html'), 'ugxlin');
  assert.equal(getProduct('UGXL/Features/Settings.html'), 'ugxl');
  assert.equal(
    getProduct('Applications-and-Services/UGX-Mods-Forum/BBCode.html'),
    'forum',
  );
  assert.equal(
    getProduct('Applications-and-Services/Modder-Mapper/UGX-MapPacker.html'),
    'ugxmp',
  );
  assert.equal(
    getProduct('Applications-and-Services/UGX-Mods-Web-Chat.html'),
    'services',
  );
  assert.equal(getProduct('home.html'), undefined);

  assert.equal(
    getTopic(
      'Modding/World-at-War-Modtools/Radiant/Creating-a-Map.html',
      'waw',
    ),
    'mapping',
  );
  assert.equal(
    getTopic(
      'Modding/Black-Ops-3-Modtools/Asset-Conversion/Adding-custom-sounds.html',
      'bo3',
    ),
    'sound',
  );
  assert.equal(
    getTopic('Modding/Black-Ops-3-Modtools/Script.html', 'bo3'),
    'scripting',
  );
  assert.equal(getTopic('UGXL/Features/Sound.html', 'ugxl'), undefined);
});

test('suggestTags picks the content type', () => {
  /**
   * @param {string} page
   * @param {string} [title]
   * @param {boolean} [hasChildren]
   * @param {{type?: string}} [override]
   */
  const tags = (page, title = '', hasChildren = false, override = undefined) =>
    suggestTags({ page, title, hasChildren }, override);
  assert.deepEqual(tags('UGXL/Changelog/UGXL-v0-8-0-rc14.html'), [
    'ugxl',
    'changelog',
  ]);
  assert.deepEqual(tags('UGXL/FAQ.html'), ['ugxl', 'troubleshooting']);
  assert.deepEqual(tags('UGXL/Features.html', '', true), ['ugxl', 'overview']);
  assert.deepEqual(tags('UGXL/Features/Search.html'), ['ugxl', 'reference']);
  assert.deepEqual(
    tags('Modding/World-at-War-Modtools/Script/Trader.html', 'Trader'),
    ['waw', 'guide', 'scripting'],
  );
  assert.deepEqual(
    tags('UGXL/UGX-Launcher-Legacy/Information-LEGACY/T4M-Legacy.html'),
    ['ugxl', 'reference', 'legacy'],
  );
  assert.deepEqual(tags('README.md'), ['meta']);
  assert.deepEqual(
    tags('UGXL/Need-Help.html', '', false, { type: 'troubleshooting' }),
    ['ugxl', 'troubleshooting'],
  );
});

test('setTags keeps confluence ids first and existing tags', () => {
  const page = htmlPage('Foo', '<p>x</p>', {
    tags: 'confluence:123, mod tools',
  });
  const result = setTags(page, ['waw', 'guide'], false);
  assert.match(result ?? '', /^tags: confluence:123, waw, guide, mod tools$/m);
  // body untouched
  assert.ok(result?.endsWith('<p>x</p>\n'));
});

test('setTags adds a missing tags line and handles front matter', () => {
  const html = '<!--\ntitle: Foo\neditor: ckeditor\n-->\n<p>tags: no</p>';
  assert.equal(
    setTags(html, ['ugxl'], false),
    '<!--\ntitle: Foo\ntags: ugxl\neditor: ckeditor\n-->\n<p>tags: no</p>',
  );
  const md = '---\ntitle: README\ntags:\neditor: markdown\n---\n\n# Readme';
  assert.equal(
    setTags(md, ['meta'], true),
    '---\ntitle: README\ntags: meta\neditor: markdown\n---\n\n# Readme',
  );
  assert.equal(setTags('<p>no header</p>', ['ugxl'], false), null);
});
