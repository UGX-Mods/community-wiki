/**
 * Changelog pages from Jira Cloud: creates the page of a release (fixVersion) with
 * its tickets and adds the release to the changelog overview of the product.
 *
 * Environment: JIRA_PROJECT, JIRA_VERSION, JIRA_EMAIL, JIRA_API_TOKEN (read-only
 * account, scope read:jira-work), JIRA_CLOUD_ID (needed for scoped tokens),
 * JIRA_URL (default https://ugxmods.atlassian.net), DRY_RUN=1 prints the page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { encoding } from '../lib/pages.js';
import { formatHtml } from '../lib/html.js';
import { refreshPageHierarchy } from '../hierarchy.js';

const DEFAULT_JIRA_URL = 'https://ugxmods.atlassian.net';
const ICONS = '/attachments/icons/jira';

/**
 * @typedef {object} ProjectConfig
 * @property {string} dir changelog folder (child pages of `${dir}.html`)
 * @property {string} prefix file name prefix incl. separator
 * @property {string} title title prefix
 * @property {string} tag product tag
 */

/** @type {Record<string, ProjectConfig>} Jira project key -> wiki changelog */
const PROJECTS = {
  UGXSMF: {
    dir: 'Applications-and-Services/UGX-Mods-Forum/Changelog',
    prefix: 'UGXSMF-',
    title: 'UGXSMF',
    tag: 'forum',
  },
  UGXL: { dir: 'UGXL/Changelog', prefix: 'UGXL-', title: 'UGXL', tag: 'ugxl' },
  UGXLIN: {
    dir: 'UGXLIN/Changelog',
    prefix: 'UGXLIN_',
    title: 'UGXLIN',
    tag: 'ugxlin',
  },
  UGXMAPP: {
    dir: 'Applications-and-Services/Modder-Mapper/UGX-MapPacker/Changelog-of-UGXMP',
    prefix: 'UGXMAPP-',
    title: 'UGXMAPP',
    tag: 'ugxmp',
  },
};

// version names end up in JQL and file names
const REGEX_VERSION = /^[\w.+-]{1,50}$/;

/** @type {Record<string, string>} issue type -> local icon */
const TYPE_ICONS = {
  bug: 'type-bug.svg',
  change: 'type-change.svg',
  'crash report': 'type-crash-report.svg',
  feedback: 'type-feedback.svg',
  improvement: 'type-improvement.svg',
  'new feature': 'type-new-feature.svg',
  story: 'type-story.svg',
  'sub-task': 'type-sub-task.svg',
  subtask: 'type-sub-task.svg',
  task: 'type-task.svg',
};

/** @type {Record<string, string>} status category -> lozenge class */
const STATUS_LOZENGES = {
  done: 'aui-lozenge-success',
  indeterminate: 'aui-lozenge-current',
  new: 'aui-lozenge-default',
};

/**
 * @typedef {object} JiraIssue
 * @property {string} key
 * @property {{summary?: string, issuetype?: {name?: string}, priority?: {name?: string},
 *   status?: {name?: string, statusCategory?: {key?: string}}, resolution?: {name?: string} | null,
 *   created?: string, updated?: string, assignee?: {displayName?: string} | null,
 *   reporter?: {displayName?: string} | null}} fields
 */

/**
 * @typedef {object} JiraVersion
 * @property {string} name
 * @property {boolean} [released]
 * @property {string} [releaseDate] YYYY-MM-DD
 * @property {string} [description]
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * @param {string} project
 * @param {string} version
 * @returns {string} page path without extension, e.g. UGXL/Changelog/UGXL-v0-8-1
 */
function changelogPagePath(project, version) {
  const config = PROJECTS[project];
  const slug = version.replaceAll('.', '-').replace(/[^A-Za-z0-9_-]/g, '');
  return `${config.dir}/${config.prefix}${slug}`;
}

