import * as React from 'react'

/**
 * Small illustrations used by the "Diff expansion" preference, in the same
 * style (and aspect ratio) as the theme swatches. They're inline SVGs rather
 * than static images so that they can pick up the colors of the active theme
 * through CSS variables.
 */

const width = 228
const height = 120
const headerHeight = 21
const sidebarWidth = 49
const gutterWidth = 22
const rowHeight = 9
const codeX = sidebarWidth + gutterWidth + 6

type RowKind = 'context' | 'add' | 'delete' | 'hunk'

interface IRow {
  readonly kind: RowKind
  /** Width of the fake line of code, in px */
  readonly lineWidth: number
}

function rowBackground(kind: RowKind) {
  switch (kind) {
    case 'add':
      return 'var(--diff-add-background-color)'
    case 'delete':
      return 'var(--diff-delete-background-color)'
    case 'hunk':
      return 'var(--diff-hunk-background-color)'
    default:
      return 'transparent'
  }
}

function gutterBackground(kind: RowKind) {
  switch (kind) {
    case 'add':
      return 'var(--diff-add-gutter-background-color)'
    case 'delete':
      return 'var(--diff-delete-gutter-background-color)'
    case 'hunk':
      return 'var(--diff-hunk-gutter-background-color)'
    default:
      return 'var(--diff-gutter-background-color)'
  }
}

function lineColor(kind: RowKind) {
  switch (kind) {
    case 'add':
      return 'var(--diff-add-text-color)'
    case 'delete':
      return 'var(--diff-delete-text-color)'
    case 'hunk':
      return 'var(--diff-hunk-text-color)'
    default:
      return 'var(--text-secondary-color)'
  }
}

function renderRow(row: IRow, index: number) {
  const y = headerHeight + index * rowHeight
  const gutterX = sidebarWidth

  if (row.kind === 'hunk') {
    // A collapsed hunk boundary: highlighted row with an "expand" marker in the
    // gutter and a faint hunk header line.
    return (
      <g key={index}>
        <rect
          x={sidebarWidth}
          y={y}
          width={width - sidebarWidth}
          height={rowHeight}
          fill={rowBackground(row.kind)}
        />
        <rect
          x={gutterX}
          y={y}
          width={gutterWidth}
          height={rowHeight}
          fill={gutterBackground(row.kind)}
        />
        <g fill="var(--diff-hunk-gutter-color)">
          <circle cx={gutterX + 7} cy={y + 4.5} r={1} />
          <circle cx={gutterX + 11} cy={y + 4.5} r={1} />
          <circle cx={gutterX + 15} cy={y + 4.5} r={1} />
        </g>
        <rect
          x={codeX}
          y={y + 3}
          width={row.lineWidth}
          height={3}
          rx={1.5}
          fill={lineColor(row.kind)}
          opacity={0.6}
        />
      </g>
    )
  }

  return (
    <g key={index}>
      <rect
        x={sidebarWidth}
        y={y}
        width={width - sidebarWidth}
        height={rowHeight}
        fill={rowBackground(row.kind)}
      />
      <rect
        x={gutterX}
        y={y}
        width={gutterWidth}
        height={rowHeight}
        fill={gutterBackground(row.kind)}
      />
      <rect
        x={gutterX + 5}
        y={y + 3}
        width={6}
        height={3}
        rx={1.5}
        fill="var(--diff-line-number-color)"
        opacity={0.7}
      />
      <rect
        x={gutterX + 13}
        y={y + 3}
        width={6}
        height={3}
        rx={1.5}
        fill="var(--diff-line-number-color)"
        opacity={0.7}
      />
      <rect
        x={codeX}
        y={y + 3}
        width={row.lineWidth}
        height={3}
        rx={1.5}
        fill={lineColor(row.kind)}
        opacity={row.kind === 'context' ? 0.45 : 0.9}
      />
    </g>
  )
}

function renderChrome() {
  return (
    <g>
      {/* window background */}
      <rect width={width} height={height} fill="var(--background-color)" />
      {/* sidebar with a few file entries */}
      <rect
        y={headerHeight}
        width={sidebarWidth}
        height={height - headerHeight}
        fill="var(--box-alt-background-color)"
      />
      <g fill="var(--text-secondary-color)" opacity={0.5}>
        <rect x={4} y={26} width={41} height={4} rx={2} />
        <rect x={4} y={33} width={41} height={4} rx={2} />
        <rect x={4} y={40} width={41} height={4} rx={2} />
      </g>
      <rect
        x={sidebarWidth - 1}
        y={headerHeight}
        width={1}
        height={height - headerHeight}
        fill="var(--box-border-color)"
      />
      {/* diff gutter */}
      <rect
        x={sidebarWidth}
        y={headerHeight}
        width={gutterWidth}
        height={height - headerHeight}
        fill="var(--diff-gutter-background-color)"
      />
      {/* toolbar */}
      <rect
        width={width}
        height={headerHeight}
        fill="var(--toolbar-background-color)"
      />
      <g fill="var(--text-secondary-color)" opacity={0.6}>
        <rect x={5} y={7} width={6} height={6} rx={3} />
        <rect x={15} y={6} width={28} height={3} rx={1.5} />
        <rect x={15} y={11} width={28} height={3} rx={1.5} />
        <rect x={55} y={7} width={6} height={6} rx={3} />
        <rect x={65} y={6} width={28} height={3} rx={1.5} />
        <rect x={65} y={11} width={28} height={3} rx={1.5} />
        <rect x={105} y={7} width={6} height={6} rx={3} />
        <rect x={115} y={6} width={28} height={3} rx={1.5} />
        <rect x={115} y={11} width={28} height={3} rx={1.5} />
      </g>
      <rect
        y={headerHeight}
        width={width}
        height={1}
        fill="var(--box-border-color)"
      />
    </g>
  )
}

function renderSwatch(rows: ReadonlyArray<IRow>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      {renderChrome()}
      {rows.map(renderRow)}
    </svg>
  )
}

/** Only the changed hunks plus a few lines of context, separated by hunk headers. */
export function DiffChangesOnlySwatch() {
  return renderSwatch([
    { kind: 'hunk', lineWidth: 60 },
    { kind: 'context', lineWidth: 80 },
    { kind: 'context', lineWidth: 110 },
    { kind: 'delete', lineWidth: 70 },
    { kind: 'add', lineWidth: 95 },
    { kind: 'add', lineWidth: 55 },
    { kind: 'context', lineWidth: 100 },
    { kind: 'hunk', lineWidth: 60 },
    { kind: 'context', lineWidth: 85 },
    { kind: 'delete', lineWidth: 65 },
    { kind: 'add', lineWidth: 90 },
  ])
}

/** The whole file with the changes shown in place. */
export function DiffWholeFileSwatch() {
  return renderSwatch([
    { kind: 'context', lineWidth: 90 },
    { kind: 'context', lineWidth: 60 },
    { kind: 'context', lineWidth: 110 },
    { kind: 'context', lineWidth: 75 },
    { kind: 'delete', lineWidth: 70 },
    { kind: 'add', lineWidth: 95 },
    { kind: 'add', lineWidth: 55 },
    { kind: 'context', lineWidth: 100 },
    { kind: 'context', lineWidth: 65 },
    { kind: 'context', lineWidth: 120 },
    { kind: 'context', lineWidth: 80 },
  ])
}
