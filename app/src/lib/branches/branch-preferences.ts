import { Repository } from '../../models/repository'
import { getObject, setObject } from '../local-storage'

/** How the "Other branches" group in the branch list is ordered. */
export type BranchSortOrder = 'name' | 'date'

const branchSortOrderKey = 'branch-list-sort-order'
export const branchSortOrderDefault: BranchSortOrder = 'name'

export function getBranchSortOrder(): BranchSortOrder {
  return localStorage.getItem(branchSortOrderKey) === 'date' ? 'date' : 'name'
}

export function setBranchSortOrder(order: BranchSortOrder) {
  localStorage.setItem(branchSortOrderKey, order)
}

const pinnedBranchesKey = (repository: Repository) =>
  `pinned-branches-${repository.id}`

/** The names of the branches the user pinned in this repository. */
export function getPinnedBranches(repository: Repository): ReadonlySet<string> {
  const stored = getObject<unknown>(pinnedBranchesKey(repository))
  return new Set(
    Array.isArray(stored)
      ? stored.filter((x): x is string => typeof x === 'string')
      : []
  )
}

export function setPinnedBranches(
  repository: Repository,
  names: ReadonlySet<string>
) {
  setObject(pinnedBranchesKey(repository), [...names])
}

/** Pins or unpins a branch and returns the new set of pinned names. */
export function togglePinnedBranch(
  repository: Repository,
  branchName: string
): ReadonlySet<string> {
  const pinned = new Set(getPinnedBranches(repository))
  if (pinned.has(branchName)) {
    pinned.delete(branchName)
  } else {
    pinned.add(branchName)
  }
  setPinnedBranches(repository, pinned)
  return pinned
}
