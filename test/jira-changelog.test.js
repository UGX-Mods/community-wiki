import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changelogPagePath,
  renderChangelogPage,
  addOverviewRow,
  getIssues,
  getVersion,
} from '../src/tools/jira/changelog.js';
import { checkPageMetadata } from '../src/tools/validate/metadata.js';
import { checkDescription } from '../src/tools/content/descriptions.js';

const JIRA = 'https://example.atlassian.net';

/** @type {import('../src/tools/jira/changelog.js').JiraVersion} */
const version = {
  name: 'v0.8.86-beta',
  released: true,
  releaseDate: '2026-11-03',
  description: 'Bug fixes & <improvements>',
};

/** @type {import('../src/tools/jira/changelog.js').JiraIssue[]} */
const issues = [
  {
    key: 'UGXSMF-400',
    fields: {
      summary: 'Fix <script>alert("x")</script> in posts',
      issuetype: { name: 'Bug' },
      priority: { name: 'Major' },
      status: { name: 'Done', statusCategory: { key: 'done' } },
      resolution: { name: 'Done' },
      created: '2026-10-01T10:00:00.000+0000',
      updated: '2026-11-02T10:00:00.000+0000',
      assignee: { displayName: 'Alexander Diller' },
      reporter: { displayName: 'Community Reporter' },
    },
  },
  {
    key: 'UGXSMF-401',
    fields: {
      summary: 'Unknown type',
      issuetype: { name: 'Epic' },
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      resolution: null,
      assignee: null,
    },
  },
];

const render = () =>
  renderChangelogPage({
    project: 'UGXSMF',
    version,
    issues,
    jiraUrl: JIRA,
    now: new Date('2026-11-04T12:00:00.000Z'),
  });

test('changelogPagePath follows the wiki.js naming restrictions', () => {
  assert.equal(
    changelogPagePath('UGXSMF', 'v0.8.86-beta'),
    'Applications-and-Services/UGX-Mods-Forum/Changelog/UGXSMF-v0-8-86-beta',
  );
  assert.equal(
    changelogPagePath('UGXLIN', 'v0.8.1-rc.1'),
    'UGXLIN/Changelog/UGXLIN_v0-8-1-rc-1',
  );
});

test('renderChangelogPage escapes jira content and maps icons and states', () => {
  const html = render();
  assert.ok(!html.includes('<script>'));
  assert.ok(
    html.includes('Fix &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'),
  );
  assert.ok(html.includes('<p>Bug fixes &amp; &lt;improvements&gt;</p>'));
  assert.ok(
    html.includes('src="/attachments/icons/jira/type-bug.svg" alt="Bug"'),
  );
  assert.ok(html.includes('src="/attachments/icons/jira/priority-major.svg"'));
  // unknown issue type: plain text instead of a broken image
  assert.ok(html.includes('>Epic</a>'));
  assert.ok(html.includes('aui-lozenge-success">Done</span>'));
  assert.ok(html.includes('aui-lozenge-current">In Progress</span>'));
  assert.ok(html.includes('<td>Unassigned</td>'));
  assert.ok(html.includes('<td>Unresolved</td>'));
  assert.ok(html.includes('<td>3 November 2026</td>'));
  assert.ok(html.includes('<td>Oct 01, 2026</td>'));
  assert.ok(html.includes('>2 issues</a>'));
  assert.ok(html.includes(`${JIRA}/browse/UGXSMF-400`));
});

test('renderChangelogPage creates a valid page header', () => {
  const html = render();
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

test('addOverviewRow adds the release as first row once', () => {
  const overview =
    '<table><thead><tr><th>Title</th></tr></thead><tbody>\n<tr><td><a href="UGXSMF-v0-8-85-beta">old</a></td></tr></tbody></table>';
  const options = { project: 'UGXSMF', version, issueCount: 1, jiraUrl: JIRA };
  const updated = addOverviewRow(overview, options);
  assert.ok(updated);
  assert.ok(
    updated.indexOf('UGXSMF-v0-8-86-beta') <
      updated.indexOf('UGXSMF-v0-8-85-beta'),
  );
  assert.ok(updated.includes('>1 issue</a>'));
  assert.ok(updated.includes('<td>3 Nov 2026</td>'));
  assert.equal(addOverviewRow(updated, options), null);
  assert.equal(
    addOverviewRow('<ul class="widget-page-hierarchy"></ul>', options),
    null,
  );
});

test('getIssues follows the pages and authenticates', async () => {
  /** @type {string[]} */
  const urls = [];
  /** @type {(string|null)[]} */
  const auths = [];
  /** @type {typeof fetch} */
  const fakeFetch = async (url, init) => {
    urls.push(String(url));
    auths.push(new Headers(init?.headers).get('authorization'));
    const second = String(url).includes('nextPageToken=abc');
    return Response.json(
      second
        ? { issues: [issues[1]], isLast: true }
        : { issues: [issues[0]], isLast: false, nextPageToken: 'abc' },
    );
  };
  const client = { url: JIRA, email: 'a@b.c', token: 't', fetch: fakeFetch };
  const result = await getIssues(client, 'UGXSMF', 'v0.8.86-beta');
  assert.deepEqual(
    result.map((i) => i.key),
    ['UGXSMF-400', 'UGXSMF-401'],
  );
  assert.equal(urls.length, 2);
  assert.ok(urls[0].includes('fixVersion+%3D+%22v0.8.86-beta%22'));
  assert.equal(auths[0], `Basic ${Buffer.from('a@b.c:t').toString('base64')}`);
});

test('getVersion finds the release and reports http errors', async () => {
  /** @type {typeof fetch} */
  const ok = async () => Response.json([{ name: 'v1' }, version]);
  const client = { url: JIRA, email: 'a@b.c', token: 't', fetch: ok };
  assert.equal(
    (await getVersion(client, 'UGXSMF', 'v0.8.86-beta'))?.releaseDate,
    '2026-11-03',
  );
  /** @type {typeof fetch} */
  const denied = async () => new Response('', { status: 401 });
  await assert.rejects(
    getVersion({ ...client, fetch: denied }, 'UGXSMF', 'v1'),
    /401/,
  );
});
