import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAltTexts } from '../src/tools/content/alt-texts.js';

const alts = {
  '/attachments/a.png': 'Settings window, "Account" tab',
  '/attachments/b.png': 'Network settings',
  '/attachments/c.png': 'Interface settings',
  '/attachments/d.png': 'Should not replace',
};

test('applyAltTexts sets missing, empty and boolean alt attributes', () => {
  const { content, changed } = applyAltTexts(
    [
      '<img src="/attachments/a.png" alt />',
      '<img\n  width="480"\n  src="/attachments/b.png"\n  alt="" />',
      '<img src="/attachments/c.png">',
      '<img src="/attachments/d.png" alt="Existing text" />',
      '<img src="/attachments/unknown.png" alt />',
    ].join('\n'),
    alts,
  );
  assert.equal(changed, 3);
  assert.equal(
    content,
    [
      '<img src="/attachments/a.png" alt="Settings window, &quot;Account&quot; tab" />',
      '<img\n  width="480"\n  src="/attachments/b.png"\n  alt="Network settings" />',
      '<img src="/attachments/c.png" alt="Interface settings">',
      '<img src="/attachments/d.png" alt="Existing text" />',
      '<img src="/attachments/unknown.png" alt />',
    ].join('\n'),
  );
});
