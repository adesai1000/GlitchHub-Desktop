import * as React from 'react'
import * as Os from 'os'
import * as Path from 'path'
import untildify from 'untildify'
import { Disposable } from 'event-kit'
import classNames from 'classnames'
import { Repository } from '../../models/repository'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'
import { clamp } from '../../lib/clamp'
import { IMenuItem, showContextualMenu } from '../../lib/menu-item'
import { showOpenDialog } from '../main-process-proxy'
import { findClaudeCodeFolders } from '../../lib/claude-code/claude-code-conversations'
import {
  getClaudeCodeConfigDirectory,
  getClaudeCodeWorkingDirectory,
} from '../../lib/claude-code/claude-code-settings'
import {
  ClaudeCodeSession,
  ClaudeCodeSessions,
  IClaudeCodeSessionOptions,
  getClaudeCodeSessions,
} from './claude-code-session'

/** The narrowest and widest the panel can be dragged to */
const minimumWidth = 320
const maximumWidthFraction = 0.75

interface IClaudeCodePanelProps {
  /**
   * The selected repository, if any. New sessions run in its folder when
   * Settings has no working folder.
   */
  readonly repository: Repository | null
  readonly width: number
  readonly onWidthChanged: (width: number) => void
  readonly onWidthReset: () => void
  readonly onClose: () => void
  readonly onOpenSettings: () => void
}

interface IClaudeCodeSessionTabProps {
  readonly session: ClaudeCodeSession
  readonly isActive: boolean

  readonly onSelect: (session: ClaudeCodeSession) => void
  readonly onClose: (session: ClaudeCodeSession) => void
}

/** A tab for one Claude Code session, named after its conversation */
class ClaudeCodeSessionTab extends React.Component<IClaudeCodeSessionTabProps> {
  public render() {
    const { session, isActive } = this.props
    const isRunning = session.status.kind === 'running'
    const folder = Path.basename(session.cwd)

    return (
      <div
        className={classNames('claude-code-tab', { active: isActive })}
        role="tab"
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        onClick={this.onClick}
        onKeyDown={this.onKeyDown}
        onAuxClick={this.onAuxClick}
      >
        <span
          className={classNames('claude-code-tab-status', {
            running: isRunning,
          })}
        />
        <span className="claude-code-tab-title">{session.title}</span>
        <span className="claude-code-tab-folder">{folder}</span>
        <button
          type="button"
          className="claude-code-tab-close"
          tabIndex={-1}
          aria-label={`Close ${session.title}`}
          onClick={this.onCloseClick}
        >
          <Octicon symbol={octicons.x} />
        </button>
      </div>
    )
  }

  private onClick = () => {
    this.props.onSelect(this.props.session)
  }

  private onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      this.props.onSelect(this.props.session)
    }
  }

  /** Closes the tab on middle click, like an editor */
  private onAuxClick = (event: React.MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault()
      this.props.onClose(this.props.session)
    }
  }

  private onCloseClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    this.props.onClose(this.props.session)
  }
}

/**
 * A panel on the right of the window that runs Claude Code, in the working
 * folder from Settings or the selected repository's folder. Its sessions,
 * shown as tabs, belong to the app rather than a repository: they stay put
 * when another repository is selected, and keep running while the panel is
 * hidden.
 */
export class ClaudeCodePanel extends React.Component<IClaudeCodePanelProps> {
  private readonly hostRef = React.createRef<HTMLDivElement>()
  private readonly sessions: ClaudeCodeSessions
  private subscription: Disposable | null = null
  private resizeObserver: ResizeObserver | null = null
  private attached: ClaudeCodeSession | null = null
  private dragStartX = 0
  private dragStartWidth = 0

  public constructor(props: IClaudeCodePanelProps) {
    super(props)
    this.sessions = getClaudeCodeSessions()
  }

  public componentDidMount() {
    this.subscription = this.sessions.onDidChange(() => this.forceUpdate())

    const host = this.hostRef.current
    if (host !== null) {
      this.resizeObserver = new ResizeObserver(() => this.attached?.fit())
      this.resizeObserver.observe(host)
    }

    if (this.sessions.sessions.length === 0) {
      this.startSession({})
    }
    this.attachActiveSession()
  }

