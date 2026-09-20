import { getNumber, setNumber } from '../../lib/local-storage'

/** The base font size, in pixels, that the stylesheets are designed around. */
export const textSizeDefault = 12
export const textSizeMin = 10
export const textSizeMax = 18
export const textSizeStep = 1

const textSizeKey = 'text-size'

/**
 * Name of the DOM event dispatched on `document` after the text size has been
 * applied. Components that cache measurements which depend on the font size
 * (such as the virtualized diff rows) listen for it to re-measure.
 */
export const textSizeChangedEvent = 'text-size-changed'

/**
 * The CSS variables declared in _variables.scss that depend on the text size,
 * with their default pixel values. Every one of them is scaled proportionally
 * to the chosen size so headings, labels, body copy and the diff view keep
 * their relative proportions.
 */
const scaledVariables: ReadonlyArray<[string, number]> = [
  ['--font-size', 12],
  ['--font-size-sm', 11],
  ['--font-size-md', 14],
  ['--font-size-lg', 28],
  ['--font-size-xl', 32],
  ['--font-size-xxl', 42],
  ['--font-size-xs', 9],
  // The diff view lays out its rows with a fixed line height and line number
  // gutter, both of which need to grow with the monospace text.
  ['--diff-line-height', 20],
  ['--diff-line-number-column-width', 50],
]

export function clampTextSize(size: number) {
  if (isNaN(size)) {
    return textSizeDefault
  }
  return Math.min(textSizeMax, Math.max(textSizeMin, Math.round(size)))
}

/** Gets the persisted text size preference, in pixels. */
export function getTextSize(): number {
  return clampTextSize(getNumber(textSizeKey, textSizeDefault))
}

/** Persists the text size preference, in pixels. */
export function setTextSize(size: number) {
  setNumber(textSizeKey, clampTextSize(size))
}

/**
 * Applies the given text size to the document by overriding the font size
 * CSS variables on the root element. Passing the default size removes the
 * overrides so the stylesheet values are used as-is.
 */
export function applyTextSize(size: number, root = document.documentElement) {
  const scale = clampTextSize(size) / textSizeDefault

  for (const [name, px] of scaledVariables) {
    if (scale === 1) {
      root.style.removeProperty(name)
    } else {
      root.style.setProperty(name, `${Math.round(px * scale * 10) / 10}px`)
    }
  }

  // Use the document's own window so the event is the right type in
  // environments (like tests) where the global differs from the DOM's.
  const doc = root.ownerDocument
  const EventCtor = doc.defaultView?.CustomEvent ?? CustomEvent
  doc.dispatchEvent(new EventCtor(textSizeChangedEvent))
}
