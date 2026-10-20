import test from 'node:test';
import assert from 'node:assert/strict';
import { titleToFileName } from '../src/tools/confluence/filenames.js';
import {
  createHtmlBanner,
  createPrivacyYoutubeEmbed,
} from '../src/tools/confluence/cleanup.js';

test('titleToFileName follows the wiki.js naming restrictions', () => {
  assert.equal(titleToFileName('WaW | Radiant (Tips)'), 'Radiant-Tips');
  assert.equal(titleToFileName('BO3 | Adding Zones'), 'Adding-Zones');
  assert.equal(titleToFileName('UGXSMF v0.8.85 beta'), 'UGXSMF-v0_8_85-beta');
  assert.equal(titleToFileName('Tips &amp; Tricks?'), 'Tips-and-Tricks');
});

test('createHtmlBanner maps confluence macro types to banner icons', () => {
  const icon = (type) =>
    /icons\/([\w-]+)\.png/.exec(createHtmlBanner('', 'x', type))[1];
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
});
