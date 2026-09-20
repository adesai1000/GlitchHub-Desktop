import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Button } from '../lib/button'
import { Terminal } from '../terminal'
import { Repository } from '../../models/repository'
import { IScriptRun } from '../../lib/scripts/script-runner'
import { Dispatcher } from '../dispatcher'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IScriptOutputDialogProps {
  readonly repository: Repository
  readonly run: IScriptRun | undefined
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
}

/** Live output of the script running (or last run) for a repository. */
export class ScriptOutputDialog extends React.Component<IScriptOutputDialogProps> {
  private terminalRef = React.createRef<Terminal>()
  /** `totalChunks` of the run at the time we last wrote to the terminal. */
  private writtenChunks = 0

  public componentDidMount() {
    this.writePendingOutput()
  }

  public componentDidUpdate(prevProps: IScriptOutputDialogProps) {
    if (prevProps.run?.id !== this.props.run?.id) {
      // A different run, start over
      this.terminalRef.current?.Terminal?.reset()
      this.writtenChunks = 0
    }
    this.writePendingOutput()
  }

  private writePendingOutput() {
    const { run } = this.props
    const terminal = this.terminalRef.current
    if (run === undefined || terminal === null) {
      return
    }

    const pending = run.totalChunks - this.writtenChunks
    if (pending <= 0) {
      return
    }

    if (pending > run.output.length) {
      // Older chunks were dropped before we could show them
      terminal.write('[… earlier output truncated …]\r\n')
    }
    terminal.write(
      run.output.slice(-Math.min(pending, run.output.length)).join('')
    )
    this.writtenChunks = run.totalChunks
  }

  private onStop = () => {
    this.props.dispatcher.stopRepositoryScript(this.props.repository)
  }

  private onRunAgain = () => {
    const { run, repository } = this.props
    if (run !== undefined) {
      this.props.dispatcher.runRepositoryScript(repository, run.scriptName, {
        skipConfirmation: true,
      })
    }
  }

  private renderStatus() {
    const { run } = this.props
    if (run === undefined) {
      return null
    }

    const duration =
      run.finishedAt !== null
        ? ` in ${((run.finishedAt - run.startedAt) / 1000).toFixed(1)}s`
        : ''

    switch (run.status) {
      case 'running':
        return (
          <span className="status running">
            <Octicon symbol={octicons.sync} className="spin" /> Running
          </span>
        )
      case 'succeeded':
        return (
          <span className="status succeeded">
            <Octicon symbol={octicons.checkCircle} /> Succeeded{duration}
          </span>
        )
      case 'failed':
        return (
          <span className="status failed">
            <Octicon symbol={octicons.xCircle} /> Failed
            {run.exitCode !== null ? ` with exit code ${run.exitCode}` : ''}
            {duration}
          </span>
        )
      case 'stopped':
        return (
          <span className="status stopped">
            <Octicon symbol={octicons.circleSlash} /> Stopped{duration}
          </span>
        )
    }
  }

  public render() {
    const { run, repository } = this.props
    const title = run
      ? `${run.scriptName} in ${repository.name}`
      : `Scripts in ${repository.name}`
    const isRunning = run?.status === 'running'

    return (
      <Dialog
        id="script-output"
        title={title}
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
        dismissDisabled={false}
        className="script-output-dialog"
      >
        <DialogContent>
          <div className="script-output-header">
            <code className="command">{run?.command}</code>
            {this.renderStatus()}
          </div>
          <div className="script-output-terminal">
            <Terminal ref={this.terminalRef} rows={24} cols={100} />
          </div>
        </DialogContent>
        <DialogFooter>
          <div className="script-output-buttons">
            {isRunning ? (
              <Button onClick={this.onStop} type="button">
                <Octicon symbol={octicons.stop} /> Stop
              </Button>
            ) : (
              <Button
                onClick={this.onRunAgain}
                type="button"
                disabled={run === undefined}
              >
                <Octicon symbol={octicons.play} /> Run again
              </Button>
            )}
            <Button type="submit">Close</Button>
          </div>
        </DialogFooter>
      </Dialog>
    )
  }
}