/**
 * @param {string|undefined} iso
 * @param {Intl.DateTimeFormatOptions} options
 * @param {string} locale
 * @returns {string}
 */
function formatDate(iso, options, locale) {
  if (!iso) return '';
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
}

/** @param {string|undefined} iso */
const formatIssueDate = (iso) =>
  formatDate(iso, { month: 'short', day: '2-digit', year: 'numeric' }, 'en-US');

/** @param {string|undefined} iso */
const formatReleaseDate = (iso) =>
  formatDate(iso, { day: 'numeric', month: 'long', year: 'numeric' }, 'en-GB');

/**
 * @param {string} jiraUrl
 * @param {string} project
 * @param {string} version
 * @returns {string} issue search url of the release
 */
function searchUrl(jiraUrl, project, version) {
  const jql = `project = ${project} AND fixVersion = "${version}"`;
  return `${jiraUrl}/issues/?jql=${encodeURIComponent(jql)}`;
}

/**
 * @param {string} name icon name (issue type or priority)
 * @param {string|undefined} file icon file
 * @returns {string} img or the escaped name if there is no local icon
 */
function icon(name, file) {
  if (!name) return '';
  return file
    ? `<img src="${ICONS}/${file}" alt="${escapeHtml(name)}" class="icon" />`
    : escapeHtml(name);
}

/**
 * @param {JiraIssue} issue
 * @param {string} jiraUrl
 * @returns {string} table row
 */
function renderIssueRow(issue, jiraUrl) {
  const f = issue.fields ?? {};
  const href = `${jiraUrl}/browse/${encodeURIComponent(issue.key)}`;
  const link = (/** @type {string} */ text) =>
    `<a href="${href}" target="_blank">${text}</a>`;
  const type = f.issuetype?.name ?? '';
  const priority = f.priority?.name ?? '';
  const lozenge =
    STATUS_LOZENGES[f.status?.statusCategory?.key ?? ''] ??
    'aui-lozenge-default';
  return `<tr>
  <td>${link(escapeHtml(issue.key))}</td>
  <td>${link(escapeHtml(f.summary))}</td>
  <td>${link(icon(type, TYPE_ICONS[type.toLowerCase()]))}</td>
  <td>${formatIssueDate(f.created)}</td>
  <td>${formatIssueDate(f.updated)}</td>
  <td>${escapeHtml(f.assignee?.displayName ?? 'Unassigned')}</td>
  <td>${escapeHtml(f.reporter?.displayName)}</td>
  <td>${icon(priority, priority ? `priority-${priority.toLowerCase()}.svg` : undefined)}</td>
  <td><span class="aui-lozenge aui-lozenge-subtle ${lozenge}">${escapeHtml(f.status?.name)}</span></td>
  <td>${escapeHtml(f.resolution?.name ?? 'Unresolved')}</td>
</tr>`;
}

/**
 * @param {object} options
 * @param {string} options.project Jira project key
 * @param {JiraVersion} options.version
 * @param {JiraIssue[]} options.issues
 * @param {string} options.jiraUrl
 * @param {Date} options.now
 * @returns {string} page html (unformatted)
 */
