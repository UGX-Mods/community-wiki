/**
 * Images hotlinked from image hosts (imgur, gyazo) can vanish any time.
 * This step downloads them into attachments/ (stored with Git LFS) and points
 * the pages to the local copies. Dead images are reported and left as they are.
 *
 * Environment: DRY_RUN=1 only reports what would be downloaded
 */
import fs from 'node:fs';
import path from 'node:path';
import { encoding, readPage, stripPageExtension } from '../lib/pages.js';

// same short names as the existing attachments folders
/** @type {Record<string, string>} */
const FOLDER_NAMES = {
  'world-at-war-modtools': 'waw',
  'black-ops-3-modtools': 'bo3',
};

// direct image urls of the mirrored hosts
const REGEX_IMAGE_URL =
  /https?:\/\/(?:i\.imgur\.com|i\.gyazo\.com)\/[\w-]+\.(?:png|jpe?g|gif|webp)\b/gi;

/**
 * @param {string} pagePath page path relative to the repository root
 * @returns {string} attachments folder of the page (forward slashes)
 */
function getAttachmentFolder(pagePath) {
  const segments = stripPageExtension(pagePath)
    .split(/[\\/]/)
    .map((s) => s.toLowerCase())
    .map((s) => FOLDER_NAMES[s] ?? s)
    // asset paths: same characters as page names (e.g. "UGX-WeaponsEditor++")
    .map((s) =>
      s
        .split(/[^a-z0-9_-]+/)
        .filter(Boolean)
        .join('-'),
    );
  return ['attachments', ...segments].join('/');
}

/**
 * @param {string} content page source
 * @returns {string[]} unique hotlinked image urls of the mirrored hosts
 */
function findHotlinkedImages(content) {
  return [...new Set(content.match(REGEX_IMAGE_URL) ?? [])];
}

/**
 * @param {string} url
 * @returns {Promise<{data: Buffer} | {error: string}>}
 */
async function download(url) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'ugx-community-wiki (image mirror)' },
    });
    // imgur redirects deleted images to removed.png
    if (new URL(res.url).pathname.startsWith('/removed')) {
      return { error: 'deleted (removed.png)' };
    }
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return { error: `no image (${type})` };
    return { data: Buffer.from(await res.arrayBuffer()) };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * @typedef {object} MirrorState
 * @property {string} root repository root
 * @property {boolean} dryRun
 * @property {Map<string, string>} mirrored url -> local path (/attachments/...)
 * @property {Map<string, string>} dead url -> error
 */

/**
 * Downloads the image once (the first page using it decides the folder)
 *
 * @param {string} url
 * @param {string} filePath page using the image
 * @param {MirrorState} state
 * @returns {Promise<string|undefined>} local path, undefined for dead images
 */
async function mirrorImage(url, filePath, state) {
  if (state.mirrored.has(url) || state.dead.has(url)) {
    return state.mirrored.get(url);
  }

  const name = path.posix.basename(new URL(url).pathname);
  const local = `${getAttachmentFolder(filePath)}/${name}`;
  if (!state.dryRun) {
    const res = await download(url);
    if ('error' in res) {
      state.dead.set(url, res.error);
      return undefined;
    }
    const target = path.join(state.root, ...local.split('/'));
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, res.data);
  }
  state.mirrored.set(url, `/${local}`);
  return `/${local}`;
}

/**
 * @param {string[]} files pages
 * @param {string} root repository root
 * @returns {Promise<number>} errors (always 0, dead images are only reported)
 */
async function mirrorImages(files, root = process.cwd()) {
  const dryRun = !!process.env.DRY_RUN;
  /** @type {MirrorState} */
  const state = { root, dryRun, mirrored: new Map(), dead: new Map() };
  const { mirrored, dead } = state;
  let pages = 0;

  for (const filePath of files) {
    const content = await readPage(filePath);
    if (!content) continue;

    let result = content;
    for (const url of findHotlinkedImages(content)) {
      const local = await mirrorImage(url, filePath, state);
      if (local) result = result.split(url).join(local);
    }

    if (result !== content) {
      pages++;
      if (!dryRun) await fs.promises.writeFile(filePath, result, encoding);
    }
  }

  console.log(
    `${dryRun ? 'DRY_RUN: would mirror' : 'Mirrored'} ${mirrored.size} images in ${pages} pages 🖼️`,
  );
  if (dead.size) {
    console.warn(`⚠️ ${dead.size} dead images (left unchanged):`);
    for (const [url, error] of dead) console.warn(`  ${url} - ${error}`);
  }
  return 0;
}

export { getAttachmentFolder, findHotlinkedImages, mirrorImages };
