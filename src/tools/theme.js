/**
 * Deploy the theme (dist/wiki.min.css / dist/wiki.min.js) via the wiki.js GraphQL API
 * (Administration > Theme > Code Injection). Run `npm run build` first.
 *
 * - CSS Override is replaced completely (owned by this repository)
 * - the script is replaced between the markers in Head or Body HTML Injection,
 *   everything else in there (e.g. ads) is kept
 *
 * Environment: WIKI_API_KEY (API key with manage:theme), WIKI_URL, DRY_RUN=1
 */
import fs from 'node:fs';
import path from 'node:path';
import { encoding } from './lib/pages.js';

const DEFAULT_WIKI_URL = 'https://wiki.ugx-mods.com';
const MARKER_START = '<!-- ugx-wiki-js:start -->';
const MARKER_END = '<!-- ugx-wiki-js:end -->';

const QUERY_CONFIG = `query {
  theming { config { theme iconset darkMode tocPosition injectCSS injectHead injectBody } }
}`;

const MUTATION_SET_CONFIG = `mutation ($theme: String!, $iconset: String!, $darkMode: Boolean!, $tocPosition: String,
  $injectCSS: String, $injectHead: String, $injectBody: String) {
  theming {
    setConfig(theme: $theme, iconset: $iconset, darkMode: $darkMode, tocPosition: $tocPosition,
      injectCSS: $injectCSS, injectHead: $injectHead, injectBody: $injectBody) {
      responseResult { succeeded errorCode message }
    }
  }
}`;

/**
 * @param {string} html content of an html injection field
 * @param {string} js
 * @returns {string|null} html with the replaced script block, null if the markers are missing
 */
function replaceScriptBlock(html, js) {
  const start = html.indexOf(MARKER_START);
  const end = html.indexOf(MARKER_END, start);
  if (start === -1 || end === -1) return null;

  // a </script> inside the js would end the tag early
  const script = js.trim().replace(/<\/script/gi, '<\\/script');
  return (
    html.slice(0, start) +
    `${MARKER_START}\n<script>${script}</script>\n${MARKER_END}` +
    html.slice(end + MARKER_END.length)
  );
}

/**
 * wiki.js 2 ThemingConfig (server/graph/schemas/theming.graphql)
 *
 * @typedef {object} ThemingConfig
 * @property {string} theme
 * @property {string} iconset
 * @property {boolean} darkMode
 * @property {string} [tocPosition]
 * @property {string} [injectCSS]
 * @property {string} [injectHead]
 * @property {string} [injectBody]
 */

/**
 * @param {ThemingConfig} config current theming config
 * @param {{css: string, js: string}} theme
 * @returns {ThemingConfig} new theming config
 */
function createThemeConfig(config, { css, js }) {
  const result = { ...config, injectCSS: css.trim() };
  for (const field of /** @type {const} */ (['injectHead', 'injectBody'])) {
    const html = replaceScriptBlock(config[field] ?? '', js);
    if (html !== null) {
      result[field] = html;
      return result;
    }
  }
  throw new Error(
    `Markers not found. Wrap the wiki.js <script> in Head or Body HTML Injection once with\n` +
      `${MARKER_START}\n<script>...</script>\n${MARKER_END}`,
  );
}

/**
 * @param {string} url
 * @param {string} apiKey
 * @param {string} query
 * @param {object} variables
 * @returns {Promise<any>} data of the response
 */
async function graphql(url, apiKey, query, variables = {}) {
  const res = await fetch(`${url.replace(/\/$/, '')}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.errors?.length) {
    const errors = body?.errors
      ?.map((/** @type {{message: string}} */ e) => e.message)
      .join(', ');
    throw new Error(`GraphQL request failed (${res.status}): ${errors ?? ''}`);
  }
  return body.data;
}

/**
 * @param {string} root repository root
 * @returns {Promise<number>} amount of errors
 */
async function deployTheme(root = process.cwd()) {
  const url = process.env.WIKI_URL || DEFAULT_WIKI_URL;
  const apiKey = process.env.WIKI_API_KEY;
  const dryRun = !!process.env.DRY_RUN;
  if (!apiKey) {
    console.error('🚨 WIKI_API_KEY is not set');
    return 1;
  }

  let theme;
  try {
    const read = (/** @type {string} */ file) =>
      fs.promises.readFile(path.join(root, 'dist', file), encoding);
    theme = { css: await read('wiki.min.css'), js: await read('wiki.min.js') };
  } catch (_) {
    console.error(
      '🚨 dist/wiki.min.css or dist/wiki.min.js not found, run npm run build first',
    );
    return 1;
  }

  const config = (await graphql(url, apiKey, QUERY_CONFIG)).theming?.config;
  if (!config) {
    console.error('🚨 No theming config, does the API key have manage:theme?');
    return 1;
  }

  const newConfig = createThemeConfig(config, theme);
  if (dryRun) {
    console.log('DRY_RUN: would deploy to', url);
    console.log(JSON.stringify({ ...newConfig, injectCSS: '…' }, null, 2));
    return 0;
  }

  const result = (await graphql(url, apiKey, MUTATION_SET_CONFIG, newConfig))
    .theming?.setConfig?.responseResult;
  if (!result?.succeeded) {
    console.error('🚨 Theme deployment failed:', result?.message);
    return 1;
  }

  console.log('Theme deployed to', url, '🎨');
  return 0;
}

export {
  MARKER_START,
  MARKER_END,
  replaceScriptBlock,
  createThemeConfig,
  deployTheme,
};
