/**
 * Finding and reading wiki pages (every .html and .md file is a wiki.js page)
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const encoding = 'utf8';

// folders which never contain wiki pages (.github: GitHub templates, github: their wiki.js re-export)
const IGNORED_DIRS = /(^|[\\/])(node_modules|\.git|\.github|github)([\\/]|$)/;

const HTML_EXTENSION = '.html';
const MARKDOWN_EXTENSION = '.md';
const PAGE_EXTENSIONS = [HTML_EXTENSION, MARKDOWN_EXTENSION];

/**
 * @param {string} filePath
 * @param {string[]} extensions
 */
function isPage(filePath, extensions = PAGE_EXTENSIONS) {
  return (
    extensions.some((ext) => filePath.endsWith(ext)) &&
    !IGNORED_DIRS.test(filePath)
  );
}

/**
 * Files of the repository: tracked and untracked, without git ignored files
 * (e.g. local notes). Falls back to all files if git is not available.
 *
 * @param {string} root
 * @returns {Promise<string[]>} paths relative to root (OS separator)
 */
async function listFiles(root) {
  try {
    return execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { cwd: root, encoding, stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .split('\0')
      .filter((f) => f && fs.existsSync(path.join(root, f)))
      .map((f) => f.split('/').join(path.sep));
  } catch (_) {
    return fs.promises.readdir(root, { recursive: true });
  }
}

/**
 * @param {string} root directory to search in
 * @param {string[]} extensions
 * @returns {Promise<string[]>} page paths relative to root
 */
async function getPageFiles(
  root = process.cwd(),
  extensions = PAGE_EXTENSIONS,
) {
  return (await listFiles(root)).filter((f) => isPage(f, extensions));
}

/**
 * @param {string} root directory to search in
 * @returns {Promise<string[]>} html page paths relative to root
 */
function getHtmlFiles(root = process.cwd()) {
  return getPageFiles(root, [HTML_EXTENSION]);
}

/**
 * Path of the page without extension, which is also the folder of its child pages
 *
 * @param {string} filePath
 * @returns {string}
 */
function stripPageExtension(filePath) {
  const ext = PAGE_EXTENSIONS.find((e) => filePath.endsWith(e));
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

/**
 * Pages which have a folder with child pages
 *
 * @param {string[]} files
 * @returns {string[]}
 */
function filterPagesWithChildren(files) {
  return files.filter((f) => {
    try {
      fs.accessSync(stripPageExtension(f));
      return true;
    } catch (_) {
      return false;
    }
  });
}

/**
 * @param {string} filePath
 * @returns {Promise<string|null>} file content or null (error is logged)
 */
function readPage(filePath) {
  return fs.promises.readFile(filePath, encoding).catch((err) => {
    console.error(err);
    return null;
  });
}

module.exports = {
  encoding,
  IGNORED_DIRS,
  HTML_EXTENSION,
  MARKDOWN_EXTENSION,
  PAGE_EXTENSIONS,
  isPage,
  getPageFiles,
  getHtmlFiles,
  stripPageExtension,
  filterPagesWithChildren,
  readPage,
};
