/**
 * Fetches releases and their tickets from Jira Cloud for the changelog pages.
 *
 * This is the only code that sees the Jira API token, so it is a standalone
 * script on purpose: it imports nothing but Node.js built-ins. The other tooling
 * (src/main.js) loads third-party packages (prettier, node-html-parser, ...);
 * a compromised release of one of them could read the token from the
 * environment. The page generation therefore runs in separate processes without
 * the token: `jira-plan` writes the list of releases, this script fetches them,
 * `jira-render` writes the pages.
 *
 * Only projects of the allowlist JIRA_PROJECTS (a GitHub variable, not part of
 * the repository) are requested, tickets with a security level are left out,
 * and only the fields the pages need are written (no email addresses).
 *
 * usage: node src/jira-fetch.js <plan.json> <data.json>
 * environment: JIRA_PROJECTS (comma separated keys), JIRA_EMAIL, JIRA_API_TOKEN,
 * JIRA_CLOUD_ID (needed for scoped tokens), JIRA_URL (default https://ugxmods.atlassian.net)
 */
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

const DEFAULT_JIRA_URL = 'https://ugxmods.atlassian.net';
const REGEX_PROJECT = /^[A-Z][A-Z0-9]{1,9}$/;
// version names end up in JQL
const REGEX_VERSION = /^[\w.+-]{1,50}$/;
const FIELDS = [
  'summary',
  'issuetype',
  'priority',
  'status',
  'resolution',
  'created',
  'updated',
  'assignee',
  'reporter',
  'security',
];

/**
 * @typedef {object} JiraClient
 * @property {string} url site url, used for the links on the page
 * @property {string} [apiUrl] REST api base, the api.atlassian.com gateway for scoped tokens
 * @property {string} email
 * @property {string} token
 * @property {typeof fetch} [fetch]
 */

/**
 * @typedef {object} Release
 * @property {string} name
 * @property {boolean} released
 * @property {string} releaseDate YYYY-MM-DD or ''
 * @property {string} description
 */

/**
 * @typedef {object} Issue
 * @property {string} key
 * @property {string} summary
 * @property {string} type
 * @property {string} priority
 * @property {string} status
 * @property {string} statusCategory new, indeterminate or done
 * @property {string} resolution
 * @property {string} created
 * @property {string} updated
 * @property {string} assignee display name
 * @property {string} reporter display name
 */

/**
 * @param {string|undefined} value comma separated project keys
 * @returns {Set<string>}
 */
function parseAllowlist(value) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => REGEX_PROJECT.test(k)),
  );
}

/**
 * @param {JiraClient} client
 * @param {string} apiPath
 * @returns {Promise<any>}
 */
