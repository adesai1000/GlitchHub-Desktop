import * as React from 'react'
import { Repository } from '../../models/repository'
import { ImageDiffType } from '../../models/diff'
import { AppFileStatusKind } from '../../models/status'
import { IBranchReviewState } from '../../lib/app-state'
import { Dispatcher } from '../dispatcher'
import { DiffHeader } from '../diff/diff-header'
import { SeamlessDiffSwitcher } from '../diff/seamless-diff-switcher'

interface IReviewDiffProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly reviewState: IBranchReviewState
  readonly imageDiffType: ImageDiffType
  readonly hideWhitespaceInDiff: boolean
  readonly showSideBySideDiff: boolean
  readonly expandWholeFileByDefault: boolean
  readonly externalEditorLabel?: string

  /**
   * Open a file in the external editor
   *
   * @param path The path of the file relative to the root of the repository
   */
  readonly onOpenInExternalEditor: (path: string) => void
  readonly onOpenBinaryFile: (fullPath: string) => void
  readonly onOpenSubmodule: (fullPath: string) => void
  readonly onChangeImageDiffType: (type: ImageDiffType) => void
  readonly onDiffOptionsOpened: () => void
}

/** The diff of the file selected in the Review tab */
export class ReviewDiff extends React.Component<IReviewDiffProps> {
  private onShowSideBySideDiffChanged = (showSideBySideDiff: boolean) => {
    this.props.dispatcher.onShowSideBySideDiffChanged(showSideBySideDiff)
  }

  private onHideWhitespaceInDiffChanged = (hideWhitespaceInDiff: boolean) => {
    return this.props.dispatcher.onHideWhitespaceInBranchReviewDiffChanged(
      hideWhitespaceInDiff,
      this.props.repository
    )
  }

  private onOpenInExternalEditor = () => {
    const { selectedFile } = this.props.reviewState
    if (selectedFile !== null) {
      this.props.onOpenInExternalEditor(selectedFile.path)
    }
  }

  public render() {
    const { selectedFile: file, diff } = this.props.reviewState

    if (file === null) {
      return <div className="blankslate">Select a file to see its changes.</div>
    }

    return (
      <div className="diff-container">
        <DiffHeader
          path={file.path}
          status={file.status}
          diff={diff}
          showSideBySideDiff={this.props.showSideBySideDiff}
          onShowSideBySideDiffChanged={this.onShowSideBySideDiffChanged}
          hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
          onHideWhitespaceInDiffChanged={this.onHideWhitespaceInDiffChanged}
          onDiffOptionsOpened={this.props.onDiffOptionsOpened}
        />

        <SeamlessDiffSwitcher
          repository={this.props.repository}
          imageDiffType={this.props.imageDiffType}
          file={file}
          diff={diff}
          readOnly={true}
          hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
          showSideBySideDiff={this.props.showSideBySideDiff}
          expandWholeFileByDefault={this.props.expandWholeFileByDefault}
          showDiffCheckMarks={false}
          onOpenBinaryFile={this.props.onOpenBinaryFile}
          onOpenSubmodule={this.props.onOpenSubmodule}
          onChangeImageDiffType={this.props.onChangeImageDiffType}
          onHideWhitespaceInDiffChanged={this.onHideWhitespaceInDiffChanged}
          externalEditorLabel={this.props.externalEditorLabel}
          onOpenInExternalEditor={
            file.status.kind === AppFileStatusKind.Deleted
              ? undefined
              : this.onOpenInExternalEditor
          }
        />
      </div>
    )
  }
}
