import assert from 'node:assert'
import { describe, it } from 'node:test'
import {
  compareWithOrder,
  moveRepositoryInGroup,
} from '../../src/lib/repository-list-order'
import {
  getPinnedBranches,
  togglePinnedBranch,
} from '../../src/lib/branches/branch-preferences'
import { applyDiffWrapLines, diffNoWrapClass } from '../../src/ui/lib/diff-wrap'
import { Repository } from '../../src/models/repository'

describe('repository list order', () => {
  it('moves a repository within its group and refuses impossible moves', () => {
    assert.deepStrictEqual(moveRepositoryInGroup([1, 2, 3], 2, 'up'), [2, 1, 3])
    assert.deepStrictEqual(
      moveRepositoryInGroup([1, 2, 3], 2, 'down'),
      [1, 3, 2]
    )
    assert.strictEqual(moveRepositoryInGroup([1, 2, 3], 1, 'up'), null)
    assert.strictEqual(moveRepositoryInGroup([1, 2, 3], 3, 'down'), null)
    assert.strictEqual(moveRepositoryInGroup([1, 2, 3], 9, 'up'), null)
  })

  it('sorts ordered ids first and the rest by the fallback', () => {
    const items = [
      { id: 1, name: 'zeta' },
      { id: 2, name: 'alpha' },
      { id: 3, name: 'mid' },
      { id: 4, name: 'beta' },
    ]
    const sorted = [...items].sort(
      compareWithOrder(
        [3, 1],
        i => i.id,
        (x, y) => x.name.localeCompare(y.name)
      )
    )
    assert.deepStrictEqual(
      sorted.map(i => i.name),
      ['mid', 'zeta', 'alpha', 'beta']
    )
  })
})

describe('pinned branches', () => {
  it('toggles and persists per repository', () => {
    const repo = new Repository('/tmp/pins', 777, null, false)
    assert.strictEqual(getPinnedBranches(repo).size, 0)
    assert.ok(togglePinnedBranch(repo, 'feature/a').has('feature/a'))
    assert.ok(getPinnedBranches(repo).has('feature/a'))
    assert.strictEqual(togglePinnedBranch(repo, 'feature/a').size, 0)
  })
})

describe('diff line wrapping', () => {
  it('toggles the root class and notifies listeners', () => {
    const root = document.createElement('div')
    let events = 0
    document.addEventListener('diff-wrap-changed', () => events++)

    applyDiffWrapLines(false, root)
    assert.ok(root.classList.contains(diffNoWrapClass))
    applyDiffWrapLines(true, root)
    assert.ok(!root.classList.contains(diffNoWrapClass))
    assert.strictEqual(events, 2)
  })
})
