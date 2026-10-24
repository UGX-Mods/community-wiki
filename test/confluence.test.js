import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { titleToFileName } from '../src/tools/confluence/filenames.js';
import {
  createHtmlBanner,
  createPrivacyYoutubeEmbed,
} from '../src/tools/confluence/cleanup.js';
import { addConfluenceCommentAsTag } from '../src/tools/confluence/ids.js';
import { htmlPage, createFixture, removeFixture } from './helpers.js';

test('addConfluenceCommentAsTag moves the conf id comment into the tags', async (t) => {
  const root = createFixture({
    'Page.html': htmlPage('Page', '<!-- conf id: 12345 -->\n<p>x</p>', {
      tags: 'bo3',
    }),
  });
  t.after(() => removeFixture(root));
  const file = path.join(root, 'Page.html');

  await addConfluenceCommentAsTag([file]);

  const result = fs.readFileSync(file, 'utf8');
  assert.match(result, /^tags: confluence:12345 bo3$/m);
  assert.doesNotMatch(result, /conf id/);
});

test('titleToFileName follows the wiki.js naming restrictions', () => {
  assert.equal(titleToFileName('WaW | Radiant (Tips)'), 'Radiant-Tips');
  assert.equal(titleToFileName('BO3 | Adding Zones'), 'Adding-Zones');
  assert.equal(titleToFileName('UGXSMF v0.8.85 beta'), 'UGXSMF-v0_8_85-beta');
  assert.equal(titleToFileName('Tips &amp; Tricks?'), 'Tips-and-Tricks');
});

test('createHtmlBanner maps confluence macro types to banner icons', () => {
  const icon = (/** @type {string} */ type) =>
    /icons\/([\w-]+)\.png/.exec(createHtmlBanner('', 'x', type))?.[1];
  assert.equal(icon('tip'), 'check-decagram');
  assert.equal(icon('warning'), 'alert-octagon');
  assert.equal(icon('note'), 'alert');
  assert.equal(icon('information'), 'information-outline');
  assert.match(createHtmlBanner('', 'x', 'information'), /banner-info"/);
});

test('createHtmlBanner renders the optional title', () => {
  assert.match(
    createHtmlBanner('Heads up', '<p>x</p>', 'note'),
    /<p class="banner-title">Heads up<\/p>/,
  );
  assert.doesNotMatch(createHtmlBanner('', '<p>x</p>', 'note'), /banner-title/);
});

test('createPrivacyYoutubeEmbed uses youtube-nocookie', () => {
  for (const url of [
    'https://www.youtube.com/embed/abc',
    '//www.youtube.com/embed/abc',
    'http://youtube.com/embed/abc',
  ]) {
    assert.match(
      createPrivacyYoutubeEmbed(url),
      /src="https:\/\/www\.youtube-nocookie\.com\/embed\/abc"/,
    );
  }
  assert.equal(createPrivacyYoutubeEmbed(''), '');
  // other hosts are not rewritten
  assert.match(
    createPrivacyYoutubeEmbed('https://wwwXyoutube.com/embed/abc'),
    /src="https:\/\/wwwXyoutube\.com\/embed\/abc"/,
  );
  assert.match(
    createPrivacyYoutubeEmbed('https://notyoutube.com.evil.example/embed/abc'),
    /src="https:\/\/notyoutube\.com\.evil\.example\/embed\/abc"/,
  );
});