function renderChangelogPage({ project, version, issues, jiraUrl, now }) {
  const config = PROJECTS[project];
  const name = escapeHtml(version.name);
  const released = formatReleaseDate(version.releaseDate);
  const month = formatDate(
    version.releaseDate,
    { month: 'long', year: 'numeric' },
    'en-GB',
  );
  // description is YAML: no ": " or " #", see checkDescription
  const description = `Release notes of ${config.title} ${version.name}${month ? ` (${month})` : ''}`;
  const timestamp = now.toISOString();
  const status = version.released
    ? '<span class="aui-lozenge aui-lozenge-subtle aui-lozenge-success">RELEASED</span>'
    : '<span class="aui-lozenge aui-lozenge-subtle aui-lozenge-current">UNRELEASED</span>';
  const count = `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`;
  const summary = version.description
    ? `<p>${escapeHtml(version.description)}</p>`
    : '<p>Release notes will follow.</p>';

  return `<!--
title: ${config.title} ${version.name}
description: ${description}
published: true
date: ${timestamp}
tags: ${config.tag}, changelog
editor: ckeditor
dateCreated: ${timestamp}
-->

<table>
  <tbody>
    <tr><th>Date</th><td>${released || '&nbsp;'}</td></tr>
    <tr><th>Issues</th><td><a href="${searchUrl(jiraUrl, project, version.name)}" target="_blank">${count}</a></td></tr>
    <tr><th>Status</th><td>${status}</td></tr>
    <tr><th>Version</th><td>${name}</td></tr>
  </tbody>
</table>
<h2 id="Summary">Summary</h2>
${summary}
<h2 id="Alltickets">All tickets for this release</h2>
<div style="width: 100%; overflow: auto">
  <table>
    <thead>
      <tr>
        <th>Key</th><th>Summary</th><th>T</th><th>Created</th><th>Updated</th>
        <th>Assignee</th><th>Reporter</th><th>P</th><th>Status</th><th>Resolution</th>
      </tr>
    </thead>
    <tbody>
${issues.map((issue) => renderIssueRow(issue, jiraUrl)).join('\n')}
    </tbody>
  </table>
</div>
`;
}

/**
 * Adds the release as first row of the overview table (newest first).
 *
 * @param {string} html overview page
 * @param {object} options
 * @param {string} options.project
 * @param {JiraVersion} options.version
 * @param {number} options.issueCount
 * @param {string} options.jiraUrl
 * @returns {string|null} changed html, null if there is no overview table or the release is listed
 */
function addOverviewRow(html, { project, version, issueCount, jiraUrl }) {
  const config = PROJECTS[project];
  const file = changelogPagePath(project, version.name).split('/').at(-1);
  const tableStart = html.indexOf('<th>Title</th>');
  if (tableStart === -1 || html.includes(`href="${file}"`)) return null;
  const tbody = html.indexOf('<tbody>', tableStart);
  if (tbody === -1) return null;

  const status = version.released
    ? '<span class="aui-lozenge aui-lozenge-success aui-lozenge-subtle">RELEASED</span>'
    : '<span class="aui-lozenge aui-lozenge-current aui-lozenge-subtle">UNRELEASED</span>';
  const row = `
    <tr>
      <td><a href="${file}">${escapeHtml(`${config.title} ${version.name}`)}</a></td>
      <td>${version.releaseDate ? formatDate(version.releaseDate, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-GB') : '&nbsp;'}</td>
      <td><p><a href="${searchUrl(jiraUrl, project, version.name)}" target="_blank">${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}</a></p></td>
      <td>&nbsp;</td>
      <td>${status}</td>
      <td>${escapeHtml(version.name)}</td>
      <td>&nbsp;</td>
    </tr>`;
  const insertAt = tbody + '<tbody>'.length;
  return html.slice(0, insertAt) + row + html.slice(insertAt);
}

/**
 * @typedef {object} JiraClient
 * @property {string} url site url, used for the links on the page
 * @property {string} [apiUrl] REST api base, the api.atlassian.com gateway for scoped tokens
 * @property {string} email
 * @property {string} token
 * @property {typeof fetch} [fetch]
 */

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
 * @param {string} versionName
 * @returns {Promise<JiraVersion|undefined>}
 */
async function getVersion(client, project, versionName) {
  /** @type {JiraVersion[]} */
  const versions = await jiraGet(
    client,
    `/rest/api/3/project/${encodeURIComponent(project)}/versions`,
  );
  return versions.find((v) => v.name === versionName);
}

/**
 * @param {JiraClient} client
 * @param {string} project
 * @param {string} versionName
 * @returns {Promise<JiraIssue[]>} all issues of the release (paginated)
 */
