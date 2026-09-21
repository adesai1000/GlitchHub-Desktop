import * as React from 'react'
import { IAppIcon } from '../../lib/app-icons'
import { encodePathAsUrl } from '../../lib/path'
import { getName } from '../lib/app-proxy'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IAppIconPickerProps {
  readonly icons: ReadonlyArray<IAppIcon>
  readonly selectedId: string
  readonly onSelectionChanged: (id: string) => void
  readonly onInstall: () => void
  readonly onRemove: (id: string) => void
  readonly ariaLabelledBy?: string
}

interface IAppIconCardProps {
  readonly icon: IAppIcon
  readonly selected: boolean
  readonly onSelect: (id: string) => void
  readonly onRemove: (id: string) => void
}

class AppIconCard extends React.Component<IAppIconCardProps> {
  private onChange = () => {
    this.props.onSelect(this.props.icon.id)
  }

  private onRemove = () => {
    this.props.onRemove(this.props.icon.id)
  }

  public render() {
    const { icon, selected } = this.props
    const inputId = `app-icon-${icon.id}`

    return (
      <div className={`app-icon-card${selected ? ' selected' : ''}`}>
        <label htmlFor={inputId}>
          <img src={encodePathAsUrl(icon.path)} alt="" />
          <span className="app-icon-name">
            <input
              id={inputId}
              type="radio"
              name="app-icon"
              value={icon.id}
              checked={selected}
              onChange={this.onChange}
            />
            {icon.name}
          </span>
        </label>
        {icon.builtIn ? null : (
          <button
            type="button"
            className="app-icon-remove"
            aria-label={`Remove ${icon.name}`}
            onClick={this.onRemove}
          >
            <Octicon symbol={octicons.x} />
          </button>
        )}
      </div>
    )
  }
}

/**
 * Cards for the built-in app icons and the ones the user installed, plus a
 * card that installs a new one. Styled after the theme picker.
 */
export class AppIconPicker extends React.Component<IAppIconPickerProps> {
  private renderDockPreview() {
    const selected = this.props.icons.find(i => i.id === this.props.selectedId)
    if (selected === undefined) {
      return null
    }

    return (
      <div className="app-icon-dock" aria-hidden="true">
        <span className="dock-tile" />
        <span className="dock-tile" />
        <span className="dock-app">
          <span className="dock-tooltip">{getName()}</span>
          <img src={encodePathAsUrl(selected.path)} alt="" />
          <span className="dock-running-dot" />
        </span>
        <span className="dock-tile" />
        <span className="dock-tile" />
      </div>
    )
  }

  public render() {
    const { icons, selectedId } = this.props
    const builtIn = icons.filter(i => i.builtIn)
    const installed = icons.filter(i => !i.builtIn)

    return (
      <div
        className="app-icon-picker"
        role="radiogroup"
        aria-labelledby={this.props.ariaLabelledBy}
      >
        <div className="app-icon-group-label">Preview</div>
        {this.renderDockPreview()}

        <div className="app-icon-group-label">Included with GlitchHub</div>
        <div className="app-icon-grid">
          {builtIn.map(icon => (
            <AppIconCard
              key={icon.id}
              icon={icon}
              selected={icon.id === selectedId}
              onSelect={this.props.onSelectionChanged}
              onRemove={this.props.onRemove}
            />
          ))}
        </div>

        <div className="app-icon-group-label">Installed by you</div>
        <div className="app-icon-grid">
          {installed.map(icon => (
            <AppIconCard
              key={icon.id}
              icon={icon}
              selected={icon.id === selectedId}
              onSelect={this.props.onSelectionChanged}
              onRemove={this.props.onRemove}
            />
          ))}
          <button
            type="button"
            className="app-icon-card app-icon-install"
            onClick={this.props.onInstall}
          >
            <Octicon symbol={octicons.plus} />
            <span className="app-icon-name">
              {__DARWIN__ ? 'Install Icon…' : 'Install icon…'}
            </span>
            <span className="app-icon-hint">.icns or a 1024 px PNG</span>
          </button>
        </div>
      </div>
    )
  }
}
