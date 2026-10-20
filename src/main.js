/**
 * Tooling CLI for the wiki: validation, page hierarchy widgets and the confluence migration helpers.
 * The steps are implemented in ./tools, the theme sources are in ./theme
 */
const fs = require('node:fs');
const path = require('node:path');
const { select, Separator } = require('@inquirer/prompts');
const { getPageFiles, isPage, HTML_EXTENSION } = require('./tools/lib/pages');
const {
  setupPageHierarchy,
  refreshPageHierarchy,
} = require('./tools/hierarchy');
const { validateAllLinks } = require('./tools/validate/links');
const { securityValidation } = require('./tools/validate/security');
const { metadataValidation } = require('./tools/validate/metadata');
const {
  fixFileNames,
  fixNumberFileNameOnly,
} = require('./tools/confluence/filenames');
const {
  cleanupConfluenceHtml,
  fixCodeBlocks,
} = require('./tools/confluence/cleanup');
const { addConfluenceCommentAsTag } = require('./tools/confluence/ids');
const { deployTheme } = require('./tools/theme');

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
