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
Read this before changing anything. For contributor docs see [CONTRIBUTING.md](CONTRIBUTING.md).

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
- Pages were imported from Confluence in 2024. The leftover Confluence markup was cleaned up in 2026; the changelogs still link to Jira Cloud (`ugxmods.atlassian.net`). Inline color styles are intended.

## Repository layout

| Path                                            | Purpose                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `home.html`                                     | Wiki start page (`/`)                                                               |
| `Modding/`                                      | Call of Duty modding guides (`World-at-War-Modtools/`, `Black-Ops-3-Modtools/`)     |
| `Applications-and-Services/`                    | UGX services: forum, Discord, newsletter, MapPacker, …                              |
| `UGXL/`, `UGXLIN/`                              | UGX Launcher and UGX Launcher Installer docs (incl. changelogs, legacy docs)        |
| `Careers.html`, `UGX-Help-Center.html`          | Standalone pages                                                                    |
| `attachments/`                                  | Images, videos, downloads (Git LFS), grouped by area                                |
| `src/theme/`                                    | Theme for Wiki.js: `wiki.scss` and its partials (`_tokens`, `widgets/*`), `wiki.js` |
| `src/main.js`, `src/tools/`                     | Tooling CLI and its steps: validation, hierarchy, theme, content helpers, Jira      |
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

### Changelog pages from Jira

Release pages (UGXSMF, UGXL, UGXLIN, UGXMAPP) are generated from Jira Cloud by the workflow **Jira changelog** (`.github/workflows/jira-changelog.yml`):

- Run it with project + fix version to create the page of a new release. It also adds the release to the changelog overview. A weekly run (and every manual run) refreshes the changelogs that are due.
- The result is pushed to a branch. Open the pull request from the run summary, check the tickets and add a summary to new pages.
- Changelog format (`src/tools/jira/page.js`, reference: the UGXSMF changelogs): one wrapper `<div class="widget-jira-changelog" data-project data-version data-released data-refreshed>` with, in this order, the info table (`widget-jira-info`), and the sections `changelog-summary`, `changelog-highlights`, `changelog-tickets`, `changelog-known-issues`, `changelog-special-thanks` and `changelog-whats-next` (each a `div` with its `h2`). **Generated** are only the rows Date, Issues, Status and Version of the info table and the ticket table (`widget-jira-issues`). Everything else is written by hand and kept as it is: further info rows (Version Mode: production, beta, ...), the sections, extra sections like "Did you know...?" (they stay in the section they follow). Missing sections are added with a default text. A refresh never touches anything outside the wrapper.
- A changelog is refreshed while the release is unreleased and until 30 days after its release date, then it stays as it is. The workflow input `force` (locally `JIRA_FORCE=1`) refreshes all of them, e.g. after a format change. Versions that are missing in Jira are a warning, those pages keep their tables.
- `JIRA_PROJECT=UGXSMF node src/main.js jira-adopt` converts old changelog pages into the format without asking Jira (the tables stay until a refresh). The version comes from the Jira query of the Issues link, a release date that can not be read is stored as `unknown` (frozen until a forced refresh). The UGXSMF changelogs are converted; the UGXL, UGXLIN and UGXMAPP ones use sprints or ticket lists instead of fix versions and stay as they are.

Security:

- **Token isolation:** the Jira token is only used by `src/jira-fetch.js`, a standalone script with Node.js built-ins only. The rest of the tooling loads third-party packages, which could read the token from the environment if one of them were compromised. In CI the fetch runs in its own job without `npm ci` (plan and render run in jobs without secrets), locally `node src/main.js jira-changelog` starts it as a separate process and never loads the token itself.
- **Allowed projects:** only the keys in `JIRA_PROJECTS` are fetched. It is a variable of the GitHub environment `jira`, not part of the repository. For a new Jira project, add the key there **and** its page folder to `PROJECTS` in `src/tools/jira/changelog.js`. A page may only request its own project (folder), versions are validated before they reach JQL.
- **Private tickets:** tickets with a Jira security level are left out (JQL `level IS EMPTY` plus a second check in the script). Only the fields of the table are kept, no email addresses.
- **Token:** read-only account with browse permission for these projects only, scoped API token with `read:jira-work` (expires after one year, renew it and run `gh secret set JIRA_API_TOKEN --env jira`). Scoped tokens need the cloud id of the site (`JIRA_CLOUD_ID`, api.atlassian.com gateway). An expired token fails with "Jira denied the request (401)".

