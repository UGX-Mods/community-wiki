const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MARKER_START,
  MARKER_END,
  replaceScriptBlock,
  createThemeConfig,
} = require('../src/tools/theme');

const block = (js) => `${MARKER_START}\n<script>${js}</script>\n${MARKER_END}`;
const ads = '<script>/* ads */</script>';

test('replaceScriptBlock only replaces the marked block', () => {
  assert.equal(
    replaceScriptBlock(`${block('old()')}\n${ads}`, 'new();\n'),
    `${block('new();')}\n${ads}`,
  );
  assert.equal(replaceScriptBlock(ads, 'new()'), null);
});

test('replaceScriptBlock escapes closing script tags', () => {
  assert.equal(
    replaceScriptBlock(block(''), 'x("</script>")'),
    block(String.raw`x("<\/script>")`),
  );
});

test('createThemeConfig keeps the other settings', () => {
  const config = {
    theme: 'default',
    iconset: 'mdi',
    darkMode: true,
    tocPosition: 'right',
    injectCSS: '.old{}',
    injectHead: '<meta name="x">',
    injectBody: `${ads}${block('old()')}`,
  };
  assert.deepEqual(
    createThemeConfig(config, { css: '.new{}\n', js: 'new()' }),
    {
      ...config,
      injectCSS: '.new{}',
      injectBody: `${ads}${block('new()')}`,
    },
  );
});

test('createThemeConfig requires the markers', () => {
  assert.throws(
    () =>
      createThemeConfig(
        { injectHead: '', injectBody: ads },
        { css: '', js: 'x()' },
      ),
    /Markers not found/,
  );
});
