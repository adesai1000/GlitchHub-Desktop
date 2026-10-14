import { Repository } from '../../models/repository'
import {
  AppFileStatusKind,
  CommittedFileChange,
  WorkingTreeCommitish,
} from '../../models/status'
import { DiffType, IDiff, IImageDiff } from '../../models/diff'
import { getOldPathOrDefault } from '../get-old-path'
import { git } from './core'
import { IChangesetData, parseRawLogWithNumstat } from './log'
import { getMergeBase } from './merge'
import {
  buildDiff,
  ensureRelativePath,
  getBlobImage,
  getWorkingDirectoryImage,
  parseLineEndingsWarning,
} from './diff'

/** The point a branch review compares the current branch against */
export interface IBranchReviewBase {
  /** The ref the merge base was computed with, for example `origin/main` */
  readonly ref: string

  /** The SHA of the best common ancestor of `ref` and HEAD */
  readonly mergeBase: string
}

/**
 * Find the merge base of HEAD and the first of the given refs that shares
 * history with HEAD.
 *
 * Pass a local branch's upstream before the branch itself, so that a stale
 * local copy of the base branch doesn't add commits that already landed on
 * the remote.
 *
 * Returns null when none of the refs exist or share history with HEAD.
 */
export async function getBranchReviewBase(
  repository: Repository,
  candidateRefs: ReadonlyArray<string>
): Promise<IBranchReviewBase | null> {
  for (const ref of candidateRefs) {
    const mergeBase = await getMergeBase(repository, ref, 'HEAD')
    if (mergeBase !== null) {
      return { ref, mergeBase }
    }
  }

  return null
}

/** Count the commits on HEAD that aren't reachable from the merge base */
export async function getBranchReviewCommitCount(
  repository: Repository,
  mergeBase: string
): Promise<number> {
  const { stdout } = await git(
    ['rev-list', '--count', `${mergeBase}..HEAD`],
    repository.path,
    'getBranchReviewCommitCount'
  )

  return parseInt(stdout.trim(), 10) || 0
}

/**
 * Get the files that differ between the merge base and HEAD, or between the
 * merge base and the working directory when `includeUncommitted` is set. This
 * is the net change a pull request from the current branch would contain.
 *
 * Untracked files are only listed when `includeUncommitted` is set, and don't
 * count toward the added and deleted lines.
 */
export async function getBranchReviewChangedFiles(
  repository: Repository,
  mergeBase: string,
  headSHA: string,
  includeUncommitted: boolean
): Promise<IChangesetData> {
  const args = [
    'diff',
    '-C',
    '-M',
    '-z',
    '--raw',
    '--numstat',
    '--end-of-options',
    mergeBase,
    ...(includeUncommitted ? [] : [headSHA]),
    '--',
  ]

  const { stdout } = await git(
    args,
    repository.path,
    'getBranchReviewChangedFiles'
  )

  const commitish = includeUncommitted ? WorkingTreeCommitish : headSHA
  const changeset = parseRawLogWithNumstat(stdout, commitish, mergeBase)

  if (!includeUncommitted) {
    return changeset
  }

  const untracked = await git(
    ['ls-files', '--others', '--exclude-standard', '-z'],
    repository.path,
    'getBranchReviewUntrackedFiles'
  )

  const untrackedFiles = untracked.stdout
    .split('\0')
    .filter(path => path.length > 0)
    .map(
      path =>
        new CommittedFileChange(
          path,
          { kind: AppFileStatusKind.Untracked },
          WorkingTreeCommitish,
          mergeBase
        )
    )

  const files = [...changeset.files, ...untrackedFiles].sort((a, b) =>
    a.path.localeCompare(b.path)
  )

  return { ...changeset, files }
}

/**
 * Render the diff of a file in the branch review, from the merge base to HEAD
 * or to the working directory.
 *
 * @param file A file from getBranchReviewChangedFiles
 */
export async function getBranchReviewDiff(
  repository: Repository,
  file: CommittedFileChange,
  mergeBase: string,
  hideWhitespaceInDiff: boolean
): Promise<IDiff> {
  const inWorkingTree = file.commitish === WorkingTreeCommitish
  const args = [
    'diff',
    ...(hideWhitespaceInDiff ? ['-w'] : []),
    '--no-ext-diff',
    '--patch-with-raw',
    '-z',
    '--no-color',
  ]
  const successExitCodes = new Set([0])

  if (file.status.kind === AppFileStatusKind.Untracked) {
    // `git diff --no-index` exits with 1 when it finds changes
    successExitCodes.add(1)
    args.push('--no-index', '--', '/dev/null', file.path)
  } else {
    args.push(
      '-M',
      '--end-of-options',
      mergeBase,
      ...(inWorkingTree ? [] : [file.commitish]),
      '--',
      ensureRelativePath(file.path)
    )

    if (
      file.status.kind === AppFileStatusKind.Renamed ||
      file.status.kind === AppFileStatusKind.Copied
    ) {
      args.push(ensureRelativePath(file.status.oldPath))
    }
  }

  const { stdout, stderr } = await git(
    args,
    repository.path,
    'getBranchReviewDiff',
    { successExitCodes, encoding: 'buffer' }
  )

  return buildDiff(
    stdout,
    repository,
    file,
    file.commitish,
    mergeBase,
    inWorkingTree ? parseLineEndingsWarning(stderr) : undefined,
    () => getBranchReviewImageDiff(repository, file, mergeBase)
  )
}

async function getBranchReviewImageDiff(
  repository: Repository,
  file: CommittedFileChange,
  mergeBase: string
): Promise<IImageDiff> {
  const { kind } = file.status
  const isNew =
    kind === AppFileStatusKind.New || kind === AppFileStatusKind.Untracked

  const previous = isNew
    ? undefined
    : await getBlobImage(repository, getOldPathOrDefault(file), mergeBase)

  let current = undefined
  if (kind !== AppFileStatusKind.Deleted) {
    current =
      file.commitish === WorkingTreeCommitish
        ? await getWorkingDirectoryImage(repository, file)
        : await getBlobImage(repository, file.path, file.commitish)
  }

  return { kind: DiffType.Image, previous, current }
}
