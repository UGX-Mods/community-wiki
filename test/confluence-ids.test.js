import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { checkConfluenceIds } from '../src/tools/validate/confluence.js';
import { getPageFiles } from '../src/tools/lib/pages.js';

test('checkConfluenceIds reports missing pages and invalid ids', () => {
  const files = [path.join('Modding', 'Zones.html'), 'Home.md'];
  assert.deepEqual(
    checkConfluenceIds({ 'Modding/Zones': 123, Home: 1 }, files),
    [],
  );
  assert.deepEqual(
    checkConfluenceIds({ 'Modding/Old-Name': 123, Home: 0 }, files),
    [
      'Modding/Old-Name: page not found (renamed or moved?)',
      'Home: invalid id 0',
    ],
  );
});

test('every entry of src/theme/confluence-ids.json points to a page', async () => {
  const ids = JSON.parse(
    fs.readFileSync('src/theme/confluence-ids.json', 'utf8'),
  );
  assert.deepEqual(checkConfluenceIds(ids, await getPageFiles()), []);
});
