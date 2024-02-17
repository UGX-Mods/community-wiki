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

Then ensure it's properly formatted and create a Pull Request (see below).

### Formatting / Building

VSCode in combination with prettier is used

> ⚠️ Ensure the files follow the naming convention of Wiki.js (https://docs.requarks.io/guide/pages#naming-restrictions)

### Stylesheet

The `wiki.scss` is used to compile css which is used  to override and extend WikiJS theme.

To build it, simply run `npm run sass` and the `wiki.min.js` is generated (and must be applied in `Administration > Theme > Code Injection`)

### Javascript

The `wiki.js` is used to extend the theme logic of WikiJS.

To build it, simply run `npm run js` and the `wiki.min.js` is generated (and must be applied in `Administration > Theme > Code Injection`)

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