  public componentDidUpdate() {
    this.attachActiveSession()
  }

  public componentWillUnmount() {
    this.subscription?.dispose()
    this.resizeObserver?.disconnect()
    this.attached?.detach()
    this.attached = null
    document.removeEventListener('mousemove', this.onDragMove)
    document.removeEventListener('mouseup', this.onDragEnd)
  }

  /** Moves the active session's terminal into the panel when it changes */
  private attachActiveSession() {
    const host = this.hostRef.current
    const { active } = this.sessions
    if (host === null || active === this.attached) {
      return
    }

    this.attached?.detach()
    this.attached = active
    if (active !== null) {
      active.attach(host)
      active.focus()
    }
  }

  public render() {
    const { active, sessions } = this.sessions

    return (
      <div id="claude-code-panel" style={{ width: this.props.width }}>
        <button
          // Prevent form submission with this button
          type="button"
          tabIndex={-1}
          className="claude-code-resize-handle"
          aria-label="Resize Claude Code"
          onMouseDown={this.onDragStart}
          onDoubleClick={this.props.onWidthReset}
        />
        <div className="claude-code-header">
          <Octicon className="claude-code-icon" symbol={octicons.sparkle} />
          <div
            className="claude-code-tabs"
            role="tablist"
            aria-label="Claude Code sessions"
          >
            {sessions.map(session => (
              <ClaudeCodeSessionTab
                key={session.number}
                session={session}
                isActive={session === active}
                onSelect={this.onSelectSession}
                onClose={this.onCloseSession}
              />
            ))}
          </div>
          <Button
            className="claude-code-header-button"
            onClick={this.onShowNewSessionMenu}
            ariaLabel="New session or past conversation"
            tooltip="Start a session, or continue a past conversation"
          >
            <Octicon symbol={octicons.plus} />
          </Button>
          <Button
            className="claude-code-header-button"
            onClick={this.onRestart}
            disabled={active === null}
            ariaLabel="Restart this session"
            tooltip="Restart this session with the current Settings"
          >
            <Octicon symbol={octicons.sync} />
          </Button>
          <Button
            className="claude-code-header-button"
            onClick={this.props.onClose}
            ariaLabel="Hide Claude Code"
            tooltip="Hide Claude Code. Sessions keep running."
          >
            <Octicon symbol={octicons.x} />
          </Button>
        </div>
        {active?.hasOutdatedSettings && active.status.kind === 'running' && (
          <div className="claude-code-notice">
            <span>
              Claude Code's settings changed since this session started. Restart
              it to use them.
            </span>
            <Button onClick={this.onRestart}>Restart</Button>
          </div>
        )}
        <div className="claude-code-terminal" ref={this.hostRef} />
        {this.renderStatus(active)}
      </div>
    )
  }

  private renderStatus(session: ClaudeCodeSession | null) {
    if (session === null) {
      return (
        <div className="claude-code-status">
          <p>No Claude Code sessions are open.</p>
          <div className="claude-code-status-actions">
            <Button onClick={this.onNewSession}>
              {__DARWIN__ ? 'New Session' : 'New session'}
            </Button>
          </div>
        </div>
      )
    }

    const { status } = session

    switch (status.kind) {
      case 'not-found':
        return (
          <div className="claude-code-status">
            <p>
              StickShift couldn't find Claude Code. Install it, or choose its
              location in Settings.
            </p>
            <div className="claude-code-status-actions">
              <Button onClick={this.props.onOpenSettings}>
                {__DARWIN__ ? 'Open Settings' : 'Open options'}
              </Button>
              <Button onClick={this.onRestart}>Try Again</Button>
            </div>
          </div>
        )
      case 'failed':
        return (
          <div className="claude-code-status">
            <p>Claude Code couldn't start: {status.message}</p>
            <div className="claude-code-status-actions">
              <Button onClick={this.onRestart}>Try Again</Button>
            </div>
          </div>
        )
      case 'exited':
        return (
          <div className="claude-code-status exited">
            <span>Claude Code exited.</span>
            <Button onClick={this.onRestart}>Restart</Button>
          </div>
        )
      case 'idle':
      case 'starting':
      case 'running':
        return null
    }
  }

