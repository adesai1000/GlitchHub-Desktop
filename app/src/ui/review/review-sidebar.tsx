import * as React from 'react'
import * as Path from 'path'
import { Repository } from '../../models/repository'
import { Branch } from '../../models/branch'
import { CommittedFileChange } from '../../models/status'
import { BranchReviewStatus, IBranchReviewState } from '../../lib/app-state'
import { Dispatcher } from '../dispatcher'
import { BranchSelect } from '../branches/branch-select'
import { FileList } from '../history/file-list'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Ref } from '../lib/ref'
import { IMenuItem, showContextualMenu } from '../../lib/menu-item'
import { pathExists } from '../../lib/path-exists'
import { revealInFileManager } from '../../lib/app-shell'
import { writeClipboardText } from '../main-process-proxy'
import { openFile } from '../lib/open-file'
import {
  CopyFilePathLabel,
  CopyRelativeFilePathLabel,
  DefaultEditorLabel,
  isSafeFileExtension,
  OpenWithDefaultProgramLabel,
  RevealInFileManagerLabel,
} from '../lib/context-menu'

interface IReviewSidebarProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly reviewState: IBranchReviewState

  /** The checked out branch, or null when HEAD is detached */
  readonly currentBranch: Branch | null

  /** See IBranchesState.defaultBranch */
  readonly defaultBranch: Branch | null

  /** See IBranchesState.allBranches */
  readonly allBranches: ReadonlyArray<Branch>

  /** See IBranchesState.recentBranches */
  readonly recentBranches: ReadonlyArray<Branch>

  /** The width available to the file list */
  readonly availableWidth: number

  /** The name of the external editor, if one is configured */
  readonly externalEditorLabel?: string

  /**
   * Open a file in the external editor
   *
   * @param path The path of the file relative to the root of the repository
   */
  readonly onOpenInExternalEditor: (path: string) => void
}

/**
 * The sidebar of the Review tab: the base branch picker, a summary of the
 * branch, and the files a pull request from it would change.
 */
export class ReviewSidebar extends React.Component<IReviewSidebarProps> {
  private onBaseBranchChanged = (branch: Branch) => {
    this.props.dispatcher.changeBranchReviewBaseBranch(
      this.props.repository,
      branch
    )
  }

