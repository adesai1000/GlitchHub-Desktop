import * as React from 'react'
import { DialogContent } from '../dialog'
import { RepositoryScriptsEditor } from '../scripts/repository-scripts-editor'
import {
  IRepositoryScripts,
  IRepositoryScriptsConfig,
} from '../../lib/scripts/repository-scripts'

interface IRepositoryScriptsProps {
  readonly scripts: IRepositoryScripts | null | undefined
  readonly config: IRepositoryScriptsConfig
  readonly onConfigChanged: (config: IRepositoryScriptsConfig) => void
}

/** The Scripts tab of Repository Settings. */
export class RepositoryScripts extends React.Component<IRepositoryScriptsProps> {
  public render() {
    return (
      <DialogContent>
        <p id="repository-scripts-description">
          Scripts you enable here appear in the <strong>Run script</strong>{' '}
          button in the toolbar and run in this repository's folder with your
          shell environment.
        </p>
        <RepositoryScriptsEditor
          scripts={this.props.scripts}
          config={this.props.config}
          onConfigChanged={this.props.onConfigChanged}
        />
      </DialogContent>
    )
  }
}
