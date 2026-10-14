import { describe, it } from 'node:test'
import assert from 'node:assert'
import { exec } from 'dugite'
import { getBranchNamesForCommits } from '../../../src/lib/git'
import { setupEmptyRepository } from '../../helpers/repositories'
import { makeCommit, switchTo } from '../../helpers/repository-scaffolding'
import { Repository } from '../../../src/models/repository'

async function getSHA(repository: Repository, rev: string) {
  const { stdout } = await exec(['rev-parse', rev], repository.path)
  return stdout.trim()
}

describe('git/commit-branch-names', () => {
  it('names commits after the branch they were made on', async t => {
    const repository = await setupEmptyRepository(t)

    await makeCommit(repository, {
      entries: [{ path: 'a.txt', contents: 'a\n' }],
    })
    const first = await getSHA(repository, 'HEAD')

    await switchTo(repository, 'feature/long-branch-name')
    await makeCommit(repository, {
      entries: [{ path: 'b.txt', contents: 'b\n' }],
    })
    const onFeature = await getSHA(repository, 'HEAD')

    // Merge the feature into master, so master contains its commit too
    await switchTo(repository, 'master')
    await makeCommit(repository, {
      entries: [{ path: 'c.txt', contents: 'c\n' }],
    })
    await exec(
      ['merge', '--no-ff', '--no-edit', 'feature/long-branch-name'],
      repository.path
    )
    const merge = await getSHA(repository, 'HEAD')
    await exec(['branch', '-D', 'feature/long-branch-name'], repository.path)

    const names = await getBranchNamesForCommits(repository, [
      merge,
      onFeature,
      first,
    ])

    assert.equal(names.get(merge), 'master')
    // The branch is gone, so the name comes from the merge commit's subject
    assert.equal(names.get(onFeature), 'feature/long-branch-name')
    assert.equal(names.get(first), 'master')
  })

  it('reads branch names from pull request merges', async t => {
    const repository = await setupEmptyRepository(t)

    await makeCommit(repository, {
      entries: [{ path: 'a.txt', contents: 'a\n' }],
    })
    await switchTo(repository, 'topic')
    await makeCommit(repository, {
      entries: [{ path: 'b.txt', contents: 'b\n' }],
    })
    const onTopic = await getSHA(repository, 'HEAD')
    await switchTo(repository, 'master')
    await exec(
      [
        'merge',
        '--no-ff',
        '-m',
        'Merge pull request #12 from owner/feat/ENG-329-sidebar',
        'topic',
      ],
      repository.path
    )
    await exec(['branch', '-D', 'topic'], repository.path)

    const names = await getBranchNamesForCommits(repository, [onTopic])
    assert.equal(names.get(onTopic), 'feat/ENG-329-sidebar')
  })

  it('leaves commits no branch contains unnamed', async t => {
    const repository = await setupEmptyRepository(t)

    await makeCommit(repository, {
      entries: [{ path: 'a.txt', contents: 'a\n' }],
    })
    await makeCommit(repository, {
      entries: [{ path: 'b.txt', contents: 'b\n' }],
    })
    const dropped = await getSHA(repository, 'HEAD')
    await exec(['reset', '--hard', 'HEAD~1'], repository.path)

    const names = await getBranchNamesForCommits(repository, [dropped])
    assert.equal(names.get(dropped), '')
  })
})
