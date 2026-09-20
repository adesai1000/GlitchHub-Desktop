import { describe, it } from 'node:test'
import assert from 'node:assert'
import { groupBranches } from '../../src/ui/branches'
import { Branch, BranchType } from '../../src/models/branch'
import { CommitIdentity } from '../../src/models/commit-identity'

describe('Branches grouping', () => {
  const author = new CommitIdentity('Hubot', 'hubot@github.com', new Date())

  const branchTip = {
    sha: '300acef',
    author,
  }

  const currentBranch = new Branch(
    'master',
    null,
    branchTip,
    BranchType.Local,
    ''
  )
  const defaultBranch = new Branch(
    'master',
    null,
    branchTip,
    BranchType.Local,
    ''
  )
  const recentBranches = [
    new Branch('some-recent-branch', null, branchTip, BranchType.Local, ''),
  ]
  const otherBranch = new Branch(
    'other-branch',
    null,
    branchTip,
    BranchType.Local,
    ''
  )

  const allBranches = [currentBranch, ...recentBranches, otherBranch]

  it('should group branches', () => {
    const groups = groupBranches(
      defaultBranch,
      currentBranch,
      allBranches,
      recentBranches
    )
    assert.equal(groups.length, 3)

    assert.equal(groups[0].identifier, 'default')
    let items = groups[0].items
    assert.equal(items[0].branch, defaultBranch)

    assert.equal(groups[1].identifier, 'recent')
    items = groups[1].items
    assert.equal(items[0].branch, recentBranches[0])

    assert.equal(groups[2].identifier, 'other')
    items = groups[2].items
    assert.equal(items[0].branch, otherBranch)
  })
})

describe('groupBranches pinning and sorting', () => {
  it('puts pinned branches in their own group and sorts others by date', () => {
    const mk = (name: string, sha: string) =>
      new Branch(name, null, { sha }, BranchType.Local, `refs/heads/${name}`)
    const a = mk('a-old', 'sha-a')
    const b = mk('b-new', 'sha-b')
    const c = mk('c-pinned', 'sha-c')
    const dates = new Map<string, Date>([
      ['sha-a', new Date(2020, 0, 1)],
      ['sha-b', new Date(2024, 0, 1)],
    ])

    const groups = groupBranches(
      null,
      null,
      [a, b, c],
      [],
      new Set(['c-pinned']),
      'date',
      dates
    )
    assert.deepStrictEqual(
      groups.map(g => [g.identifier, g.items.map(i => i.branch.name)]),
      [
        ['pinned', ['c-pinned']],
        ['other', ['b-new', 'a-old']],
      ]
    )
  })
})
