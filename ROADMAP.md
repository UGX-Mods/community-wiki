---
title: ROADMAP
description: Planned work for the UGX-Mods Community Wiki
published: true
date: 2026-10-20T00:15:12.629Z
tags:
editor: markdown
dateCreated: 2026-10-20T00:15:12.629Z
---

## Phase 1: Content quality

Numbers are from October 2026 (289 HTML pages). `VERBOSE=1 node src/main.js metadata-validation` lists the metadata issues.

- [ ] Page metadata
  - [ ] write a `description` for the 285 pages without one (used by search and link previews; good AI-assisted task, review per section)
  - [ ] define a small tag set (e.g. `waw`, `bo3`, `ugxl`, `ugxlin`, `forum`, `changelog`) and tag the 29 untagged pages and the rest of the wiki
- [ ] Remove more obsolete Confluence boilerplate / cleaner HTML files
  - [ ] `table-wrap`, `wrapped`, `confluenceTable` classes (235 occurrences in 84 pages)
  - [ ] inline `style` attributes (432 in 71 pages), mostly in old forum changelogs
- [ ] Rename `UGX-WeaponsEditor++` (violates the naming restrictions; changes the URL, update links)
- [ ] Stub / TODO pages: write or merge them
  - Notifications, Radiant Black, Scripting custom traps, Creating a Zombie Window Entrance, Troubleshooting for UGXMP, UGXL FAQ, Video pages that only embed a video
- [ ] Review product pages for currency (UGXL, UGXLIN, Legacy launcher, Web Chat / Discord)
- [ ] Remove the "imported from Confluence" warnings (README, home page) once the cleanup is done

## Phase 2: Tools / Element

- [ ] Some more style / widget elements and fixes (e.g. tabs, status badges, image gallery)
- [ ] Better Jira Cloud integration / embed
  - atm there is no real sync and it must be exported + imported and fixed 😢
  - fetch the changelog / export it and generate it (UGXSMF, etc.)
