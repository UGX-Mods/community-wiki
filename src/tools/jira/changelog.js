/**
 * Changelog pages from Jira Cloud, in three steps so the API token never meets
 * third-party code (see src/jira-fetch.js):
 *
 * 1. jira-plan: lists the releases to fetch, a new release (JIRA_PROJECT +
 *    JIRA_VERSION) and the release widgets that are due for a refresh
 * 2. node src/jira-fetch.js: fetches them (the only step with the token)
 * 3. jira-render: creates the new page / refreshes the widgets
 *
 * A release widget (`.widget-jira-issues` with data-project, data-version,
 * data-released, data-refreshed) is refreshed while the release is unreleased
 * and until REFRESH_DAYS after its release date, then it stays as it is.
 *
 * Environment: JIRA_PROJECT, JIRA_VERSION (new page), JIRA_PROJECTS (allowed
 * keys), JIRA_PLAN / JIRA_DATA (file paths, default in the temp folder).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encoding } from '../lib/pages.js';
import { formatHtml, parseHtmlContent } from '../lib/html.js';
import { refreshPageHierarchy } from '../hierarchy.js';

const ICONS = '/attachments/icons/jira';
const REFRESH_DAYS = 30;
const DEFAULT_PLAN = path.join(os.tmpdir(), 'ugx-wiki-jira-plan.json');
const DEFAULT_DATA = path.join(os.tmpdir(), 'ugx-wiki-jira-data.json');
const FETCH_SCRIPT = fileURLToPath(
  new URL('../../jira-fetch.js', import.meta.url),
);

/**
 * @typedef {object} ProjectConfig
 * @property {string} dir changelog folder (child pages of `${dir}.html`)
 * @property {string} prefix file name prefix incl. separator
 * @property {string} title title prefix
 * @property {string} tag product tag
 */

/**
 * Where the pages of a Jira project go. Which projects may be fetched is decided
 * by the allowlist JIRA_PROJECTS (GitHub variable), a project needs both.
 *
 * @type {Record<string, ProjectConfig>}
 */
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

/** @typedef {import('../../jira-fetch.js').Release} Release */
/** @typedef {import('../../jira-fetch.js').Issue} Issue */

/**
 * @typedef {object} PlanRequest
 * @property {string} project
 * @property {string} version
 * @property {string} page page path relative to the repository root, with .html
 * @property {'create'|'refresh'} mode
 */

/**
 * @typedef {object} FetchedRelease
 * @property {string} project
 * @property {Release} release
 * @property {Issue[]} issues
 * @property {number} hidden tickets left out because of a security level
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
 * @returns {string} page path with .html, e.g. UGXL/Changelog/UGXL-v0-8-1.html
 */
