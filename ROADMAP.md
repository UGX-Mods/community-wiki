# Roadmap of UGX-Mods Wiki

## Planned 📈

### Phase 1: Repository & tooling

- [ ] Remove the `github/` folder (Wiki.js re-export of `.github/*.md`) and the matching wiki pages
  - any change to `.github/*.md` is imported again as a page, so either add a Wiki.js page rule that hides `github/*` or convert the issue templates to [issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) (`.yml`, not imported as pages)
  - update the PR template checklist afterwards (`npm run check`, conventional PR title)
- [ ] Fully support markdown (`.md`) files with tooling
  - validators only check `.html` files at the moment (front matter, links)
- [ ] Split `main.js` into modules (e.g. `tools/validate`, `tools/hierarchy`, `tools/confluence`) and add tests (`node:test`) for the validators
- [ ] Scheduled (weekly, report-only) external link check, e.g. with [lychee](https://github.com/lycheeverse/lychee), which opens an issue with dead links
- [ ] Deploy the theme (`wiki.min.css` / `wiki.min.js`) automatically instead of copy & paste into the admin area
  - evaluate the Wiki.js GraphQL API (theming config) from a workflow on changes to `wiki.scss` / `wiki.js`
- [ ] Optional: scheduled workflow that formats pages committed by the wiki editor and opens a PR

### Phase 2: Content quality

Numbers are from October 2026 (289 HTML pages). `VERBOSE=1 node main.js metadata-validation` lists the metadata issues.

- [ ] Page metadata
  - [ ] write a `description` for the 285 pages without one (used by search and link previews; good AI-assisted task, review per section)
  - [ ] define a small tag set (e.g. `waw`, `bo3`, `ugxl`, `ugxlin`, `forum`, `changelog`) and tag the 29 untagged pages and the rest of the wiki
- [ ] Structure & accessibility
  - [ ] use `<h2>` as top level heading in page bodies (57 pages use `<h1>`, the title is already the `<h1>`)
  - [ ] add `alt` texts to images (~90 pages)
- [ ] Remove more obsolete Confluence boilerplate / cleaner HTML files
  - [ ] `table-wrap`, `wrapped`, `confluenceTable` classes (235 occurrences in 84 pages)
  - [ ] inline `style` attributes (432 in 71 pages), mostly in old forum changelogs
- [ ] Jira elements (status-macro)
  - changelogs contain 2350 links / images to `ugxmods.atlassian.net` (52 pages), including hotlinked priority & issue type icons
  - replace icons with local files in `attachments/icons/jira/` or a CSS status widget, so changelogs survive changes of the Jira Cloud site
- [ ] Hotlinked media: mirror the 271 images from imgur / gyazo (81 pages) into `attachments/` (where we are allowed to), and check the 20 mega.nz / mediafire downloads (4 pages)
- [ ] Outdated hosts: `beta.ugx-mods.com` (redirects to www), `nightly.ugx-mods.com` (HTTP 500), `scriptref-beta.ugx-mods.com`
  - keep them in historical changelogs, update them in docs (e.g. UGX-Mods Beta Program, donor content)
- [ ] `http://` links in the "Used licenses" pages, switch to `https://` where available
- [ ] Rename `UGX-WeaponsEditor++` (violates the naming restrictions; changes the URL, update links)
- [ ] Stub / TODO pages: write or merge them
  - Notifications, Radiant Black, Scripting custom traps, Creating a Zombie Window Entrance, Troubleshooting for UGXMP, UGXL FAQ, Video pages that only embed a video
- [ ] Review product pages for currency (UGXL, UGXLIN, Legacy launcher, Web Chat / Discord)
- [ ] Remove the "imported from Confluence" warnings (README, home page) once the cleanup is done

### Phase 3: Platform

- [ ] Some more style / widget elements and fixes (e.g. tabs, status badges, image gallery)
- [ ] Evaluate Wiki.js v3 once it is released as stable (navigation, git storage changes, migration path)

## Wishlist ✨

- Better navigation, similar to Confluence 💖
  - might need to wait for wiki.js v3 release
- Better Jira Cloud integration / embed
  - atm there is no real sync and it must be exported + imported and fixed 😢
