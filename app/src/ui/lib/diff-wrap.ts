import { getBoolean, setBoolean } from '../../lib/local-storage'

const diffWrapLinesKey = 'diff-wrap-lines'
export const diffWrapLinesDefault = true

/** Class set on the document root while long diff lines don't wrap. */
export const diffNoWrapClass = 'diff-no-wrap'

/** Dispatched on `document` after the wrapping preference has been applied. */
export const diffWrapChangedEvent = 'diff-wrap-changed'

/** Whether long lines in diffs wrap (the default) or scroll horizontally. */
export function getDiffWrapLines(): boolean {
  return getBoolean(diffWrapLinesKey, diffWrapLinesDefault)
}

export function setDiffWrapLines(wrap: boolean) {
  setBoolean(diffWrapLinesKey, wrap)
}

/**
 * Applies the wrapping preference to the document so the diff stylesheet
 * and the diff component can pick it up.
 */
export function applyDiffWrapLines(
  wrap: boolean,
  root = document.documentElement
) {
  root.classList.toggle(diffNoWrapClass, !wrap)
  const doc = root.ownerDocument
  const EventCtor = doc.defaultView?.CustomEvent ?? CustomEvent
  doc.dispatchEvent(new EventCtor(diffWrapChangedEvent))
}
