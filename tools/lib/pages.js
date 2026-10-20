/**
 * Finding and reading wiki pages (every .html file is a wiki.js page)
 */
const fs = require('node:fs');

const encoding = 'utf8';

// folders which never contain wiki pages
const IGNORED_DIRS = /(^|[\\/])(node_modules|\.git|github)([\\/]|$)/;

const PAGE_EXTENSION = '.html';

/**
 * @param {string} root directory to search in
 * @returns {Promise<string[]>} page paths relative to root
 */
async function getHtmlFiles(root = process.cwd()) {
  return (await fs.promises.readdir(root, { recursive: true })).filter(
    (f) => !IGNORED_DIRS.test(f) && f.endsWith(PAGE_EXTENSION),
  );
}

/**
 * Path of the page without extension, which is also the folder of its child pages
 *
 * @param {string} filePath
 * @returns {string}
 */
function stripPageExtension(filePath) {
  return filePath.endsWith(PAGE_EXTENSION)
    ? filePath.slice(0, -PAGE_EXTENSION.length)
    : filePath;
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
  PAGE_EXTENSION,
  getHtmlFiles,
  stripPageExtension,
  filterPagesWithChildren,
  readPage,
};
