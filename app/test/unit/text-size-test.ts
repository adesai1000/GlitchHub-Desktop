import assert from 'node:assert'
import { describe, it } from 'node:test'
import {
  applyTextSize,
  clampTextSize,
  textSizeChangedEvent,
  textSizeDefault,
  textSizeMax,
  textSizeMin,
} from '../../src/ui/lib/text-size'

describe('text size', () => {
  it('clamps to the supported range and falls back to the default', () => {
    assert.strictEqual(clampTextSize(textSizeMin - 5), textSizeMin)
    assert.strictEqual(clampTextSize(textSizeMax + 5), textSizeMax)
    assert.strictEqual(clampTextSize(13.4), 13)
    assert.strictEqual(clampTextSize(NaN), textSizeDefault)
  })

  it('scales every dependent variable and clears them at the default', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const events: string[] = []
    document.addEventListener(textSizeChangedEvent, () =>
      events.push('changed')
    )

    applyTextSize(18, root)
    assert.strictEqual(root.style.getPropertyValue('--font-size'), '18px')
    assert.strictEqual(root.style.getPropertyValue('--font-size-sm'), '16.5px')
    assert.strictEqual(
      root.style.getPropertyValue('--diff-line-height'),
      '30px'
    )
    assert.strictEqual(
      root.style.getPropertyValue('--diff-line-number-column-width'),
      '75px'
    )

    applyTextSize(textSizeDefault, root)
    assert.strictEqual(root.style.getPropertyValue('--font-size'), '')
    assert.strictEqual(root.style.getPropertyValue('--diff-line-height'), '')

    assert.deepStrictEqual(events, ['changed', 'changed'])
    document.body.removeChild(root)
  })
})
