import { app } from 'electron'
import * as Path from 'path'
import { cpSync, existsSync } from 'fs'

/**
 * The names the app had before it was StickShift. The profile folder, which
 * holds the repository list, settings, and sign-ins, is named after the app,
 * so a rename would otherwise start everyone over with an empty profile.
 */
const previousNames = __DEV__
  ? ['GlitchHub Desktop-dev']
  : ['GlitchHub Desktop']

/** Where the app keeps its repository list and its settings */
const appStores = ['IndexedDB', 'Local Storage']

/** Caches the app rebuilds on its own, and the running instance's locks */
const skippedEntries = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Crashpad',
  'SingletonLock',
  'SingletonCookie',
  'SingletonSocket',
])

/**
 * Copies the profile of the app's previous name into StickShift's profile
 * folder the first time StickShift starts. The old folder is left alone, so
 * going back to an old build still works.
 */
function migrateProfile() {
  // Electron creates the profile folder before the app's code runs, so look
  // for the stores that only appear once the app has run, instead
  const userData = app.getPath('userData')
  const hasRun = appStores.some(name => existsSync(Path.join(userData, name)))
  if (hasRun) {
    return
  }

  const appData = app.getPath('appData')
  const previous = previousNames
    .map(name => Path.join(appData, name))
    .find(path => existsSync(path))

  if (previous === undefined) {
    return
  }

  cpSync(previous, userData, {
    recursive: true,
    verbatimSymlinks: true,
    filter: source =>
      Path.dirname(source) !== previous ||
      !skippedEntries.has(Path.basename(source)),
  })
}

try {
  migrateProfile()
} catch (e) {
  // Logging isn't set up yet, and starting with an empty profile beats not
  // starting at all
  console.error('Could not copy the profile from the previous app name', e)
}
