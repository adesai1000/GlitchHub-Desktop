import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { IPty } from 'node-pty'
import { Disposable, Emitter } from 'event-kit'
import untildify from 'untildify'
import { getMonospaceFontFamily } from '../get-monospace-font-family'
import { openExternal } from '../main-process-proxy'
import { getShellEnv } from '../../lib/hooks/get-shell-env'
import { getGitHookEnvShell } from '../../lib/hooks/config'
import { resolveClaudeCodeExecutable } from '../../lib/claude-code/find-claude-code'
import { isDefaultClaudeCodeConfigDirectory } from '../../lib/claude-code/claude-code-conversations'
import {
  getClaudeCodeConfigDirectory,
  getClaudeCodeExecutable,
} from '../../lib/claude-code/claude-code-settings'

export type ClaudeCodeSessionStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | { readonly kind: 'running' }
  | { readonly kind: 'exited'; readonly exitCode: number }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'failed'; readonly message: string }

/** The Settings a session was started with */
interface ILaunchSettings {
  /** The executable from Settings, null for the newest installation */
  readonly executableSetting: string | null
  readonly configDirectory: string | null
}

/** Lets the selection show in both the light and the dark theme */
const selectionBackground = 'rgba(56, 139, 253, 0.35)'

/**
 * Claude Code running in a pseudo-terminal, with the terminal that shows it.
 * The terminal lives in its own element so that it can move between panels,
 * and keep running while no panel shows it.
 */
export class ClaudeCodeSession {
  public readonly element = document.createElement('div')

  private readonly terminal: Terminal
  private readonly fitAddon = new FitAddon()
  private readonly emitter = new Emitter()
  private pty: IPty | null = null
  private isTerminalOpen = false
  private _status: ClaudeCodeSessionStatus = { kind: 'idle' }
  private _terminalTitle = ''
  private _executablePath: string | null = null
  private launchSettings: ILaunchSettings | null = null

  /**
   * @param cwd The folder to run Claude Code in, which is also the folder
   *            Claude Code files the conversation under
   * @param number Numbers the sessions of a repository, for their names
   * @param args Arguments for Claude Code, such as `--continue`
   */
  public constructor(
    public readonly cwd: string,
    public readonly number: number,
    private readonly args: ReadonlyArray<string> = []
  ) {
    this.element.className = 'claude-code-terminal-element'

    this.terminal = new Terminal({
      fontFamily: getMonospaceFontFamily(),
      fontSize: 13,
      cursorBlink: true,
      scrollback: 10000,
      macOptionClickForcesSelection: true,
      theme: readTheme(),
    })

    this.terminal.loadAddon(this.fitAddon)
    this.terminal.loadAddon(
      new WebLinksAddon((event, uri) => {
        event.preventDefault()
        openExternal(uri)
      })
    )

    this.terminal.onData(data => this.pty?.write(data))
    this.terminal.onResize(({ cols, rows }) => this.pty?.resize(cols, rows))
    this.terminal.attachCustomKeyEventHandler(this.onKeyEvent)

    // Claude Code names the terminal after the conversation
    this.terminal.onTitleChange(title => {
      this._terminalTitle = title.trim()
      this.emitter.emit('did-change')
    })
  }

  public get status() {
    return this._status
  }

  /**
   * The conversation's name, as Claude Code sets it, or a numbered name
   * until the conversation has one
   */
  public get title() {
    // Claude Code puts a status glyph, such as ✳, in front of the name
    const name = this._terminalTitle.replace(/^[^\p{L}\p{N}]+/u, '').trim()
    return name !== '' && name !== 'Claude Code'
      ? name
      : `Claude ${this.number}`
  }

  /** The executable the session last started, if it found one */
  public get executablePath() {
    return this._executablePath
  }

  /**
   * Whether the Claude Code location or configuration folder in Settings
   * changed since the session started, so a restart would pick them up.
   */
  public get hasOutdatedSettings() {
    const launched = this.launchSettings
    return (
      launched !== null &&
      (launched.executableSetting !== getClaudeCodeExecutable() ||
        launched.configDirectory !== getClaudeCodeConfigDirectory())
    )
  }

