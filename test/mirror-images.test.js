import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  getAttachmentFolder,
  findHotlinkedImages,
} from '../src/tools/content/mirror-images.js';

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
