import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECTS,
  changelogPagePath,
  addOverviewRow,
  isDue,
  planReleases,
} from '../src/tools/jira/changelog.js';
import {
  renderChangelogPage,
  refreshChangelogPage,
  adoptChangelogPage,
  readChangelog,
  parseReleaseDate,
} from '../src/tools/jira/page.js';
import { checkPageMetadata } from '../src/tools/validate/metadata.js';
import { checkDescription } from '../src/tools/content/descriptions.js';
import { createFixture, removeFixture, htmlPage } from './helpers.js';

const JIRA = 'https://example.atlassian.net';
const NOW = new Date('2026-11-04T12:00:00.000Z');

/** @type {import('../src/tools/jira/page.js').FetchedRelease} */
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

const newPage = () =>
  renderChangelogPage({
    fetched,
    jiraUrl: JIRA,
    now: NOW,
    page: PROJECTS.UGXSMF,
  });

/** an old page like UGXSMF v0.8.85-beta */
const OLD_PAGE = htmlPage(
  'UGXSMF v0.8.85-beta',
  `<table>
  <tbody>
    <tr><th>Date</th><td>29 May 2024</td></tr>
    <tr><th>Issues</th><td><p><a href="https://ugxmods.atlassian.net/issues/?jql=x">11 issues</a></p></td></tr>
    <tr><th>Status</th><td><span class="aui-lozenge aui-lozenge-success aui-lozenge-subtle">RELEASED</span></td></tr>
    <tr><th>Version</th><td>v0.8.85-beta</td></tr>
    <tr><th>Version Mode</th><td>production ⭐</td></tr>
  </tbody>
</table>
<h2 id="changelog-summary">Summary</h2>
<p>Big update with performance improvements.</p>
<h2 id="important-highlights">Important highlights from this release</h2>
<ul><li>New spoilers</li></ul>
<h2 id="all-tickets">All tickets for this release</h2>
<div style="width: 100%; overflow: auto"><table><tbody><tr><td>OLD-1</td></tr></tbody></table></div>
<p>(Not all changes are listed here, always check the highlights above)</p>
<h2 id="known-issues">Known issues</h2>
<ul><li>Edge partially tested</li></ul>
<h2 id="did-you-know">Did you know...?</h2>
<p>Fun fact</p>
<h2 id="whats-next">Whats next?</h2>
<p>Roadmap</p>`,
  { tags: 'forum, changelog' },
);

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

test('a new page has all sections in order, with defaults', () => {
  const html = newPage();
  const order = [
    'widget-jira-changelog',
    'widget-jira-info',
    'changelog-summary',
    'changelog-highlights',
    'changelog-tickets',
    'changelog-known-issues',
    'changelog-special-thanks',
    'changelog-whats-next',
  ].map((cls) => html.indexOf(`class="${cls}"`));
  assert.ok(
    order.every((pos, i) => pos > 0 && (i === 0 || pos > order[i - 1])),
  );
  assert.ok(html.includes('<th>Version Mode</th>'));
  assert.ok(html.includes('For your support and issue reports ❤️'));
  assert.ok(html.includes('<p>Bug fixes &amp; &lt;improvements&gt;</p>'));
  assert.ok(html.includes('https://www.ugx-mods.com/roadmap'));
  assert.ok(html.includes('data-released="2026-11-03"'));
  assert.ok(html.includes('data-refreshed="2026-11-04"'));
});

test('a new page escapes jira content and maps icons and states', () => {
  const html = newPage();
  assert.ok(!html.includes('<script>'));
  assert.ok(
    html.includes('Fix &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'),
  );
  assert.ok(
    html.includes('src="/attachments/icons/jira/type-bug.svg" alt="Bug"'),
  );
  assert.ok(html.includes('>Epic</a>'));
  assert.ok(html.includes('aui-lozenge-success">Done</span>'));
  assert.ok(html.includes('aui-lozenge-current">In Progress</span>'));
  assert.ok(html.includes('<td>Unassigned</td>'));
  assert.ok(html.includes('<td>3 November 2026</td>'));
  assert.ok(html.includes('>2 issues</a>'));
});

