/**
 * This a11y linter is a false-positive as the element is a drop target
 * facilitating our drag and drop functionality for reordering, squashing, and
 * cherry-picking.
 */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import * as React from 'react'
import { Commit } from '../../models/commit'
import { GitHubRepository } from '../../models/github-repository'
import { IAvatarUser, getAvatarUsersForCommit } from '../../models/avatar'
import { RichText } from '../lib/rich-text'
import { RelativeTime } from '../relative-time'
import { CommitAttribution } from '../lib/commit-attribution'
import { AvatarStack } from '../lib/avatar-stack'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Draggable } from '../lib/draggable'
import { dragAndDropManager } from '../../lib/drag-and-drop-manager'
import {
  DragType,
  DropTargetSelector,
  DropTargetType,
} from '../../models/drag-drop'
import classNames from 'classnames'
import { Account } from '../../models/account'
import { Emoji } from '../../lib/emoji'
import { enableAccessibleListToolTips } from '../../lib/feature-flag'
import { TooltippedContent } from '../lib/tooltipped-content'
import { formatDate } from '../../lib/format-date'

interface ICommitProps {
  readonly gitHubRepository: GitHubRepository | null
  readonly commit: Commit
  readonly selectedCommits: ReadonlyArray<Commit>
  readonly emoji: Map<string, Emoji>
  readonly onRenderCommitDragElement?: (commit: Commit) => void
  readonly onRemoveDragElement?: () => void
  readonly onSquash?: (
    toSquash: ReadonlyArray<Commit>,
    squashOnto: Commit,
    isInvokedByContextMenu: boolean
  ) => void
  /**
   * Whether or not the commit can be dragged for certain operations like squash,
   * cherry-pick, reorder, etc. Defaults to false.
   */
  readonly isDraggable?: boolean
  readonly showUnpushedIndicator: boolean
  readonly disableSquashing?: boolean
  readonly unpushedIndicatorTitle?: string
  readonly accounts: ReadonlyArray<Account>
  readonly preferAbsoluteDates: boolean

  /** The branch the commit was most likely made on, shown after the date */
  readonly branchName?: string

  /**
   * Called with the height the item needs beyond its normal height when the
   * branch name makes the byline wrap onto more lines
   */
  readonly onExtraHeightChanged?: (sha: string, extraHeight: number) => void
}

/**
 * The line height of a byline that can wrap, which must match
 * `.byline.with-branch` in _commit-list.scss
 */
const WrappingBylineLineHeight = 16

interface ICommitListItemState {
  readonly avatarUsers: ReadonlyArray<IAvatarUser>
}

/** A component which displays a single commit in a commit list. */
export class CommitListItem extends React.PureComponent<
  ICommitProps,
  ICommitListItemState
