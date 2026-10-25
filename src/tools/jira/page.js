/**
 * Format of the changelog pages: one wrapper with the release data and the
 * sections of a release, in this order:
 *
 * <div class="widget-jira-changelog" data-project data-version data-released data-refreshed>
 *   <table class="widget-jira-info">   generated rows (Date, Issues, Status, Version)
 *                                      + hand-written rows (Version Mode, ...)
 *   <div class="changelog-summary">          hand-written
 *   <div class="changelog-highlights">       hand-written
 *   <div class="changelog-tickets">          generated ticket table (.widget-jira-issues)
 *   <div class="changelog-known-issues">     hand-written
 *   <div class="changelog-special-thanks">   hand-written (default text)
 *   <div class="changelog-whats-next">       hand-written
 * </div>
 *
 * Only the generated parts are ever replaced. Hand-written sections and rows are
 * kept as they are, missing sections are added with a default, unknown sections
 * (e.g. "Did you know...?") stay in the section they follow. Nothing outside the
 * wrapper is touched.
 */
import { HTMLParser, escapeHtml, parseHtmlContent } from '../lib/html.js';

const ICONS = '/attachments/icons/jira';

/** info table rows that come from Jira, all others are hand-written */
const GENERATED_ROWS = ['Date', 'Issues', 'Status', 'Version'];

/**
 * @typedef {object} Section
 * @property {string} key
 * @property {string} id heading id of new pages
 * @property {string} title heading of new pages
 * @property {RegExp} match headings of existing pages
 * @property {(ctx: {releaseDescription: string}) => string} content default content
 */

/** @type {Section[]} */
const SECTIONS = [
  {
    key: 'summary',
    id: 'changelog-summary',
    title: 'Summary',
    match: /^summary$/i,
    content: ({ releaseDescription }) =>
      releaseDescription
        ? `<p>${escapeHtml(releaseDescription)}</p>`
        : '<p>Release notes will follow.</p>',
  },
  {
    key: 'highlights',
    id: 'important-highlights',
    title: 'Important highlights from this release',
    match: /^important highlights/i,
    content: () => '<p>See all tickets below.</p>',
  },
  {
    key: 'tickets',
    id: 'all-tickets',
    title: 'All tickets for this release',
    match: /^all (tickets|updates) for this release$/i,
    content: () =>
      '<div class="widget-jira-issues"></div>\n<p>(Not all changes are listed here, always check the highlights above)</p>',
  },
  {
    key: 'known-issues',
    id: 'known-issues',
    title: 'Known issues',
    match: /^known issues$/i,
    content: () => '<p>There are no known issues.</p>',
  },
  {
    key: 'special-thanks',
    id: 'special-thanks',
    title: 'Special Thanks',
    match: /^special thanks$/i,
    content: () =>
      '<p>For your support and issue reports ❤️<br />Report issues / features via <a href="/Applications-and-Services/UGX-Mods-Discord-Server">Discord</a> or other report options.</p>',
  },
  {
    key: 'whats-next',
    id: 'whats-next',
    title: 'Whats next?',
    match: /^what'?s next\??$/i,
    content: () =>
      '<p>To get a complete overview of our development plans, visit <a href="https://www.ugx-mods.com/roadmap" target="_blank">https://www.ugx-mods.com/roadmap</a></p>',
  },
];

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

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** @typedef {import('../../jira-fetch.js').Release} Release */
/** @typedef {import('../../jira-fetch.js').Issue} Issue */

/**
 * @typedef {object} FetchedRelease
 * @property {string} project
 * @property {Release} release
 * @property {Issue[]} issues
 * @property {number} hidden tickets left out because of a security level
 */

/**
 * @typedef {object} ChangelogData data attributes of the wrapper
 * @property {string} project
 * @property {string} version
 * @property {string} released YYYY-MM-DD, empty while unreleased
 * @property {string} refreshed YYYY-MM-DD of the last refresh, empty if never
 */

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
 * @param {string} text e.g. "29 May 2024" or "10 March 2019"
 * @returns {string} YYYY-MM-DD or ''
 */
function parseReleaseDate(text) {
  // the old pages also have "02 Sep2018"
  const m = /(\d{1,2})\s+([A-Za-z]+)\s*(\d{4})/.exec(text);
  if (!m) return '';
  const month = MONTHS.findIndex((name) =>
    name.startsWith(m[2].toLowerCase().slice(0, 3)),
  );
  if (month === -1) return '';
  return new Date(Date.UTC(+m[3], month, +m[1])).toISOString().slice(0, 10);
}

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
 * @returns {string} the generated rows of the info table
 */
