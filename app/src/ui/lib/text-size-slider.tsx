import * as React from 'react'
import {
  textSizeDefault,
  textSizeMax,
  textSizeMin,
  textSizeStep,
} from './text-size'

interface ITextSizeSliderProps {
  /** The currently selected text size, in pixels. */
  readonly value: number

  /** Called whenever the user picks a new size. */
  readonly onChange: (size: number) => void

  /** The id of the element that labels the slider. */
  readonly ariaLabelledBy?: string
}

/**
 * A macOS-style text size slider: a small "A" on the left, a large "A" on the
 * right, a tick for every available size with the default one labelled, and a
 * live example rendered at the chosen size.
 */
export class TextSizeSlider extends React.Component<ITextSizeSliderProps> {
  private onChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.props.onChange(parseInt(event.currentTarget.value, 10))
  }

  private renderTicks() {
    const ticks = []
    const count = (textSizeMax - textSizeMin) / textSizeStep + 1

    for (let i = 0; i < count; i++) {
      const size = textSizeMin + i * textSizeStep
      const left = `${(i / (count - 1)) * 100}%`
      const isDefault = size === textSizeDefault
      ticks.push(
        <span
          key={size}
          className={isDefault ? 'tick default' : 'tick'}
          style={{ left }}
        >
          {isDefault ? <span className="tick-label">Default</span> : null}
        </span>
      )
    }

    return <div className="text-size-ticks">{ticks}</div>
  }

  public render() {
    const { value } = this.props

    return (
      <div className="text-size-slider">
        <div className="text-size-slider-row">
          <span className="text-size-glyph small" aria-hidden="true">
            A
          </span>
          <div className="text-size-track">
            <input
              type="range"
              min={textSizeMin}
              max={textSizeMax}
              step={textSizeStep}
              value={value}
              onChange={this.onChange}
              aria-labelledby={this.props.ariaLabelledBy}
              aria-valuetext={`${value} pixels`}
            />
            {this.renderTicks()}
          </div>
          <span className="text-size-glyph large" aria-hidden="true">
            A
          </span>
        </div>
        <div className="text-size-example" style={{ fontSize: `${value}px` }}>
          Example {value} px
        </div>
      </div>
    )
  }
}