Locally, put `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_CLOUD_ID` and `JIRA_PROJECTS` into `.env` in the repository root (gitignored, shell variables win) and run `JIRA_PROJECT=UGXSMF JIRA_VERSION=v0.8.86-beta node src/main.js jira-changelog`. Without project and version it only refreshes. Existing pages are never overwritten, an unknown version lists the newest versions of the project.

#### How to: changelog of a new release

1. In Jira, set the fix version on all tickets of the release (tickets with a security level are left out automatically).
2. Run the workflow **Jira changelog** with the project (e.g. `UGXSMF`) and the version (e.g. `v0.8.86-beta`), or run it locally (see above).
3. Open the pull request from the link in the run summary. On the new page, write the hand-written parts: Version Mode in the info table, Summary, Important highlights, Known issues and Whats next? (Special Thanks has a default text).
4. Merge. While the release is unreleased and up to 30 days after its release date, the weekly run updates the ticket table and the generated info rows; the hand-written parts stay.

Own sections (e.g. "Did you know...?") can be added anywhere inside the changelog: inside a section or as an own `<h2>` between two sections. They are kept by every refresh and stay after the section they follow. Only the generated info rows and the ticket table are replaced, so do not edit those by hand.

#### How to: changelogs of a new app

1. Jira: create the project and use fix versions for the releases (not only sprints). Give the read-only account browse permission for the project.
2. GitHub: add the project key to the variable `JIRA_PROJECTS` of the environment `jira` (`gh variable set JIRA_PROJECTS --env jira --body "UGXSMF,UGXL,UGXLIN,UGXMAPP,NEWKEY"`), and to `.env` for local runs.
3. Repository: add the project to `PROJECTS` in `src/tools/jira/changelog.js` (`dir` of the changelog folder, file name `prefix`, page `title`, product `tag` from `src/tools/lib/tags.js`), and create the changelog overview page `<dir>.html` (with a table like `Applications-and-Services/UGX-Mods-Forum/Changelog.html`, or the child page list `widget-page-hierarchy`). Open a pull request with both.
4. After the merge, create the first changelog as above.

Run `npm run check` (or at least `npm run lint` + `npm run validate`) before committing. `validate` must report **0 errors**. New pages must not add warnings; the remaining ones are 4 pages without the wiki-managed `date` fields (Wiki.js adds them on the next save) and the forum Notifications page (its tags follow with the next forum update).

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
- `description` is shown in search and link previews. Write one sentence for every new page, all existing pages have one.
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

When the main content of a page is written by AI (a new page or a rewrite), mark it for readers: add the tag `ai-generated` and this banner at the top of the body. Name the sources the text is based on. `validate` fails if only one of the two is present. Smaller AI edits (fixes, an intro sentence, a "Related pages" list) need no marking. The marking stays on the page for some time, also after a review, and is phased out later.

```html
<div class="banner banner-note banner-ai">
  <img src="/attachments/icons/alert.png" alt="" class="banner-icon" />
  <p class="banner-title">AI-generated content</p>
  <div class="banner-body">
    <p>
      This page was written with AI from <sources> and has not been reviewed by
      the UGX team yet. It may contain mistakes. Found one?
      <a href="https://github.com/UGX-Mods/community-wiki/blob/main/CONTRIBUTING.md" target="_blank">
        Help us improve it
      </a>
      .
    </p>
  </div>
</div>
```

### Custom widgets (styled by `src/theme/widgets/`)

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

Tabs (behaviour in `wiki.js`, keyboard support included). Use them for alternatives the reader picks one of (e.g. two editors, two ways to do something). Without JavaScript the tabs are shown one below the other, so every tab needs a title:

```html
<div class="widget-tabs">
  <div class="widget-tab">
    <p class="widget-tab-title">Notepad++</p>
    <div class="widget-tab-content"><p>...</p></div>
  </div>
  <div class="widget-tab">
    <p class="widget-tab-title">Sublime Text 3</p>
    <div class="widget-tab-content"><p>...</p></div>
  </div>
</div>
```

Image gallery: a grid of thumbnails, a click opens the image large (dialog with previous / next). For screenshot overviews, not for step-by-step guides where each image belongs to its step. Every image needs `alt`, the caption is optional:

```html
<div class="widget-gallery">
  <figure class="image">
    <img src="/attachments/ugxl/features/settings/interface.png" alt="..." />
    <figcaption>Settings</figcaption>
  </figure>
</div>
```

All widget colors are CSS custom properties with a light and a dark variant (`--ugx-*` in `src/theme/_tokens.scss`). Use them for new styles and keep text at 4.5:1 contrast in both modes.

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
