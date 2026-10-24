import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  hasMeaninglessName,
  planImageNames,
} from '../src/tools/content/rename-images.js';

test('slugify', () => {
  assert.equal(slugify('Using the Script Placer'), 'using-the-script-placer');
  assert.equal(slugify('Tips &amp; Tricks (v1.4)!'), 'tips-tricks-v1-4');
  assert.ok(slugify('word '.repeat(30)).length <= 50);
  assert.doesNotMatch(slugify('word '.repeat(30)), /-$/);
});

test('hasMeaninglessName', () => {
  for (const src of [
    '/attachments/waw/VXphWnh.png',
    '/attachments/waw/a1b0b2724d3d11859347e759303ca260.png',
    '/attachments/forum/b8/93290536.png',
  ]) {
    assert.ok(hasMeaninglessName(src), src);
  }
  for (const src of [
    '/attachments/waw/zones.png',
    '/attachments/waw/dog_spawner.png',
    '/attachments/icons/jira/12345.svg',
    'https://example.com/VXphWnh.png',
  ]) {
    assert.ok(!hasMeaninglessName(src), src);
  }
});

test('planImageNames uses alt text, then the heading above, then the page name', () => {
  const html = [
    '<p><img src="/attachments/p/AAAAA1.png" alt="" /></p>',
    '<h2>Using the Script Placer</h2>',
    '<img src="/attachments/p/BBBBB2.png" alt />',
    '<img src="/attachments/p/CCCCC3.PNG" alt="Figure 2" />',
    '<h3>Zones</h3>',
    '<img src="/attachments/p/DDDDD4.gif" alt="Zone volume in Radiant" />',
    '<img src="/attachments/p/EEEEE5.png" />',
    '<img src="/attachments/p/BBBBB2.png" />',
  ].join('\n');

  const plan = planImageNames(
    [{ filePath: 'Modding/Creating-a-Map.html', html }],
    (file) => file === '/attachments/p/zones.png',
  );

  assert.deepEqual(Object.fromEntries(plan), {
    '/attachments/p/AAAAA1.png': '/attachments/p/creating-a-map.png',
    '/attachments/p/BBBBB2.png': '/attachments/p/using-the-script-placer-1.png',
    '/attachments/p/CCCCC3.PNG': '/attachments/p/using-the-script-placer-2.png',
    '/attachments/p/DDDDD4.gif': '/attachments/p/zone-volume-in-radiant.gif',
    // zones.png already exists
    '/attachments/p/EEEEE5.png': '/attachments/p/zones-2.png',
  });
});

test('planImageNames names a shared image after the first page', () => {
  const page = (/** @type {string} */ name) => ({
    filePath: `${name}.html`,
    html: `<h2>${name}</h2><img src="/attachments/shared/XyZ123.png" />`,
  });
  const plan = planImageNames([page('First'), page('Second')], () => false);
  assert.deepEqual(Object.fromEntries(plan), {
    '/attachments/shared/XyZ123.png': '/attachments/shared/first.png',
  });
});
