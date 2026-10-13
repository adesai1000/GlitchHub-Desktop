import { getBoolean, getNumber, setBoolean, setNumber } from '../local-storage'

const executableKey = 'claude-code-executable'
const configDirectoryKey = 'claude-code-config-directory'
const workingDirectoryKey = 'claude-code-working-directory'
const toolbarButtonVisibleKey = 'claude-code-toolbar-button-visible'
const panelOpenKey = 'claude-code-panel-open'
const panelWidthKey = 'claude-code-panel-width'

export const defaultClaudeCodePanelWidth = 520

/**
 * The path of the Claude Code executable to launch, or null to use the newest
 * installation found on this computer.
 */
export function getClaudeCodeExecutable(): string | null {
  return localStorage.getItem(executableKey)
}

export function setClaudeCodeExecutable(path: string | null) {
  setOrRemove(executableKey, path)
}

/**
 * The folder Claude Code keeps its login, settings, and sessions in, passed
 * as `CLAUDE_CONFIG_DIR`, or null for Claude Code's own default, `~/.claude`.
 */
export function getClaudeCodeConfigDirectory(): string | null {
  return localStorage.getItem(configDirectoryKey)
}

export function setClaudeCodeConfigDirectory(path: string | null) {
  setOrRemove(configDirectoryKey, path)
}

/**
 * The folder Claude Code runs in, and files its conversations under, or
 * null to run it in the folder of the repository selected when a session
 * starts
 */
export function getClaudeCodeWorkingDirectory(): string | null {
  return localStorage.getItem(workingDirectoryKey)
}

export function setClaudeCodeWorkingDirectory(path: string | null) {
  setOrRemove(workingDirectoryKey, path)
}

/**
 * Before the working folder setting existed, the configuration folder was
 * the only folder setting, and it got used to pick the folder Claude Code
 * works in. A configuration folder that has none of Claude Code's files was
 * meant as the working folder, so move it there.
 *
 * @param isConfigDirectory Whether a folder has Claude Code's files
 */
export function moveMistakenConfigDirectory(
  isConfigDirectory: (path: string) => boolean
) {
  const configDirectory = getClaudeCodeConfigDirectory()
  if (
    configDirectory === null ||
    getClaudeCodeWorkingDirectory() !== null ||
    isConfigDirectory(configDirectory)
  ) {
    return
  }

  setClaudeCodeWorkingDirectory(configDirectory)
  setClaudeCodeConfigDirectory(null)
}

/** Whether the Claude Code button is shown in the toolbar */
export function getClaudeCodeToolbarButtonVisible(): boolean {
  return getBoolean(toolbarButtonVisibleKey, true)
}

export function setClaudeCodeToolbarButtonVisible(visible: boolean) {
  setBoolean(toolbarButtonVisibleKey, visible)
}

/** Whether the Claude Code panel was open when the app last ran */
export function getClaudeCodePanelOpen(): boolean {
  return getBoolean(panelOpenKey, false)
}

export function setClaudeCodePanelOpen(open: boolean) {
  setBoolean(panelOpenKey, open)
}

export function getClaudeCodePanelWidth(): number {
  return getNumber(panelWidthKey, defaultClaudeCodePanelWidth)
}

export function setClaudeCodePanelWidth(width: number) {
  setNumber(panelWidthKey, width)
}

function setOrRemove(key: string, value: string | null) {
  if (value === null || value.trim() === '') {
    localStorage.removeItem(key)
  } else {
    localStorage.setItem(key, value)
  }
}