async function jiraGet(client, apiPath) {
  const auth = Buffer.from(`${client.email}:${client.token}`).toString(
    'base64',
  );
  const res = await (client.fetch ?? fetch)(
    `${client.apiUrl ?? client.url}${apiPath}`,
    {
      headers: { accept: 'application/json', authorization: `Basic ${auth}` },
    },
  );
  // never print the response body or headers, only the status
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Jira denied the request (${res.status}): the API token is expired, revoked or misses the scope read:jira-work (scoped tokens also need JIRA_CLOUD_ID)`,
    );
  }
  if (!res.ok) {
    throw new Error(`Jira request failed (${res.status}): ${apiPath}`);
  }
  return res.json();
}

/**
 * @param {JiraClient} client
 * @param {string} project
 * @returns {Promise<Release[]>} all versions of the project, oldest first
 */
async function getReleases(client, project) {
  /** @type {any[]} */
  const versions = await jiraGet(
    client,
    `/rest/api/3/project/${encodeURIComponent(project)}/versions`,
  );
  return versions.map((v) => ({
    name: String(v.name ?? ''),
    released: !!v.released,
    releaseDate: String(v.releaseDate ?? ''),
    description: String(v.description ?? ''),
  }));
}

/**
 * @param {any} raw jira issue
 * @returns {Issue} only the fields the page shows
 */
function toIssue(raw) {
  const f = raw.fields ?? {};
  return {
    key: String(raw.key ?? ''),
    summary: String(f.summary ?? ''),
    type: String(f.issuetype?.name ?? ''),
    priority: String(f.priority?.name ?? ''),
    status: String(f.status?.name ?? ''),
    statusCategory: String(f.status?.statusCategory?.key ?? ''),
    resolution: String(f.resolution?.name ?? ''),
    created: String(f.created ?? ''),
    updated: String(f.updated ?? ''),
    assignee: String(f.assignee?.displayName ?? ''),
    reporter: String(f.reporter?.displayName ?? ''),
  };
}

/**
 * @param {JiraClient} client
 * @param {string} project
 * @param {string} version
 * @returns {Promise<{issues: Issue[], hidden: number}>} tickets of the release
 * without the ones with a security level (paginated)
 */
async function getIssues(client, project, version) {
  // level IS EMPTY: tickets with a security level never end up on a public page
  const jql = `project = ${project} AND fixVersion = "${version}" AND level IS EMPTY ORDER BY priority DESC, key DESC`;
  /** @type {Issue[]} */
  const issues = [];
  let hidden = 0;
  let token = '';
  do {
    const query = new URLSearchParams({
      jql,
      fields: FIELDS.join(','),
      maxResults: '100',
    });
    if (token) query.set('nextPageToken', token);
    const page = await jiraGet(client, `/rest/api/3/search/jql?${query}`);
    for (const raw of page.issues ?? []) {
      // second line of defense if the JQL filter does not apply
      if (raw.fields?.security) hidden++;
      else issues.push(toIssue(raw));
    }
    token = page.isLast ? '' : (page.nextPageToken ?? '');
  } while (token);
  return { issues, hidden };
}

/**
 * @param {object} options
 * @param {{project: string, version: string}[]} options.requests from the plan
 * @param {Set<string>} options.allowlist
 * @param {JiraClient} options.client
 * @returns {Promise<{releases: object[], errors: string[]}>}
 */
async function fetchReleases({ requests, allowlist, client }) {
  /** @type {object[]} */
  const releases = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, Release[]>} */
  const versionsByProject = new Map();

  for (const { project, version } of requests) {
    // the plan is built from page content, so it is checked again here
    if (!allowlist.has(project)) {
      errors.push(`${project} is not in JIRA_PROJECTS`);
      continue;
    }
    if (!REGEX_VERSION.test(version)) {
      errors.push(`${project}: invalid version ${JSON.stringify(version)}`);
      continue;
    }
    if (!versionsByProject.has(project)) {
      versionsByProject.set(project, await getReleases(client, project));
    }
    const versions = versionsByProject.get(project) ?? [];
    const release = versions.find((v) => v.name === version);
    if (!release) {
      const newest = versions
        .slice(-10)
        .reverse()
        .map((v) => v.name);
      errors.push(
        `Version ${version} not found in ${project}. Newest versions: ${newest.join(', ') || 'none'}`,
      );
      continue;
    }
    const { issues, hidden } = await getIssues(client, project, version);
    releases.push({ project, release, issues, hidden });
  }
  return { releases, errors };
}

async function main() {
  const [planPath, dataPath] = process.argv.slice(2);
  if (!planPath || !dataPath) {
    console.error('usage: node src/jira-fetch.js <plan.json> <data.json>');
    return 1;
  }
  // local secrets, variables of the shell win
  if (fs.existsSync('.env')) {
    const local = parseEnv(fs.readFileSync('.env', 'utf8'));
    for (const [key, value] of Object.entries(local)) {
      process.env[key] ??= value;
    }
  }

  const allowlist = parseAllowlist(process.env.JIRA_PROJECTS);
  const url = (process.env.JIRA_URL || DEFAULT_JIRA_URL).replace(/\/$/, '');
  const cloudId = process.env.JIRA_CLOUD_ID ?? '';
  const client = {
    url,
    // scoped API tokens only work through the api.atlassian.com gateway
    apiUrl: cloudId ? `https://api.atlassian.com/ex/jira/${cloudId}` : url,
    email: process.env.JIRA_EMAIL ?? '',
    token: process.env.JIRA_API_TOKEN ?? '',
  };
  if (!allowlist.size) {
    console.error('🚨 JIRA_PROJECTS (allowed Jira project keys) is not set');
    return 1;
  }
  if (cloudId && !/^[0-9a-f-]{36}$/.test(cloudId)) {
    console.error('🚨 JIRA_CLOUD_ID is not a valid cloud id');
    return 1;
  }
  if (!client.email || !client.token) {
    console.error('🚨 JIRA_EMAIL and JIRA_API_TOKEN are required');
    return 1;
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const { releases, errors } = await fetchReleases({
    requests: plan.requests ?? [],
    allowlist,
    client,
  });
  errors.forEach((e) => console.error('🚨', e));
  fs.writeFileSync(
    dataPath,
    JSON.stringify(
      { jiraUrl: url, fetchedAt: new Date().toISOString(), releases },
      null,
      2,
    ),
  );
  console.log(
    'Fetched',
    releases.length,
    'of',
    plan.requests?.length ?? 0,
    'releases from Jira',
  );
  return errors.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then(
    (code) => (process.exitCode = code),
    (err) => {
      console.error('🚨', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    },
  );
}

export { parseAllowlist, getReleases, getIssues, fetchReleases, toIssue };
