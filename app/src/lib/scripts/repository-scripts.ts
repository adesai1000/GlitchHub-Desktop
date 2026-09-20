import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { Repository } from '../../models/repository'
import { getObject, setObject, getBoolean, setBoolean } from '../local-storage'

/** The package managers whose `run` command we know how to invoke. */
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

export const packageManagers: ReadonlyArray<PackageManager> = [
  'npm',
  'yarn',
  'pnpm',
  'bun',
]

/** A single entry from the `scripts` section of a package.json file. */
export interface IRepositoryScript {
  readonly name: string
  readonly command: string
}

/** The scripts available in a repository and how to run them. */
export interface IRepositoryScripts {
  /** The package manager to run the scripts with. */
  readonly packageManager: PackageManager
  /** Whether the package manager was detected from a lock file. */
  readonly detectedFromLockFile: boolean
  readonly scripts: ReadonlyArray<IRepositoryScript>
}

/** Which scripts the user has chosen to expose for a repository. */
export interface IRepositoryScriptsConfig {
  /** Names of the scripts shown in the toolbar dropdown. */
  readonly enabled: ReadonlyArray<string>
  /** Names of the scripts that ask for confirmation before running. */
  readonly confirm: ReadonlyArray<string>
}

const emptyConfig: IRepositoryScriptsConfig = { enabled: [], confirm: [] }

const lockFiles: ReadonlyArray<[string, PackageManager]> = [
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
]

async function fileExists(path: string) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/**
 * Works out which package manager a repository uses, first from the
 * `packageManager` field in package.json, then from lock files.
 */
async function detectPackageManager(
  repoPath: string,
  packageJson: Record<string, unknown>
): Promise<{ packageManager: PackageManager; detected: boolean }> {
  const declared = packageJson['packageManager']
  if (typeof declared === 'string') {
    const name = declared.split('@')[0]
    const pm = packageManagers.find(x => x === name)
    if (pm !== undefined) {
      return { packageManager: pm, detected: true }
    }
  }

  for (const [file, pm] of lockFiles) {
    if (await fileExists(join(repoPath, file))) {
      return { packageManager: pm, detected: true }
    }
  }

  return { packageManager: 'npm', detected: false }
}

/**
 * Reads the scripts declared in the repository's package.json, or null if
 * there's no package.json or it doesn't declare any scripts.
 */
export async function discoverRepositoryScripts(
  repoPath: string
): Promise<IRepositoryScripts | null> {
  let packageJson: Record<string, unknown>

  try {
    const contents = await readFile(join(repoPath, 'package.json'), 'utf8')
    const parsed: unknown = JSON.parse(contents)
    if (parsed === null || typeof parsed !== 'object') {
      return null
    }
    packageJson = parsed as Record<string, unknown>
  } catch {
    return null
  }

  const rawScripts = packageJson['scripts']
  if (rawScripts === null || typeof rawScripts !== 'object') {
    return null
  }

  const scripts = Object.entries(rawScripts as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([name, command]) => ({ name, command }))

  if (scripts.length === 0) {
    return null
  }

  const detection = await detectPackageManager(repoPath, packageJson)
  const preferred = getPreferredPackageManager()

  return {
    packageManager: preferred ?? detection.packageManager,
    detectedFromLockFile: preferred === undefined && detection.detected,
    scripts,
  }
}

/** The shell command used to run a named script with a package manager. */
export function getScriptRunCommand(pm: PackageManager, scriptName: string) {
  const quoted = quoteScriptName(scriptName)
  switch (pm) {
    case 'npm':
      return `npm run ${quoted}`
    case 'yarn':
      return `yarn run ${quoted}`
    case 'pnpm':
      return `pnpm run ${quoted}`
    case 'bun':
      return `bun run ${quoted}`
  }
}

/**
 * Script names are keys in package.json and can in theory contain anything.
 * Wrap the ones that aren't plain identifiers so the shell passes them
 * through verbatim.
 */
function quoteScriptName(name: string) {
  if (/^[A-Za-z0-9_.:@/-]+$/.test(name)) {
    return name
  }
  return __WIN32__
    ? `"${name.replace(/"/g, '\\"')}"`
    : `'${name.replace(/'/g, `'\\''`)}'`
}

// --- Per-repository configuration -----------------------------------------

const configKey = (repository: Repository) =>
  `repository-scripts-config-${repository.id}`

export function getRepositoryScriptsConfig(
  repository: Repository
): IRepositoryScriptsConfig {
  const stored = getObject<Partial<IRepositoryScriptsConfig>>(
    configKey(repository)
  )
  if (stored === undefined) {
    return emptyConfig
  }
  return {
    enabled: Array.isArray(stored.enabled) ? stored.enabled : [],
    confirm: Array.isArray(stored.confirm) ? stored.confirm : [],
  }
}

export function setRepositoryScriptsConfig(
  repository: Repository,
  config: IRepositoryScriptsConfig
) {
  setObject(configKey(repository), {
    enabled: [...config.enabled],
    confirm: [...config.confirm],
  })
}

// --- Global configuration -------------------------------------------------

const toolbarButtonKey = 'scripts-toolbar-button-visible'
const preferredPackageManagerKey = 'scripts-preferred-package-manager'
const alwaysConfirmKey = 'scripts-always-confirm'

/** Whether the "Run script" button is shown in the toolbar at all. */
export const getScriptsToolbarButtonVisible = () =>
  getBoolean(toolbarButtonKey, true)

export const setScriptsToolbarButtonVisible = (visible: boolean) =>
  setBoolean(toolbarButtonKey, visible)

/**
 * A package manager to use for every repository instead of detecting it, or
 * undefined to auto-detect.
 */
export const getPreferredPackageManager = (): PackageManager | undefined => {
  const stored = localStorage.getItem(preferredPackageManagerKey)
  return packageManagers.find(pm => pm === stored)
}

export const setPreferredPackageManager = (pm: PackageManager | undefined) => {
  if (pm === undefined) {
    localStorage.removeItem(preferredPackageManagerKey)
  } else {
    localStorage.setItem(preferredPackageManagerKey, pm)
  }
}

/** Whether every script asks for confirmation, regardless of per-script flags. */
export const getAlwaysConfirmScripts = () => getBoolean(alwaysConfirmKey, false)

export const setAlwaysConfirmScripts = (confirm: boolean) =>
  setBoolean(alwaysConfirmKey, confirm)

/** Whether running the given script should ask for confirmation first. */
export function shouldConfirmScript(
  config: IRepositoryScriptsConfig,
  scriptName: string
) {
  return getAlwaysConfirmScripts() || config.confirm.includes(scriptName)
}
