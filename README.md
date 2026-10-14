# StickShift
<img width="2135" height="1411" alt="image" src="https://github.com/user-attachments/assets/53456adf-ea8b-4225-bb44-0fd3ed4e3d5b" />

StickShift is an IDE for the agentic age. Your coding agent, your diffs, and your Git history live in one window: Claude Code runs in a panel next to your repository, its changes land in tabbed diffs, and you stage, commit, and push without switching apps. It's a [desktop app for macOS](https://github.com/adesai1000/StickShift/releases/latest), built on the open source [GitHub Desktop](https://github.com/desktop/desktop).

Works with the Claude Code you already have: the CLI, Homebrew, or the copy bundled with the Claude Code extension for VS Code, VSCodium, Cursor, or Windsurf. If it's set up on your computer, StickShift finds it and signs in with your existing account.

## "Wait, isn't this just GitHub Desktop?"

It started as a fork of it. GitHub Desktop is a great Git client, but the work changed: an agent writes the code now, and you review it. That meant a terminal for the agent, an editor for the files, and a Git client for the commits, all fighting for the same screen.

StickShift puts them in one place. You get everything GitHub Desktop ships, plus the features its users kept asking for and never got, and an agent panel built for reviewing and steering instead of typing. It's MIT licensed, so if it ever goes the wrong direction, you have everything you need to fork it.

## What you get

### Claude Code, built in

Press <kbd>⌘</kbd>+<kbd>Esc</kbd>, or click **Claude Code** at the end of the toolbar, and Claude Code opens in a panel next to your repository. It's the real CLI in a real terminal, so slash commands, plan mode, and permission prompts all work the way you're used to.

- **Several sessions.** Click **+** to start another one. Each session gets a tab named after its conversation.
- **Your working folder.** Set a working folder in Settings → **Claude Code**, such as the folder that holds your repositories, and every session starts there. Without one, sessions start in the selected repository's folder.
- **Pick up past conversations.** The **+** menu finds the conversations Claude Code kept for the working folder, or a folder above it. Continue the last one, or choose from the list.
- **Always running.** The panel belongs to the app, not a repository, so switching repositories keeps your sessions on screen. Hiding the panel doesn't stop them either.
- **Your setup.** Sessions start with your login shell's environment and your Claude Code login.
- **Your choice of Claude Code.** Settings → **Claude Code** runs the newest copy it finds, or the one you pick. It can also use a separate configuration folder, such as `~/.claude-work`.

### Review like an editor

- **Review a branch before the pull request.** The **Review** tab, next to **History**, lists every file your branch changes since it left the base branch, across all its commits, with the final diff a reviewer will see. Pick the base branch, and include your uncommitted changes if you like. Press <kbd>⌘</kbd>+<kbd>3</kbd> to open it.
- **See where each commit came from.** The History list shows the branch each commit was made on after its date, read from merge messages when the branch is gone.
- **Tabs for changed files.** Every file you open from the Changes list gets a tab above the diff. Close tabs with **×**, a middle click, or the tab menu.
- **Whole files, no wrapping.** Open every diff fully expanded, and let long lines scroll instead of wrap.
- **Jump to your editor.** Right-click any diff and open the file in your editor, with a different default editor per repository if you like.
- **Stash just some files.** Right-click files in the Changes list and stash only those.

### The rest of your workflow

- **Run scripts from the toolbar.** Run `package.json` scripts with live output, a **Stop** button, and a history of past runs.
- **Branches your way.** Sort them by last update, pin the ones you use most, and search tags.
- **A tidy sidebar.** Reorder your repositories, and scale all text from 10 px to 18 px.
- **Nothing phones home.** No usage statistics, no crash reports, and no update checks.

## Installation

> [!WARNING]
> StickShift runs Claude Code; it doesn't install it. Set it up and sign in before you open the panel:
>
> - Install [Claude Code](https://claude.com/product/claude-code), run `claude`, and sign in.
> - Or install the Claude Code extension in VS Code, VSCodium, Cursor, or Windsurf. StickShift uses the copy that comes with it.
>
> StickShift runs on macOS on Apple silicon.

### Desktop app

Download the latest zip from [GitHub Releases](https://github.com/adesai1000/StickShift/releases/latest), unzip it, and drag StickShift into Applications.

The app isn't signed with an Apple developer certificate yet, so macOS asks before the first launch: right-click StickShift, choose **Open**, then click **Open** again.

#### With the GitHub CLI

```bash
rm -rf /tmp/stickshift
gh release download --repo adesai1000/StickShift --pattern '*.zip' --dir /tmp/stickshift
rm -rf /Applications/StickShift.app
ditto -x -k /tmp/stickshift/StickShift-*.zip /Applications
open /Applications/StickShift.app
```

Run the same commands to update. Quit StickShift first.

#### Command line tool

In StickShift, choose **StickShift > Install Command Line Tool**. Then:

```bash
stickshift                           # open the repository in the current folder
stickshift open ~/code/my-project    # open a repository by path
stickshift clone owner/repo          # clone a repository from GitHub
```

### Coming from GlitchHub Desktop

StickShift used to be called GlitchHub Desktop. Quit GlitchHub Desktop, then open StickShift: on first launch it copies your repositories, settings, and sign-ins, and leaves the old app's data untouched. Once everything looks right, delete GlitchHub Desktop from Applications.

## Some notes

We're early. Expect bugs, and [open an issue](https://github.com/adesai1000/StickShift/issues) when you find one.

There's no auto-update yet. Watch the repository for new releases, and update from [GitHub Releases](https://github.com/adesai1000/StickShift/releases).

StickShift isn't affiliated with or endorsed by GitHub or Anthropic.

## Troubleshooting

### "The repository does not seem to exist anymore"

If a repository that belongs to a GitHub organization fails with this message but works in a terminal, the organization restricts OAuth apps and hasn't approved the one StickShift signs in through, **GitHub Desktop Dev**. Fix it either way:

- **Approve the app.** On github.com, go to **Settings > Applications > Authorized OAuth Apps > GitHub Desktop Dev**, and under **Organization access**, click **Grant**, or **Request** if you don't own the organization.
- **Use a classic personal access token.** Create one with the `repo`, `user`, and `workflow` scopes, authorize it for SAML single sign-on if the organization uses it, and store it in the keychain. Replace `LOGIN` with your GitHub username and `TOKEN` with the token:

  ```bash
  security add-generic-password -U -s "GitHub - https://api.github.com" -a LOGIN -w "TOKEN"
  ```

  Then start StickShift and click **Always Allow** when macOS asks about the keychain. Signing out and back in replaces the token, so repeat this afterwards.

### Claude Code doesn't start

If the panel says it couldn't find Claude Code, check that `claude` works in your terminal, or choose its location in Settings → **Claude Code**.

## Building from source

StickShift needs Node 24.19 (pinned in `.node-version`), Yarn, Python 3, and the Xcode command line tools. Older Node 24 releases silently fail to package the app.

```bash
yarn              # install dependencies
yarn build:dev    # build the development app
yarn start        # launch it with hot reload
```

Changes under `app/src` reload live. Changes to the main process or the packaging need `yarn build:dev` again. To rebuild the icon after editing `app/static/logos/*/icon-logo.icon`, run `script/build-icon-assets.sh`; it needs a full Xcode install.

See the [setup guide](./docs/contributing/setup.md) for details.

## License

[MIT](./LICENSE), the same license as GitHub Desktop, whose copyright notice the license file keeps for the code StickShift is built on. GitHub is a trademark of GitHub, Inc., and Claude is a trademark of Anthropic, PBC.