  private onSelectSession = (session: ClaudeCodeSession) => {
    this.sessions.activate(session)
  }

  private onCloseSession = (session: ClaudeCodeSession) => {
    this.sessions.close(session)
  }

  private onNewSession = () => {
    this.startSession({})
  }

  private startSession(
    options: Omit<IClaudeCodeSessionOptions, 'fallbackFolder'>
  ) {
    this.sessions
      .create({ ...options, fallbackFolder: this.fallbackFolder })
      .start()
  }

  /** Where a session runs when Settings has no working folder */
  private get fallbackFolder() {
    return this.props.repository?.path ?? Os.homedir()
  }

  /** Where a new session runs */
  private get defaultFolder() {
    const workingDirectory = getClaudeCodeWorkingDirectory()
    return workingDirectory !== null
      ? untildify(workingDirectory)
      : this.fallbackFolder
  }

  /**
   * Offers a new session, and the conversations Claude Code kept for the
   * folder new sessions run in or a folder above it. Conversations belong to
   * the folder Claude Code ran in, so ones started in a parent folder only
   * show up in sessions that run there too.
   */
  private onShowNewSessionMenu = async () => {
    const { defaultFolder } = this
    const folders = await findClaudeCodeFolders(
      defaultFolder,
      getClaudeCodeConfigDirectory()
    )

    const items: IMenuItem[] = [
      {
        label: `${
          __DARWIN__ ? 'New Session in' : 'New session in'
        } ${Path.basename(defaultFolder)}`,
        action: this.onNewSession,
      },
    ]

    if (folders.length > 0) {
      items.push(
        { type: 'separator' },
        {
          label: __DARWIN__ ? 'Past Conversations' : 'Past conversations',
          enabled: false,
        }
      )
    }

    for (const { path, conversationCount } of folders) {
      const name = Path.basename(path)
      const count = `${conversationCount} conversation${
        conversationCount === 1 ? '' : 's'
      }`

      items.push({
        label: `${name} (${count})`,
        submenu: [
          {
            label: __DARWIN__
              ? 'Continue Last Conversation'
              : 'Continue last conversation',
            action: () =>
              this.startSession({ folder: path, args: ['--continue'] }),
          },
          {
            label: __DARWIN__
              ? 'Choose a Conversation…'
              : 'Choose a conversation…',
            action: () =>
              this.startSession({ folder: path, args: ['--resume'] }),
          },
          { type: 'separator' },
          {
            label: __DARWIN__ ? 'New Session Here' : 'New session here',
            action: () => this.startSession({ folder: path }),
          },
        ],
      })
    }

    items.push(
      { type: 'separator' },
      {
        label: __DARWIN__ ? 'New Session in Folder…' : 'New session in folder…',
        action: this.onNewSessionInFolder,
      }
    )

    showContextualMenu(items)
  }

  private onNewSessionInFolder = async () => {
    const path = await showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: this.defaultFolder,
    })
    if (path !== null) {
      this.startSession({ folder: path })
    }
  }

  private onRestart = async () => {
    const { active } = this.sessions
    if (active !== null) {
      await active.start()
      active.focus()
    }
  }

  private onDragStart = (event: React.MouseEvent) => {
    event.preventDefault()
    this.dragStartX = event.clientX
    this.dragStartWidth = this.props.width
    document.addEventListener('mousemove', this.onDragMove)
    document.addEventListener('mouseup', this.onDragEnd)
  }

  /** The panel sits on the right, so dragging left makes it wider */
  private onDragMove = (event: MouseEvent) => {
    const maximumWidth = Math.max(
      minimumWidth,
      window.innerWidth * maximumWidthFraction
    )
    const width = this.dragStartWidth + this.dragStartX - event.clientX
    this.props.onWidthChanged(clamp(width, minimumWidth, maximumWidth))
  }

  private onDragEnd = () => {
    document.removeEventListener('mousemove', this.onDragMove)
    document.removeEventListener('mouseup', this.onDragEnd)
  }
}
