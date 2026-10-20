---
title: CONTRIBUTING
description: How to contribute to the UGX-Mods Community Wiki
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

Feel free to [suggest a change](https://github.com/UGX-Mods/community-wiki/issues/new/choose), like feature / improvement or a bug fix.

> 👍 Or even better, contribute it yourself. See below for more details on how to contribute.

## Contributing

Simply clone the project and do some changes. :wink:

> 💡 Install [Git LFS](https://git-lfs.com/) (`git lfs install`) before cloning, otherwise images and videos are only pointer files.
> Use the Node.js version from `.nvmrc`, then install the dependencies with `npm ci`.

You can write new files in either HTML (file ending with .html) or Markdown (file ending with .md) format.
See [AGENTS.md](/AGENTS.md) for the page format, conventions and available widgets.

Then run `npm run check` to verify formatting, links and the build (`npm run format` fixes formatting issues).

Now create the Pull Request (see below).

### Formatting / Validation

VSCode in combination with prettier is used (see the recommended extensions in `.vscode/extensions.json`).

> ⚠️ Ensure the files follow the naming convention of Wiki.js (https://docs.requarks.io/guide/pages#naming-restrictions)

| Command            | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `npm run lint`     | Check formatting (prettier) and the stylesheet (stylelint), changes nothing |
| `npm run format`   | Fix formatting issues (if possible)                                         |
| `npm run validate` | Check links, iframe security and the Wiki.js page headers of all pages      |
| `npm run build`    | Build the theme files (see below)                                           |
| `npm run check`    | All of the above (same as the CI checks of a pull request)                  |

### Stylesheet

The `wiki.scss` is used to compile css which is used to override and extend WikiJS theme.

To build it, simply run `npm run build:css` and the `wiki.min.css` is generated (and must be applied in `Administration > Theme > Code Injection > CSS Override`)

### Javascript

The `wiki.js` is used to extend the theme logic of WikiJS.

To build it, simply run `npm run build:js` and the `wiki.min.js` is generated (and must be applied in `Administration > Theme > Code Injection`)

### Tooling

There is a tool script (`main.js`) which helps with fixing html files (confluence to wikijs migration). It also offer other tools, e.g. to validate pages or to refresh the page hierarchy widgets.

Run `npm run tools` for an interactive menu, or pass a step directly, e.g. `node main.js refresh-hierarchy` (see `node main.js --help`).

### Local WikiJS instance for testing

You can quickly (in under 5 minutes) start a local instance.

This allows you to verify your changes before pushing them.<br>
You can also use the text editor of wikijs to make modifications and then push them 😎

We use a `docker-compose.yml` with the following content

```yml
services:
  wiki:
    image: ghcr.io/requarks/wiki:2
    environment:
      DB_TYPE: sqlite
      DB_FILEPATH: /home/db.sqlite
    ports:
      - '3634:3000'
    volumes:
      - ./home:/home
    restart: unless-stopped
```

(based on https://docs.requarks.io/install/docker)

Then up the container `docker compose up -d` and navigate to `http://localhost:3634` and finish installation.

Then login, go to `administration > storage`

- Select `Local File System`, enable it and set Path to `/home/local-files`
- Now either copy or checkout your files into the folder ({location of docker-compose.yml}/home/local-files)
- Click on `Import Everything` to start importing the files (if you import all files it may take a while).
- ⚠️ Any modifications within wikijs will be applied on the files (you might loose local changes!), also run `Dump all content to disk` will prune outside made changes - so be careful
- ⚠️ If you do modifications outside of wikijs, be sure to run `Import Everything` again to apply them to your instance (but this will wipe out any unsaved changes in your wikijs instance!)
- 💡 To create pages within wikijs, simply create your page and make your modifications, then use the `Dump all content to disk` to generate the html file, which you then must push to your fork 🙃

You can also copy & pase the wiki.css in `administration > theme > CSS Override` to apply custom changes and see all custom widgets.<br>
Switch to dark theme and set `Table of Contents Position` to `right`.

💡 You can easily reset the instance and start all over again by deleting the `{location of docker-compose.yml}/home/db.sql`

### Pull Request

Before opening any pull request, be sure that the changes are formatted, valid and follow all guidelines.
Your Branch should start with `feature/`, e.g.: `feature/FeatureOrBugFix`

- [Fork](https://github.com/UGX-Mods/community-wiki/fork) the Project
- Create your Feature Branch (`git checkout -b feature/FeatureOrBugFix`)
- Commit your Changes using [Conventional Commits](https://www.conventionalcommits.org/) (`git commit -m 'docs(content): add guide for xyz'`)
- Push to the Branch (`git push origin feature/FeatureOrBugFix`)
- Open a [Pull Request](https://github.com/UGX-Mods/community-wiki/compare), the CI checks (`npm run check`) must pass
- Pull Requests are squash merged, so the PR title becomes the commit message and must be a conventional commit too

### Release

- Releases aren't created through GitHub.
- The wiki instances fetches the latest main branch in intervals and will update on change
- Changes made in the wiki editor are committed back to `main` by the wiki (user `Administrator`), so always pull before you start working
