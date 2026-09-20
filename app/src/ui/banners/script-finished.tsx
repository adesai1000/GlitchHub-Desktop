import * as React from 'react'
import { Banner } from './banner'
import { SuccessBanner } from './success-banner'
import { LinkButton } from '../lib/link-button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { PopupType } from '../../models/popup'

interface IScriptFinishedProps {
  readonly repository: Repository
  readonly runId: number
  readonly scriptName: string
  readonly status: 'succeeded' | 'failed' | 'stopped'
  readonly exitCode: number | null
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
}

/** Shown when a script finishes while its output isn't on screen. */
export class ScriptFinished extends React.Component<IScriptFinishedProps> {
  private onViewOutput = () => {
    this.props.onDismissed()
    this.props.dispatcher.showPopup({
      type: PopupType.ScriptOutput,
      repository: this.props.repository,
      runId: this.props.runId,
    })
  }

  public render() {
    const { status, exitCode, scriptName, repository, onDismissed } = this.props

    const name = (
      <span>
        <strong>{scriptName}</strong> in <strong>{repository.name}</strong>
      </span>
    )

    if (status === 'succeeded') {
      return (
        <SuccessBanner timeout={8000} onDismissed={onDismissed}>
          <div className="banner-message">
            <span>{name} finished successfully.</span>{' '}
            <LinkButton onClick={this.onViewOutput}>View output</LinkButton>
          </div>
        </SuccessBanner>
      )
    }

    const message =
      status === 'stopped'
        ? ' was stopped.'
        : exitCode !== null
        ? ` failed with exit code ${exitCode}.`
        : ' failed.'

    return (
      <Banner
        id="script-finished"
        className="script-failed"
        dismissable={true}
        onDismissed={onDismissed}
      >
        <Octicon className="alert-icon" symbol={octicons.alert} />
        <div className="banner-message">
          <span>
            {name}
            {message}
          </span>{' '}
          <LinkButton onClick={this.onViewOutput}>View output</LinkButton>
        </div>
      </Banner>
    )
  }
}
