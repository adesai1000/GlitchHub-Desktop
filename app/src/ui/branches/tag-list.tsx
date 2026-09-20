import * as React from 'react'
import { IFilterListGroup, IFilterListItem } from '../lib/filter-list'
import { SectionFilterList } from '../lib/section-filter-list'
import { IMatches } from '../../lib/fuzzy-find'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { getAllTags } from '../../lib/git/tag'
import { getCommit } from '../../lib/git/log'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { HighlightText } from '../lib/highlight-text'
import { FoldoutType } from '../../lib/app-state'
import { ClickSource } from '../lib/list'

interface ITagListItem extends IFilterListItem {
  readonly id: string
  readonly text: ReadonlyArray<string>
  readonly name: string
  readonly sha: string
}

interface ITagListProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
}

interface ITagListState {
  /** undefined while loading */
  readonly groups: ReadonlyArray<IFilterListGroup<ITagListItem>> | undefined
  readonly filterText: string
  readonly selectedItem: ITagListItem | null
}

const RowHeight = 30

/**
 * A searchable list of the repository's tags. Picking one checks out the
 * commit it points to (detached HEAD), the same as choosing a commit in the
 * history view.
 */
export class TagList extends React.Component<ITagListProps, ITagListState> {
  public constructor(props: ITagListProps) {
    super(props)
    this.state = { groups: undefined, filterText: '', selectedItem: null }
  }

  public componentDidMount() {
    this.loadTags()
  }

  public componentDidUpdate(prevProps: ITagListProps) {
    if (prevProps.repository.id !== this.props.repository.id) {
      this.setState({ groups: undefined })
      this.loadTags()
    }
  }

  private async loadTags() {
    const { repository } = this.props
    try {
      const tags = await getAllTags(repository)
      if (this.props.repository.id !== repository.id) {
        return
      }
      const items = [...tags.entries()]
        .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
        .map(([name, sha]) => ({ id: name, text: [name], name, sha }))
      this.setState({ groups: [{ identifier: 'tags', items }] })
    } catch (e) {
      log.error('Failed to load tags', e)
      this.setState({ groups: [] })
    }
  }

  private onFilterTextChanged = (filterText: string) => {
    this.setState({ filterText })
  }

  private onSelectionChanged = (selectedItem: ITagListItem | null) => {
    this.setState({ selectedItem })
  }

  private onItemClick = async (item: ITagListItem, _source: ClickSource) => {
    const { repository, dispatcher } = this.props
    dispatcher.closeFoldout(FoldoutType.Branch)

    const commit = await getCommit(repository, item.sha)
    if (commit === null) {
      return
    }
    await dispatcher.checkoutCommit(repository, commit)
  }

  private renderItem = (item: ITagListItem, matches: IMatches) => {
    return (
      <div className="branches-list-item tag-list-item">
        <Octicon className="icon" symbol={octicons.tag} />
        <div className="name">
          <HighlightText text={item.name} highlight={matches.title} />
        </div>
        <div className="description">{item.sha.substring(0, 7)}</div>
      </div>
    )
  }

  private renderNoItems = () => {
    const { groups, filterText } = this.state
    return (
      <div className="no-tags">
        {groups === undefined
          ? 'Loading tags…'
          : filterText.length > 0
          ? `No tags match "${filterText}"`
          : 'This repository has no tags yet.'}
      </div>
    )
  }

  public render() {
    return (
      <SectionFilterList<ITagListItem>
        className="tags-list"
        rowHeight={RowHeight}
        groups={this.state.groups ?? []}
        selectedItem={this.state.selectedItem}
        renderItem={this.renderItem}
        filterText={this.state.filterText}
        onFilterTextChanged={this.onFilterTextChanged}
        onSelectionChanged={this.onSelectionChanged}
        onItemClick={this.onItemClick}
        renderNoItems={this.renderNoItems}
        invalidationProps={this.state.groups}
        placeholderText="Filter tags"
      />
    )
  }
}
