import { Branch } from '../../models/branch'
import { IFilterListGroup, IFilterListItem } from '../lib/filter-list'
import { BranchSortOrder } from '../../lib/branches/branch-preferences'

export type BranchGroupIdentifier = 'default' | 'pinned' | 'recent' | 'other'

const emptySet: ReadonlySet<string> = new Set()
const emptyDates: ReadonlyMap<string, Date> = new Map()

export interface IBranchListItem extends IFilterListItem {
  readonly text: ReadonlyArray<string>
  readonly id: string
  readonly branch: Branch
}

/**
 * @param pinnedBranchNames Names of branches the user pinned; they get their
 *                          own group right below the default branch.
 * @param sortOrder         How the "other" group is ordered. Sorting by date
 *                          needs `commitAuthorDates` (tip sha to date);
 *                          branches without a known date sort last by name.
 */
export function groupBranches(
  defaultBranch: Branch | null,
  currentBranch: Branch | null,
  allBranches: ReadonlyArray<Branch>,
  recentBranches: ReadonlyArray<Branch>,
  pinnedBranchNames: ReadonlySet<string> = emptySet,
  sortOrder: BranchSortOrder = 'name',
  commitAuthorDates: ReadonlyMap<string, Date> = emptyDates
): ReadonlyArray<IFilterListGroup<IBranchListItem>> {
  const groups = new Array<IFilterListGroup<IBranchListItem>>()

  if (defaultBranch) {
    groups.push({
      identifier: 'default',
      items: [
        {
          text: [defaultBranch.name],
          id: defaultBranch.name,
          branch: defaultBranch,
        },
      ],
    })
  }

  const recentBranchNames = new Set<string>()
  const defaultBranchName = defaultBranch ? defaultBranch.name : null
  const pinnedBranches = allBranches.filter(
    b =>
      pinnedBranchNames.has(b.name) &&
      b.name !== defaultBranchName &&
      !b.isDesktopForkRemoteBranch
  )
  if (pinnedBranches.length > 0) {
    groups.push({
      identifier: 'pinned',
      items: pinnedBranches.map(branch => ({
        text: [branch.name],
        id: branch.name,
        branch,
      })),
    })
  }

  const recentBranchesWithoutDefault = recentBranches.filter(
    b => b.name !== defaultBranchName && !pinnedBranchNames.has(b.name)
  )
  if (recentBranchesWithoutDefault.length > 0) {
    const recentBranches = new Array<IBranchListItem>()

    for (const branch of recentBranchesWithoutDefault) {
      recentBranches.push({
        text: [branch.name],
        id: branch.name,
        branch,
      })
      recentBranchNames.add(branch.name)
    }

    groups.push({
      identifier: 'recent',
      items: recentBranches,
    })
  }

  const remainingBranches = allBranches.filter(
    b =>
      b.name !== defaultBranchName &&
      !recentBranchNames.has(b.name) &&
      !pinnedBranchNames.has(b.name) &&
      !b.isDesktopForkRemoteBranch
  )

  const remainingItems = sortBranches(
    remainingBranches,
    sortOrder,
    commitAuthorDates
  ).map(b => ({
    text: [b.name],
    id: b.name,
    branch: b,
  }))
  groups.push({
    identifier: 'other',
    items: remainingItems,
  })

  return groups
}

function sortBranches(
  branches: ReadonlyArray<Branch>,
  sortOrder: BranchSortOrder,
  commitAuthorDates: ReadonlyMap<string, Date>
): ReadonlyArray<Branch> {
  if (sortOrder !== 'date') {
    // Preserve the order Git gave us (alphabetical by ref name)
    return branches
  }

  return [...branches].sort((x, y) => {
    const dx = commitAuthorDates.get(x.tip.sha)?.getTime()
    const dy = commitAuthorDates.get(y.tip.sha)?.getTime()
    if (dx !== undefined && dy !== undefined && dx !== dy) {
      return dy - dx
    }
    if (dx !== undefined && dy === undefined) {
      return -1
    }
    if (dx === undefined && dy !== undefined) {
      return 1
    }
    return x.name.localeCompare(y.name)
  })
}