  /** Called when the status or the title changes */
  public onDidChange(callback: () => void): Disposable {
    return this.emitter.on('did-change', callback)
  }

  /** Shows the terminal in the given element, sized to fit it */
  public attach(host: HTMLElement) {
    host.appendChild(this.element)

    if (!this.isTerminalOpen) {
      this.terminal.open(this.element)
      this.isTerminalOpen = true
    }

    // Pick up a change of the app's theme since the terminal was last shown
    this.terminal.options.theme = readTheme()
    this.fit()
  }

  public detach() {
    this.element.remove()
  }

  public focus() {
    this.terminal.focus()
  }

  /** Resizes the terminal, and the pseudo-terminal, to fill its element */
  public fit() {
    if (this.element.isConnected && this.element.clientWidth > 0) {
      this.fitAddon.fit()
    }
  }

  /**
   * Starts Claude Code, stopping it first if it's running. Each start reads
   * the Claude Code location and configuration folder from Settings again.
   */
  public async start() {
    this.kill()
    this.terminal.reset()
    this._terminalTitle = ''

    const launchSettings: ILaunchSettings = {
      executableSetting: getClaudeCodeExecutable(),
      configDirectory: getClaudeCodeConfigDirectory(),
    }
    this.launchSettings = launchSettings
    this.setStatus({ kind: 'starting' })

    const executable = await resolveClaudeCodeExecutable(
      launchSettings.executableSetting
    )
    this._executablePath = executable
    if (executable === null) {
      this.setStatus({ kind: 'not-found' })
      return
    }

    try {
      const nodePty = await import('node-pty')
      const env = await getEnvironment(this.cwd, launchSettings)
      this.fit()

      const pty = nodePty.spawn(executable, [...this.args], {
        name: 'xterm-256color',
        cols: this.terminal.cols,
        rows: this.terminal.rows,
        cwd: this.cwd,
        env,
      })

      this.pty = pty
      pty.onData(data => this.terminal.write(data))
      pty.onExit(({ exitCode }) => {
        // A restart replaces the process, so ignore the old one exiting
        if (this.pty === pty) {
          this.pty = null
          this.setStatus({ kind: 'exited', exitCode })
        }
      })

      this.setStatus({ kind: 'running' })
    } catch (e) {
      log.error('claude-code: unable to start Claude Code', e)
      this.setStatus({ kind: 'failed', message: `${e}` })
    }
  }

  /** Stops Claude Code and frees the terminal */
  public dispose() {
    this.kill()
    this.terminal.dispose()
    this.element.remove()
    this.emitter.dispose()
  }

  private kill() {
    const pty = this.pty
    this.pty = null
    pty?.kill()
  }

  private setStatus(status: ClaudeCodeSessionStatus) {
    this._status = status
    this.emitter.emit('did-change')
  }

  /**
   * Turns Shift+Enter into the escape sequence Claude Code reads as a new
   * line, the same as Option+Enter, instead of sending the prompt.
   */
  private onKeyEvent = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && event.shiftKey && !event.metaKey) {
      if (event.type === 'keydown') {
        this.pty?.write('\x1b\r')
      }
      return false
    }

    return true
  }
}

/** How a new session starts */
export interface IClaudeCodeSessionOptions {
  /** The folder to run Claude Code in, the repository's by default */
  readonly cwd?: string

  /** Arguments for Claude Code, such as `--continue` or `--resume` */
  readonly args?: ReadonlyArray<string>
}

/** The Claude Code sessions of one repository, shown as tabs in the panel */
export class ClaudeCodeSessions {
  private readonly emitter = new Emitter()
  private readonly subscriptions = new Map<ClaudeCodeSession, Disposable>()
  private _sessions: ReadonlyArray<ClaudeCodeSession> = []
  private _active: ClaudeCodeSession | null = null
  private nextNumber = 1

