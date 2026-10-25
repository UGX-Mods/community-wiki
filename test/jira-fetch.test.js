import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAllowlist,
  getIssues,
  fetchReleases,
  toIssue,
} from '../src/jira-fetch.js';

const JIRA = 'https://example.atlassian.net';

/**
 * @param {string} key
 * @param {Record<string, unknown>} [extra]
 */
const rawIssue = (key, extra = {}) => ({
  key,
  fields: {
    summary: `Summary of ${key}`,
    issuetype: { name: 'Bug' },
    priority: { name: 'Major' },
    status: { name: 'Done', statusCategory: { key: 'done' } },
    resolution: { name: 'Done' },
    created: '2026-10-01T10:00:00.000+0000',
    updated: '2026-11-02T10:00:00.000+0000',
    assignee: { displayName: 'Alexander Diller', emailAddress: 'a@b.c' },
    reporter: { displayName: 'Community Reporter', emailAddress: 'r@b.c' },
    ...extra,
  },
});

/**
 * @param {(url: string) => any} handler
 * @returns {{fetch: typeof fetch, urls: string[], auths: (string|null)[]}}
 */
function fakeJira(handler) {
  /** @type {string[]} */
  const urls = [];
  /** @type {(string|null)[]} */
  const auths = [];
  /** @type {typeof fetch} */
  const fetchFn = async (url, init) => {
    urls.push(String(url));
    auths.push(new Headers(init?.headers).get('authorization'));
    const body = handler(String(url));
    return typeof body === 'number'
      ? new Response('', { status: body })
      : Response.json(body);
  };
  return { fetch: fetchFn, urls, auths };
}

test('parseAllowlist keeps valid project keys only', () => {
  assert.deepEqual(
    [...parseAllowlist(' UGXSMF, UGXL,,bad key, ugxl')],
    ['UGXSMF', 'UGXL'],
  );
  assert.equal(parseAllowlist(undefined).size, 0);
});

test('toIssue keeps the fields of the page and no email addresses', () => {
  const issue = toIssue(rawIssue('UGXSMF-1'));
  assert.equal(issue.assignee, 'Alexander Diller');
  assert.ok(!JSON.stringify(issue).includes('@'));
});

test('getIssues excludes security levels, follows pages, authenticates', async () => {
  const jira = fakeJira((url) =>
    url.includes('nextPageToken=abc')
      ? {
          issues: [rawIssue('UGXSMF-2', { security: { name: 'Staff' } })],
          isLast: true,
        }
      : { issues: [rawIssue('UGXSMF-1')], isLast: false, nextPageToken: 'abc' },
  );
  const client = { url: JIRA, email: 'a@b.c', token: 't', fetch: jira.fetch };
  const { issues, hidden } = await getIssues(client, 'UGXSMF', 'v1.0');
  assert.deepEqual(
    issues.map((i) => i.key),
    ['UGXSMF-1'],
  );
  assert.equal(hidden, 1);
  assert.equal(jira.urls.length, 2);
  assert.ok(jira.urls[0].includes('level+IS+EMPTY'));
  assert.ok(jira.urls[0].includes('fixVersion+%3D+%22v1.0%22'));
  assert.equal(
    jira.auths[0],
    `Basic ${Buffer.from('a@b.c:t').toString('base64')}`,
  );
});

test('fetchReleases only requests allowed projects and valid versions', async () => {
  const jira = fakeJira((url) =>
    url.includes('/versions')
      ? [{ name: 'v1.0', released: true, releaseDate: '2026-11-03' }]
      : { issues: [rawIssue('UGXSMF-1')], isLast: true },
  );
  const gateway =
    'https://api.atlassian.com/ex/jira/00000000-0000-0000-0000-000000000000';
  const client = {
    url: JIRA,
    apiUrl: gateway,
    email: 'a@b.c',
    token: 't',
    fetch: jira.fetch,
  };
  const { releases, errors } = await fetchReleases({
    requests: [
      { project: 'UGXSMF', version: 'v1.0' },
      { project: 'SECRET', version: 'v1.0' },
      { project: 'UGXSMF', version: 'v1" OR project = SECRET' },
      { project: 'UGXSMF', version: 'v9.9' },
    ],
    allowlist: new Set(['UGXSMF']),
    client,
  });
  assert.equal(releases.length, 1);
  assert.deepEqual(errors, [
    'SECRET is not in JIRA_PROJECTS',
    'UGXSMF: invalid version "v1\\" OR project = SECRET"',
    'Version v9.9 not found in UGXSMF. Newest versions: v1.0',
  ]);
  assert.ok(jira.urls.every((u) => u.startsWith(gateway)));
  assert.ok(!jira.urls.some((u) => u.includes('SECRET')));
});

test('an expired token explains the cause', async () => {
  const jira = fakeJira(() => 401);
  const client = { url: JIRA, email: 'a@b.c', token: 't', fetch: jira.fetch };
  await assert.rejects(
    getIssues(client, 'UGXSMF', 'v1.0'),
    /expired, revoked or misses the scope read:jira-work/,
  );
});
