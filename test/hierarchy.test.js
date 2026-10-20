import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createPageHierarchy } from '../src/tools/hierarchy.js';
import { htmlPage, createFixture, removeFixture } from './helpers.js';

test('createPageHierarchy lists child pages recursively', async (t) => {
  const root = createFixture({
    'Guide.html': htmlPage('Guide'),
    'Guide/Install.html': htmlPage('Install the tools'),
    'Guide/Install/Windows.html': htmlPage('Windows'),
    'Guide/Usage.html': htmlPage('Usage'),
    'Guide/image.png': 'png',
  });
  t.after(() => removeFixture(root));

  assert.equal(
    await createPageHierarchy(path.join(root, 'Guide.html')),
    '<ul class="widget-page-hierarchy"><li>' +
      '<a href="Install">Install the tools</a><ul><li><a href="Install/Windows">Windows</a></li></ul>' +
      '</li><li><a href="Usage">Usage</a>' +
      '</li></ul>',
  );
});

test('createPageHierarchy returns null without child pages', async (t) => {
  const root = createFixture({ 'Lonely.html': htmlPage('Lonely') });
  t.after(() => removeFixture(root));

  assert.equal(await createPageHierarchy(path.join(root, 'Lonely.html')), null);
});