test('a new page has a valid header', () => {
  const html = newPage();
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

test('adopt converts an old page and keeps everything hand-written', () => {
  const adopted = adoptChangelogPage(OLD_PAGE, 'UGXSMF') ?? '';
  const page = readChangelog(adopted);
  assert.deepEqual(page.data, {
    project: 'UGXSMF',
    version: 'v0.8.85-beta',
    released: '2024-05-29',
    refreshed: '',
  });
  assert.ok(adopted.includes('production ⭐'));
  assert.ok(page.sections.summary.includes('Big update'));
  assert.ok(page.sections.highlights.includes('New spoilers'));
  // the old ticket table stays until a refresh
  assert.ok(page.sections.tickets.includes('OLD-1'));
  // unknown sections stay with the section they follow
  assert.ok(page.sections['known-issues'].includes('Fun fact'));
  // missing sections get the default
  assert.ok(adopted.includes('For your support and issue reports ❤️'));
  assert.ok(page.sections['whats-next'].includes('Roadmap'));
  assert.equal(adoptChangelogPage(adopted, 'UGXSMF'), null);
});

test('refresh only replaces the generated parts', () => {
  const adopted = (adoptChangelogPage(OLD_PAGE, 'UGXSMF') ?? '').replace(
    'Big update with performance improvements.',
    'Edited by hand.',
  );
  const release = { ...fetched.release, name: 'v0.8.85-beta' };
  const refreshed =
    refreshChangelogPage(adopted, { ...fetched, release }, JIRA, NOW) ?? '';
  assert.ok(refreshed.includes('Edited by hand.'));
  assert.ok(refreshed.includes('production ⭐'));
  assert.ok(refreshed.includes('Fun fact'));
  assert.ok(!refreshed.includes('OLD-1'));
  assert.ok(refreshed.includes('UGXSMF-400'));
  assert.ok(refreshed.includes('(Not all changes are listed here'));
  assert.ok(refreshed.includes('>2 issues</a>'));
  assert.ok(!refreshed.includes('11 issues'));
  assert.ok(refreshed.includes('data-refreshed="2026-11-04"'));
  // a second refresh changes only the refresh date
  const later = new Date('2026-11-05T00:00:00.000Z');
  const again =
    refreshChangelogPage(refreshed, { ...fetched, release }, JIRA, later) ?? '';
  assert.equal(
    again.replace('2026-11-05', '2026-11-04').replace(/\s+/g, ''),
    refreshed.replace(/\s+/g, ''),
  );
  assert.equal(refreshChangelogPage(OLD_PAGE, fetched, JIRA, NOW), null);
});

test('parseReleaseDate reads the dates of the info tables', () => {
  assert.equal(parseReleaseDate('29 May 2024'), '2024-05-29');
  assert.equal(parseReleaseDate('10 March 2019'), '2019-03-10');
  assert.equal(parseReleaseDate('soon'), '');
});

test('isDue refreshes until 30 days after the release', () => {
  assert.equal(isDue({ released: '' }, NOW), true);
  assert.equal(isDue({ released: '2026-10-10' }, NOW), true);
  assert.equal(isDue({ released: '2026-09-01' }, NOW), false);
  assert.equal(isDue({ released: 'garbage' }, NOW), false);
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

test('planReleases finds due changelogs, forced or not, and rejects foreign projects', async () => {
  const wrapper = (/** @type {string} */ attrs) =>
    htmlPage('Page', `<div class="widget-jira-changelog" ${attrs}></div>`);
  const dir = 'Applications-and-Services/UGX-Mods-Forum/Changelog';
  const root = createFixture({
    [`${dir}/UGXSMF-v1-0.html`]: wrapper(
      'data-project="UGXSMF" data-version="v1.0" data-released="" data-refreshed="2026-11-01"',
    ),
    [`${dir}/UGXSMF-v0-9.html`]: wrapper(
      'data-project="UGXSMF" data-version="v0.9" data-released="2026-01-01" data-refreshed="2026-01-05"',
    ),
    [`${dir}/Foreign.html`]: wrapper(
      'data-project="UGXL" data-version="v1.0" data-released=""',
    ),
    [`${dir}/Injection.html`]: wrapper(
      'data-project="UGXSMF" data-version="v1&quot; OR x" data-released=""',
    ),
  });
  try {
    const base = { root, allowlist: new Set(['UGXSMF', 'UGXL']), now: NOW };
    const plan = await planReleases({
      ...base,
      project: 'UGXSMF',
      version: 'v1.1',
    });
    assert.deepEqual(
      plan.requests.map((r) => `${r.mode} ${r.project} ${r.version}`),
      ['create UGXSMF v1.1', 'refresh UGXSMF v1.0'],
    );
    assert.equal(plan.errors.length, 0);
    assert.equal(plan.warnings.length, 2);

    const forced = await planReleases({ ...base, force: true });
    assert.deepEqual(forced.requests.map((r) => r.version).sort(), [
      'v0.9',
      'v1.0',
    ]);

    const denied = await planReleases({
      ...base,
      allowlist: new Set(['UGXL']),
      project: 'UGXSMF',
      version: 'v1.0',
    });
    assert.deepEqual(denied.errors, [
      'JIRA_PROJECT UGXSMF is not an allowed project',
    ]);
    assert.equal(denied.requests.length, 0);
  } finally {
    removeFixture(root);
  }
});

test('adopt takes the version from the issues query and freezes unreadable dates', () => {
  const page = OLD_PAGE.replace(
    'href="https://ugxmods.atlassian.net/issues/?jql=x"',
    'href="https://ugxmods.atlassian.net/issues/?jql=project+%3D+UGXSMF+AND+fixVersion+%3D+v0.7.0-open-beta"',
  )
    .replace('<td>v0.8.85-beta</td>', '<td>v0.7.0-donor-beta</td>')
    .replace('29 May 2024', '02 Dev 2017');
  const data = readChangelog(adoptChangelogPage(page, 'UGXSMF') ?? '').data;
  assert.equal(data?.version, 'v0.7.0-open-beta');
  assert.equal(data?.released, 'unknown');
  assert.equal(isDue({ released: 'unknown' }, NOW), false);
  assert.equal(parseReleaseDate('02 Sep2018'), '2018-09-02');
});

test('own sections between the sections survive a refresh', () => {
  const page = newPage().replace(
    '<div class="changelog-whats-next">',
    '<h2 id="did-you-know">Did you know...?</h2>\n<p>Own section</p>\n<div class="changelog-whats-next">',
  );
  const refreshed = refreshChangelogPage(page, fetched, JIRA, NOW) ?? '';
  const own = refreshed.indexOf('Own section');
  assert.ok(own > 0);
  assert.ok(own > refreshed.indexOf('class="changelog-special-thanks"'));
  assert.ok(own < refreshed.indexOf('class="changelog-whats-next"'));
});
