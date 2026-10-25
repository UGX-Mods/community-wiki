import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changelogPagePath,
  renderChangelogPage,
  refreshChangelogPage,
  addOverviewRow,
  isDue,
  planReleases,
} from '../src/tools/jira/changelog.js';
import { checkPageMetadata } from '../src/tools/validate/metadata.js';
import { checkDescription } from '../src/tools/content/descriptions.js';
import { createFixture, removeFixture, htmlPage } from './helpers.js';

const JIRA = 'https://example.atlassian.net';
const NOW = new Date('2026-11-04T12:00:00.000Z');

/** @type {import('../src/tools/jira/changelog.js').FetchedRelease} */
const fetched = {
  project: 'UGXSMF',
  release: {
    name: 'v0.8.86-beta',
    released: true,
    releaseDate: '2026-11-03',
    description: 'Bug fixes & <improvements>',
  },
  issues: [
    {
      key: 'UGXSMF-400',
      summary: 'Fix <script>alert("x")</script> in posts',
      type: 'Bug',
      priority: 'Major',
      status: 'Done',
      statusCategory: 'done',
      resolution: 'Done',
      created: '2026-10-01T10:00:00.000+0000',
      updated: '2026-11-02T10:00:00.000+0000',
      assignee: 'Alexander Diller',
      reporter: 'Community Reporter',
    },
    {
      key: 'UGXSMF-401',
      summary: 'Unknown type',
      type: 'Epic',
      priority: '',
      status: 'In Progress',
      statusCategory: 'indeterminate',
      resolution: '',
      created: '',
      updated: '',
      assignee: '',
      reporter: '',
    },
  ],
  hidden: 0,
};

test('changelogPagePath follows the wiki.js naming restrictions', () => {
  assert.equal(
    changelogPagePath('UGXSMF', 'v0.8.86-beta'),
    'Applications-and-Services/UGX-Mods-Forum/Changelog/UGXSMF-v0-8-86-beta.html',
  );
  assert.equal(
    changelogPagePath('UGXLIN', 'v0.8.1-rc.1'),
    'UGXLIN/Changelog/UGXLIN_v0-8-1-rc-1.html',
  );
});

test('renderChangelogPage escapes jira content and maps icons and states', () => {
  const html = renderChangelogPage(fetched, JIRA, NOW);
  assert.ok(!html.includes('<script>'));
  assert.ok(
    html.includes('Fix &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'),
  );
  assert.ok(html.includes('<p>Bug fixes &amp; &lt;improvements&gt;</p>'));
  assert.ok(
    html.includes('src="/attachments/icons/jira/type-bug.svg" alt="Bug"'),
  );
  assert.ok(html.includes('src="/attachments/icons/jira/priority-major.svg"'));
  assert.ok(html.includes('>Epic</a>'));
  assert.ok(html.includes('aui-lozenge-success">Done</span>'));
  assert.ok(html.includes('aui-lozenge-current">In Progress</span>'));
  assert.ok(html.includes('<td>Unassigned</td>'));
  assert.ok(html.includes('<td>Unresolved</td>'));
  assert.ok(html.includes('<td>3 November 2026</td>'));
  assert.ok(html.includes('<td>Oct 01, 2026</td>'));
  assert.ok(html.includes('>2 issues</a>'));
  assert.ok(html.includes('data-project="UGXSMF"'));
  assert.ok(html.includes('data-released="2026-11-03"'));
  assert.ok(html.includes('data-refreshed="2026-11-04"'));
});

test('renderChangelogPage creates a valid page header', () => {
  const html = renderChangelogPage(fetched, JIRA, NOW);
  const result = checkPageMetadata(
    'Applications-and-Services/UGX-Mods-Forum/Changelog/UGXSMF-v0-8-86-beta.html',
    html,
  );
  assert.deepEqual(result, { errors: [], warnings: [] });
  const description = /^description: (.*)$/m.exec(html)?.[1] ?? '';
  assert.equal(
    description,
    'Release notes of UGXSMF v0.8.86-beta (November 2026)',
  );
  assert.equal(checkDescription(description), null);
});

