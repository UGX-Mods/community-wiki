import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  getAttachmentFolder,
  findHotlinkedImages,
  replaceImageUrl,
} from '../src/tools/content/mirror-images.js';

test('findHotlinkedImages ignores image urls that are only linked or mentioned', () => {
  assert.deepEqual(
    findHotlinkedImages(
      [
        '<a href="https://i.imgur.com/linked1.png">https://i.imgur.com/linked1.png</a>',
        '<p>like https://i.imgur.com/mention.png</p>',
        '![md](https://i.imgur.com/markdown.png)',
      ].join('\n'),
    ),
    ['https://i.imgur.com/markdown.png'],
  );
});

test('replaceImageUrl changes src / href / markdown links, not visible text', () => {
  const url = 'https://i.imgur.com/CVQUGIb.png';
  const local = '/attachments/x/example.png';
  assert.equal(
    replaceImageUrl(
      [
        `<img src="${url}" alt="" />`,
        `<a href="${url}">${url}</a>`,
        `![example](${url})`,
        `<p>The direct url looks like ${url}</p>`,
      ].join('\n'),
      url,
      local,
    ),
    [
      `<img src="${local}" alt="" />`,
      `<a href="${local}">${url}</a>`,
      `![example](${local})`,
      `<p>The direct url looks like ${url}</p>`,
    ].join('\n'),
  );
});

test('getAttachmentFolder follows the attachments naming', () => {
  assert.equal(
    getAttachmentFolder(
      path.join(
        'Modding',
        'World-at-War-Modtools',
        'Radiant',
        'Creating-a-Map.html',
      ),
    ),
    'attachments/modding/waw/radiant/creating-a-map',
  );
  assert.equal(
    getAttachmentFolder('Modding/Black-Ops-3-Modtools/Mapping.html'),
    'attachments/modding/bo3/mapping',
  );
  assert.equal(
    getAttachmentFolder('UGX-Applications/UGX-WeaponsEditor++.html'),
    'attachments/ugx-applications/ugx-weaponseditor',
  );
});

test('findHotlinkedImages finds unique imgur / gyazo image urls', () => {
  assert.deepEqual(
    findHotlinkedImages(
      [
        '<img src="https://i.imgur.com/VXphWnh.png" alt />',
        '<img src="https://i.imgur.com/VXphWnh.png" alt />',
        '<img\n  src="https://i.gyazo.com/0a1b2c3d4e.jpg" />',
        '<img src="https://example.com/x.png" />',
        '<a href="https://imgur.com/gallery/abc">album</a>',
      ].join('\n'),
    ),
    ['https://i.imgur.com/VXphWnh.png', 'https://i.gyazo.com/0a1b2c3d4e.jpg'],
  );
});
