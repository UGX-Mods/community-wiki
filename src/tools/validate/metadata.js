/**
 * Metadata validation: wiki.js page header and file name.
 * Missing header / title are errors, everything else is reported as warning.
 */
import { readPage, stripPageExtension } from '../lib/pages.js';
import { PAGE_HEADER_FIELDS, parsePageHeader } from '../lib/header.js';
import { isMarkdownPage } from '../lib/markdown.js';

// https://docs.requarks.io/guide/pages#naming-restrictions
const REGEX_VALID_PAGE_PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * @param {string} filePath page path relative to the repository root
 * @param {string} fileContent
 * @returns {{errors: string[], warnings: string[]}}
 */
function checkPageMetadata(filePath, fileContent) {
  const errors = [];
  const warnings = [];

  const markdown = isMarkdownPage(filePath);
  const meta = parsePageHeader(fileContent, markdown);
  if (!meta) {
    errors.push(
      markdown
        ? 'Missing wiki.js front matter at top of file'
        : 'Missing wiki.js page header comment at top of file',
    );
  } else {
    if (!meta.title) errors.push('Missing or empty "title"');
    const missing = PAGE_HEADER_FIELDS.filter((k) => !(k in meta));
    if (missing.length) warnings.push(`Missing fields: ${missing}`);
    if ('published' in meta && !['true', 'false'].includes(meta.published)) {
      errors.push(`Invalid "published" value: ${meta.published}`);
    }
    if ('description' in meta && !meta.description) {
      warnings.push('Empty "description"');
    }
    const editor = markdown ? 'markdown' : 'ckeditor';
    if (meta.editor && meta.editor !== editor) {
      warnings.push(`"editor" should be ${editor}, not ${meta.editor}`);
    }
  }

  const invalidSegments = stripPageExtension(filePath)
    .split(/[\\/]/)
    .filter((s) => !REGEX_VALID_PAGE_PATH_SEGMENT.test(s));
  if (invalidSegments.length) {
    warnings.push(
      `Path segment(s) violate wiki.js naming restrictions: ${invalidSegments}`,
    );
  }

  return { errors, warnings };
}

/**
 * @param {string[]} files
 * @returns {Promise<number>} amount of errors
 */
async function metadataValidation(files) {
  const verbose = !!process.env.VERBOSE;
  let errors = 0;
  let warnings = 0;
  for (const filePath of files) {
    const fileContent = await readPage(filePath);
    if (fileContent === null) continue;

    const result = checkPageMetadata(filePath, fileContent);

    if (result.errors.length) {
      errors += result.errors.length;
      console.error('## File', filePath, 'has metadata errors!', result.errors);
    }
    if (result.warnings.length && verbose) {
      console.warn(
        '## File',
        filePath,
        'has metadata warnings',
        result.warnings,
      );
    }
    warnings += result.warnings.length;
  }

  if (warnings > 0) {
    console.warn(
      `⚠️ ${warnings} metadata warning(s)` +
        (verbose ? '' : ' (set VERBOSE=1 to list them)'),
    );
  }
  if (errors > 0) {
    console.error('🚨 Found', errors, 'metadata errors!');
  }

  return errors;
}

export { checkPageMetadata, metadataValidation };
