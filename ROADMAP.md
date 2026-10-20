---
title: ROADMAP
description: Planned work for the UGX-Mods Community Wiki
published: true
date: 2026-10-20T00:15:12.629Z
tags:
editor: markdown
dateCreated: 2026-10-20T00:15:12.629Z
---

# Roadmap of UGX-Mods Wiki

## Planned 📈

### Phase 1: Repository & tooling

- [ ] Remove the `github/` folder: only the PR template is left (`.github/PULL_REQUEST_TEMPLATE.md` has no `.yml` alternative and is still imported as page)
  - hide `github/*` with a Wiki.js page rule, then delete `github/PULL_REQUEST_TEMPLATE.md` and the page

### Phase 2: Content quality

Numbers are from October 2026 (289 HTML pages). `VERBOSE=1 node src/main.js metadata-validation` lists the metadata issues.

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
