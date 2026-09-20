import * as React from 'react'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Select } from '../lib/select'
import { Repository } from '../../models/repository'
import { RepositoryScriptsEditor } from '../scripts/repository-scripts-editor'
import {
  IRepositoryScripts,
  IRepositoryScriptsConfig,
  PackageManager,
  packageManagers,
} from '../../lib/scripts/repository-scripts'

interface IScriptsPreferencesProps {
  readonly toolbarButtonVisible: boolean
  readonly onToolbarButtonVisibleChanged: (visible: boolean) => void
  readonly alwaysConfirm: boolean
  readonly onAlwaysConfirmChanged: (confirm: boolean) => void
  readonly preferredPackageManager: PackageManager | undefined
  readonly onPreferredPackageManagerChanged: (
    pm: PackageManager | undefined
  ) => void

  /** All local repositories the user can configure scripts for. */
  readonly repositories: ReadonlyArray<Repository>
  readonly selectedRepository: Repository | null
  readonly onSelectedRepositoryChanged: (repository: Repository) => void
  /** Scripts of the selected repository, undefined while loading. */
  readonly scripts: IRepositoryScripts | null | undefined
  readonly config: IRepositoryScriptsConfig
  readonly onConfigChanged: (config: IRepositoryScriptsConfig) => void
}

/** The Scripts tab of the Settings dialog. */
export class Scripts extends React.Component<IScriptsPreferencesProps> {
  private onToolbarButtonVisibleChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onToolbarButtonVisibleChanged(event.currentTarget.checked)
  }

  private onAlwaysConfirmChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onAlwaysConfirmChanged(event.currentTarget.checked)
  }

  private onPackageManagerChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const value = event.currentTarget.value
    this.props.onPreferredPackageManagerChanged(
      packageManagers.find(pm => pm === value)
    )
  }

  private onRepositoryChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    const id = parseInt(event.currentTarget.value, 10)
    const repository = this.props.repositories.find(r => r.id === id)
    if (repository !== undefined) {
      this.props.onSelectedRepositoryChanged(repository)
    }
  }

  public render() {
    const { repositories, selectedRepository } = this.props

    return (
      <DialogContent>
        <div className="scripts-section">
          <h2>{__DARWIN__ ? 'Running Scripts' : 'Running scripts'}</h2>
          <p className="appearance-section-description">
            Run scripts from a repository's <code>package.json</code> straight
            from the toolbar. Scripts run in the repository folder using your
            login shell's environment.
          </p>
          <Checkbox
            label="Show the Run script button in the toolbar"
            value={
              this.props.toolbarButtonVisible
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onToolbarButtonVisibleChanged}
          />
          <Checkbox
            label="Always ask for confirmation before running a script"
            value={
              this.props.alwaysConfirm ? CheckboxValue.On : CheckboxValue.Off
            }
            onChange={this.onAlwaysConfirmChanged}
          />
          <Select
            label={__DARWIN__ ? 'Package Manager' : 'Package manager'}
            value={this.props.preferredPackageManager ?? 'auto'}
            onChange={this.onPackageManagerChanged}
          >
            <option value="auto">Detect from lock file (default)</option>
            {packageManagers.map(pm => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </Select>
        </div>

        <div className="scripts-section">
          <h2>
            {__DARWIN__ ? 'Scripts per Repository' : 'Scripts per repository'}
          </h2>
          <p className="appearance-section-description">
            Choose which scripts each repository shows in the toolbar.
          </p>
          {repositories.length === 0 ? (
            <p className="scripts-empty">No repositories added yet.</p>
          ) : (
            <>
              <Select
                label="Repository"
                value={selectedRepository ? `${selectedRepository.id}` : ''}
                onChange={this.onRepositoryChanged}
              >
                {repositories.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              {selectedRepository !== null ? (
                <RepositoryScriptsEditor
                  scripts={this.props.scripts}
                  config={this.props.config}
                  onConfigChanged={this.props.onConfigChanged}
                />
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    )
  }
}
