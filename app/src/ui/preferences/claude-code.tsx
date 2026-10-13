import * as React from 'react'
import * as Os from 'os'
import * as Path from 'path'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Select } from '../lib/select'
import { TextBox } from '../lib/text-box'
import { Button } from '../lib/button'
import { showOpenDialog } from '../main-process-proxy'
import {
  IClaudeCodeInstallation,
  findClaudeCodeConfigDirectories,
  findClaudeCodeInstallations,
} from '../../lib/claude-code/find-claude-code'

/** The select value for choosing a path that wasn't detected */
const CustomValue = 'custom'

/** The select value for the default: newest installation, `~/.claude` */
const DefaultValue = ''

interface IClaudeCodePreferencesProps {
  readonly toolbarButtonVisible: boolean
  readonly onToolbarButtonVisibleChanged: (visible: boolean) => void

  /** The executable to launch, or null for the newest installation */
  readonly executable: string | null
  readonly onExecutableChanged: (executable: string | null) => void

  /** The configuration folder, or null for Claude Code's default */
  readonly configDirectory: string | null
  readonly onConfigDirectoryChanged: (directory: string | null) => void
}

interface IClaudeCodePreferencesState {
  /** The installations found, or null while looking for them */
  readonly installations: ReadonlyArray<IClaudeCodeInstallation> | null
  readonly configDirectories: ReadonlyArray<string>
  readonly customExecutable: boolean
  readonly customConfigDirectory: boolean
}

/** The Claude Code tab of the Settings dialog */
export class ClaudeCodePreferences extends React.Component<
  IClaudeCodePreferencesProps,
  IClaudeCodePreferencesState
> {
  private unmounted = false

  public constructor(props: IClaudeCodePreferencesProps) {
    super(props)
    this.state = {
      installations: null,
      configDirectories: [],
      customExecutable: false,
      customConfigDirectory: false,
    }
  }

  public async componentDidMount() {
    const [installations, configDirectories] = await Promise.all([
      findClaudeCodeInstallations(),
      findClaudeCodeConfigDirectories(),
    ])

    if (this.unmounted) {
      return
    }

    // A saved path that isn't among the detected ones is a custom path
    const { executable, configDirectory } = this.props
    this.setState({
      installations,
      configDirectories,
      customExecutable:
        executable !== null && !installations.some(i => i.path === executable),
      customConfigDirectory:
        configDirectory !== null &&
        !configDirectories.includes(configDirectory),
    })
  }

  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    return (
      <DialogContent>
        <div className="claude-code-preferences">
          <h2>Claude Code</h2>
          <p className="appearance-section-description">
            Run Claude Code in a panel next to your repository. It starts in the
            repository folder with your login shell's environment, and signs in
            the same way it does in a terminal or in your editor.
          </p>
          <Checkbox
            label="Show the Claude Code button in the toolbar"
            value={
              this.props.toolbarButtonVisible
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onToolbarButtonVisibleChanged}
          />
          {this.renderExecutable()}
          {this.renderConfigDirectory()}
        </div>
      </DialogContent>
    )
  }

  private renderExecutable() {
    const { installations, customExecutable } = this.state

    if (installations === null) {
      return <p>Looking for Claude Code installations…</p>
    }

    const newest = installations.at(0)
    const value = customExecutable
      ? CustomValue
      : this.props.executable ?? DefaultValue

    return (
      <div className="claude-code-preferences-group">
        <Select
          label="Installation"
          value={value}
          onChange={this.onExecutableSelected}
        >
          <option value={DefaultValue}>
            {newest === undefined
              ? 'Newest found (none found yet)'
              : `Newest found: ${describeInstallation(newest)}`}
          </option>
          {installations.map(i => (
            <option key={i.path} value={i.path}>
              {describeInstallation(i)}
            </option>
          ))}
          <option value={CustomValue}>Other…</option>
        </Select>
        <p className="claude-code-preferences-path">
          {customExecutable
            ? 'Choose the claude executable to launch.'
            : this.props.executable ?? newest?.path ?? ''}
        </p>
        {customExecutable && (
          <div className="claude-code-preferences-custom">
            <TextBox
              ariaLabel="Path to the claude executable"
              placeholder="/path/to/claude"
              value={this.props.executable ?? ''}
              onValueChanged={this.onCustomExecutableChanged}
            />
            <Button onClick={this.onChooseExecutable}>Choose…</Button>
          </div>
        )}
      </div>
    )
  }

  private renderConfigDirectory() {
    const { configDirectories, customConfigDirectory } = this.state
    const defaultDirectory = Path.join(Os.homedir(), '.claude')
    const value = customConfigDirectory
      ? CustomValue
      : this.props.configDirectory ?? DefaultValue

    return (
      <div className="claude-code-preferences-group">
        <Select
          label={__DARWIN__ ? 'Configuration Folder' : 'Configuration folder'}
          value={value}
          onChange={this.onConfigDirectorySelected}
        >
          <option value={DefaultValue}>
            {`${tildify(defaultDirectory)} (default)`}
          </option>
          {configDirectories.map(d => (
            <option key={d} value={d}>
              {tildify(d)}
            </option>
          ))}
          <option value={CustomValue}>Other…</option>
        </Select>
        <p className="claude-code-preferences-hint">
          Claude Code keeps its login, settings, and conversations here. The
          default folder is shared with the Claude Code CLI and your editor's
          Claude Code extension, so you stay signed in.
        </p>
        {customConfigDirectory && (
          <div className="claude-code-preferences-custom">
            <TextBox
              ariaLabel="Path to the configuration folder"
              placeholder="~/.claude-work"
              value={this.props.configDirectory ?? ''}
              onValueChanged={this.onCustomConfigDirectoryChanged}
            />
            <Button onClick={this.onChooseConfigDirectory}>Choose…</Button>
          </div>
        )}
      </div>
    )
  }

  private onToolbarButtonVisibleChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onToolbarButtonVisibleChanged(event.currentTarget.checked)
  }

  private onExecutableSelected = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const { value } = event.currentTarget
    const customExecutable = value === CustomValue
    this.setState({ customExecutable })
    if (!customExecutable) {
      this.props.onExecutableChanged(value === DefaultValue ? null : value)
    }
  }

  private onCustomExecutableChanged = (value: string) => {
    this.props.onExecutableChanged(value.trim() === '' ? null : value)
  }

  private onChooseExecutable = async () => {
    const path = await showOpenDialog({
      properties: ['openFile', 'showHiddenFiles'],
    })
    if (path !== null) {
      this.props.onExecutableChanged(path)
    }
  }

  private onConfigDirectorySelected = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const { value } = event.currentTarget
    const customConfigDirectory = value === CustomValue
    this.setState({ customConfigDirectory })
    if (!customConfigDirectory) {
      this.props.onConfigDirectoryChanged(value === DefaultValue ? null : value)
    }
  }

  private onCustomConfigDirectoryChanged = (value: string) => {
    this.props.onConfigDirectoryChanged(value.trim() === '' ? null : value)
  }

  private onChooseConfigDirectory = async () => {
    const path = await showOpenDialog({
      properties: ['openDirectory', 'createDirectory', 'showHiddenFiles'],
    })
    if (path !== null) {
      this.props.onConfigDirectoryChanged(path)
    }
  }
}

function describeInstallation({ version, source }: IClaudeCodeInstallation) {
  return version === null ? source : `${version} (${source})`
}

function tildify(path: string) {
  const home = Os.homedir()
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path
}