test('refreshChangelogPage replaces the tables and keeps the summary', () => {
  const unreleased = {
    ...fetched,
    release: { ...fetched.release, released: false, releaseDate: '' },
    issues: [fetched.issues[0]],
  };
  const page = renderChangelogPage(unreleased, JIRA, NOW).replace(
    '<p>Bug fixes &amp; &lt;improvements&gt;</p>',
    '<p>Written by hand</p>',
  );
  assert.ok(page.includes('UNRELEASED'));
  const later = new Date('2026-11-20T00:00:00.000Z');
  const refreshed = refreshChangelogPage(page, fetched, JIRA, later) ?? '';
  assert.ok(refreshed.includes('<p>Written by hand</p>'));
  assert.ok(refreshed.includes('>RELEASED<'));
  assert.ok(!refreshed.includes('UNRELEASED'));
  assert.ok(refreshed.includes('>2 issues</a>'));
  assert.ok(refreshed.includes('data-refreshed="2026-11-20"'));
  assert.equal(
    refreshChangelogPage('<p>no widget</p>', fetched, JIRA, NOW),
    null,
  );
});

test('isDue refreshes until 30 days after the release', () => {
  assert.equal(isDue({ released: '', refreshed: '' }, NOW), true);
  assert.equal(isDue({ released: '2026-10-10', refreshed: '' }, NOW), true);
  assert.equal(isDue({ released: '2026-09-01', refreshed: '' }, NOW), false);
  assert.equal(isDue({ released: 'garbage', refreshed: '' }, NOW), false);
});

test('addOverviewRow adds the release as first row once', () => {
  const overview =
    '<table><thead><tr><th>Title</th></tr></thead><tbody>\n<tr><td><a href="UGXSMF-v0-8-85-beta">old</a></td></tr></tbody></table>';
  const updated = addOverviewRow(overview, fetched, JIRA);
  assert.ok(updated);
  assert.ok(
    updated.indexOf('UGXSMF-v0-8-86-beta') <
      updated.indexOf('UGXSMF-v0-8-85-beta'),
  );
  assert.ok(updated.includes('<td>3 Nov 2026</td>'));
  assert.equal(addOverviewRow(updated, fetched, JIRA), null);
  assert.equal(
    addOverviewRow('<ul class="widget-page-hierarchy"></ul>', fetched, JIRA),
    null,
  );
});

test('planReleases finds due widgets and rejects foreign projects', async () => {
  const widget = (/** @type {string} */ attrs) =>
    htmlPage(
      'Page',
      `<div class="widget-jira-issues" ${attrs}><table></table></div>`,
    );
  const dir = 'Applications-and-Services/UGX-Mods-Forum/Changelog';
  const root = createFixture({
    [`${dir}/UGXSMF-v1-0.html`]: widget(
      'data-project="UGXSMF" data-version="v1.0" data-released="" data-refreshed="2026-11-01"',
    ),
    [`${dir}/UGXSMF-v0-9.html`]: widget(
      'data-project="UGXSMF" data-version="v0.9" data-released="2026-01-01" data-refreshed="2026-01-05"',
    ),
    [`${dir}/Foreign.html`]: widget(
      'data-project="UGXL" data-version="v1.0" data-released=""',
    ),
    [`${dir}/Injection.html`]: widget(
      'data-project="UGXSMF" data-version="v1&quot; OR x" data-released=""',
    ),
  });
  try {
    const plan = await planReleases({
      root,
      project: 'UGXSMF',
      version: 'v1.1',
      allowlist: new Set(['UGXSMF', 'UGXL']),
      now: NOW,
    });
    assert.deepEqual(
      plan.requests.map((r) => `${r.mode} ${r.project} ${r.version}`),
      ['create UGXSMF v1.1', 'refresh UGXSMF v1.0'],
    );
    assert.equal(plan.errors.length, 0);
    assert.equal(plan.warnings.length, 2);

    const denied = await planReleases({
      root,
      project: 'UGXSMF',
      version: 'v1.0',
      allowlist: new Set(['UGXL']),
      now: NOW,
    });
    assert.deepEqual(denied.errors, [
      'JIRA_PROJECT UGXSMF is not an allowed project',
    ]);
    assert.equal(denied.requests.length, 0);
  } finally {
    removeFixture(root);
  }
});
