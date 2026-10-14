import { Repository } from '../../models/repository'
import { git } from './core'

/**
 * The number of commits to name per `git name-rev` call, which keeps the
 * command line well under the platform limits
 */
const NameRevBatchSize = 200

/**
 * Patterns for the subjects of merge commits that name the merged branch.
 * Each captures the branch name.
 */
const mergeSubjectPatterns: ReadonlyArray<{
  readonly pattern: RegExp
  readonly stripRemote: boolean
}> = [
  // GitHub: "Merge pull request #123 from owner/feature/name"
  {
    pattern: /^Merge pull request #\d+ from [^/\s]+\/(\S+)/,
    stripRemote: false,
  },
  // git merge: "Merge remote-tracking branch 'origin/feature/name'"
  { pattern: /^Merge remote-tracking branch '([^']+)'/, stripRemote: true },
  // git merge and GitLab: "Merge branch 'feature/name' into main"
  { pattern: /^Merge branch '([^']+)'/, stripRemote: false },
]

/**
 * Guess which branch each commit was made on.
 *
 * Git doesn't record the branch a commit was made on, so this asks
 * `git name-rev` for the nearest branch that contains each commit. A commit
 * that reached that branch through a merge is named after the merged branch
 * instead, which comes from the merge commit's subject, for example
 * "Merge pull request #123 from owner/feature/name".
 *
 * Returns a map from SHA to branch name. Commits that no branch contains map
 * to an empty string.
 */
export async function getBranchNamesForCommits(
  repository: Repository,
  shas: ReadonlyArray<string>
): Promise<Map<string, string>> {
  const revNames = new Map<string, string>()

  for (let i = 0; i < shas.length; i += NameRevBatchSize) {
    const batch = shas.slice(i, i + NameRevBatchSize)
    const { stdout } = await git(
      [
        'name-rev',
        '--name-only',
        '--refs=refs/heads/*',
        '--refs=refs/remotes/*',
        '--exclude=refs/remotes/*/HEAD',
        ...batch,
      ],
      repository.path,
      'getBranchNamesForCommits'
    )

    const lines = stdout.split('\n')
    batch.forEach((sha, index) => revNames.set(sha, lines[index] ?? ''))
  }

  const parsed = new Map(
    Array.from(revNames, ([sha, name]) => [sha, parseRevName(name)])
  )

  const mergeRevs = new Set(
    Array.from(parsed.values()).flatMap(p => p?.mergeRev ?? [])
  )
  const mergedBranches = await getMergedBranchNames(repository, [...mergeRevs])

  const result = new Map<string, string>()
  for (const [sha, revName] of parsed) {
    if (revName === null) {
      result.set(sha, '')
      continue
    }

    const mergedBranch =
      revName.mergeRev === null
        ? undefined
        : mergedBranches.get(revName.mergeRev)

    result.set(sha, mergedBranch ?? revName.branch)
  }

  return result
}

interface IParsedRevName {
  /** The branch the name starts from, for example `main` or `origin/main` */
  readonly branch: string

  /**
   * A revision for the last merge commit on the way from the branch to the
   * commit, when the commit came in through a merge. For example the
   * commit named `main~5^2~1` came in through the merge `main~5`.
   */
  readonly mergeRev: string | null
}

function parseRevName(name: string): IParsedRevName | null {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed === 'undefined') {
    return null
  }

  // Ref names can't contain `~` or `^`, so the first one starts the path
  const pathStart = trimmed.search(/[~^]/)
  const ref = pathStart === -1 ? trimmed : trimmed.slice(0, pathStart)
  const path = pathStart === -1 ? '' : trimmed.slice(pathStart)

  // A step to a second or later parent, like `^2`, goes through a merge
  let lastMergeStep = -1
  for (const match of path.matchAll(/\^([2-9]|\d{2,})/g)) {
    lastMergeStep = match.index ?? -1
  }

  return {
    branch: ref.replace(/^remotes\//, ''),
    mergeRev: lastMergeStep === -1 ? null : ref + path.slice(0, lastMergeStep),
  }
}

/**
 * Read the branch names that merge commits name in their subjects.
 *
 * @returns A map from the given revision to the merged branch, for the
 *          merge commits whose subject names one
 */
async function getMergedBranchNames(
  repository: Repository,
  revs: ReadonlyArray<string>
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (revs.length === 0) {
    return result
  }

  // The revisions come from `git name-rev`, so they start with a ref name
  // and can't be mistaken for options
  const resolved = await git(
    ['rev-parse', ...revs],
    repository.path,
    'getMergeCommitSHAs'
  )
  const shas = resolved.stdout.split('\n').slice(0, revs.length)

  const log = await git(
    ['log', '--no-walk', '--format=%H%x1f%s', ...shas],
    repository.path,
    'getMergeCommitSubjects'
  )

  const subjects = new Map<string, string>()
  for (const line of log.stdout.split('\n')) {
    const [sha, subject] = line.split('\x1f')
    if (sha && subject !== undefined) {
      subjects.set(sha, subject)
    }
  }

  revs.forEach((rev, index) => {
    const subject = subjects.get(shas[index])
    const branch =
      subject === undefined ? null : getMergedBranchFromSubject(subject)
    if (branch !== null) {
      result.set(rev, branch)
    }
  })

  return result
}

function getMergedBranchFromSubject(subject: string): string | null {
  for (const { pattern, stripRemote } of mergeSubjectPatterns) {
    const match = pattern.exec(subject)
    if (match !== null) {
      return stripRemote ? match[1].replace(/^[^/]+\//, '') : match[1]
    }
  }

  return null
}
