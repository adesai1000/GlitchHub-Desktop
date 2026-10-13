import * as Path from 'path'
import * as Os from 'os'
import { constants } from 'fs'
import { access, readdir, readlink, realpath } from 'fs/promises'
import { execFile } from 'child_process'
import { compare } from 'compare-versions'
import { getShellEnv } from '../hooks/get-shell-env'
import { getGitHookEnvShell } from '../hooks/config'

const executableName = __WIN32__ ? 'claude.exe' : 'claude'

/** A copy of the Claude Code CLI found on this computer */
export interface IClaudeCodeInstallation {
  /** The path to launch it from */
  readonly path: string

  /** Its version, such as `2.1.296`, or null if it couldn't be read */
  readonly version: string | null

  /** Where it came from, such as `VSCodium extension` or `Native install` */
  readonly source: string
}

/**
 * Editors that bundle a Claude Code binary inside their Claude Code
 * extension, keyed by the folder in the home directory holding the
 * extensions.
 */
const editorExtensionFolders: ReadonlyArray<[string, string]> = [
  ['.vscode', 'VS Code'],
  ['.vscode-insiders', 'VS Code Insiders'],
  ['.vscode-oss', 'VSCodium'],
  ['.cursor', 'Cursor'],
  ['.windsurf', 'Windsurf'],
]

const extensionFolderRe = /^anthropic\.claude-code-(\d+\.\d+\.\d+)/
const versionRe = /(\d+\.\d+\.\d+)/

/**
 * Finds the copies of Claude Code on this computer: the CLI on the login
 * shell's PATH, the usual install locations, and the binaries bundled with
 * the Claude Code extension of VS Code and editors built on it. The newest
 * comes first.
 */
export async function findClaudeCodeInstallations(): Promise<
  ReadonlyArray<IClaudeCodeInstallation>
> {
  const home = Os.homedir()
  const candidates: Array<{ path: string; source: string; version?: string }> =
    []

  candidates.push(
    {
      path: Path.join(home, '.local', 'bin', executableName),
      source: 'Native install',
    },
    {
      path: Path.join(home, '.claude', 'local', executableName),
      source: 'Local install',
    }
  )

  if (__DARWIN__) {
    candidates.push(
      { path: '/opt/homebrew/bin/claude', source: 'Homebrew' },
      { path: '/usr/local/bin/claude', source: 'Homebrew' }
    )
  }

  for (const [folder, editor] of editorExtensionFolders) {
    candidates.push(...(await findInEditorExtensions(home, folder, editor)))
  }

  // Known locations come first so they keep their more telling names
  for (const dir of await getLoginShellPath()) {
    candidates.push({
      path: Path.join(dir, executableName),
      source: `On PATH in ${tildify(dir)}`,
    })
  }

  // The same binary is often reachable from several places, so keep the
  // first, most specific, way to reach each one
  const seen = new Set<string>()
  const installations = new Array<IClaudeCodeInstallation>()

  for (const candidate of candidates) {
    if (!(await isExecutable(candidate.path))) {
      continue
    }

    const resolved = await realpath(candidate.path).catch(() => candidate.path)
    if (seen.has(resolved)) {
      continue
    }
    seen.add(resolved)

    installations.push({
      path: candidate.path,
      source: candidate.source,
      version: candidate.version ?? (await getVersion(candidate.path)),
    })
  }

  return installations.sort((x, y) => compareVersions(y.version, x.version))
}

/**
 * Finds Claude Code configuration folders in the home directory other than
 * the default `~/.claude`, such as `~/.claude-work`, for people who keep
 * separate logins.
 */
export async function findClaudeCodeConfigDirectories(): Promise<
  ReadonlyArray<string>
> {
  const home = Os.homedir()
  const entries = await readdir(home, { withFileTypes: true }).catch(() => [])

  return entries
    .filter(e => e.isDirectory() && /^\.claude[-_.]/.test(e.name))
    .map(e => Path.join(home, e.name))
}

/**
 * Returns the given executable, or the newest installation if it's null, or
 * null if no Claude Code can be found.
 */
export async function resolveClaudeCodeExecutable(
  executable: string | null
): Promise<string | null> {
  if (executable !== null) {
    return (await isExecutable(executable)) ? executable : null
  }

  const [newest] = await findClaudeCodeInstallations()
  return newest?.path ?? null
}

async function findInEditorExtensions(
  home: string,
  folder: string,
  editor: string
) {
  const extensions = Path.join(home, folder, 'extensions')
  const entries = await readdir(extensions).catch(() => new Array<string>())

  return entries.flatMap(entry => {
    const match = extensionFolderRe.exec(entry)
    if (match === null) {
      return []
    }

    return [
      {
        path: Path.join(
          extensions,
          entry,
          'resources',
          'native-binary',
          executableName
        ),
        source: `${editor} extension`,
        version: match[1],
      },
    ]
  })
}

async function getLoginShellPath(): Promise<ReadonlyArray<string>> {
  try {
    const result = await getShellEnv(undefined, getGitHookEnvShell())
    const path = result.kind === 'success' ? result.env.PATH : process.env.PATH
    return (path ?? '').split(Path.delimiter).filter(p => p.length > 0)
  } catch (e) {
    log.warn('claude-code: unable to load shell environment', e)
    return (process.env.PATH ?? '').split(Path.delimiter)
  }
}

async function isExecutable(path: string) {
  try {
    await access(path, __WIN32__ ? constants.F_OK : constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Reads the version from the native installer's versions folder when the
 * executable links into it, or else by asking the executable.
 */
async function getVersion(path: string): Promise<string | null> {
  const target = await readlink(path).catch(() => null)
  const linked = target !== null ? versionRe.exec(Path.basename(target)) : null
  if (linked !== null) {
    return linked[1]
  }

  return new Promise(resolve => {
    execFile(path, ['--version'], { timeout: 10000 }, (error, stdout) => {
      const match = error === null ? versionRe.exec(stdout) : null
      resolve(match === null ? null : match[1])
    })
  })
}

function compareVersions(x: string | null, y: string | null) {
  if (x === y) {
    return 0
  }
  if (x === null || y === null) {
    return x === null ? -1 : 1
  }
  return compare(x, y, '>') ? 1 : -1
}

function tildify(path: string) {
  const home = Os.homedir()
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path
}
