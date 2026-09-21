import { app, nativeImage } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as Path from 'path'
import { utimes } from 'fs/promises'

const execFileAsync = promisify(execFile)

/**
 * JavaScript for Automation snippet that asks the Finder to use (or, with an
 * empty icon path, forget) a custom icon for a file. The custom icon lives
 * beside the bundle's contents, not inside them, so the code signature of
 * the app stays valid.
 */
const setFinderIconScript = `
ObjC.import('AppKit')
function run(argv) {
  const [appPath, iconPath] = argv
  const workspace = $.NSWorkspace.sharedWorkspace
  const image = iconPath ? $.NSImage.alloc.initWithContentsOfFile(iconPath) : $()
  if (iconPath && image.isNil()) {
    return 'unreadable'
  }
  return workspace.setIconForFileOptions(image, appPath, 0) ? 'ok' : 'failed'
}
`

/** The path of the .app bundle this process runs from, if any. */
function getAppBundlePath(): string | null {
  // <name>.app/Contents/MacOS/<executable>
  const bundle = Path.resolve(process.execPath, '..', '..', '..')
  return bundle.endsWith('.app') ? bundle : null
}

/**
 * Applies a custom app icon (a PNG on disk) to the Dock tile of the running
 * app and to the app bundle in the Finder, or restores the built-in icon
 * when `iconPath` is null.
 *
 * macOS only; a no-op elsewhere.
 */
export async function setAppIcon(iconPath: string | null): Promise<void> {
  if (!__DARWIN__) {
    return
  }

  const dockIconPath =
    iconPath ?? Path.join(__dirname, 'static', 'app-icons', 'glitch.png')
  const dockImage = nativeImage.createFromPath(dockIconPath)
  if (!dockImage.isEmpty()) {
    app.dock?.setIcon(dockImage)
  }

  const bundle = getAppBundlePath()
  if (bundle === null) {
    return
  }

  const { stdout } = await execFileAsync('osascript', [
    '-l',
    'JavaScript',
    '-e',
    setFinderIconScript,
    '--',
    bundle,
    iconPath ?? '',
  ])

  const result = stdout.trim()
  if (result !== 'ok') {
    throw new Error(`Could not update the app icon in the Finder (${result})`)
  }

  // Nudge the Finder and the Dock into noticing the change
  const now = new Date()
  await utimes(bundle, now, now).catch(() => undefined)
}
