import { Repository } from '../models/repository'

const key = (repository: Repository) =>
  `repository-external-editor-${repository.id}`

/**
 * The external editor chosen for a specific repository, overriding the one in
 * Settings, or null to use the default.
 */
export function getRepositoryExternalEditor(
  repository: Repository
): string | null {
  return localStorage.getItem(key(repository))
}

export function setRepositoryExternalEditor(
  repository: Repository,
  editor: string | null
) {
  if (editor === null) {
    localStorage.removeItem(key(repository))
  } else {
    localStorage.setItem(key(repository), editor)
  }
}

/**
 * Finds the repository, if any, that a path being opened in an editor
 * belongs to, so its editor override can be applied.
 */
export function findRepositoryForPath<T extends Repository>(
  repositories: ReadonlyArray<T | { readonly path: string }>,
  fullPath: string
): T | null {
  let best: T | null = null
  for (const repo of repositories) {
    if (!(repo instanceof Repository)) {
      continue
    }
    const root = repo.path.endsWith('/') ? repo.path : `${repo.path}/`
    if (
      (fullPath === repo.path || fullPath.startsWith(root)) &&
      (best === null || repo.path.length > best.path.length)
    ) {
      best = repo as T
    }
  }
  return best
}
