/**
 * Tooling CLI for the wiki: validation, page hierarchy widgets and the confluence migration helpers.
 * The steps are implemented in ./tools, the theme sources are in ./theme
 */
import fs from 'node:fs';
import path from 'node:path';
import { select, Separator } from '@inquirer/prompts';
import { getPageFiles, isPage, HTML_EXTENSION } from './tools/lib/pages.js';
import { setupPageHierarchy, refreshPageHierarchy } from './tools/hierarchy.js';
import { validateAllLinks } from './tools/validate/links.js';
import { securityValidation } from './tools/validate/security.js';
import { metadataValidation } from './tools/validate/metadata.js';
import {
  fixFileNames,
  fixNumberFileNameOnly,
} from './tools/confluence/filenames.js';
import {
  cleanupConfluenceHtml,
  fixCodeBlocks,
} from './tools/confluence/cleanup.js';
import { addConfluenceCommentAsTag } from './tools/confluence/ids.js';
import { deployTheme } from './tools/theme.js';
import { localizeJiraIcons } from './tools/content/jira-icons.js';
import { demotePageHeadings } from './tools/content/headings.js';
import { mirrorImages } from './tools/content/mirror-images.js';
import { renameImages } from './tools/content/rename-images.js';
import { setAltTexts } from './tools/content/alt-texts.js';

const STEPS = {
  none: 'NONE',
  createHierarchy: 'create-hierarchy',
  refreshHierarchy: 'refresh-hierarchy',
  deployTheme: 'deploy-theme',
  validate: 'validate',
  linkValidation: 'link-validation',
  securityValidation: 'security-validation',
  metadataValidation: 'metadata-validation',
  confluenceFixFilenames: 'confluence-fix-filenames',
  confluenceCleanup: 'confluence-cleanup',
  confluenceId: 'confluence-id',
  jiraIcons: 'jira-icons',
  demoteHeadings: 'demote-headings',
  mirrorImages: 'mirror-images',
  renameImages: 'rename-images',
  altTexts: 'alt-texts',
};

const STEP_CHOICES = [
  { value: STEPS.none, name: 'Nothing', description: 'Do nothing :D' },
  {
    value: STEPS.createHierarchy,
    name: 'CREATE: Page Hierarchy',
    description: 'Create a page hierarchy from parent to child pages',
  },
  {
    value: STEPS.refreshHierarchy,
    name: 'REFRESH: Page Hierarchies',
    description: 'Update all widgets with latest links',
  },
  {
    value: STEPS.deployTheme,
    name: 'DEPLOY: Theme',
    description:
      'Deploy wiki.min.css / wiki.min.js via the wiki.js API (WIKI_API_KEY, DRY_RUN=1)',
  },
  new Separator('--- VALIDATION ---'),
  {
    value: STEPS.validate,
    name: 'Validate everything',
    description: 'Runs link, security and metadata validation (used by CI)',
  },
  {
    value: STEPS.linkValidation,
    name: 'Link validation',
    description: 'Checks all href if they point to a valid file/folder',
  },
  {
    value: STEPS.securityValidation,
    name: 'Security validation',
    description: 'Does some security checks to ensure content is safe',
  },
  {
    value: STEPS.metadataValidation,
    name: 'Metadata validation',
    description:
      'Checks the wiki.js page header (title, description, ...) and the file name',
  },
  new Separator('--- CONTENT ---'),
  {
    value: STEPS.jiraIcons,
    name: 'Jira icons',
    description:
      'Point hotlinked Jira priority / issue type icons to attachments/icons/jira',
  },
  {
    value: STEPS.demoteHeadings,
    name: 'Demote headings',
    description:
      'Pages with <h1> in the body: shift all headings down one level (title is the h1)',
  },
  {
    value: STEPS.mirrorImages,
    name: 'Mirror images',
    description:
      'Download external Imgur images into attachments/ and link the copies (DRY_RUN=1)',
  },
  {
    value: STEPS.renameImages,
    name: 'Rename images',
    description:
      'Give images with meaningless names (imgur ids, hashes) names from alt text / heading (DRY_RUN=1)',
  },
  {
    value: STEPS.altTexts,
    name: 'Alt texts',
    description:
      'Set missing image alt texts from a JSON file (ALT_TEXTS=path, src -> alt)',
  },
  new Separator('--- Confluence Migration: ---'),
  {
    value: STEPS.confluenceCleanup,
    name: 'Cleanup files',
    description:
      '[confluence migration] cleanup files from confluence boilerplate & fix code blocks',
  },
  {
    value: STEPS.confluenceFixFilenames,
    name: 'Fix filenames',
    description: '[confluence migration] fix the filenames',
  },
  {
    value: STEPS.confluenceId,
    name: 'Confluence ID',
    description:
      '[confluence migration] will add the confluence id (if found) as a tag',
  },
];

