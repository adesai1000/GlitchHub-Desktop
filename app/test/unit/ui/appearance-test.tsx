import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { render, screen, fireEvent } from '../../helpers/ui/render'
import { Appearance } from '../../../src/ui/preferences/appearance'
import { ApplicationTheme } from '../../../src/ui/lib/application-theme'
import {
  getDateFormatPreference,
  getTimeFormatPreference,
  getNumberFormatPreference,
} from '../../../src/models/formatting-preferences'

function renderAppearance(
  alwaysShowWorktreeList = false,
  expandWholeFileByDefault = false
) {
  const changes: boolean[] = []
  const expandChanges: boolean[] = []
  const textSizes: number[] = []
  const props = {
    selectedTheme: ApplicationTheme.Light,
    onSelectedThemeChanged: () => {},
    selectedTabSize: 4,
    onSelectedTabSizeChanged: () => {},
    selectedTextSize: 12,
    onSelectedTextSizeChanged: (value: number) => textSizes.push(value),
    diffWrapLines: true,
    onDiffWrapLinesChanged: () => {},
    branchSortOrder: 'name' as const,
    onBranchSortOrderChanged: () => {},
    selectedDateFormat: getDateFormatPreference(),
    onSelectedDateFormatChanged: () => {},
    selectedTimeFormat: getTimeFormatPreference(),
    onSelectedTimeFormatChanged: () => {},
    selectedNumberFormat: getNumberFormatPreference(),
    onSelectedNumberFormatChanged: () => {},
    preferAbsoluteDates: false,
    onPreferAbsoluteDatesChanged: () => {},
    alwaysShowWorktreeList,
    onAlwaysShowWorktreeListChanged: (value: boolean) => changes.push(value),
    expandWholeFileByDefault,
    onExpandWholeFileByDefaultChanged: (value: boolean) =>
      expandChanges.push(value),
  }
  const view = render(<Appearance {...props} />)
  return { ...view, props, changes, expandChanges, textSizes }
}

describe('Appearance preferences', () => {
  it('shows the worktree preference below Diff Tab Size in Miscellaneous', () => {
    renderAppearance()

    const heading = screen.getByRole('heading', { name: 'Miscellaneous' })
    const tabSize = screen.getByRole('combobox', { name: /Diff Tab Size/i })
    const checkbox = screen.getByRole('checkbox', {
      name: 'Always show worktree list',
    })

    assert.strictEqual(
      heading.parentElement,
      tabSize.closest('.appearance-section')
    )
    assert.strictEqual(
      heading.parentElement,
      checkbox.closest('.appearance-section')
    )
    assert.ok(
      tabSize.compareDocumentPosition(checkbox) &
        Node.DOCUMENT_POSITION_FOLLOWING
    )
    assert.ok(checkbox instanceof HTMLInputElement)
    assert.strictEqual(checkbox.checked, false)
  })

  it('reports enabling and disabling the preference and reflects updated props', () => {
    const { rerender, props, changes } = renderAppearance()
    const checkbox = screen.getByRole('checkbox', {
      name: 'Always show worktree list',
    })
    fireEvent.click(checkbox)
    assert.deepStrictEqual(changes, [true])

    rerender(<Appearance {...props} alwaysShowWorktreeList={true} />)
    assert.ok(checkbox instanceof HTMLInputElement)
    assert.strictEqual(checkbox.checked, true)

    fireEvent.click(checkbox)
    assert.deepStrictEqual(changes, [true, false])
  })

  it('shows a text size slider at the default size with a live example', () => {
    const { textSizes, rerender, props } = renderAppearance()

    const slider = screen.getByRole('slider', { name: /Text size/i })
    assert.ok(slider instanceof HTMLInputElement)
    assert.strictEqual(slider.value, '12')
    assert.ok(screen.getByText('Example 12 px'))
    assert.ok(screen.getByText('Default'))

    fireEvent.change(slider, { target: { value: '16' } })
    assert.deepStrictEqual(textSizes, [16])

    rerender(<Appearance {...props} selectedTextSize={16} />)
    assert.strictEqual(slider.value, '16')
    assert.ok(screen.getByText('Example 16 px'))
  })

  it('shows the diff expansion options under their own heading, changes only by default', () => {
    renderAppearance()

    const heading = screen.getByRole('heading', { name: /Diff Expansion/i })
    const changesOnly = screen.getByRole('radio', {
      name: 'Changed lines only',
    })
    const wholeFile = screen.getByRole('radio', { name: 'Whole file' })

    assert.strictEqual(
      heading.parentElement,
      changesOnly.closest('.appearance-section')
    )
    assert.strictEqual(
      heading.parentElement,
      wholeFile.closest('.appearance-section')
    )
    assert.ok(changesOnly instanceof HTMLInputElement)
    assert.ok(wholeFile instanceof HTMLInputElement)
    assert.strictEqual(changesOnly.checked, true)
    assert.strictEqual(wholeFile.checked, false)
  })

  it('reports picking whole file or changes only and reflects updated props', () => {
    const { rerender, props, expandChanges } = renderAppearance()
    const changesOnly = screen.getByRole('radio', {
      name: 'Changed lines only',
    })
    const wholeFile = screen.getByRole('radio', { name: 'Whole file' })

    fireEvent.click(wholeFile)
    assert.deepStrictEqual(expandChanges, [true])

    rerender(<Appearance {...props} expandWholeFileByDefault={true} />)
    assert.ok(wholeFile instanceof HTMLInputElement)
    assert.ok(changesOnly instanceof HTMLInputElement)
    assert.strictEqual(wholeFile.checked, true)
    assert.strictEqual(changesOnly.checked, false)

    fireEvent.click(changesOnly)
    assert.deepStrictEqual(expandChanges, [true, false])
  })
})
