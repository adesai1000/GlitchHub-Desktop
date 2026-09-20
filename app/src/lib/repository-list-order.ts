import { getObject, setObject } from './local-storage'

/**
 * A user-chosen order of repositories within each group of the repository
 * list, keyed by the group key (see getGroupKey). Repositories that aren't in
 * the list for their group sort alphabetically after the ones that are.
 */
export type RepositoryListOrder = ReadonlyMap<string, ReadonlyArray<number>>

const key = 'repository-list-order'

export function getRepositoryListOrder(): RepositoryListOrder {
  const stored = getObject<Record<string, unknown>>(key)
  const order = new Map<string, ReadonlyArray<number>>()
  if (stored === undefined) {
    return order
  }
  for (const [groupKey, ids] of Object.entries(stored)) {
    if (Array.isArray(ids)) {
      order.set(
        groupKey,
        ids.filter((id): id is number => typeof id === 'number')
      )
    }
  }
  return order
}

export function setRepositoryListOrder(order: RepositoryListOrder) {
  setObject(key, Object.fromEntries(order))
}

/**
 * Moves a repository one step up or down within its group given the ids of
 * the group's repositories in their current display order. Returns the new
 * order for that group, or null if the move isn't possible.
 */
export function moveRepositoryInGroup(
  displayedIds: ReadonlyArray<number>,
  repositoryId: number,
  direction: 'up' | 'down'
): ReadonlyArray<number> | null {
  const index = displayedIds.indexOf(repositoryId)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= displayedIds.length) {
    return null
  }
  const ids = [...displayedIds]
  ids[index] = displayedIds[target]
  ids[target] = displayedIds[index]
  return ids
}

/**
 * Sort comparator honouring a stored order: ordered ids first, in order, then
 * everything else in the order given by `fallback`.
 */
export function compareWithOrder<T>(
  order: ReadonlyArray<number> | undefined,
  getId: (item: T) => number,
  fallback: (x: T, y: T) => number
) {
  const rank = new Map<number, number>()
  order?.forEach((id, i) => rank.set(id, i))
  return (x: T, y: T) => {
    const rx = rank.get(getId(x))
    const ry = rank.get(getId(y))
    if (rx !== undefined && ry !== undefined) {
      return rx - ry
    }
    if (rx !== undefined) {
      return -1
    }
    if (ry !== undefined) {
      return 1
    }
    return fallback(x, y)
  }
}
