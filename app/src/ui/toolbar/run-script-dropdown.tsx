import * as React from 'react'
import { Dispatcher } from '../dispatcher'
import * as octicons from '../octicons/octicons.generated'
import { Octicon, OcticonSymbol } from '../octicons'
import { Repository } from '../../models/repository'
import { ToolbarDropdown, DropdownState } from './dropdown'
import { FoldoutType, IConstrainedValue } from '../../lib/app-state'
import { Resizable } from '../resizable'
import { enableResizingToolbarButtons } from '../../lib/feature-flag'
import { PopupType } from '../../models/popup'
import { RepositorySettingsTab } from '../repository-settings/repository-settings'
import {
  discoverRepositoryScripts,
  getRepositoryScriptsConfig,
  IRepositoryScript,
  IRepositoryScripts,
} from '../../lib/scripts/repository-scripts'
import { IScriptRun, ScriptRunStatus } from '../../lib/scripts/script-runner'
import { Button } from '../lib/button'
import { LinkButton } from '../lib/link-button'
import { TabBar } from '../tab-bar'
import { RelativeTime } from '../relative-time'

interface IRunScriptDropdownProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  /** Runs for this repository, newest first. */
  readonly runs: ReadonlyArray<IScriptRun>
  readonly isOpen: boolean
  readonly onDropDownStateChanged: (state: DropdownState) => void
  readonly enableFocusTrap: boolean
  readonly runScriptDropdownWidth: IConstrainedValue
}

enum RunScriptTab {
  Scripts = 0,
  History,
}

interface IRunScriptDropdownState {
  /** undefined while loading, null when the repository has no scripts */
  readonly scripts: IRepositoryScripts | null | undefined
  readonly selectedTab: RunScriptTab
}

function statusIcon(status: ScriptRunStatus): OcticonSymbol {
  switch (status) {
    case 'running':
      return octicons.sync
    case 'succeeded':
      return octicons.checkCircle
    case 'failed':
      return octicons.xCircle
    case 'stopped':
      return octicons.circleSlash
  }
}

function statusLabel(run: IScriptRun) {
  switch (run.status) {
    case 'running':
      return 'Running'
    case 'succeeded':
      return 'Succeeded'
    case 'failed':
      return run.exitCode !== null ? `Failed (exit ${run.exitCode})` : 'Failed'
    case 'stopped':
      return 'Stopped'
  }
}