function printUsage() {
  console.log('Usage: node src/main.js [step] [page.html|page.md ...]\n');
  console.log('Without a step an interactive menu is shown. Steps:');
  for (const choice of STEP_CHOICES) {
    if (choice instanceof Separator || choice.value === STEPS.none) continue;
    console.log(`  ${choice.value.padEnd(26)} ${choice.description}`);
  }
  console.log(
    '\nValidation steps accept an optional list of pages (default: all pages)' +
      '\nand exit with code 1 if errors were found.',
  );
}

async function main() {
  const [stepArg, ...fileArgs] = process.argv.slice(2);

  if (stepArg === '--help' || stepArg === '-h') {
    printUsage();
    return;
  }

  if (stepArg && !Object.values(STEPS).includes(stepArg)) {
    console.error(`Unknown step: ${stepArg}\n`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!stepArg && !process.stdin.isTTY) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const answer =
    stepArg ??
    (await select({
      message: 'What do you want to do?',
      choices: STEP_CHOICES,
    }));

  const files = fileArgs.length
    ? fileArgs
        .map((f) => path.normalize(f))
        .filter((f) => isPage(f) && fs.existsSync(f))
    : await getPageFiles();
  console.log('Found', files.length, 'pages 🔎');
  // the confluence migration only deals with exported html pages
  const htmlFiles = files.filter((f) => f.endsWith(HTML_EXTENSION));

  let errors = 0;
  switch (answer) {
    case STEPS.createHierarchy:
      await setupPageHierarchy(files);
      break;
    case STEPS.refreshHierarchy:
      await refreshPageHierarchy(files);
      break;
    case STEPS.deployTheme:
      errors += await deployTheme();
      break;
    case STEPS.validate:
      errors += await validateAllLinks(files);
      errors += await securityValidation(files);
      errors += await metadataValidation(files);
      break;
    case STEPS.linkValidation:
      errors += await validateAllLinks(files);
      break;
    case STEPS.securityValidation:
      errors += await securityValidation(files);
      break;
    case STEPS.metadataValidation:
      errors += await metadataValidation(files);
      break;
    case STEPS.confluenceFixFilenames:
      fixFileNames(htmlFiles);
      fixNumberFileNameOnly(htmlFiles);
      break;
    case STEPS.confluenceCleanup:
      await cleanupConfluenceHtml(htmlFiles);
      fixCodeBlocks(htmlFiles);
      break;
    case STEPS.jiraIcons:
      errors += await localizeJiraIcons(htmlFiles);
      break;
    case STEPS.demoteHeadings:
      errors += await demotePageHeadings(htmlFiles);
      break;
    case STEPS.mirrorImages:
      errors += await mirrorImages(files);
      break;
    case STEPS.renameImages:
      errors += await renameImages(files);
      break;
    case STEPS.altTexts:
      errors += await setAltTexts(files);
      break;
    case STEPS.confluenceId:
      await addConfluenceCommentAsTag(htmlFiles);
      break;
    case STEPS.none:
    default:
      console.log('NOOP - nothing changed 😴');
      return;
  }

  if (errors > 0) {
    console.error(`❌ Failed with ${errors} error(s)`);
    process.exitCode = 1;
  }
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
