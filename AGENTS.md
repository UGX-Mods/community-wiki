---
title: AGENTS
description: Instructions for AI coding agents and contributors working on the wiki repository
published: false
date: 2026-10-19T00:00:00.000Z
tags: meta
editor: markdown
dateCreated: 2026-10-19T00:00:00.000Z
---

Guidance for AI coding agents (and humans) working in this repository.
Read this before changing anything. For contributor docs see [CONTRIBUTING.md](CONTRIBUTING.md), for planned work see [ROADMAP.md](ROADMAP.md).

## What this repository is

The source of the **UGX-Mods Community Wiki** (<https://wiki.ugx-mods.com>), a [Wiki.js 2](https://docs.requarks.io/) instance using **Git storage**.
Sync is **bidirectional**:

- Wiki.js pulls `main` periodically and imports every changed page/asset.
- Edits made in the Wiki.js web editor are committed back to `main` by the user `Administrator <delta@ugx-mods.com>` with messages like `docs: update <page/path>`.

Consequences:

- **Always `git pull` before starting work**. `main` receives commits that never went through a PR.
- **Every `.html` and `.md` file is a wiki page**, including files in dot-folders (e.g. `.github/PULL_REQUEST_TEMPLATE.md` was imported and re-exported as `github/…`). Do not add stray Markdown/HTML files (notes, plans, reports, test fixtures). Put scratch output outside the repo.
- **Every other file is a wiki asset** (served at its path, e.g. `/attachments/icons/alert.png`).
- Wiki-authored pages are not prettier-formatted. CI only format-checks files changed in a PR, do not reformat unrelated pages.
- Pages were imported from Confluence in 2024. `node src/main.js confluence-markup` removed most leftover markup; the changelogs still link to Jira Cloud (`ugxmods.atlassian.net`). Inline color styles are intended.

## Repository layout

| Path                                            | Purpose                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `home.html`                                     | Wiki start page (`/`)                                                               |
| `Modding/`                                      | Call of Duty modding guides (`World-at-War-Modtools/`, `Black-Ops-3-Modtools/`)     |
| `Applications-and-Services/`                    | UGX services: forum, Discord, newsletter, MapPacker, …                              |
| `UGXL/`, `UGXLIN/`                              | UGX Launcher and UGX Launcher Installer docs (incl. changelogs, legacy docs)        |
| `Careers.html`, `UGX-Help-Center.html`          | Standalone pages                                                                    |
| `attachments/`                                  | Images, videos, downloads (Git LFS), grouped by area                                |
| `src/theme/`                                    | Theme overrides for Wiki.js: `wiki.scss` (widgets, banners, code panels), `wiki.js` |
| `src/main.js`, `src/tools/`                     | Tooling CLI and its steps: validation, hierarchy, theme deployment, Confluence      |
| `test/`                                         | `node:test` unit tests for `src/tools/` (fixtures are created in a temp folder)     |
| `dist/`                                         | Build output of the theme (gitignored)                                              |
| `lychee.toml`                                   | External link check config (weekly workflow `links.yml`)                            |
| `github/`                                       | Wiki.js re-export of `.github/PULL_REQUEST_TEMPLATE.md`. Do not edit                |
| `README.md`, `CONTRIBUTING.md`, `CREDITS.md`, … | Repo docs, also imported as (non-public) wiki pages                                 |

A page at `Foo/Bar.html` is served at `/Foo/Bar`. A folder `Foo/` holds the child pages of `Foo.html`.

## Commands

Requires the Node.js version from `devEngines` in `package.json` (enforced by npm) and **Git LFS** (`git lfs install` before cloning, otherwise images are pointer files).

```sh
npm ci                 # install
npm run check          # everything CI runs: lint + typecheck + test + validate + build
npm run lint           # prettier --check . && stylelint (read-only)
npm run format         # apply prettier + stylelint fixes
npm run typecheck      # tsc type check of src/ and test/ (JSDoc types)
npm test               # unit tests of the tooling
npm run validate       # links, iframe security, page headers (all .html/.md pages)
node src/main.js validate path/to/Page.html   # validate specific pages
npm run build          # src/theme -> dist/wiki.min.css, dist/wiki.min.js
npm run tools          # interactive tooling menu (node src/main.js --help for steps)
```

Run `npm run check` (or at least `npm run lint` + `npm run validate`) before committing. `validate` must report **0 errors**. Warnings (empty descriptions etc.) are known backlog.

### Dependencies

`.npmrc` hardens installs, do not weaken it:

- Only the public npm registry, no git / URL / local file dependencies (`allow-git`, `allow-remote`, `allow-file`, `allow-directory` are `none`).
- `min-release-age=7`: new versions must be public for 7 days (Dependabot uses the same cooldown).
- `save-exact=true`: `package.json` holds exact versions, `package-lock.json` pins the rest. Commit both.
- `strict-allow-scripts=true`: install fails if a dependency has install scripts that are not listed in `allowScripts` (`package.json`). Review the script, then run `npm approve-scripts <pkg>` or `npm deny-scripts <pkg>`. `@parcel/watcher` (optional sass dependency, only for `--watch`) is denied. `esbuild` is allowed: npm currently also skips the bin links of denied packages, and its postinstall only verifies the prebuilt binary.
- GitHub Actions are pinned to commit SHAs with a `# vX.Y.Z` comment.
- Node.js: `engines` / `devEngines` in `package.json` allow the LTS lines with a minimum version each (`^24.x.y || ^26.x.y`), there is no `.nvmrc`. No odd (non-LTS) or end-of-life majors. CI (`setup-node` with `node-version-file: package.json`) uses the newest release that satisfies it, so patches arrive without a bump. Raise the minimums in both fields when a Node.js security release (<https://nodejs.org/en/blog/vulnerability>) should be required, drop a line when it reaches end of life (<https://github.com/nodejs/Release#release-schedule>). `@types/node` follows the oldest allowed major.
- Workflows that use secrets (`theme.yml`) do not restore dependency caches (cache poisoning).

Build output (`dist/`) is gitignored. After a merge to `main`, changes in `src/theme/` are deployed by `.github/workflows/theme.yml` (`node src/main.js deploy-theme`, wiki.js GraphQL API). Mention theme changes in the PR, they go live with the merge.

## Page format

### Header (required)

Every HTML page starts with a Wiki.js metadata comment as the **very first bytes** of the file:

```html
<!--
title: BO3 | Adding Zones
description: How to set up zones in Black Ops 3 zombies maps
published: true
date: 2024-02-25T10:43:02.232Z
tags: confluence:17301656, bo3, mapping
editor: ckeditor
dateCreated: 2024-02-04T15:32:14.270Z
-->
```

Markdown pages (`editor: markdown`) use the same fields as YAML front matter between `---` lines.

- `title` is required and rendered as the page `<h1>`. Many modding pages are prefixed with `WaW |` or `BO3 |` (e.g. `WaW | Radiant`, `BO3 | Adding Zones`).
- `description` is shown in search and link previews. Write one sentence for new pages (most existing pages are still empty).
- `editor: ckeditor` for HTML pages, `markdown` for `.md`.
- `tags` (comma separated) come from the tag set in `src/tools/lib/tags.js`, `validate` warns about others. Give every page:
  - one product: `waw`, `bo3`, `ugxl`, `ugxlin`, `forum`, `ugxmp` (MapPacker), `services` (other UGX services)
  - one content type: `guide` (step by step), `reference` (lists, explanations), `changelog`, `troubleshooting` (known issues, FAQ, fixes), `overview` (section start pages)
  - modding pages also a topic: `mapping`, `scripting`, `sound`, `menu`, `models`, `tools`
  - optional `legacy` (outdated product versions), `meta` for the repository docs
  - `ai-generated` when the main content of the page was written by AI (see below)
  - `node src/main.js tag-pages` suggests them from the path (`DRY_RUN=1` to preview)
- Keep existing `confluence:<id>` tags: the tooling uses them to map old Confluence links.
- Leave `date`/`dateCreated` as they are on existing pages; Wiki.js manages them. For new pages use the current UTC timestamp for both.

### File names / paths

Follow the [Wiki.js naming restrictions](https://docs.requarks.io/guide/pages#naming-restrictions): only `A-Z a-z 0-9 - _`, words separated by `-`, no spaces, dots or other punctuation (versions use `-`, e.g. `UGXSMF-v0-8-85-beta`).
**Renaming or moving a page changes its URL and Wiki.js 2 has no redirects.** Do not rename pages unless asked, and update every link to it (`npm run validate` finds broken ones).

### Body content (HTML)

- Content is English, CKEditor-compatible HTML. No `<script>`, `<style>` or inline event handlers.
- Start body headings at `<h2>` (the title is the `<h1>`). Give headings an `id` if you link to them.
- Internal links: prefer absolute paths without extension, e.g. `<a href="/Modding/Black-Ops-3-Modtools/Mapping/Adding-Zones">`. Relative links (`href="Adding-Zones"`) resolve against the page's folder. Anchors are validated too.
- External links get `target="_blank"`. Use `https://`.
- Images: store files under `attachments/<area>/<topic>/` and reference them absolutely (`/attachments/...`). Always set `alt`. Do not hotlink new images from imgur/gyazo/Jira.
- Videos: `.webm` in `attachments/`, embedded with `<video controls>`.
- Iframes: **only** `https://www.youtube-nocookie.com/embed/...` is allowed (enforced by `validate`).

### AI-generated content

When the main content of a page is written by AI (a new page or a rewrite), mark it for readers: add the tag `ai-generated` and this banner at the top of the body. Name the sources the text is based on. `validate` fails if only one of the two is present. Smaller AI edits (fixes, an intro sentence, a "Related pages" list) need no marking. Remove both once a maintainer has reviewed the page.

```html
<div class="banner banner-note banner-ai">
  <img src="/attachments/icons/alert.png" alt="" class="banner-icon" />
  <p class="banner-title">AI-generated content</p>
  <div class="banner-body">
    <p>
      This page was written with AI from <sources> and has not been reviewed by
      the UGX team yet. It may contain mistakes. Found one?
      <a href="https://github.com/UGX-Mods/community-wiki" target="_blank">
        Help us improve it
      </a>
      .
    </p>
  </div>
</div>
```

### Custom widgets (styled by `src/theme/wiki.scss`)

Banner / callout (`banner-info`, `banner-tip`, `banner-note`, `banner-warning`, icons in `/attachments/icons/`):

```html
<div class="banner banner-tip">
  <img src="/attachments/icons/check-decagram.png" alt="" class="banner-icon" />
  <p class="banner-title">Optional title</p>
  <div class="banner-body"><p>Text</p></div>
</div>
```

Icons: `information-outline` (info), `check-decagram` (tip), `alert` (note), `alert-octagon` (warning).

Code panel (GSC/CSC scripts use `language-cpp`):

```html
<div class="widget-panel widget-code-panel">
  <pre><code class="language-cpp">
#using scripts\zm\_zm_score;</code></pre>
</div>
```

Collapsible code panel (behaviour in `wiki.js`):

```html
<div class="expandable-container widget-code-panel">
  <div class="expandable-header widget-code-panel-header">
    <div class="expandable-title widget-code-panel-title">Title</div>
    <button class="expandable-button" type="button">Expand source...</button>
  </div>
  <div class="expandable-content widget-code-panel-content">
    <pre><code class="language-text">...</code></pre>
  </div>
</div>
```

Child page list: `<ul class="widget-page-hierarchy">…</ul>` is **generated**. After adding/removing child pages run `node src/main.js refresh-hierarchy` instead of editing it by hand.

## Git workflow

- Work on a `feature/…` branch and open a PR against `main`. CI (`.github/workflows/ci.yml`) runs prettier on changed files, stylelint, `validate` and `build`.
- PRs are **squash merged**: the PR title becomes the commit on `main` and must be a conventional commit (checked by `.github/workflows/pr-title.yml`).
- Use [Conventional Commits](https://www.conventionalcommits.org/): `docs(content): …` / `fix(content): …` for pages, `feat(tools): …` for `src/main.js` / `src/tools/`, `feat(theme): …` for `src/theme/`, `test(tools): …`, `build: …`, `ci: …`, `chore: …`.
- Binary files go through Git LFS (`.gitattributes`). Line endings are LF.
- Keep content and tooling changes in separate commits. Avoid repo-wide reformatting of pages.

## Things to avoid

- Editing `github/` or adding Markdown/HTML files that are not meant as wiki pages (they become wiki pages).
- Changing `node_modules` or committing build output (`dist/`).
- CommonJS (`require`) in `src/` or `test/`: the code is ES modules (`"type": "module"`), local imports need the `.js` extension.
- Removing `confluence:<id>` tags or the header comment.
- Inventing facts about UGX products, mods or game versions. Mark uncertain content for maintainer review instead.
- Upgrading dependencies to versions published less than 7 days ago, using version ranges (`^`, `~`), or `--ignore-scripts` / `--dangerously-allow-all-scripts` to get around the script policy.