async function getIssues(client, project, versionName) {
  const jql = `project = ${project} AND fixVersion = "${versionName}" ORDER BY priority DESC, key DESC`;
  const fields =
    'summary,issuetype,priority,status,resolution,created,updated,assignee,reporter';
  /** @type {JiraIssue[]} */
  const issues = [];
  let token = '';
  do {
    const query = new URLSearchParams({ jql, fields, maxResults: '100' });
    if (token) query.set('nextPageToken', token);
    const page = await jiraGet(client, `/rest/api/3/search/jql?${query}`);
    issues.push(...(page.issues ?? []));
    token = page.isLast ? '' : (page.nextPageToken ?? '');
  } while (token);
  return issues;
}

/**
 * @param {string} root repository root
 * @returns {Promise<number>} errors
 */
async function jiraChangelog(root = process.cwd()) {
  const project = process.env.JIRA_PROJECT ?? '';
  const versionName = process.env.JIRA_VERSION ?? '';
  const url = (process.env.JIRA_URL || DEFAULT_JIRA_URL).replace(/\/$/, '');
  const cloudId = process.env.JIRA_CLOUD_ID ?? '';
  /** @type {JiraClient} */
  const client = {
    url,
    // scoped API tokens only work through the api.atlassian.com gateway
    apiUrl: cloudId ? `https://api.atlassian.com/ex/jira/${cloudId}` : url,
    email: process.env.JIRA_EMAIL ?? '',
    token: process.env.JIRA_API_TOKEN ?? '',
  };
  if (cloudId && !/^[0-9a-f-]{36}$/.test(cloudId)) {
    console.error('🚨 JIRA_CLOUD_ID is not a valid cloud id');
    return 1;
  }
  if (!PROJECTS[project]) {
    console.error(
      `🚨 JIRA_PROJECT must be one of ${Object.keys(PROJECTS).join(', ')}`,
    );
    return 1;
  }
  if (!REGEX_VERSION.test(versionName)) {
    console.error('🚨 JIRA_VERSION is missing or contains invalid characters');
    return 1;
  }
  if (!client.email || !client.token) {
    console.error('🚨 JIRA_EMAIL and JIRA_API_TOKEN are required');
    return 1;
  }

  const version = await getVersion(client, project, versionName);
  if (!version) {
    console.error(`🚨 Version ${versionName} not found in ${project}`);
    return 1;
  }
  const issues = await getIssues(client, project, versionName);
  const pagePath = path.join(
    root,
    `${changelogPagePath(project, versionName)}.html`,
  );
  const page = await formatHtml(
    renderChangelogPage({
      project,
      version,
      issues,
      jiraUrl: client.url,
      now: new Date(),
    }),
    pagePath,
  );

  if (process.env.DRY_RUN) {
    console.log(page);
    return 0;
  }
  if (fs.existsSync(pagePath)) {
    console.error(`🚨 ${path.relative(root, pagePath)} exists already`);
    return 1;
  }
  await fs.promises.writeFile(pagePath, page, encoding);
  console.log(
    'Created',
    path.relative(root, pagePath),
    `(${issues.length} issues) 📝`,
  );

  // the overview lists the releases in a table or as child page list
  const overviewPath = path.join(root, `${PROJECTS[project].dir}.html`);
  const overview = await fs.promises.readFile(overviewPath, encoding);
  const updated = addOverviewRow(overview, {
    project,
    version,
    issueCount: issues.length,
    jiraUrl: client.url,
  });
  if (updated) {
    await fs.promises.writeFile(
      overviewPath,
      await formatHtml(updated, overviewPath),
      encoding,
    );
    console.log('Added the release to', path.relative(root, overviewPath));
  } else {
    await refreshPageHierarchy([overviewPath]);
  }
  return 0;
}

export {
  PROJECTS,
  escapeHtml,
  changelogPagePath,
  renderChangelogPage,
  addOverviewRow,
  getIssues,
  getVersion,
  jiraChangelog,
};
