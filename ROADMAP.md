---
title: ROADMAP
description: Planned work for the UGX-Mods Community Wiki
published: true
date: 2026-10-20T00:15:12.629Z
tags: meta
editor: markdown
dateCreated: 2026-10-20T00:15:12.629Z
---

## Phase 1: Content quality

Numbers are from October 2026 (289 HTML pages). `VERBOSE=1 node src/main.js metadata-validation` lists the metadata issues (all pages have tags and descriptions).

- [ ] Stub / TODO pages: write or merge them
  - Notifications, Radiant Black, Scripting custom traps, Creating a Zombie Window Entrance, Troubleshooting for UGXMP, UGXL FAQ, Video pages that only embed a video
- [ ] Review product pages for currency (UGXL, UGXLIN, Legacy launcher, Web Chat / Discord)

## Phase 2: Tools / Element

- [ ] Some more style / widget elements and fixes (e.g. tabs, status badges for the `aui-lozenge` spans in the changelogs, image gallery)
- [ ] Light mode and accessible theme CSS (`src/theme/wiki.scss`)
  - the widgets are styled for dark mode only: in light mode the banners are dark boxes with unreadable text (check the other widgets too)
  - use CSS custom properties for both modes (Wiki.js sets `.theme--light` / `.theme--dark`)
  - WCAG 2.2 AA: text contrast of at least 4.5:1, focus styles for the expandable buttons, text alternatives for meaningful icons, no information through color only (e.g. the colored changelog texts)
- [ ] Better Jira Cloud integration / embed
  - atm there is no real sync and it must be exported + imported and fixed 😢
  - fetch the changelog / export it and generate it (UGXSMF, etc.)
