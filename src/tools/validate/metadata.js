/**
 * Metadata validation: wiki.js page header and file name.
 * Missing header / title are errors, everything else is reported as warning.
 */
import { readPage, stripPageExtension } from '../lib/pages.js';
import {
  PAGE_HEADER_FIELDS,
  parsePageHeader,
  checkDescription,
} from '../lib/header.js';
import { isMarkdownPage } from '../lib/markdown.js';
import { AI_TAG, parseTags, isKnownTag } from '../lib/tags.js';

const REGEX_AI_BANNER = /class="[^"]*\bbanner-ai\b/;

// https://docs.requarks.io/guide/pages#naming-restrictions
const REGEX_VALID_PAGE_PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * AI-generated pages must be marked for readers (banner) and for search (tag).
 *
 * @param {string|undefined} tags tags field of the page header
 * @param {string} fileContent
 * @param {boolean} markdown
 * @returns {string|null} error
 */
function checkAiMarking(tags, fileContent, markdown) {
  const aiTag = parseTags(tags).includes(AI_TAG);
  // code examples (e.g. the banner in AGENTS.md) don't count
  const aiBanner = REGEX_AI_BANNER.test(
    markdown ? fileContent.replace(/```[\s\S]*?```/g, '') : fileContent,
  );
  if (aiTag && !aiBanner) {
    return `Tag "${AI_TAG}" without the AI banner (class banner-ai)`;
  }
  if (aiBanner && !aiTag) {
    return `AI banner (class banner-ai) without the tag "${AI_TAG}"`;
  }
  return null;
}

/**
 * @param {Record<string, string>} meta parsed page header
 * @param {boolean} markdown
 * @param {string[]} errors collects the errors
 * @param {string[]} warnings collects the warnings
 */
function checkHeaderFields(meta, markdown, errors, warnings) {
  if (!meta.title) errors.push('Missing or empty "title"');
  const missing = PAGE_HEADER_FIELDS.filter((k) => !(k in meta));
  if (missing.length) warnings.push(`Missing fields: ${missing}`);
  if ('published' in meta && !['true', 'false'].includes(meta.published)) {
    errors.push(`Invalid "published" value: ${meta.published}`);
  }
  if ('description' in meta && !meta.description) {
    warnings.push('Empty "description"');
  } else if (meta.description) {
    const problem = checkDescription(meta.description);
    if (problem) warnings.push(`"description" ${problem}`);
  }
  const editor = markdown ? 'markdown' : 'ckeditor';
  if (meta.editor && meta.editor !== editor) {
    warnings.push(`"editor" should be ${editor}, not ${meta.editor}`);
  }
  const unknownTags = parseTags(meta.tags).filter((t) => !isKnownTag(t));
  if (unknownTags.length) {
    warnings.push(`Tags outside the tag set: ${unknownTags.join(', ')}`);
  }
}

/**
 * @param {string} filePath page path relative to the repository root
 * @param {string} fileContent
 * @returns {{errors: string[], warnings: string[]}}
 */
function checkPageMetadata(filePath, fileContent) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
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
    checkHeaderFields(meta, markdown, errors, warnings);
    const aiError = checkAiMarking(meta.tags, fileContent, markdown);
    if (aiError) errors.push(aiError);
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