function formatDuration(run: IScriptRun) {
  const end = run.finishedAt ?? Date.now()
  const seconds = (end - run.startedAt) / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  }
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds - minutes * 60)}s`
}

interface IScriptListItemProps {
  readonly script: IRepositoryScript
  readonly disabled: boolean
  readonly confirm: boolean
  readonly onRun: (scriptName: string) => void
}

class ScriptListItem extends React.Component<IScriptListItemProps> {
  private onClick = () => {
    this.props.onRun(this.props.script.name)
  }

  public render() {
    const { script, disabled, confirm } = this.props
    return (
      <li>
        <Button
          className="script-item"
          disabled={disabled}
          onClick={this.onClick}
          tooltip={script.command}
        >
          <Octicon symbol={octicons.play} />
          <span className="script-item-name">{script.name}</span>
          {confirm ? (
            <Octicon
              symbol={octicons.shield}
              className="confirm-marker"
              title="Asks for confirmation"
            />
          ) : null}
        </Button>
      </li>
    )
  }
}

interface IHistoryItemProps {
  readonly run: IScriptRun
  readonly onOpen: (run: IScriptRun) => void
}

class HistoryItem extends React.Component<IHistoryItemProps> {
  private onClick = () => {
    this.props.onOpen(this.props.run)
  }

  public render() {
    const { run } = this.props
    return (
      <li>
        <Button
          className={`history-item ${run.status}`}
          onClick={this.onClick}
          tooltip={run.command}
        >
          <Octicon
            symbol={statusIcon(run.status)}
            className={run.status === 'running' ? 'spin' : undefined}
          />
          <span className="history-item-main">
            <span className="history-item-name">{run.scriptName}</span>
            <span className="history-item-meta">
              {statusLabel(run)} · {formatDuration(run)} ·{' '}
              <RelativeTime
                date={new Date(run.startedAt)}
                onlyRelative={true}
              />
            </span>
          </span>
        </Button>
      </li>
    )
  }
}

/**
 * Toolbar button with two tabs: the package.json scripts the user enabled
 * for the repository, and the history of runs with their output.
 */
export class RunScriptDropdown extends React.Component<
  IRunScriptDropdownProps,
  IRunScriptDropdownState
> {
  public constructor(props: IRunScriptDropdownProps) {
    super(props)
    this.state = { scripts: undefined, selectedTab: RunScriptTab.Scripts }
  }

  public componentDidMount() {
    this.loadScripts()
  }

  public componentDidUpdate(prevProps: IRunScriptDropdownProps) {
    // Reload when the repository changes, and whenever the dropdown opens so
    // that edits to package.json or the settings are picked up.
    if (
      prevProps.repository.path !== this.props.repository.path ||
      (this.props.isOpen && !prevProps.isOpen)
    ) {
      this.loadScripts()
    }
  }

  private async loadScripts() {
    const path = this.props.repository.path
    const scripts = await discoverRepositoryScripts(path)
    if (this.props.repository.path === path) {
      this.setState({ scripts })
    }
  }

  private get runningRun() {
    return this.props.runs.find(r => r.status === 'running')
  }

  private onTabClicked = (index: number) => {
    this.setState({ selectedTab: index })
  }

  private onRunScript = (scriptName: string) => {
    this.props.dispatcher.closeFoldout(FoldoutType.RunScript)
    this.props.dispatcher.runRepositoryScript(this.props.repository, scriptName)
  }

  private onStop = () => {
    this.props.dispatcher.stopRepositoryScript(this.props.repository)
  }

  private onOpenRun = (run: IScriptRun) => {
    this.props.dispatcher.closeFoldout(FoldoutType.RunScript)
    this.props.dispatcher.showPopup({
      type: PopupType.ScriptOutput,
      repository: this.props.repository,
      runId: run.id,
    })
  }

  private onViewRunningOutput = () => {
    const running = this.runningRun
    if (running !== undefined) {
      this.onOpenRun(running)
    }
  }

  private onClearHistory = () => {
    this.props.dispatcher.clearRepositoryScriptHistory(this.props.repository)
  }

  private onResize = (width: number) => {
    this.props.dispatcher.setRunScriptDropdownWidth(width)
  }

  private onReset = () => {
    this.props.dispatcher.resetRunScriptDropdownWidth()
  }

  private onConfigure = () => {
    this.props.dispatcher.closeFoldout(FoldoutType.RunScript)
    this.props.dispatcher.showPopup({
      type: PopupType.RepositorySettings,
      repository: this.props.repository,
      initialSelectedTab: RepositorySettingsTab.Scripts,
    })
  }

  private renderRunningBar() {
    const running = this.runningRun
    if (running === undefined) {
      return null
    }

    return (
      <div className="running-bar">
        <Octicon symbol={octicons.sync} className="spin" />
        <span className="running-bar-text">
          Running <strong>{running.scriptName}</strong>
        </span>
        <LinkButton onClick={this.onViewRunningOutput}>View output</LinkButton>
        <LinkButton onClick={this.onStop}>Stop</LinkButton>
      </div>
    )
  }

  private renderScriptsTab() {
    const { scripts } = this.state
    const config = getRepositoryScriptsConfig(this.props.repository)
    const enabled =
      scripts === null || scripts === undefined
        ? []
        : scripts.scripts.filter(s => config.enabled.includes(s.name))
    const isRunning = this.runningRun !== undefined

    return (
      <>
        {this.renderRunningBar()}
        {enabled.length === 0 ? (
          <div className="empty-message">
            {scripts === undefined
              ? 'Looking for scripts…'
              : scripts === null
              ? 'This repository has no package.json scripts.'
              : 'No scripts enabled for this repository yet.'}
          </div>
        ) : (
          <ul className="script-list">
            {enabled.map(script => (
              <ScriptListItem
                key={script.name}
                script={script}
                disabled={isRunning}
                confirm={config.confirm.includes(script.name)}
                onRun={this.onRunScript}
              />
            ))}
          </ul>
        )}
        <div className="run-script-footer">
          <LinkButton onClick={this.onConfigure}>
            {__DARWIN__ ? 'Configure Scripts…' : 'Configure scripts…'}
          </LinkButton>
        </div>
      </>
    )
  }

  private renderHistoryTab() {
    const { runs } = this.props
    const hasFinished = runs.some(r => r.status !== 'running')

    return (
      <>
        {runs.length === 0 ? (
          <div className="empty-message">
            No scripts have run in this repository yet.
          </div>
        ) : (
          <ul className="history-list">
            {runs.map(run => (
              <HistoryItem key={run.id} run={run} onOpen={this.onOpenRun} />
            ))}
          </ul>
        )}
        <div className="run-script-footer">
          {hasFinished ? (
            <LinkButton onClick={this.onClearHistory}>
              {__DARWIN__ ? 'Clear History' : 'Clear history'}
            </LinkButton>
          ) : null}
        </div>
      </>
    )
  }

  private renderFoldout = (): JSX.Element | null => {
    const { runs } = this.props

    return (
      <div className="run-script-foldout">
        <TabBar
          selectedIndex={this.state.selectedTab}
          onTabClicked={this.onTabClicked}
        >
          <span id="run-script-scripts-tab">Scripts</span>
          <span id="run-script-history-tab" className="history-tab">
            History
            {runs.length > 0 ? (
              <span className="count">{runs.length}</span>
            ) : null}
          </span>
        </TabBar>
        {this.state.selectedTab === RunScriptTab.Scripts
          ? this.renderScriptsTab()
          : this.renderHistoryTab()}
      </div>
    )
  }

  public render() {
    const { isOpen, enableFocusTrap, runs } = this.props
    const { scripts } = this.state
    const latest = runs[0]

    // Nothing to offer for repositories without a package.json, and don't
    // flash the button in while we're still looking for one.
    if (latest === undefined && (scripts === null || scripts === undefined)) {
      return null
    }

    const running = this.runningRun
    const title = running
      ? running.scriptName
      : __DARWIN__
      ? 'Run Script'
      : 'Run script'
    const description = running
      ? 'Running…'
      : latest !== undefined
      ? `${latest.scriptName}: ${statusLabel(latest).toLowerCase()}`
      : scripts?.packageManager ?? 'package.json'

    const { runScriptDropdownWidth } = this.props

    const toolbarDropdown = (
      <ToolbarDropdown
        className={`run-script-button${running ? ' running' : ''}`}
        icon={running ? octicons.sync : octicons.play}
        iconClassName={running ? 'spin' : undefined}
        title={title}
        description={description}
        tooltip={isOpen ? undefined : 'Run a package.json script'}
        onDropdownStateChanged={this.props.onDropDownStateChanged}
        dropdownContentRenderer={this.renderFoldout}
        dropdownState={isOpen ? 'open' : 'closed'}
        showDisclosureArrow={true}
        enableFocusTrap={enableFocusTrap}
        foldoutStyleOverrides={
          enableResizingToolbarButtons()
            ? {
                width: Math.max(runScriptDropdownWidth.value, 365),
                maxWidth: Math.max(runScriptDropdownWidth.max, 365),
                minWidth: 365,
              }
            : { width: 400 }
        }
      />
    )

    if (!enableResizingToolbarButtons()) {
      return toolbarDropdown
    }

    return (
      <Resizable
        width={runScriptDropdownWidth.value}
        onReset={this.onReset}
        onResize={this.onResize}
        maximumWidth={runScriptDropdownWidth.max}
        minimumWidth={runScriptDropdownWidth.min}
        description="Run script dropdown button"
      >
        {toolbarDropdown}
      </Resizable>
    )
  }
}