function renderInfoRows({ project, release, issues }, jiraUrl) {
  return `<tr><th>Date</th><td>${formatReleaseDate(release.releaseDate) || '&nbsp;'}</td></tr>
<tr><th>Issues</th><td><a href="${searchUrl(jiraUrl, project, release.name)}" target="_blank">${issueCount(issues.length)}</a></td></tr>
<tr><th>Status</th><td>${statusLozenge(release)}</td></tr>
<tr><th>Version</th><td>${escapeHtml(release.name)}</td></tr>`;
}

/**
 * @param {FetchedRelease} fetched
 * @param {string} jiraUrl
 * @returns {string} the generated ticket table
 */
function renderTicketTable({ issues }, jiraUrl) {
  return `<div class="widget-jira-issues" style="width: 100%; overflow: auto">
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
 * @param {Section} section
 * @param {string} releaseDescription
 * @returns {string} heading + default content
 */
function defaultSection(section, releaseDescription) {
  return `<h2 id="${section.id}">${section.title}</h2>\n${section.content({ releaseDescription })}`;
}

/**
 * @param {ChangelogData} data
 * @param {string} infoRows
 * @param {Record<string, string>} sections html per section key (heading included)
 * @param {string} releaseDescription for a missing summary
 * @returns {string} the wrapper
 */
function renderWrapper(data, infoRows, sections, releaseDescription) {
  const body = SECTIONS.map(
    (s) =>
      `<div class="changelog-${s.key}">\n${sections[s.key] ?? defaultSection(s, releaseDescription)}\n</div>`,
  ).join('\n');
  return `<div
  class="widget-jira-changelog"
  data-project="${escapeHtml(data.project)}"
  data-version="${escapeHtml(data.version)}"
  data-released="${escapeHtml(data.released)}"
  data-refreshed="${escapeHtml(data.refreshed)}">
<table class="widget-jira-info">
  <tbody>
${infoRows}
  </tbody>
</table>
${body}
</div>`;
}

/**
 * @param {FetchedRelease} fetched
 * @param {Date} now
 * @returns {ChangelogData}
 */
function dataOf({ project, release }, now) {
  return {
    project,
    version: release.name,
    released: release.released ? release.releaseDate : '',
    refreshed: now.toISOString().slice(0, 10),
  };
}

/**
 * @param {object} options
 * @param {FetchedRelease} options.fetched
 * @param {string} options.jiraUrl
 * @param {Date} options.now
 * @param {{title: string, tag: string}} options.page title prefix and product tag
 * @returns {string} new page html (unformatted)
 */
function renderChangelogPage({ fetched, jiraUrl, now, page }) {
  const { release } = fetched;
  const month = formatDate(
    release.releaseDate,
    { month: 'long', year: 'numeric' },
    'en-GB',
  );
  // description is YAML: no ": " or " #", see checkDescription
  const description = `Release notes of ${page.title} ${release.name}${month ? ` (${month})` : ''}`;
  const timestamp = now.toISOString();
  const tickets = `<h2 id="all-tickets">All tickets for this release</h2>\n${renderTicketTable(fetched, jiraUrl)}\n<p>(Not all changes are listed here, always check the highlights above)</p>`;
  const infoRows = `${renderInfoRows(fetched, jiraUrl)}\n<tr><th>Version Mode</th><td>&nbsp;</td></tr>`;

  return `<!--
title: ${page.title} ${release.name}
description: ${description}
published: true
date: ${timestamp}
tags: ${page.tag}, changelog
editor: ckeditor
dateCreated: ${timestamp}
-->

${renderWrapper(dataOf(fetched, now), infoRows, { tickets }, release.description)}
`;
}

/**
 * @param {HTMLParser.Node} node
 * @returns {boolean}
 */
function isElement(node) {
  return node instanceof HTMLParser.HTMLElement;
}

/**
 * @param {HTMLParser.Node} node
 * @returns {Section|undefined} known section of a h2 heading
 */
function sectionOfHeading(node) {
  if (!isElement(node)) return undefined;
  const el = /** @type {HTMLParser.HTMLElement} */ (node);
  if (el.rawTagName?.toLowerCase() !== 'h2') return undefined;
  const text = el.text.replace(/\s+/g, ' ').trim();
  return SECTIONS.find((s) => s.match.test(text));
}

/**
 * @typedef {object} ParsedChangelog
 * @property {string} header wiki.js header comment
 * @property {string} before content before the changelog
 * @property {string} after content after the changelog (wrapper format only)
 * @property {HTMLParser.HTMLElement|null} info info table
 * @property {Record<string, string>} sections html per section key
 * @property {ChangelogData|null} data data attributes (wrapper format only)
 */

/**
 * Hand-written content between the sections (e.g. an own h2 section) is kept
 * and stays after the section it follows.
 *
 * @param {HTMLParser.HTMLElement} wrapper div.widget-jira-changelog
 * @returns {{info: HTMLParser.HTMLElement|null, sections: Record<string, string>}}
 */
function readWrapper(wrapper) {
  /** @type {Record<string, string>} */
  const sections = {};
  /** @type {HTMLParser.HTMLElement|null} */
  let info = null;
  let current = '';
  /** @type {string[]} */
  let pending = [];
  for (const node of wrapper.childNodes) {
    const el = isElement(node)
      ? /** @type {HTMLParser.HTMLElement} */ (node)
      : null;
    const section = SECTIONS.find((s) =>
      el?.classList.contains(`changelog-${s.key}`),
    );
    if (el && !info && el.classList.contains('widget-jira-info')) {
      info = el;
    } else if (el && section) {
      current = section.key;
      sections[current] = [...pending, el.innerHTML.trim()].join('\n');
      pending = [];
    } else if (node.toString().trim()) {
      if (current) sections[current] += `\n${node.toString()}`;
      else pending.push(node.toString());
    }
  }
  if (pending.length) {
    sections.summary = [...pending, sections.summary ?? ''].join('\n');
  }
  return { info, sections };
}

/**
 * Reads a changelog page in the wrapper format or in the old format (info table
 * followed by h2 sections).
 *
 * @param {string} html
 * @returns {ParsedChangelog}
 */
function readChangelog(html) {
  const root = parseHtmlContent(html);
  const nodes = root.childNodes;
  const headerIndex = nodes.findIndex(
    (n) =>
      n.nodeType === HTMLParser.NodeType.COMMENT_NODE &&
      n.rawText.includes('title:'),
  );
  const header = headerIndex === -1 ? '' : nodes[headerIndex].toString();
  const rest = nodes.slice(headerIndex + 1);
  const wrapper = root.querySelector('div.widget-jira-changelog');

  if (wrapper) {
    const index = rest.indexOf(wrapper);
    return {
      header,
      before: rest.slice(0, index).join(''),
      after: rest.slice(index + 1).join(''),
      ...readWrapper(wrapper),
      data: {
        project: wrapper.getAttribute('data-project') ?? '',
        version: wrapper.getAttribute('data-version') ?? '',
        released: wrapper.getAttribute('data-released') ?? '',
        refreshed: wrapper.getAttribute('data-refreshed') ?? '',
      },
    };
  }

  // old format: the first table is the info table, then h2 sections
  const firstHeading = rest.findIndex((n) => sectionOfHeading(n));
  const infoIndex = rest.findIndex(
    (n, i) =>
      (firstHeading === -1 || i < firstHeading) &&
      isElement(n) &&
      /** @type {HTMLParser.HTMLElement} */ (n).rawTagName === 'table',
  );
  const info =
    infoIndex === -1
      ? null
      : /** @type {HTMLParser.HTMLElement} */ (rest[infoIndex]);
  /** @type {Record<string, string[]>} */
  const parts = {};
  /** @type {string[]} */
  const before = [];
  let current = '';
  rest.forEach((node, i) => {
    if (i === infoIndex) return;
    const section = sectionOfHeading(node);
    if (section) current = section.key;
    // unknown sections and content stay with the section they follow
    if (!current) before.push(node.toString());
    else (parts[current] ??= []).push(node.toString());
  });
  /** @type {Record<string, string>} */
  const sections = {};
  for (const [key, html] of Object.entries(parts)) {
    sections[key] = html.join('').trim();
  }
  return {
    header,
    before: before.join(''),
    after: '',
    info,
    sections,
    data: null,
  };
}

/**
 * @param {HTMLParser.HTMLElement|null} info
 * @returns {{generated: Record<string, string>, custom: string[]}} row html by
 * generated row name, hand-written rows
 */
function splitInfoRows(info) {
  /** @type {Record<string, string>} */
  const generated = {};
  /** @type {string[]} */
  const custom = [];
  for (const row of info?.querySelectorAll('tr') ?? []) {
    const name = row.querySelector('th')?.text.trim() ?? '';
    if (GENERATED_ROWS.includes(name)) generated[name] = row.toString();
    else custom.push(row.toString());
  }
  return { generated, custom };
}

/**
 * @param {string} sectionHtml tickets section of a page
 * @param {string} table new ticket table
 * @returns {string} the section with the ticket table replaced
 */
function replaceTicketTable(sectionHtml, table) {
  const root = parseHtmlContent(sectionHtml);
  const widget = root.querySelector('div.widget-jira-issues');
  if (widget) {
    widget.replaceWith(table);
    return root.toString();
  }
  // old pages: the first table, with its scroll wrapper if there is one
  const old = root.querySelector('table');
  if (!old) return `${sectionHtml}\n${table}`;
  const parent = old.parentNode;
  const target =
    parent && parent !== root && parent.rawTagName === 'div' ? parent : old;
  target.replaceWith(table);
  return root.toString();
}

/**
 * Refreshes the generated parts of a changelog page with data from Jira.
 *
 * @param {string} html page
 * @param {FetchedRelease} fetched
 * @param {string} jiraUrl
 * @param {Date} now
 * @returns {string|null} changed html, null if the page has no changelog wrapper
 */
function refreshChangelogPage(html, fetched, jiraUrl, now) {
  const page = readChangelog(html);
  if (!page.data) return null;
  const { custom } = splitInfoRows(page.info);
  const infoRows = [renderInfoRows(fetched, jiraUrl), ...custom].join('\n');
  const table = renderTicketTable(fetched, jiraUrl);
  const tickets = page.sections.tickets
    ? replaceTicketTable(page.sections.tickets, table)
    : `<h2 id="all-tickets">All tickets for this release</h2>\n${table}\n<p>(Not all changes are listed here, always check the highlights above)</p>`;
  const sections = { ...page.sections, tickets };
  return `${page.header}\n${page.before}${renderWrapper(dataOf(fetched, now), infoRows, sections, fetched.release.description)}${page.after}`;
}

/**
 * Converts an old changelog page into the wrapper format without asking Jira:
 * the info table and the ticket table stay as they are until a refresh.
 *
 * @param {string} html page
 * @param {string} project Jira project key
 * @returns {string|null} converted html, null if it is converted already or has
 * no version in the info table
 */
function adoptChangelogPage(html, project) {
  const page = readChangelog(html);
  if (page.data) return null;
  const { generated, custom } = splitInfoRows(page.info);
  const cell = (/** @type {string} */ name) =>
    parseHtmlContent(generated[name] ?? '')
      .querySelector('td')
      ?.text.trim() ?? '';
  // the query of the issues link has the Jira version, the Version row of some
  // old pages does not (e.g. "v0.7.0-donor-beta" on the v0.7.0-open-beta page)
  const href =
    parseHtmlContent(generated.Issues ?? '')
      .querySelector('a')
      ?.getAttribute('href') ?? '';
  let query = '';
  try {
    query = decodeURIComponent(href.replaceAll('+', ' '));
  } catch (_) {
    // not encoded
  }
  const version =
    /fixVersion\s*=\s*"?([\w.+-]+)"?/.exec(query)?.[1] ?? cell('Version');
  if (!version) return null;
  // old pages are released: a date that can not be read freezes the page until
  // a forced refresh sets the date from Jira
  const released = parseReleaseDate(cell('Date')) || 'unknown';
  const infoRows = [
    ...GENERATED_ROWS.map((name) => generated[name]).filter(Boolean),
    ...custom,
  ].join('\n');
  const data = { project, version, released, refreshed: '' };
  return `${page.header}\n${page.before}${renderWrapper(data, infoRows, page.sections, '')}`;
}

/**
 * @param {string} html
 * @returns {ChangelogData|null} data attributes of the changelog wrapper
 */
function readChangelogData(html) {
  if (!html.includes('widget-jira-changelog')) return null;
  return readChangelog(html).data;
}

export {
  SECTIONS,
  escapeHtml,
  formatDate,
  searchUrl,
  statusLozenge,
  issueCount,
  parseReleaseDate,
  readChangelog,
  readChangelogData,
  renderChangelogPage,
  refreshChangelogPage,
  adoptChangelogPage,
};
