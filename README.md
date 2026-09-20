# GlitchHub Desktop

GitHub doesn't deliver the open source features people ask for, so this is my
own fork of [GitHub Desktop](https://github.com/desktop/desktop) with the
features I want, so in classic Larry David fashion, I'm doing a spite fork and adding the features the community has been asking for.

It is the same [Electron](https://www.electronjs.org/) app, written in
[TypeScript](https://www.typescriptlang.org) with [React](https://reactjs.org/),
tracking upstream's `development` branch. Everything upstream ships is here,
plus the extras below.

## What's different

### Expand whole file in diffs by default

Upstream issue [#20548](https://github.com/desktop/desktop/issues/20548),
"Option to Always Expand File Diffs by Default", has been open since May 2025
with no response from the maintainers. GlitchHub Desktop adds it.

Settings → Appearance → **Diff Expansion** lets you pick between _Changed lines
only_ (upstream's behaviour) and _Whole file_. With _Whole file_ selected every
text diff opens fully expanded, in the Changes view, History, stash previews
and the pull request dialog. The right-click menu still lets you collapse or
expand any single diff.

### Text size slider

Settings → Appearance → **Text Size** has a macOS-style slider that scales all
text in the app from 10 px to 18 px. Changes apply live while you drag, and the
preference persists across restarts. It is independent of the window zoom
(<kbd>⌘</kbd>+<kbd>=</kbd> / <kbd>⌘</kbd>+<kbd>-</kbd>), which scales the whole
UI.

### Its own name and icon

The app is called GlitchHub Desktop, with its own icon, so it can live next to
the official app without the two being confused. It uses a separate profile
folder too.

## Building it

Follow upstream's
[setup guide](docs/contributing/setup.md) for the prerequisites (Node, Yarn,
Python 3 and the Xcode command line tools on macOS). The repo pins Node 24.19
in `.node-version`; use that exact version, older 24.x releases silently fail
to package the app.

```shellsession
$ yarn                 # install dependencies
$ yarn build:dev       # build the development app bundle
$ yarn start           # launch it with hot reload for the UI
```

Changes under `app/src` reload live. Press <kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>R</kbd>
in the app if the window doesn't refresh on its own. Changes to the main
process or the packaging need `yarn build:dev` again.

To regenerate the macOS icon after editing `app/static/logos/*/icon-logo.icon`
in Icon Composer, run `script/build-icon-assets.sh`. It needs a full Xcode
install, not just the command line tools.

## Upstream

Bug reports, documentation and contribution guidelines for the underlying app
live at [desktop/desktop](https://github.com/desktop/desktop). Upstream changes
are merged in regularly. Please don't report problems with the GlitchHub
additions to the GitHub Desktop maintainers.

## License

**[MIT](LICENSE)**, the same license as GitHub Desktop.

The MIT license grant is not for GitHub's trademarks, which include the logo
designs. GitHub reserves all trademark and copyright rights in and to all
GitHub trademarks. GitHub's logos include, for instance, the stylized
Invertocat designs that include "logo" in the file title in the
[logos](app/static/logos) folder. The GlitchHub icon is a remix of the
Invertocat and is not endorsed by GitHub.
