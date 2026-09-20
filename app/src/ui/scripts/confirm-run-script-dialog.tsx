import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Repository } from '../../models/repository'
import { Ref } from '../lib/ref'
import { Dispatcher } from '../dispatcher'

interface IConfirmRunScriptDialogProps {
  readonly repository: Repository
  readonly scriptName: string
  readonly command: string
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
}

/** Asks before running a script that was flagged as needing confirmation. */
export class ConfirmRunScriptDialog extends React.Component<IConfirmRunScriptDialogProps> {
  private onSubmit = () => {
    const { dispatcher, repository, scriptName } = this.props
    this.props.onDismissed()
    dispatcher.runRepositoryScript(repository, scriptName, {
      skipConfirmation: true,
    })
  }

  public render() {
    return (
      <Dialog
        id="confirm-run-script"
        title={__DARWIN__ ? 'Run Script?' : 'Run script?'}
        type="warning"
        role="alertdialog"
        ariaDescribedBy="confirm-run-script-message"
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
      >
        <DialogContent>
          <p id="confirm-run-script-message">
            Run <Ref>{this.props.scriptName}</Ref> in{' '}
            <strong>{this.props.repository.name}</strong>? This will execute:
          </p>
          <pre className="confirm-run-script-command">{this.props.command}</pre>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={__DARWIN__ ? 'Run Script' : 'Run script'}
            destructive={true}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