> {
  private bylineResizeObserver: ResizeObserver | null = null

  public constructor(props: ICommitProps) {
    super(props)

    this.state = {
      avatarUsers: getAvatarUsersForCommit(
        props.gitHubRepository,
        props.commit
      ),
    }
  }

  public componentWillReceiveProps(nextProps: ICommitProps) {
    if (nextProps.commit !== this.props.commit) {
      this.setState({
        avatarUsers: getAvatarUsersForCommit(
          nextProps.gitHubRepository,
          nextProps.commit
        ),
      })
    }
  }

  public componentWillUnmount() {
    this.bylineResizeObserver?.disconnect()
  }

  private onBylineRef = (byline: HTMLDivElement | null) => {
    this.bylineResizeObserver?.disconnect()
    this.bylineResizeObserver = null

    if (byline === null || this.props.onExtraHeightChanged === undefined) {
      return
    }

    this.bylineResizeObserver = new ResizeObserver(() => {
      const lines = Math.max(
        1,
        Math.round(byline.offsetHeight / WrappingBylineLineHeight)
      )
      this.props.onExtraHeightChanged?.(
        this.props.commit.sha,
        (lines - 1) * WrappingBylineLineHeight
      )
    })
    this.bylineResizeObserver.observe(byline)
  }

  private onMouseUp = () => {
    const { onSquash, selectedCommits, commit, disableSquashing } = this.props
    if (
      disableSquashing !== true &&
      dragAndDropManager.isDragOfTypeInProgress(DragType.Commit) &&
      onSquash !== undefined &&
      // don't squash if dragging one commit and dropping onto itself
      selectedCommits.filter(c => c.sha !== commit.sha).length > 0
    ) {
      onSquash(selectedCommits, commit, false)
    }
  }

  private onMouseEnter = () => {
    const { selectedCommits, commit, disableSquashing } = this.props
    const isSelected =
      selectedCommits.find(c => c.sha === commit.sha) !== undefined
    if (
      disableSquashing !== true &&
      dragAndDropManager.isDragOfTypeInProgress(DragType.Commit) &&
      !isSelected
    ) {
      dragAndDropManager.emitEnterDropTarget({
        type: DropTargetType.Commit,
      })
    }
  }

  private onMouseLeave = () => {
    if (dragAndDropManager.isDragOfTypeInProgress(DragType.Commit)) {
      dragAndDropManager.emitLeaveDropTarget()
    }
  }

  public render() {
    const { commit } = this.props
    const {
      author: { date },
    } = commit

    const isDraggable = this.props.isDraggable || false
    const hasEmptySummary = commit.summary.length === 0
    const commitSummary = hasEmptySummary
      ? 'Empty commit message'
      : commit.summary

    const summaryClassNames = classNames('summary', {
      'empty-summary': hasEmptySummary,
    })

    return (
      <Draggable
        isEnabled={isDraggable}
        onDragStart={this.onDragStart}
        onRenderDragElement={this.onRenderCommitDragElement}
        onRemoveDragElement={this.onRemoveDragElement}
        dropTargetSelectors={[
          DropTargetSelector.Branch,
          DropTargetSelector.PullRequest,
          DropTargetSelector.Commit,
          DropTargetSelector.ListInsertionPoint,
        ]}
      >
        <div
          className="commit"
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
          onMouseUp={this.onMouseUp}
        >
          <div className="info">
            <RichText
              className={summaryClassNames}
              emoji={this.props.emoji}
              text={commitSummary}
              renderUrlsAsLinks={false}
            />
            <div className="description">
              <AvatarStack
                users={this.state.avatarUsers}
                accounts={this.props.accounts}
                tooltip={!enableAccessibleListToolTips()}
              />
              {this.renderByline(date)}
            </div>
          </div>
          {this.renderCommitIndicators()}
        </div>
      </Draggable>
    )
  }

  private renderByline(date: Date) {
    const { branchName, preferAbsoluteDates } = this.props
    const attributionAndDate = (
      <>
        <CommitAttribution avatarUsers={this.state.avatarUsers} />
        {renderRelativeTime(date, preferAbsoluteDates)}
      </>
    )

    if (branchName === undefined || branchName.length === 0) {
      return (
        <div className="byline" ref={this.onBylineRef}>
          {attributionAndDate}
        </div>
      )
    }

    // The byline wraps before the dot rather than inside the author or the
    // date, and inside the branch name only when it doesn't fit on a line
    return (
      <div className="byline with-branch" ref={this.onBylineRef}>
        <span className="byline-attribution">{attributionAndDate}</span>
        <span className="commit-branch">
          {' •\u00a0'}
          <span className="commit-branch-name">{branchName}</span>
        </span>
      </div>
    )
  }

  private renderCommitIndicators() {
    const tagIndicator = renderCommitListItemTags(this.props.commit.tags)
    const unpushedIndicator = this.renderUnpushedIndicator()

    if (tagIndicator || unpushedIndicator) {
      return (
        <div className="commit-indicators">
          {tagIndicator}
          {unpushedIndicator}
        </div>
      )
    }

    return null
  }

  private renderUnpushedIndicator() {
    if (!this.props.showUnpushedIndicator) {
      return null
    }

    return (
      <TooltippedContent
        tagName="div"
        className="unpushed-indicator"
        tooltip={this.props.unpushedIndicatorTitle}
        disabled={enableAccessibleListToolTips()}
      >
        <Octicon symbol={octicons.arrowUp} />
      </TooltippedContent>
    )
  }

  private onDragStart = () => {
    // Removes active status from commit selection so they do not appear
    // highlighted in commit list.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    dragAndDropManager.setDragData({
      type: DragType.Commit,
      commits: this.props.selectedCommits,
    })
  }

  private onRenderCommitDragElement = () => {
    if (this.props.onRenderCommitDragElement !== undefined) {
      this.props.onRenderCommitDragElement(this.props.commit)
    }
  }

  private onRemoveDragElement = () => {
    if (this.props.onRemoveDragElement !== undefined) {
      this.props.onRemoveDragElement()
    }
  }
}

function renderRelativeTime(date: Date, preferAbsoluteDates: boolean) {
  return (
    <>
      {` • `}
      {preferAbsoluteDates ? (
        formatDate(date)
      ) : (
        <RelativeTime date={date} tooltip={!enableAccessibleListToolTips()} />
      )}
    </>
  )
}

function renderCommitListItemTags(tags: ReadonlyArray<string>) {
  if (tags.length === 0) {
    return null
  }
  const [firstTag] = tags
  return (
    <span className="tag-indicator">
      <span className="tag-name" key={firstTag}>
        {firstTag}
      </span>
      {tags.length > 1 && (
        <span key={tags.length} className="tag-indicator-more" />
      )}
    </span>
  )
}
