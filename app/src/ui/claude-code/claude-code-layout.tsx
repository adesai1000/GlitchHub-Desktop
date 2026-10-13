import * as React from 'react'
import { Repository } from '../../models/repository'
import { ClaudeCodePanel } from './claude-code-panel'
import {
  defaultClaudeCodePanelWidth,
  getClaudeCodePanelOpen,
  getClaudeCodePanelWidth,
  moveMistakenConfigDirectory,
  setClaudeCodePanelOpen,
  setClaudeCodePanelWidth,
} from '../../lib/claude-code/claude-code-settings'
import { isClaudeCodeConfigDirectorySync } from '../../lib/claude-code/claude-code-conversations'

interface IClaudeCodeLayoutProps {
  /** The selected repository, or null when none is selected */
  readonly repository: Repository | null
  readonly onOpenSettings: () => void
  readonly children: React.ReactNode
}

interface IClaudeCodeLayoutState {
  readonly isOpen: boolean
  readonly width: number
}

/**
 * Lays out the repository view with the Claude Code panel on its right, and
 * remembers whether the panel is open and how wide it is.
 */
export class ClaudeCodeLayout extends React.Component<
  IClaudeCodeLayoutProps,
  IClaudeCodeLayoutState
> {
  public constructor(props: IClaudeCodeLayoutProps) {
    super(props)
    moveMistakenConfigDirectory(isClaudeCodeConfigDirectorySync)
    this.state = {
      isOpen: getClaudeCodePanelOpen(),
      width: getClaudeCodePanelWidth(),
    }
  }

  /** Shows the panel, or hides it if it's showing */
  public toggle() {
    this.setOpen(!this.state.isOpen)
  }

  public render() {
    const { repository } = this.props

    return (
      <div id="claude-code-layout">
        {this.props.children}
        {this.state.isOpen && (
          <ClaudeCodePanel
            // One panel for the whole app, so switching repositories keeps
            // the same sessions on screen. The key has to differ from the
            // repository view's beside it, which uses the repository's hash:
            // siblings with the same key leave a stale view on screen.
            key="claude-code-panel"
            repository={repository}
            width={this.state.width}
            onWidthChanged={this.onWidthChanged}
            onWidthReset={this.onWidthReset}
            onClose={this.onClose}
            onOpenSettings={this.props.onOpenSettings}
          />
        )}
      </div>
    )
  }

  private setOpen(isOpen: boolean) {
    setClaudeCodePanelOpen(isOpen)
    this.setState({ isOpen })
  }

  private onClose = () => {
    this.setOpen(false)
  }

  private onWidthChanged = (width: number) => {
    setClaudeCodePanelWidth(width)
    this.setState({ width })
  }

  private onWidthReset = () => {
    this.onWidthChanged(defaultClaudeCodePanelWidth)
  }
}