function changelogPagePath(project, version) {
  const config = PROJECTS[project];
  const slug = version.replaceAll('.', '-').replace(/[^A-Za-z0-9_-]/g, '');
  return `${config.dir}/${config.prefix}${slug}.html`;
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

/** @param {Date} date */
const isoDay = (date) => date.toISOString().slice(0, 10);

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

/** @param {number} count */
const issueCount = (count) => `${count} ${count === 1 ? 'issue' : 'issues'}`;

/** @param {Release} release */
const statusLozenge = (release) =>
  release.released
    ? '<span class="aui-lozenge aui-lozenge-subtle aui-lozenge-success">RELEASED</span>'
    : '<span class="aui-lozenge aui-lozenge-subtle aui-lozenge-current">UNRELEASED</span>';

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
 * @param {Issue} issue
 * @param {string} jiraUrl
 * @returns {string} table row
 */
function renderIssueRow(issue, jiraUrl) {
  const href = `${jiraUrl}/browse/${encodeURIComponent(issue.key)}`;
  const link = (/** @type {string} */ text) =>
    `<a href="${href}" target="_blank">${text}</a>`;
  const lozenge =
    STATUS_LOZENGES[issue.statusCategory] ?? 'aui-lozenge-default';
  const priority = issue.priority
    ? `priority-${issue.priority.toLowerCase()}.svg`
    : undefined;
  return `<tr>
  <td>${link(escapeHtml(issue.key))}</td>
  <td>${link(escapeHtml(issue.summary))}</td>
  <td>${link(icon(issue.type, TYPE_ICONS[issue.type.toLowerCase()]))}</td>
  <td>${formatIssueDate(issue.created)}</td>
  <td>${formatIssueDate(issue.updated)}</td>
  <td>${escapeHtml(issue.assignee || 'Unassigned')}</td>
  <td>${escapeHtml(issue.reporter)}</td>
  <td>${icon(issue.priority, priority)}</td>
  <td><span class="aui-lozenge aui-lozenge-subtle ${lozenge}">${escapeHtml(issue.status)}</span></td>
  <td>${escapeHtml(issue.resolution || 'Unresolved')}</td>
</tr>`;
}

/**
 * @param {FetchedRelease} fetched
 * @param {string} jiraUrl
 * @returns {string} info table of the release (date, issues, status, version)
 */
function renderInfoTable({ project, release, issues }, jiraUrl) {
  return `<table class="widget-jira-info">
  <tbody>
    <tr><th>Date</th><td>${formatReleaseDate(release.releaseDate) || '&nbsp;'}</td></tr>
    <tr><th>Issues</th><td><a href="${searchUrl(jiraUrl, project, release.name)}" target="_blank">${issueCount(issues.length)}</a></td></tr>
    <tr><th>Status</th><td>${statusLozenge(release)}</td></tr>
    <tr><th>Version</th><td>${escapeHtml(release.name)}</td></tr>
  </tbody>
</table>`;
}

/**
 * @param {FetchedRelease} fetched
 * @param {string} jiraUrl
 * @param {Date} now
 * @returns {string} release widget with the ticket table
 */
function renderIssuesWidget({ project, release, issues }, jiraUrl, now) {
  return `<div
  class="widget-jira-issues"
  data-project="${escapeHtml(project)}"
  data-version="${escapeHtml(release.name)}"
  data-released="${release.released ? escapeHtml(release.releaseDate) : ''}"
  data-refreshed="${isoDay(now)}">
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
</div>`;
}

/**
 * @param {FetchedRelease} fetched
 * @param {string} jiraUrl
 * @param {Date} now
 * @returns {string} page html (unformatted)
 */
function renderChangelogPage(fetched, jiraUrl, now) {
  const config = PROJECTS[fetched.project];
  const { release } = fetched;
  const month = formatDate(
    release.releaseDate,
    { month: 'long', year: 'numeric' },
    'en-GB',
  );
  // description is YAML: no ": " or " #", see checkDescription
  const description = `Release notes of ${config.title} ${release.name}${month ? ` (${month})` : ''}`;
  const timestamp = now.toISOString();
  const summary = release.description
    ? `<p>${escapeHtml(release.description)}</p>`
    : '<p>Release notes will follow.</p>';

  return `<!--
title: ${config.title} ${release.name}
description: ${description}
published: true
date: ${timestamp}
tags: ${config.tag}, changelog
editor: ckeditor
dateCreated: ${timestamp}
-->

${renderInfoTable(fetched, jiraUrl)}
<h2 id="Summary">Summary</h2>
${summary}
<h2 id="Alltickets">All tickets for this release</h2>
${renderIssuesWidget(fetched, jiraUrl, now)}
`;
}

/**
 * Replaces the info table and the release widget of an existing page, the rest
 * (summary, highlights) stays as it is.
 *
 * @param {string} html page
 * @param {FetchedRelease} fetched
 * @param {string} jiraUrl
 * @param {Date} now
 * @returns {string|null} changed html, null if the page has no release widget
 */
function refreshChangelogPage(html, fetched, jiraUrl, now) {
  const root = parseHtmlContent(html);
  const widget = root.querySelector('div.widget-jira-issues');
  if (!widget) return null;
  widget.replaceWith(renderIssuesWidget(fetched, jiraUrl, now));
  root
    .querySelector('table.widget-jira-info')
    ?.replaceWith(renderInfoTable(fetched, jiraUrl));
  return root.toString();
}

/**
 * Adds the release as first row of the overview table (newest first).
 *
 * @param {string} html overview page
 * @param {FetchedRelease} fetched
 * @param {string} jiraUrl
 * @returns {string|null} changed html, null if there is no overview table or the release is listed
 */
function addOverviewRow(html, { project, release, issues }, jiraUrl) {
  const config = PROJECTS[project];
  const file = path.basename(changelogPagePath(project, release.name), '.html');
  const tableStart = html.indexOf('<th>Title</th>');
  if (tableStart === -1 || html.includes(`href="${file}"`)) return null;
  const tbody = html.indexOf('<tbody>', tableStart);
  if (tbody === -1) return null;

  const date = release.releaseDate
    ? formatDate(
        release.releaseDate,
        { day: 'numeric', month: 'short', year: 'numeric' },
        'en-GB',
      )
    : '&nbsp;';
  const row = `
    <tr>
      <td><a href="${file}">${escapeHtml(`${config.title} ${release.name}`)}</a></td>
      <td>${date}</td>
      <td><p><a href="${searchUrl(jiraUrl, project, release.name)}" target="_blank">${issueCount(issues.length)}</a></p></td>
      <td>&nbsp;</td>
      <td>${statusLozenge(release)}</td>
      <td>${escapeHtml(release.name)}</td>
      <td>&nbsp;</td>
    </tr>`;
  const insertAt = tbody + '<tbody>'.length;
  return html.slice(0, insertAt) + row + html.slice(insertAt);
}

/**
 * @param {{released: string, refreshed: string}} widget data attributes
 * @param {Date} now
 * @returns {boolean} the release is unreleased or released less than REFRESH_DAYS ago
 */
function isDue({ released }, now) {
  if (!released) return true;
  const end = new Date(`${released}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return false;
  end.setUTCDate(end.getUTCDate() + REFRESH_DAYS);
  return now <= end;
}

/**
 * @param {string|undefined} value comma separated project keys
 * @returns {Set<string>|null} null if not set
 */
function allowedProjects(value) {
  if (!value) return null;
  return new Set(value.split(',').map((k) => k.trim()));
}

/**
 * @param {string} html page
 * @returns {{project: string, version: string, released: string, refreshed: string}|null}
 * data attributes of the release widget
 */
function readWidget(html) {
  if (!html.includes('widget-jira-issues')) return null;
  const widget = parseHtmlContent(html).querySelector('div.widget-jira-issues');
  if (!widget) return null;
  return {
    project: widget.getAttribute('data-project') ?? '',
    version: widget.getAttribute('data-version') ?? '',
    released: widget.getAttribute('data-released') ?? '',
    refreshed: widget.getAttribute('data-refreshed') ?? '',
  };
}

/**
 * @param {object} options
 * @param {string} options.root
 * @param {string} options.project
 * @param {string} options.version
 * @param {(key: string) => boolean} options.allowed
 * @returns {{request?: PlanRequest, error?: string}}
 */
function planNewRelease({ root, project, version, allowed }) {
  if (!allowed(project)) {
    return { error: `JIRA_PROJECT ${project} is not an allowed project` };
  }
  if (!REGEX_VERSION.test(version)) {
    return { error: 'JIRA_VERSION is missing or contains invalid characters' };
  }
  const page = changelogPagePath(project, version);
  if (fs.existsSync(path.join(root, page))) {
    return { error: `${page} exists already` };
  }
  return { request: { project, version, page, mode: 'create' } };
}

/**
 * @param {object} options
 * @param {string} options.root
 * @param {(key: string) => boolean} options.allowed
 * @param {Date} options.now
 * @returns {Promise<{requests: PlanRequest[], warnings: string[]}>} due release widgets
 */
async function planRefreshes({ root, allowed, now }) {
  /** @type {PlanRequest[]} */
  const requests = [];
  /** @type {string[]} */
  const warnings = [];
  for (const [key, config] of Object.entries(PROJECTS)) {
    const dir = path.join(root, config.dir);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
    for (const file of files) {
      const page = `${config.dir}/${file}`;
      const data = readWidget(
        await fs.promises.readFile(path.join(root, page), encoding),
      );
      if (!data) continue;
      // a page may only ask for its own project (folder) and a valid version
      if (data.project !== key || !allowed(data.project)) {
        warnings.push(`${page}: project ${data.project} is not allowed here`);
      } else if (!REGEX_VERSION.test(data.version)) {
        warnings.push(`${page}: invalid version ${data.version}`);
      } else if (isDue(data, now)) {
        requests.push({ ...data, page, mode: 'refresh' });
      }
    }
  }
  return { requests, warnings };
}

/**
 * @param {object} options
 * @param {string} options.root repository root
 * @param {string} [options.project] new release
 * @param {string} [options.version] new release
 * @param {Set<string>|null} options.allowlist null: all mapped projects
 * @param {Date} options.now
 * @returns {Promise<{requests: PlanRequest[], errors: string[], warnings: string[]}>}
 */
async function planReleases({ root, project, version, allowlist, now }) {
  const allowed = (/** @type {string} */ key) =>
    !!PROJECTS[key] && (!allowlist || allowlist.has(key));
  /** @type {string[]} */
  const errors = [];
  /** @type {PlanRequest[]} */
  const requests = [];
  if (project || version) {
    const planned = planNewRelease({
      root,
      project: project ?? '',
      version: version ?? '',
      allowed,
    });
    if (planned.error) errors.push(planned.error);
    if (planned.request) requests.push(planned.request);
  }
  const refreshes = await planRefreshes({ root, allowed, now });
  requests.push(...refreshes.requests);
  return { requests, errors, warnings: refreshes.warnings };
}

/**
 * Step 1: writes the plan (JIRA_PLAN).
 *
 * @param {string} root
 * @returns {Promise<number>} errors
 */
async function jiraPlan(root = process.cwd()) {
  const { requests, errors, warnings } = await planReleases({
    root,
    project: process.env.JIRA_PROJECT,
    version: process.env.JIRA_VERSION,
    allowlist: allowedProjects(process.env.JIRA_PROJECTS),
    now: new Date(),
  });
  warnings.forEach((w) => console.warn('⚠️', w));
  errors.forEach((e) => console.error('🚨', e));
  const planPath = process.env.JIRA_PLAN || DEFAULT_PLAN;
  await fs.promises.writeFile(planPath, JSON.stringify({ requests }, null, 2));
  console.log(
    'Planned',
    requests.length,
    'release(s):',
    requests.map((r) => `${r.project} ${r.version} (${r.mode})`).join(', ') ||
      'none',
  );
  return errors.length;
}

/**
 * @param {string} filePath
 * @param {string} html
 */
async function writeFormatted(filePath, html) {
  await fs.promises.writeFile(
    filePath,
    await formatHtml(html, filePath),
    encoding,
  );
}

/**
 * @param {string} root
 * @param {PlanRequest} request
 * @param {FetchedRelease} fetched
 * @param {string} jiraUrl
 * @param {Date} now
 * @returns {Promise<number>} errors
 */
async function createReleasePage(root, request, fetched, jiraUrl, now) {
  const config = PROJECTS[fetched.project];
  const pagePath = path.join(root, request.page);
  if (fs.existsSync(pagePath)) {
    console.error('🚨', request.page, 'exists already');
    return 1;
  }
  await writeFormatted(pagePath, renderChangelogPage(fetched, jiraUrl, now));
  console.log('Created', request.page, `(${fetched.issues.length} issues) 📝`);

  // the overview lists the releases in a table or as child page list
  const overviewPath = path.join(root, `${config.dir}.html`);
  const overview = await fs.promises.readFile(overviewPath, encoding);
  const updated = addOverviewRow(overview, fetched, jiraUrl);
  if (updated) {
    await writeFormatted(overviewPath, updated);
    console.log('Added the release to', `${config.dir}.html`);
  } else {
    await refreshPageHierarchy([overviewPath]);
  }
  return 0;
}

/**
 * @param {string} root
 * @param {PlanRequest} request
 * @param {FetchedRelease} fetched
 * @param {string} jiraUrl
 * @param {Date} now
 */
async function refreshReleasePage(root, request, fetched, jiraUrl, now) {
  const pagePath = path.join(root, request.page);
  const html = await fs.promises.readFile(pagePath, encoding);
  const updated = refreshChangelogPage(html, fetched, jiraUrl, now);
  if (!updated) return;
  await writeFormatted(pagePath, updated);
  console.log(
    'Refreshed',
    request.page,
    `(${fetched.issues.length} issues) 🔄`,
  );
}

/**
 * Step 3: creates / refreshes the pages from the fetched data (JIRA_DATA).
 *
 * @param {string} root
 * @returns {Promise<number>} errors
 */
async function jiraRender(root = process.cwd()) {
  const planPath = process.env.JIRA_PLAN || DEFAULT_PLAN;
  const dataPath = process.env.JIRA_DATA || DEFAULT_DATA;
  /** @type {{requests: PlanRequest[]}} */
  const plan = JSON.parse(await fs.promises.readFile(planPath, encoding));
  /** @type {{jiraUrl: string, releases: FetchedRelease[]}} */
  const data = JSON.parse(await fs.promises.readFile(dataPath, encoding));
  const now = new Date();
  let errors = 0;

  for (const fetched of data.releases) {
    const name = `${fetched.project} ${fetched.release.name}`;
    const request = plan.requests.find(
      (r) =>
        r.project === fetched.project && r.version === fetched.release.name,
    );
    const config = PROJECTS[fetched.project];
    // the page must belong to the project, whatever the data files say
    if (!request || !config || !request.page.startsWith(`${config.dir}/`)) {
      console.error('🚨 Unexpected release', name);
      errors++;
      continue;
    }
    if (fetched.hidden) {
      console.warn(
        `⚠️ ${name}: ${fetched.hidden} ticket(s) with a security level left out`,
      );
    }
    if (!fetched.issues.length) {
      console.warn(
        `⚠️ ${name} has no tickets (fix version not set on the issues?)`,
      );
    }
    if (request.mode === 'create') {
      errors += await createReleasePage(
        root,
        request,
        fetched,
        data.jiraUrl,
        now,
      );
    } else {
      await refreshReleasePage(root, request, fetched, data.jiraUrl, now);
    }
  }
  return errors;
}

/**
 * Local shortcut: plan, fetch (separate process, reads the token from .env
 * itself) and render.
 *
 * @param {string} root
 * @returns {Promise<number>} errors
 */
async function jiraChangelog(root = process.cwd()) {
  const errors = await jiraPlan(root);
  if (errors) return errors;
  const planPath = process.env.JIRA_PLAN || DEFAULT_PLAN;
  const dataPath = process.env.JIRA_DATA || DEFAULT_DATA;
  const fetched = spawnSync(
    process.execPath,
    [FETCH_SCRIPT, planPath, dataPath],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (fetched.status !== 0) return 1;
  return jiraRender(root);
}

export {
  PROJECTS,
  REFRESH_DAYS,
  escapeHtml,
  changelogPagePath,
  renderChangelogPage,
  refreshChangelogPage,
  addOverviewRow,
  isDue,
  planReleases,
  jiraPlan,
  jiraRender,
  jiraChangelog,
};
