import * as React from 'react'
import { Disposable } from 'event-kit'
import { Repository } from '../../models/repository'
import { ToolbarButton, ToolbarButtonStyle } from '../toolbar/button'
import * as octicons from '../octicons/octicons.generated'
import {
  getClaudeCodeSessions,
  onDidChangeClaudeCodeSessions,
} from './claude-code-session'

interface IClaudeCodeToolbarButtonProps {
  readonly repository: Repository
  readonly onClick: () => void
}

/**
 * The toolbar button that shows or hides the Claude Code panel, with how
 * many sessions are running for the repository.
 */
export class ClaudeCodeToolbarButton extends React.Component<IClaudeCodeToolbarButtonProps> {
  private subscription: Disposable | null = null

  public componentDidMount() {
    this.subscription = onDidChangeClaudeCodeSessions(() => this.forceUpdate())
  }

  public componentWillUnmount() {
    this.subscription?.dispose()
  }

  public render() {
    const { runningCount } = getClaudeCodeSessions(this.props.repository.path)
    const shortcut = __DARWIN__ ? '⌘Esc' : 'Ctrl+Esc'
    const description =
      runningCount === 0 ? 'Not running' : `${runningCount} running`

    return (
      <ToolbarButton
        className="claude-code-button"
        title="Claude Code"
        description={description}
        tooltip={`Show or hide Claude Code (${shortcut})`}
        icon={octicons.sparkle}
        style={ToolbarButtonStyle.Subtitle}
        onClick={this.props.onClick}
      />
    )
  }
}
