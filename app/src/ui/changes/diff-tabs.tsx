import * as React from 'react'
import * as Path from 'path'
import classNames from 'classnames'
import { WorkingDirectoryFileChange } from '../../models/status'
import { Octicon, iconForStatus } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { mapStatus } from '../../lib/status'
import { IMenuItem, showContextualMenu } from '../../lib/menu-item'
import { createObservableRef } from '../lib/observable-ref'
import { Tooltip, TooltipDirection } from '../lib/tooltip'

interface IDiffTabProps {
  readonly file: WorkingDirectoryFileChange
  readonly isActive: boolean

  /** Whether to show the file's folder, to tell apart files of one name */
  readonly showFolder: boolean

  readonly onSelect: (file: WorkingDirectoryFileChange) => void
  readonly onClose: (path: string) => void
  readonly onContextMenu: (path: string) => void
  readonly onKeyDown: (e: React.KeyboardEvent, path: string) => void
}

class DiffTab extends React.Component<IDiffTabProps> {
  private readonly tabRef = createObservableRef<HTMLDivElement>()

  public componentDidMount() {
    if (this.props.isActive) {
      this.scrollIntoView()
    }
  }

  public componentDidUpdate(prevProps: IDiffTabProps) {
    if (this.props.isActive && !prevProps.isActive) {
      this.scrollIntoView()
    }
  }

  private scrollIntoView() {
    this.tabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  public render() {
    const { file, isActive, showFolder } = this.props
    const { path, status } = file
    const name = Path.basename(path)
    const fileStatus = mapStatus(status)

    return (
      <div
        ref={this.tabRef}
        className={classNames('diff-tab', { active: isActive })}
        role="tab"
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        onClick={this.onClick}
        onMouseDown={this.onMouseDown}
        onAuxClick={this.onAuxClick}
        onContextMenu={this.onContextMenu}
        onKeyDown={this.onKeyDown}
      >
        <Tooltip target={this.tabRef} direction={TooltipDirection.SOUTH}>
          {path}
        </Tooltip>
        <Octicon
          symbol={iconForStatus(status)}
          className={'status status-' + fileStatus.toLowerCase()}
          title={fileStatus}
        />
        <span className="name">{name}</span>
        {showFolder && (
          <span className="folder">{Path.dirname(path) || '/'}</span>
        )}
        <button
          type="button"
          className="close"
          tabIndex={-1}
          aria-label={`Close ${name}`}
          onClick={this.onCloseClick}
        >
          <Octicon symbol={octicons.x} />
        </button>
      </div>
    )
  }

  private onClick = () => {
    this.props.onSelect(this.props.file)
  }

  private onCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    this.props.onClose(this.props.file.path)
  }

  /** Keeps a middle click from starting autoscroll */
  private onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
    }
  }

  /** Closes the tab on middle click, like an editor */
  private onAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      this.props.onClose(this.props.file.path)
    }
  }

  private onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    this.props.onContextMenu(this.props.file.path)
  }

  private onKeyDown = (e: React.KeyboardEvent) => {
    this.props.onKeyDown(e, this.props.file.path)
  }
}

interface IDiffTabsProps {
  /** The files open as tabs, in tab order */
  readonly files: ReadonlyArray<WorkingDirectoryFileChange>

  /** The path of the file whose diff is shown, if any */
  readonly activePath: string | null

  /** Called when the user picks a tab */
  readonly onSelectTab: (file: WorkingDirectoryFileChange) => void

  /** Called with the paths of the tabs the user wants closed */
  readonly onCloseTabs: (paths: ReadonlyArray<string>) => void
}

/**
 * A strip of tabs, one per file opened from the changes list, shown in place
 * of the file path above the diff. Like an editor's tabs, each one switches
 * the diff to its file and has a button to close it.
 */
export class DiffTabs extends React.Component<IDiffTabsProps> {
  private readonly containerRef = React.createRef<HTMLDivElement>()

  /** The tab to focus once it becomes active, after arrow key navigation */
  private pathToFocus: string | null = null

  public componentDidUpdate() {
    const { activePath } = this.props
    if (this.pathToFocus !== null && this.pathToFocus === activePath) {
      this.pathToFocus = null
      this.containerRef.current
        ?.querySelector<HTMLElement>('.diff-tab.active')
        ?.focus()
    }
  }

  /** Names that more than one tab shares, which need their folder shown */
  private getAmbiguousNames() {
    const counts = new Map<string, number>()
    for (const { path } of this.props.files) {
      const name = Path.basename(path)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return new Set([...counts].filter(([, n]) => n > 1).map(([name]) => name))
  }

  public render() {
    const ambiguousNames = this.getAmbiguousNames()

    return (
      <div
        className="diff-tabs"
        role="tablist"
        aria-label="Open files"
        ref={this.containerRef}
        onWheel={this.onWheel}
      >
        {this.props.files.map(file => (
          <DiffTab
            key={file.path}
            file={file}
            isActive={file.path === this.props.activePath}
            showFolder={ambiguousNames.has(Path.basename(file.path))}
            onSelect={this.props.onSelectTab}
            onClose={this.onCloseTab}
            onContextMenu={this.onTabContextMenu}
            onKeyDown={this.onTabKeyDown}
          />
        ))}
      </div>
    )
  }

  private onCloseTab = (path: string) => {
    this.props.onCloseTabs([path])
  }

  /** Moves between tabs with the arrow keys and closes one with Delete */
  private onTabKeyDown = (e: React.KeyboardEvent, path: string) => {
    const { files } = this.props
    const index = files.findIndex(f => f.path === path)
    if (index === -1) {
      return
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next = files[index + (e.key === 'ArrowLeft' ? -1 : 1)]
      if (next !== undefined) {
        this.pathToFocus = next.path
        this.props.onSelectTab(next)
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      this.props.onCloseTabs([files[index].path])
    }
  }

  /** Scrolls the strip sideways with a vertical mouse wheel */
  private onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaX === 0) {
      e.currentTarget.scrollLeft += e.deltaY
    }
  }

  private onTabContextMenu = (path: string) => {
    const paths = this.props.files.map(f => f.path)
    const others = paths.filter(p => p !== path)
    const toTheRight = paths.slice(paths.indexOf(path) + 1)

    const items: IMenuItem[] = [
      {
        label: 'Close',
        action: () => this.props.onCloseTabs([path]),
      },
      {
        label: __DARWIN__ ? 'Close Others' : 'Close others',
        action: () => this.props.onCloseTabs(others),
        enabled: others.length > 0,
      },
      {
        label: __DARWIN__ ? 'Close to the Right' : 'Close to the right',
        action: () => this.props.onCloseTabs(toTheRight),
        enabled: toTheRight.length > 0,
      },
      { type: 'separator' },
      {
        label: __DARWIN__ ? 'Close All' : 'Close all',
        action: () => this.props.onCloseTabs(paths),
      },
    ]

    showContextualMenu(items)
  }
}
