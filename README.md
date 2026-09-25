# GlitchHub Desktop

GitHub doesn't deliver the open source features people ask for, so this is my
own fork of [GitHub Desktop](https://github.com/desktop/desktop) with the
features I want, so in classic Larry David fashion, I'm doing a spite fork and adding the features the community has been asking for.

It is the same [Electron](https://www.electronjs.org/) app, written in
[TypeScript](https://www.typescriptlang.org) with [React](https://reactjs.org/),
tracking upstream's `development` branch. Everything upstream ships is here,
plus the extras below.

## Download

Grab the latest build from the
[releases page](https://github.com/adesai1000/GlitchHub-Desktop/releases/latest).
It is a macOS app for Apple silicon, shipped as a zip: unzip it and drag
GlitchHub Desktop into Applications.

The build is not signed with an Apple developer certificate yet, so the first
time you open it macOS will say it can't be verified. Right-click the app,
choose **Open**, then **Open** again in the dialog. You only have to do that
once. Your repository list and settings from GitHub Desktop are not shared
with it; it keeps its own profile folder. The sign-in token is shared, though,
see [Troubleshooting](#troubleshooting) if an organization's repositories
stop working.

If you like it, a star on the repo helps other people find it.

## What's different

| Feature | Where to find it | Upstream request |
| --- | --- | --- |
| Expand whole file in diffs by default | Settings → Appearance → Diff Expansion | [#20548](https://github.com/desktop/desktop/issues/20548) |
| Text size slider | Settings → Appearance → Text Size | |
| Turn off line wrapping in diffs | Settings → Appearance → Diff Expansion | [#11052](https://github.com/desktop/desktop/issues/11052) |
| Run `package.json` scripts from the toolbar, with history | **Run script** toolbar button; Repository Settings → Scripts; Settings → Scripts | |
| Default editor per repository | Repository Settings → Editor | [#12195](https://github.com/desktop/desktop/issues/12195) |
| Sort branches by last update | Settings → Appearance → Branch List | [#5155](https://github.com/desktop/desktop/issues/5155), [#21358](https://github.com/desktop/desktop/issues/21358) |
| Pin branches | Right-click a branch → Pin Branch | [#15767](https://github.com/desktop/desktop/issues/15767) |
| Search tags | Branch dropdown → Tags tab | [#15702](https://github.com/desktop/desktop/issues/15702) |
| Reorder the repository list | Right-click a repository → Move Up / Move Down | [#11608](https://github.com/desktop/desktop/issues/11608) |
| Resizable Run script button | Drag its right edge, double-click to reset | |
| Choose or install your own app icon (macOS) | Settings → Appearance → App Icon | |
| No telemetry, no crash reports, no update pings | Always on | |
| Settings that scroll at any text size | Settings dialog | |
| Its own name, icon and profile folder | Everywhere | |

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

### Run package.json scripts from the toolbar

A **Run script** button sits next to Fetch origin for any repository with a
`package.json`. Pick a script and it runs in the repository folder with your
login shell's environment, streaming its output into a terminal view with a
Stop button. Long-running scripts such as `dev` or `test:watch` keep running
while you work, and a banner tells you when a script finishes if its output
isn't on screen.

Nothing is exposed until you opt in: Repository Settings → **Scripts** (or
Settings → **Scripts**, which has a repository picker) lists every script with
a _Show_ checkbox and a _Confirm_ checkbox for the ones that deserve a second
look, like a production deploy. The package manager is detected from the lock
file (npm, yarn, pnpm or bun) and can be overridden globally.

The button has two tabs, like the branch dropdown: **Scripts** to start a run
and **History**, which keeps the last 20 runs per repository with their status,
duration and full output. The button itself is resizable, the same way the
branch, worktree and fetch buttons are.

### Smaller things the official app declined

- **Default editor per repository** ([#12195](https://github.com/desktop/desktop/issues/12195)):
  Repository Settings → **Editor** overrides the editor from Settings for that
  repository. Every "Open in editor" button and menu item follows it.
- **Turn off line wrapping in diffs** ([#11052](https://github.com/desktop/desktop/issues/11052)):
  Settings → Appearance → Diff Expansion → _Wrap long lines_. Off means long
  lines scroll horizontally instead.
- **Sort branches by last update** ([#5155](https://github.com/desktop/desktop/issues/5155),
  [#21358](https://github.com/desktop/desktop/issues/21358)): Settings →
  Appearance → Branch List.
- **Pin branches** ([#15767](https://github.com/desktop/desktop/issues/15767)):
  right-click a branch and choose _Pin Branch_. Pinned branches get their own
  group at the top of the list.
- **Search tags** ([#15702](https://github.com/desktop/desktop/issues/15702)):
  the branch dropdown has a **Tags** tab with a filter. Picking a tag checks
  out the commit it points to.
- **Reorder the repository list** ([#11608](https://github.com/desktop/desktop/issues/11608)):
  right-click a repository and choose _Move Up_ or _Move Down_. The order is
  remembered per group.

### Nothing phones home

The official app posts daily usage statistics, opt-in pings and crash reports
to GitHub, and asks GitHub's update server for new builds. GlitchHub Desktop
does none of that: the reporting code is compiled out, the Usage checkbox in
Settings → Advanced is replaced by a note that your data stays private, and
the About dialog points at the releases page instead of checking for updates.
That last part also stops the fork from ever updating itself into the
official app. Talking to GitHub for your repositories, pull requests, sign-in
and notifications works exactly as before; only the reporting is gone.

### Its own name and icon, and yours

The app is called GlitchHub Desktop, with its own icon, so it can live next to
the official app without the two being confused. It uses a separate profile
folder too.

Settings → Appearance → **App Icon** lets you pick the icon shown in the Dock
and the Finder. _Glitch_ is the default and _Boring_ is the vanilla GitHub
Desktop icon. **Install Icon…** takes any `.icns` or 1024 px PNG and keeps it
in your profile, so icons can be shared as plain files. Changes apply right
away; picking Glitch again clears the custom icon. macOS only for now.

## Troubleshooting

### "The repository does not seem to exist anymore"

If fetching or pushing a repository that belongs to an organization fails with
this message while the same commands work in a terminal, the organization has
turned on *OAuth App access restrictions* and hasn't approved the OAuth app
that GlitchHub Desktop signs in through. GitHub answers every request from an
unapproved app with a 404, which the app renders as this message. The
terminal works because `gh`, SSH keys and personal access tokens aren't OAuth
apps.

GlitchHub Desktop signs in through the **GitHub Desktop Dev** OAuth app, not
the production **GitHub Desktop** app, so an organization that has approved
the official app still has to approve this one. There are two ways to fix it.

**Ask the organization to approve the app.** On github.com, go to
**Settings > Applications > Authorized OAuth Apps > GitHub Desktop Dev**. Under
**Organization access**, click **Grant** if you own the organization, or
**Request** and have an owner approve it under the organization's
**Settings > Third-party access**. This is a one-time fix and it survives
signing out and back in.

**Use a personal access token instead.** Classic tokens aren't subject to the
restriction. Do this if you can't get the app approved:

1. On github.com, go to **Settings > Developer settings > Personal access
   tokens > Tokens (classic)** and generate a token with the `repo`, `user`
   and `workflow` scopes. Use a classic token; fine-grained tokens don't
   report their scopes back to the app.
2. If the organization enforces SAML single sign-on, click **Configure SSO**
   next to the new token and authorize it for the organization.
3. Sign in to GlitchHub Desktop as usual so the account exists, then quit
   the app.
4. Replace the stored token in the keychain. Replace `LOGIN` with your GitHub
   username and `TOKEN` with the token:

   ```shellsession
   $ security add-generic-password -U -s "GitHub - https://api.github.com" -a LOGIN -w "TOKEN"
   ```

5. Start the app. macOS asks whether GlitchHub Desktop may read the keychain
   item; click **Always Allow**.

Two things to know about the token route. The app keeps that keychain item
under the same name as the official GitHub Desktop, so both apps now use the
token; that's fine, it works for both. And signing out and back in writes a
fresh OAuth token over it, so repeat step 4 afterwards.

If the message appears for one repository only and a token doesn't help,
check its remote: **Repository > Repository settings > Remote**, or
`git remote -v` in a terminal. A URL with no owner and name, such as
`https://github.com/`, produces the same message.

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
