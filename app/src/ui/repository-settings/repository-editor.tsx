import * as React from 'react'
import { DialogContent } from '../dialog'
import { Select } from '../lib/select'

/** Sentinel option meaning "no override, use the editor from Settings". */
export const DefaultEditorValue = '__default__'

interface IRepositoryEditorProps {
  /** Editors installed on this machine, by name. */
  readonly availableEditors: ReadonlyArray<string>
  /** The editor chosen in Settings, shown as the default. */
  readonly defaultEditor: string | null
  /** The override for this repository, null for none. */
  readonly editor: string | null
  readonly onEditorChanged: (editor: string | null) => void
}

/** The Editor tab of Repository Settings. */
export class RepositoryEditor extends React.Component<IRepositoryEditorProps> {
  private onChange = (event: React.FormEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value
    this.props.onEditorChanged(value === DefaultEditorValue ? null : value)
  }

  public render() {
    const { availableEditors, defaultEditor, editor } = this.props
    const defaultLabel = defaultEditor
      ? `Use default (${defaultEditor})`
      : 'Use default'
    // Keep a stale override visible so it can be cleared even if the editor
    // has since been uninstalled.
    const options =
      editor !== null && !availableEditors.includes(editor)
        ? [...availableEditors, editor]
        : availableEditors

    return (
      <DialogContent>
        <p id="repository-editor-description">
          Choose which editor opens this repository. "Open in editor" buttons
          and menu items use it instead of the editor from Settings.
        </p>
        <Select
          label={__DARWIN__ ? 'External Editor' : 'External editor'}
          value={editor ?? DefaultEditorValue}
          onChange={this.onChange}
        >
          <option value={DefaultEditorValue}>{defaultLabel}</option>
          {options.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </DialogContent>
    )
  }
}
