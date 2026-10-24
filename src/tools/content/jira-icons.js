/**
 * Jira icons (priority / issue type) in the changelogs are hotlinked from Jira Cloud.
 * This step points them to the local copies in attachments/icons/jira/.
 */
import fs from 'node:fs';
import { encoding, readPage } from '../lib/pages.js';

const JIRA = 'https://ugxmods.atlassian.net';
const ISSUE_TYPE = `${JIRA}/rest/api/2/universal_avatar/view/type/issuetype/avatar`;
const LOCAL = '/attachments/icons/jira';

/** @type {Record<string, string>} Jira Cloud icon url -> local icon */
const JIRA_ICONS = {
  [`${JIRA}/images/icons/priorities/blocker.svg`]: `${LOCAL}/priority-blocker.svg`,
  [`${JIRA}/images/icons/priorities/critical.svg`]: `${LOCAL}/priority-critical.svg`,
  [`${JIRA}/images/icons/priorities/major.svg`]: `${LOCAL}/priority-major.svg`,
  [`${JIRA}/images/icons/priorities/minor.svg`]: `${LOCAL}/priority-minor.svg`,
  [`${JIRA}/images/icons/priorities/trivial.svg`]: `${LOCAL}/priority-trivial.svg`,
  [`${ISSUE_TYPE}/10303?size=medium`]: `${LOCAL}/type-bug.svg`,
  [`${ISSUE_TYPE}/10306?size=medium`]: `${LOCAL}/type-change.svg`,
  [`${ISSUE_TYPE}/10308?size=medium`]: `${LOCAL}/type-crash-report.svg`,
  [`${ISSUE_TYPE}/10309?size=medium`]: `${LOCAL}/type-feedback.svg`,
  [`${ISSUE_TYPE}/10310?size=medium`]: `${LOCAL}/type-improvement.svg`,
  [`${ISSUE_TYPE}/10311?size=medium`]: `${LOCAL}/type-new-feature.svg`,
  [`${ISSUE_TYPE}/10315?size=medium`]: `${LOCAL}/type-story.svg`,
  [`${ISSUE_TYPE}/10316?size=medium`]: `${LOCAL}/type-sub-task.svg`,
  [`${ISSUE_TYPE}/10318?size=medium`]: `${LOCAL}/type-task.svg`,
};

/**
 * Replaces the src of known Jira icons. Plain string replacement, so the rest
 * of the page (formatting included) stays untouched.
 *
 * @param {string} content page source
 * @returns {{content: string, replaced: number, unknown: string[]}}
 */
function replaceJiraIcons(content) {
  let replaced = 0;
  const result = content.replace(
    /src="(https:\/\/ugxmods\.atlassian\.net\/[^"]+)"/g,
    (match, url) => {
      const local = JIRA_ICONS[url.replace(/&amp;/g, '&')];
      if (!local) return match;
      replaced++;
      return `src="${local}"`;
    },
  );
  const unknown = [
    ...result.matchAll(
      /<img[^>]*src="(https:\/\/ugxmods\.atlassian\.net[^"]+)"/g,
    ),
  ].map((m) => m[1]);
  return { content: result, replaced, unknown };
}

/**
 * @param {string[]} files html pages
 * @returns {Promise<number>} amount of pages with unknown Jira images (errors)
 */
async function localizeJiraIcons(files) {
  let pages = 0;
  let icons = 0;
  let unknownPages = 0;
  for (const filePath of files) {
    const data = await readPage(filePath);
    if (!data) continue;

    const { content, replaced, unknown } = replaceJiraIcons(data);
    if (unknown.length) {
      unknownPages++;
      console.warn('⚠️ Unknown Jira images @', filePath, [...new Set(unknown)]);
    }
    if (!replaced) continue;

    await fs.promises.writeFile(filePath, content, encoding);
    pages++;
    icons += replaced;
  }

  console.log('Replaced', icons, 'Jira icons in', pages, 'pages 🎫');
  return unknownPages;
}

export { JIRA_ICONS, replaceJiraIcons, localizeJiraIcons };
