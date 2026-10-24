import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  JIRA_ICONS,
  replaceJiraIcons,
} from '../src/tools/content/jira-icons.js';

const ISSUE_TYPE =
  'https://ugxmods.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar';

test('replaceJiraIcons points known icons to the local copies', () => {
  const { content, replaced, unknown } = replaceJiraIcons(
    `<img
  class="icon"
  src="${ISSUE_TYPE}/10303?size=medium"
  alt="Bug" />
<img src="https://ugxmods.atlassian.net/images/icons/priorities/minor.svg" alt="Minor" />
<a href="https://ugxmods.atlassian.net/browse/UGXL-1">UGXL-1</a>`,
  );
  assert.equal(replaced, 2);
  assert.deepEqual(unknown, []);
  assert.match(content, /src="\/attachments\/icons\/jira\/type-bug\.svg"/);
  assert.match(
    content,
    /src="\/attachments\/icons\/jira\/priority-minor\.svg"/,
  );
  // issue links stay
  assert.match(
    content,
    /href="https:\/\/ugxmods\.atlassian\.net\/browse\/UGXL-1"/,
  );
});

test('replaceJiraIcons reports unknown Jira images', () => {
  const url = `${ISSUE_TYPE}/99999?size=medium`;
  const { replaced, unknown } = replaceJiraIcons(`<img src="${url}" alt="" />`);
  assert.equal(replaced, 0);
  assert.deepEqual(unknown, [url]);
});

test('every mapped icon exists in attachments', () => {
  for (const local of Object.values(JIRA_ICONS)) {
    assert.ok(fs.existsSync(`.${local}`), local);
  }
});
