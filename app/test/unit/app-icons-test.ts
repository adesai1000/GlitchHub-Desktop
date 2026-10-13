import assert from 'node:assert'
import { describe, it } from 'node:test'
import { mkdtemp, writeFile, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  appIconNameFromPath,
  defaultAppIconId,
  getBuiltInAppIcons,
  getInstalledAppIcons,
  getSelectedAppIconId,
  installAppIcon,
  removeInstalledAppIcon,
  setSelectedAppIconId,
} from '../../src/lib/app-icons'

describe('app icons', () => {
  it('ships the StickShift icon as the only built-in icon', () => {
    const icons = getBuiltInAppIcons('/out')
    assert.deepStrictEqual(
      icons.map(i => [i.id, i.name, i.builtIn]),
      [['stickshift', 'StickShift', true]]
    )
    assert.strictEqual(icons[0].id, defaultAppIconId)
    assert.ok(icons[0].path.endsWith('/static/app-icons/stickshift.png'))
  })

  it('persists the selection and treats the default as unset', () => {
    assert.strictEqual(getSelectedAppIconId(), defaultAppIconId)
    setSelectedAppIconId('custom-icon')
    assert.strictEqual(getSelectedAppIconId(), 'custom-icon')
    setSelectedAppIconId(defaultAppIconId)
    assert.strictEqual(getSelectedAppIconId(), defaultAppIconId)
  })

  it('derives a readable name from the file name', () => {
    assert.strictEqual(
      appIconNameFromPath('/x/forest-green_v2.png'),
      'Forest green v2'
    )
    assert.strictEqual(appIconNameFromPath('/x/.png'), 'Custom icon')
  })

  it('installs a PNG into the profile folder and can remove it again', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stickshift-icons-'))
    try {
      const source = join(dir, 'my-icon.png')
      await writeFile(source, 'not really a png')
      const icon = await installAppIcon(source, dir)
      assert.strictEqual(icon.name, 'My icon')
      assert.ok(icon.path.startsWith(join(dir, 'app-icons')))
      assert.ok((await stat(icon.path)).isFile())
      assert.deepStrictEqual(
        getInstalledAppIcons().map(i => i.id),
        [icon.id]
      )

      await removeInstalledAppIcon(icon.id)
      assert.deepStrictEqual(getInstalledAppIcons(), [])
      await assert.rejects(stat(icon.path))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects unsupported file types', async () => {
    await assert.rejects(installAppIcon('/x/icon.svg', '/tmp'), /Unsupported/)
  })
})
