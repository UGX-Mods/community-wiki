import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  cleanStyle,
  cleanupPageMarkup,
} from '../src/tools/content/confluence-markup.js';
import { htmlPage } from './helpers.js';

// only used to resolve the prettier config of the repository
const PAGE = path.resolve('Page.html');

test('cleanStyle keeps only visible declarations', () => {
  assert.equal(cleanStyle('text-decoration: none', 'a'), '');
  assert.equal(
    cleanStyle('font-size: 14px; line-height: 1.42857; color: red', 'span'),
    'color: red',
  );
  assert.equal(cleanStyle('text-align: center', 'td'), 'text-align: center');
  assert.equal(cleanStyle('color: red', 'br'), '');
  assert.equal(cleanStyle('width: 113px', 'col'), '');
});

test('cleanupPageMarkup removes wrappers, classes and macro attributes', async () => {
  const page = htmlPage(
    'Foo',
    `<div class="plugin-tabmeta-details">
  <div class="table-wrap">
    <table class="wrapped confluenceTable">
      <colgroup>
        <col style="width: 113px" />
      </colgroup>
      <tbody>
        <tr></tr>
        <tr>
          <td class="title" data-content-id="1">
            <span class="static-jira-issues_count">
              <a class="issue-link" href="/Foo">2 issues</a>
            </span>
          </td>
          <td>
            <span class="status-macro aui-lozenge aui-lozenge-success">
              RELEASED
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
<p></p>
<p>&nbsp;</p>
<p><span style="color: rgb(255, 0, 0); line-height: 20px">red</span></p>
<pre><span>&nbsp;</span></pre>
<`,
  );
  const result = await cleanupPageMarkup(page, PAGE);
  assert.equal(
    result,
    htmlPage(
      'Foo',
      `
<table>
  <tbody>
    <tr>
      <td>
        <a href="/Foo">2 issues</a>
      </td>
      <td>
        <span class="aui-lozenge aui-lozenge-success">RELEASED</span>
      </td>
    </tr>
  </tbody>
</table>

<p>&nbsp;</p>
<p><span style="color: rgb(255, 0, 0)">red</span></p>`,
    ),
  );
});

test('cleanupPageMarkup leaves clean and unformatted pages alone', async () => {
  const clean = htmlPage('Foo', '<p>Text</p>');
  assert.equal(await cleanupPageMarkup(clean, PAGE), null);
  const unformatted = htmlPage('Foo', '<p   class="wrapped">Text</p>');
  assert.equal(await cleanupPageMarkup(unformatted, PAGE), null);
});
