import test from 'node:test';
import assert from 'node:assert/strict';
import { demoteHeadings } from '../src/tools/content/headings.js';

test('demoteHeadings shifts all levels of pages with <h1>', () => {
  const { content, changed } = demoteHeadings(
    '<h1 id="a">A</h1><h2>B</h2><h3\n  id="c">C</h3><h5>E</h5><p>h1 text</p>',
  );
  assert.equal(changed, true);
  assert.equal(
    content,
    '<h2 id="a">A</h2><h3>B</h3><h4\n  id="c">C</h4><h6>E</h6><p>h1 text</p>',
  );
});

test('demoteHeadings leaves pages without <h1> alone', () => {
  const page = '<h2>A</h2><h3>B</h3>';
  assert.deepEqual(demoteHeadings(page), { content: page, changed: false });
});

test('demoteHeadings refuses pages with <h1> and <h6>', () => {
  assert.equal(
    demoteHeadings('<h1>A</h1><h6>F</h6>').error,
    'uses <h1> and <h6>',
  );
});
