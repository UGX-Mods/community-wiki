const test = require('node:test');
const assert = require('node:assert/strict');
const { checkPageSecurity } = require('../tools/validate/security');

const iframe = (src) =>
  src === null ? '<iframe></iframe>' : `<iframe src="${src}"></iframe>`;

test('allows youtube-nocookie embeds', () => {
  assert.deepEqual(
    checkPageSecurity(iframe('https://www.youtube-nocookie.com/embed/abc')),
    [],
  );
});

test('rejects iframes without src, without https or from other hosts', () => {
  const issues = checkPageSecurity(
    [
      iframe(null),
      iframe('http://www.youtube-nocookie.com/embed/abc'),
      iframe('https://www.youtube.com/embed/abc'),
      iframe('https://evil.example/embed'),
    ].join('\n'),
  );
  assert.deepEqual(
    issues.map((i) => i.issue),
    [
      'Invalid src attribute!',
      'Insecure URL',
      'Secure hostname check failed!',
      'Secure hostname check failed!',
    ],
  );
});

test('ignores pages without iframes', () => {
  assert.deepEqual(checkPageSecurity('<p><a href="x">x</a></p>'), []);
});
