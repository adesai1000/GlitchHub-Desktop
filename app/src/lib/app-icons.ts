import { copyFile, mkdir, rm } from 'fs/promises'
import * as Path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getObject, setObject } from './local-storage'

const execFileAsync = promisify(execFile)

/** An icon the app can use for its Dock tile and bundle. */
export interface IAppIcon {
  readonly id: string
  readonly name: string
  /** Absolute path to a square PNG. */
  readonly path: string
  /** Whether the icon ships with the app (can't be removed). */
  readonly builtIn: boolean
}

/** The id of the icon the app ships with by default. */
export const defaultAppIconId = 'glitch'

const selectedAppIconKey = 'selected-app-icon'
const installedAppIconsKey = 'installed-app-icons'

/** File types accepted by "Install icon…". */
export const appIconFileExtensions = ['png', 'icns']

/**
 * The icons bundled with the app. `staticDir` is where the app's static
 * resources live (usually `__dirname` in the renderer).
 */
export function getBuiltInAppIcons(staticDir: string): ReadonlyArray<IAppIcon> {
  const dir = Path.join(staticDir, 'static', 'app-icons')
  return [
    {
      id: defaultAppIconId,
      name: 'Glitch',
      path: Path.join(dir, 'glitch.png'),
      builtIn: true,
    },
    {
      id: 'boring',
      name: 'Boring',
      path: Path.join(dir, 'boring.png'),
      builtIn: true,
    },
  ]
}

export function getSelectedAppIconId(): string {
  return localStorage.getItem(selectedAppIconKey) ?? defaultAppIconId
}

export function setSelectedAppIconId(id: string) {
  if (id === defaultAppIconId) {
    localStorage.removeItem(selectedAppIconKey)
  } else {
    localStorage.setItem(selectedAppIconKey, id)
  }
}

/** Icons the user installed, stored under the app's user data folder. */
export function getInstalledAppIcons(): ReadonlyArray<IAppIcon> {
  const stored = getObject<unknown>(installedAppIconsKey)
  if (!Array.isArray(stored)) {
    return []
  }
  return stored
    .filter(
      (x): x is { id: string; name: string; path: string } =>
        x !== null &&
        typeof x === 'object' &&
        typeof x.id === 'string' &&
        typeof x.name === 'string' &&
        typeof x.path === 'string'
    )
    .map(x => ({ ...x, builtIn: false }))
}

function setInstalledAppIcons(icons: ReadonlyArray<IAppIcon>) {
  setObject(
    installedAppIconsKey,
    icons.map(({ id, name, path }) => ({ id, name, path }))
  )
}

/** A readable name for an icon derived from its file name. */
export function appIconNameFromPath(sourcePath: string) {
  // Path.extname treats ".png" as a dotfile with no extension, so strip the
  // extension by hand
  const base = Path.basename(sourcePath).replace(/\.[A-Za-z0-9]+$/, '')
  const cleaned = base.replace(/[-_]+/g, ' ').trim()
  return cleaned.length > 0
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    : 'Custom icon'
}

/**
 * Copies (and if needed converts) an icon file into the app's user data
 * folder and records it. Returns the new icon.
 *
 * @param sourcePath  A .png or .icns file picked by the user
 * @param userDataDir The app's user data folder
 */
export async function installAppIcon(
  sourcePath: string,
  userDataDir: string,
  name = appIconNameFromPath(sourcePath)
): Promise<IAppIcon> {
  const ext = Path.extname(sourcePath).toLowerCase().replace('.', '')
  if (!appIconFileExtensions.includes(ext)) {
    throw new Error(
      `Unsupported icon file. Choose a ${appIconFileExtensions
        .map(e => `.${e}`)
        .join(' or ')} file.`
    )
  }

  const dir = Path.join(userDataDir, 'app-icons')
  await mkdir(dir, { recursive: true })

  const id = `custom-${Date.now().toString(36)}`
  const destination = Path.join(dir, `${id}.png`)

  if (ext === 'png') {
    await copyFile(sourcePath, destination)
  } else {
    // sips ships with macOS and can rasterize the largest representation
    await execFileAsync('sips', [
      '-s',
      'format',
      'png',
      sourcePath,
      '--out',
      destination,
    ])
  }

  const icon: IAppIcon = { id, name, path: destination, builtIn: false }
  setInstalledAppIcons([...getInstalledAppIcons(), icon])
  return icon
}

/** Forgets an installed icon and deletes its file. */
export async function removeInstalledAppIcon(id: string): Promise<void> {
  const icons = getInstalledAppIcons()
  const icon = icons.find(i => i.id === id)
  setInstalledAppIcons(icons.filter(i => i.id !== id))
  if (icon !== undefined) {
    await rm(icon.path, { force: true }).catch(() => undefined)
  }
}
