---
title: CONTRIBUTING
description: 
published: true
date: 2024-02-25T10:37:56.992Z
tags: 
editor: markdown
dateCreated: 2024-02-04T15:24:16.655Z
---

# Contribution guide

We appreciate your thought to contribute to open source. :heart:

> 👉 **NOTE**: Before participating, please read the [CODE OF CONDUCT](/CODE_OF_CONDUCT).
>
> By interacting with this repository, organization, or community you agree to abide by its terms.

Feel free to join our Discord (https://www.ugx-mods.com/discord/) and join the `#community-wiki` room.

## Feature / Bugfix / Improvement request

Feel free to [suggest a change](/issues/new), like feature / improvement or a bug fix.

> 👍 Or even better, contribute it yourself. See below for more details on how to contribute.

## Contributing

Simply clone the project and do some changes. :wink:

You can write new files in either HTML (file ending with .html) or Markdown (file ending with .md) format.

Then run `npm run lint` to check if the files are properly formatted.

You must run `npm run build` if you modified the frontend files (`wiki.scss` or `wiki.js`).

Now create the Pull Request (see below).

### Formatting / Building

VSCode in combination with prettier is used

> ⚠️ Ensure the files follow the naming convention of Wiki.js (https://docs.requarks.io/guide/pages#naming-restrictions)

You can check and fix issues (if possible) via `npm run lint`.

### Stylesheet

The `wiki.scss` is used to compile css which is used  to override and extend WikiJS theme.

To build it, simply run `npm run build:sass` and the `wiki.min.js` is generated (and must be applied in `Administration > Theme > Code Injection`)

### Javascript

The `wiki.js` is used to extend the theme logic of WikiJS.

To build it, simply run `npm run build:js` and the `wiki.min.js` is generated (and must be applied in `Administration > Theme > Code Injection`)

### Tooling

There is a tool script (`main.js`) which helps with fixing html files (confluence to wikijs migration). It also offer other tools.

Install first the dependencies with `npm install` and then execute the script with `node main.js`.

### Pull Request

Before opening any pull request, be sure that the changes are formatted, valid and follow all guidelines.
Your Branch should start with `feature/`, e.g.: `feature/FeatureOrBugFix`

- [Fork](/fork) the Project
- Create your Feature Branch (`git checkout -b feature/FeatureOrBugFix`)
- Commit your Changes (`git commit -m 'Add some FeatureOrBugFix'`)
- Push to the Branch (`git push origin feature/FeatureOrBugFix`)
- Open a [Pull Request](/compare)

### Release

- Releases aren't created through GitHub.
- The wiki instances fetches the latest main branch in intervals and will update on change
