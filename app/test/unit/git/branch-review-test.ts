import { describe, it } from 'node:test'
import assert from 'node:assert'
import { exec } from 'dugite'
import { writeFile } from 'fs/promises'
import * as Path from 'path'
import {
  getBranchReviewBase,
  getBranchReviewChangedFiles,
  getBranchReviewCommitCount,
  getBranchReviewDiff,
} from '../../../src/lib/git'
import { setupEmptyRepository } from '../../helpers/repositories'
import { makeCommit, switchTo } from '../../helpers/repository-scaffolding'
import {
  AppFileStatusKind,
  WorkingTreeCommitish,
} from '../../../src/models/status'
import { DiffType } from '../../../src/models/diff'
import { Repository } from '../../../src/models/repository'

async function getHeadSHA(repository: Repository) {
  const { stdout } = await exec(['rev-parse', 'HEAD'], repository.path)
  return stdout.trim()
}

/**
 * A repository where `feature` branches off `master`, then both move on:
 *
 * - master adds `main-only.txt` after the branch point
 * - feature edits `a.txt` twice, adds `temp.txt` and deletes it again, and
 *   adds `b.txt`
 */
async function setupFeatureBranch(
  t: Parameters<typeof setupEmptyRepository>[0]
) {
  const repository = await setupEmptyRepository(t)

  await makeCommit(repository, {
    entries: [{ path: 'a.txt', contents: 'one\n' }],
  })
  await switchTo(repository, 'feature')
  await makeCommit(repository, {
    entries: [{ path: 'a.txt', contents: 'one\ntwo\n' }],
  })
  await makeCommit(repository, {
    entries: [{ path: 'temp.txt', contents: 'temporary\n' }],
  })
  await makeCommit(repository, {
    entries: [
      { path: 'a.txt', contents: 'one\ntwo\nthree\n' },
      { path: 'temp.txt', contents: null },
      { path: 'b.txt', contents: 'new\n' },
    ],
  })

  await switchTo(repository, 'master')
  await makeCommit(repository, {
    entries: [{ path: 'main-only.txt', contents: 'main\n' }],
  })
  await switchTo(repository, 'feature')

  return repository
}

describe('git/branch-review', () => {
  it('lists the net change of every commit since the merge base', async t => {
    const repository = await setupFeatureBranch(t)
    const base = await getBranchReviewBase(repository, ['master'])
    assert(base !== null)

    const headSHA = await getHeadSHA(repository)
    const changes = await getBranchReviewChangedFiles(
      repository,
      base.mergeBase,
      headSHA,
      false
    )

    // temp.txt was added and deleted, and main-only.txt is on master only
    assert.deepStrictEqual(
      changes.files.map(f => [f.path, f.status.kind]),
      [
        ['a.txt', AppFileStatusKind.Modified],
        ['b.txt', AppFileStatusKind.New],
      ]
    )
    assert.equal(changes.linesAdded, 3)
    assert.equal(changes.linesDeleted, 0)
    assert.equal(
      await getBranchReviewCommitCount(repository, base.mergeBase),
      3
    )

    const diff = await getBranchReviewDiff(
      repository,
      changes.files[0],
      base.mergeBase,
      false
    )
    assert.equal(diff.kind, DiffType.Text)
    if (diff.kind === DiffType.Text) {
      assert(diff.text.includes('+two'))
      assert(diff.text.includes('+three'))
    }
  })

  it('includes uncommitted and untracked changes when asked', async t => {
    const repository = await setupFeatureBranch(t)
    const base = await getBranchReviewBase(repository, ['master'])
    assert(base !== null)

    await writeFile(Path.join(repository.path, 'a.txt'), 'one\ntwo\nfour\n')
    await writeFile(Path.join(repository.path, 'c.txt'), 'untracked\n')

    const headSHA = await getHeadSHA(repository)
    const committedOnly = await getBranchReviewChangedFiles(
      repository,
      base.mergeBase,
      headSHA,
      false
    )
    assert.deepStrictEqual(
      committedOnly.files.map(f => f.path),
      ['a.txt', 'b.txt']
    )

    const withUncommitted = await getBranchReviewChangedFiles(
      repository,
      base.mergeBase,
      headSHA,
      true
    )
    assert.deepStrictEqual(
      withUncommitted.files.map(f => [f.path, f.status.kind]),
      [
        ['a.txt', AppFileStatusKind.Modified],
        ['b.txt', AppFileStatusKind.New],
        ['c.txt', AppFileStatusKind.Untracked],
      ]
    )
    assert(
      withUncommitted.files.every(f => f.commitish === WorkingTreeCommitish)
    )

    const diff = await getBranchReviewDiff(
      repository,
      withUncommitted.files[0],
      base.mergeBase,
      false
    )
    assert.equal(diff.kind, DiffType.Text)
    if (diff.kind === DiffType.Text) {
      assert(diff.text.includes('+four'))
      assert(!diff.text.includes('+three'))
    }

    const untrackedDiff = await getBranchReviewDiff(
      repository,
      withUncommitted.files[2],
      base.mergeBase,
      false
    )
    assert.equal(untrackedDiff.kind, DiffType.Text)
    if (untrackedDiff.kind === DiffType.Text) {
      assert(untrackedDiff.text.includes('+untracked'))
    }
  })

  it('falls back to the next ref when one is missing', async t => {
    const repository = await setupFeatureBranch(t)
    const base = await getBranchReviewBase(repository, [
      'origin/master',
      'master',
    ])
    assert.equal(base?.ref, 'master')
  })

  it('returns null for unrelated histories', async t => {
    const repository = await setupFeatureBranch(t)
    await exec(['checkout', '--orphan', 'unrelated'], repository.path)
    await makeCommit(repository, {
      entries: [{ path: 'other.txt', contents: 'other\n' }],
    })

    assert.equal(await getBranchReviewBase(repository, ['feature']), null)
  })
})
