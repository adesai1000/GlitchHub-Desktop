import { getBoolean, setBoolean } from '../../lib/local-storage'

export const ShowSideBySideDiffDefault = false
const showSideBySideDiffKey = 'show-side-by-side-diff'

/**
 * Gets a value indicating whether not to present diffs in a split view mode
 * as opposed to unified (the default).
 */
export function getShowSideBySideDiff(): boolean {
  return getBoolean(showSideBySideDiffKey, ShowSideBySideDiffDefault)
}

/**
 * Sets a local storage key indicating whether not to present diffs in a split
 * view mode as opposed to unified (the default).
 */
export function setShowSideBySideDiff(showSideBySideDiff: boolean) {
  setBoolean(showSideBySideDiffKey, showSideBySideDiff)
}

export const ExpandWholeFileByDefaultDefault = false
const expandWholeFileByDefaultKey = 'expand-whole-file-by-default'

/**
 * Gets a value indicating whether text diffs should be expanded to show the
 * whole file as soon as they're loaded (as opposed to only the changed hunks
 * plus a few lines of context, which is the default).
 */
export function getExpandWholeFileByDefault(): boolean {
  return getBoolean(
    expandWholeFileByDefaultKey,
    ExpandWholeFileByDefaultDefault
  )
}

/**
 * Sets a local storage key indicating whether text diffs should be expanded to
 * show the whole file as soon as they're loaded.
 */
export function setExpandWholeFileByDefault(expandWholeFileByDefault: boolean) {
  setBoolean(expandWholeFileByDefaultKey, expandWholeFileByDefault)
}