  public constructor(private readonly cwd: string) {}

  public get sessions() {
    return this._sessions
  }

  /** The session the panel shows */
  public get active() {
    return this._active
  }

  /** How many sessions have Claude Code running */
  public get runningCount() {
    return this._sessions.filter(s => s.status.kind === 'running').length
  }

  /** Called when sessions come or go, or one changes its status or title */
  public onDidChange(callback: () => void): Disposable {
    return this.emitter.on('did-change', callback)
  }

  /** Adds a new session and makes it the active one */
  public create(options: IClaudeCodeSessionOptions = {}) {
    const session = new ClaudeCodeSession(
      options.cwd ?? this.cwd,
      this.nextNumber++,
      options.args
    )
    this.subscriptions.set(
      session,
      session.onDidChange(() => this.emitChange())
    )
    this._sessions = [...this._sessions, session]
    this._active = session
    this.emitChange()
    return session
  }

  public activate(session: ClaudeCodeSession) {
    this._active = session
    this.emitChange()
  }

  /** Stops the session and shows the one that took its place */
  public close(session: ClaudeCodeSession) {
    const index = this._sessions.indexOf(session)
    if (index === -1) {
      return
    }

    this.subscriptions.get(session)?.dispose()
    this.subscriptions.delete(session)
    session.dispose()

    this._sessions = this._sessions.filter(s => s !== session)
    if (this._active === session) {
      this._active =
        this._sessions[Math.min(index, this._sessions.length - 1)] ?? null
    }
    this.emitChange()
  }

  public dispose() {
    this._sessions.forEach(s => s.dispose())
    this.subscriptions.forEach(s => s.dispose())
    this.emitter.dispose()
  }

  private emitChange() {
    this.emitter.emit('did-change')
    changes.emit('did-change')
  }
}

const sessionsByRepository = new Map<string, ClaudeCodeSessions>()
const changes = new Emitter()

/** The Claude Code sessions of the repository at the given path */
export function getClaudeCodeSessions(repositoryPath: string) {
  let sessions = sessionsByRepository.get(repositoryPath)
  if (sessions === undefined) {
    sessions = new ClaudeCodeSessions(repositoryPath)
    sessionsByRepository.set(repositoryPath, sessions)
  }
  return sessions
}

/** Called when any repository's Claude Code sessions change */
export function onDidChangeClaudeCodeSessions(
  callback: () => void
): Disposable {
  return changes.on('did-change', callback)
}

window.addEventListener('beforeunload', () => {
  sessionsByRepository.forEach(sessions => sessions.dispose())
  sessionsByRepository.clear()
})

/**
 * The login shell's environment, so that Claude Code finds the same tools it
 * finds in a terminal, with the terminal type and the configuration folder
 * from Settings.
 */
async function getEnvironment(cwd: string, settings: ILaunchSettings) {
  let env: Record<string, string | undefined>
  try {
    const result = await getShellEnv(cwd, getGitHookEnvShell())
    env = result.kind === 'success' ? { ...result.env } : { ...process.env }
  } catch (e) {
    log.warn('claude-code: unable to load shell environment', e)
    env = { ...process.env }
  }

  // These would make Claude Code's own runtime act as plain Node.js
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE

  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'

  // Naming the default folder would still change where Claude Code looks
  // for some of its files, so only a different folder is passed on
  if (
    settings.configDirectory !== null &&
    !isDefaultClaudeCodeConfigDirectory(settings.configDirectory)
  ) {
    env.CLAUDE_CONFIG_DIR = untildify(settings.configDirectory)
  }

  return env
}

/** Terminal colors that match the app's light or dark theme */
function readTheme() {
  const style = getComputedStyle(document.body)
  const color = (name: string) => style.getPropertyValue(name).trim()

  return {
    background: color('--background-color'),
    foreground: color('--text-color'),
    cursor: color('--text-color'),
    selectionBackground,
  }
}
