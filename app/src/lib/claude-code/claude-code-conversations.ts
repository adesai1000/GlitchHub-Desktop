import * as Os from 'os'
import * as Path from 'path'
import { existsSync, readdirSync } from 'fs'
import { readdir } from 'fs/promises'
import untildify from 'untildify'

/** A folder Claude Code has run in, with the conversations it kept there */
export interface IClaudeCodeFolder {
  readonly path: string
  readonly conversationCount: number
}

/** The default folder Claude Code keeps its configuration in */
export function getDefaultClaudeCodeConfigDirectory() {
  return Path.join(Os.homedir(), '.claude')
}

/**
 * Whether the configuration folder setting names Claude Code's own default,
 * in which case it's better left unset: setting `CLAUDE_CONFIG_DIR` changes
 * where Claude Code looks for some of its files, even for the default folder.
 */
export function isDefaultClaudeCodeConfigDirectory(directory: string) {
  return (
    Path.resolve(untildify(directory)) === getDefaultClaudeCodeConfigDirectory()
  )
}

/** Files and folders only a Claude Code configuration folder has */
const configDirectoryEntries = [
  'projects',
  'settings.json',
  '.credentials.json',
]

/**
 * Whether a folder looks like a Claude Code configuration folder: it has
 * Claude Code's files and holds no Git repositories. The second check
 * matters because Claude Code creates its files in whatever folder it's
 * given, so a folder of repositories mistakenly used as one gets them too.
 */
export function isClaudeCodeConfigDirectorySync(directory: string) {
  const resolved = untildify(directory)
  return (
    configDirectoryEntries.some(name =>
      existsSync(Path.join(resolved, name))
    ) && !holdsGitRepositories(resolved)
  )
}

/** Whether a folder is a Git repository or has one directly inside it */
function holdsGitRepositories(folder: string) {
  if (existsSync(Path.join(folder, '.git'))) {
    return true
  }

  try {
    return readdirSync(folder, { withFileTypes: true }).some(
      entry =>
        entry.isDirectory() && existsSync(Path.join(folder, entry.name, '.git'))
    )
  } catch {
    return false
  }
}

/**
 * The folder name Claude Code files a working folder's conversations under:
 * the path with every character other than a letter or digit replaced by a
 * hyphen, so `/Users/me/code` becomes `-Users-me-code`.
 */
export function getClaudeCodeProjectName(folder: string) {
  return folder.replace(/[^a-zA-Z0-9]/g, '-')
}

/**
 * Finds the folders Claude Code has kept conversations for among the
 * repository's folder and the folders above it, nearest first. Claude Code
 * files conversations under the folder it ran in, so conversations started
 * in a parent folder, such as one holding several repositories, don't show
 * up when Claude Code runs in the repository itself.
 *
 * @param configDirectory The configuration folder from Settings, or null
 *                        for Claude Code's default
 */
export async function findClaudeCodeFolders(
  repositoryPath: string,
  configDirectory: string | null
): Promise<ReadonlyArray<IClaudeCodeFolder>> {
  const projects = Path.join(
    configDirectory !== null
      ? untildify(configDirectory)
      : getDefaultClaudeCodeConfigDirectory(),
    'projects'
  )

  const folders = new Array<IClaudeCodeFolder>()
  for (const folder of getFolderAndParents(repositoryPath)) {
    const conversations = Path.join(projects, getClaudeCodeProjectName(folder))
    const entries = await readdir(conversations).catch(() => [])
    const conversationCount = entries.filter(e => e.endsWith('.jsonl')).length
    if (conversationCount > 0) {
      folders.push({ path: folder, conversationCount })
    }
  }

  return folders
}

/**
 * The folder and the folders above it, stopping before the home folder and
 * the root, where conversations rarely belong to the repository
 */
function getFolderAndParents(folder: string) {
  const home = Os.homedir()
  const folders = new Array<string>()
  let current = Path.resolve(folder)

  while (current !== home && current !== Path.dirname(current)) {
    folders.push(current)
    current = Path.dirname(current)
  }

  return folders
}
