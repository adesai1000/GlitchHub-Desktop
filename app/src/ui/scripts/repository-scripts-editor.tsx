import * as React from 'react'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Ref } from '../lib/ref'
import {
  IRepositoryScript,
  IRepositoryScripts,
  IRepositoryScriptsConfig,
} from '../../lib/scripts/repository-scripts'

interface IScriptRowProps {
  readonly script: IRepositoryScript
  readonly enabled: boolean
  readonly confirm: boolean
  readonly onEnabledChanged: (name: string, on: boolean) => void
  readonly onConfirmChanged: (name: string, on: boolean) => void
}

class ScriptRow extends React.Component<IScriptRowProps> {
  private onEnabledChanged = (event: React.FormEvent<HTMLInputElement>) => {
    this.props.onEnabledChanged(
      this.props.script.name,
      event.currentTarget.checked
    )
  }

  private onConfirmChanged = (event: React.FormEvent<HTMLInputElement>) => {
    this.props.onConfirmChanged(
      this.props.script.name,
      event.currentTarget.checked
    )
  }

  public render() {
    const { script, enabled, confirm } = this.props
    const nameId = `script-name-${script.name}`

    return (
      <tr className={enabled ? 'enabled' : ''}>
        <td className="show-column">
          <Checkbox
            value={enabled ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onEnabledChanged}
            ariaLabelledBy={nameId}
          />
        </td>
        <td className="confirm-column">
          <Checkbox
            value={confirm ? CheckboxValue.On : CheckboxValue.Off}
            disabled={!enabled}
            onChange={this.onConfirmChanged}
            ariaLabelledBy={nameId}
          />
        </td>
        <td className="script-column">
          <div className="script-name" id={nameId}>
            {script.name}
          </div>
          <div className="script-command">{script.command}</div>
        </td>
      </tr>
    )
  }
}

interface IRepositoryScriptsEditorProps {
  /** The scripts discovered in the repository, null while loading. */
  readonly scripts: IRepositoryScripts | null | undefined
  readonly config: IRepositoryScriptsConfig
  readonly onConfigChanged: (config: IRepositoryScriptsConfig) => void
}

/**
 * A table of a repository's package.json scripts with a checkbox to expose
 * each one in the toolbar and another to require confirmation before it runs.
 * Shared between Repository Settings and the Scripts tab in Settings.
 */
export class RepositoryScriptsEditor extends React.Component<IRepositoryScriptsEditorProps> {
  private toggle(list: ReadonlyArray<string>, name: string, on: boolean) {
    const without = list.filter(x => x !== name)
    return on ? [...without, name] : without
  }

  private onEnabledChanged = (name: string, on: boolean) => {
    const { config } = this.props
    this.props.onConfigChanged({
      enabled: this.toggle(config.enabled, name, on),
      // A script that isn't shown doesn't need a confirmation flag
      confirm: on ? config.confirm : this.toggle(config.confirm, name, false),
    })
  }

  private onConfirmChanged = (name: string, on: boolean) => {
    const { config } = this.props
    this.props.onConfigChanged({
      ...config,
      confirm: this.toggle(config.confirm, name, on),
    })
  }

  public render() {
    const { scripts, config } = this.props

    if (scripts === undefined) {
      return <p className="scripts-empty">Looking for scripts…</p>
    }

    if (scripts === null) {
      return (
        <p className="scripts-empty">
          No scripts found. Add a <Ref>scripts</Ref> section to the repository's{' '}
          <Ref>package.json</Ref> and they will show up here.
        </p>
      )
    }

    return (
      <div className="repository-scripts-editor">
        <p className="scripts-summary">
          {scripts.scripts.length} scripts, run with{' '}
          <Ref>{scripts.packageManager}</Ref>
          {scripts.detectedFromLockFile ? ' (detected from the lock file)' : ''}
          . Tick <strong>Show</strong> to add a script to the toolbar and{' '}
          <strong>Confirm</strong> to be asked before it runs.
        </p>
        <table className="scripts-table">
          <thead>
            <tr>
              <th className="show-column">Show</th>
              <th className="confirm-column">Confirm</th>
              <th>Script</th>
            </tr>
          </thead>
          <tbody>
            {scripts.scripts.map(script => (
              <ScriptRow
                key={script.name}
                script={script}
                enabled={config.enabled.includes(script.name)}
                confirm={config.confirm.includes(script.name)}
                onEnabledChanged={this.onEnabledChanged}
                onConfirmChanged={this.onConfirmChanged}
              />
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}