  private onIncludeUncommittedChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.dispatcher.setBranchReviewIncludeUncommitted(
      this.props.repository,
      event.currentTarget.checked
    )
  }

  private onFileSelected = (file: CommittedFileChange) => {
    this.props.dispatcher.changeBranchReviewFileSelection(
      this.props.repository,
      file
    )
  }

  private onRowDoubleClick = (row: number) => {
    const file = this.props.reviewState.changesetData.files[row]
    if (file !== undefined) {
      this.props.onOpenInExternalEditor(file.path)
    }
  }

  private onFileContextMenu = async (
    file: CommittedFileChange,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    const { repository, dispatcher, externalEditorLabel } = this.props
    const fullPath = Path.join(repository.path, file.path)
    const fileExistsOnDisk = await pathExists(fullPath)
    const isSafeExtension = isSafeFileExtension(Path.extname(file.path))

    const items: IMenuItem[] = [
      {
        label: RevealInFileManagerLabel,
        action: () => revealInFileManager(repository, file.path),
        enabled: fileExistsOnDisk,
      },
      {
        label:
          externalEditorLabel !== undefined
            ? `Open in ${externalEditorLabel}`
            : DefaultEditorLabel,
        action: () => dispatcher.openInExternalEditor(fullPath),
        enabled: fileExistsOnDisk,
      },
      {
        label: OpenWithDefaultProgramLabel,
        action: () => openFile(fullPath, dispatcher),
        enabled: isSafeExtension && fileExistsOnDisk,
      },
      { type: 'separator' },
      {
        label: CopyFilePathLabel,
        action: () => writeClipboardText(fullPath),
      },
      {
        label: CopyRelativeFilePathLabel,
        action: () => writeClipboardText(Path.normalize(file.path)),
      },
    ]

    showContextualMenu(items)
  }

  private renderBaseBranchPicker() {
    const { reviewState, currentBranch, defaultBranch } = this.props
    const { baseBranch } = reviewState

    return (
      <div className="review-base-branch">
        <BranchSelect
          // BranchSelect only reads the branch when it mounts
          key={baseBranch?.name ?? ''}
          repository={this.props.repository}
          branch={baseBranch}
          defaultBranch={defaultBranch}
          currentBranch={currentBranch}
          allBranches={this.props.allBranches}
          recentBranches={this.props.recentBranches}
          onChange={this.onBaseBranchChanged}
        />
      </div>
    )
  }

  private renderSummary() {
    const { status, changesetData, commitCount, baseRef, includeUncommitted } =
      this.props.reviewState

    if (status !== BranchReviewStatus.Loaded || baseRef === null) {
      return null
    }

    const { files, linesAdded, linesDeleted } = changesetData
    const fileCount = `${files.length} ${files.length === 1 ? 'file' : 'files'}`
    const commits = `${commitCount} ${commitCount === 1 ? 'commit' : 'commits'}`

    return (
      <div className="review-summary">
        <div>
          {fileCount} changed across {commits}
          {includeUncommitted ? ' and uncommitted changes' : ''}, since{' '}
          <Ref>{baseRef}</Ref>
        </div>
        <div className="lines-added-deleted">
          <span className="lines-added">+{linesAdded}</span>{' '}
          <span className="lines-deleted">−{linesDeleted}</span>
        </div>
      </div>
    )
  }

  private renderHeader() {
    const { includeUncommitted } = this.props.reviewState

    return (
      <div className="review-header">
        {this.renderBaseBranchPicker()}
        {this.renderSummary()}
        <Checkbox
          label="Include uncommitted changes"
          value={includeUncommitted ? CheckboxValue.On : CheckboxValue.Off}
          onChange={this.onIncludeUncommittedChanged}
        />
      </div>
    )
  }

  private renderMessage(message: string | JSX.Element) {
    return <div className="review-message">{message}</div>
  }

  private renderFiles() {
    const { reviewState, availableWidth } = this.props
    const { status, changesetData, selectedFile, baseBranch } = reviewState

    switch (status) {
      case BranchReviewStatus.Loading:
        return this.renderMessage('Loading changes…')
      case BranchReviewStatus.NoCommits:
        return this.renderMessage(
          'This branch has no commits yet, so there is nothing to review.'
        )
      case BranchReviewStatus.NoBaseBranch:
        return this.renderMessage(
          'Choose a base branch to compare the current branch against.'
        )
      case BranchReviewStatus.UnrelatedHistories:
        return this.renderMessage(
          <>
            The current branch doesn't share any history with{' '}
            <Ref>{baseBranch?.name ?? 'the base branch'}</Ref>. Choose another
            base branch.
          </>
        )
      case BranchReviewStatus.Loaded:
        break
    }

    if (changesetData.files.length === 0) {
      return this.renderMessage(this.getNoChangesMessage())
    }

    return (
      <FileList
        files={changesetData.files}
        selectedFile={selectedFile}
        onSelectedFileChanged={this.onFileSelected}
        onRowDoubleClick={this.onRowDoubleClick}
        onContextMenu={this.onFileContextMenu}
        availableWidth={availableWidth}
      />
    )
  }

  private getNoChangesMessage() {
    const { currentBranch, reviewState } = this.props
    const { baseBranch, includeUncommitted } = reviewState

    if (
      currentBranch !== null &&
      baseBranch !== null &&
      (currentBranch.name === baseBranch.name ||
        currentBranch.upstream === baseBranch.name)
    ) {
      return (
        <>
          You're on <Ref>{currentBranch.name}</Ref>, the base branch. Switch to
          a feature branch, or choose another base branch, to review changes.
        </>
      )
    }

    return includeUncommitted
      ? 'No changes to review.'
      : 'No committed changes to review.'
  }

  public render() {
    return (
      <div id="branch-review">
        {this.renderHeader()}
        <div className="review-files">{this.renderFiles()}</div>
      </div>
    )
  }
}
