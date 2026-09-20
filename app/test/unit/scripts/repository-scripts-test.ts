import assert from 'node:assert'
import { describe, it } from 'node:test'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  discoverRepositoryScripts,
  getRepositoryScriptsConfig,
  getScriptRunCommand,
  setRepositoryScriptsConfig,
  setPreferredPackageManager,
  shouldConfirmScript,
  setAlwaysConfirmScripts,
} from '../../../src/lib/scripts/repository-scripts'
import { Repository } from '../../../src/models/repository'

async function withRepo(
  files: Record<string, string>,
  fn: (path: string) => Promise<void>
) {
  const path = await mkdtemp(join(tmpdir(), 'glitchhub-scripts-'))
  try {
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(join(path, name), contents)
    }
    await fn(path)
  } finally {
    await rm(path, { recursive: true, force: true })
  }
}

describe('repository scripts', () => {
  it('returns null when there is no package.json or no scripts', async () => {
    await withRepo({}, async path => {
      assert.strictEqual(await discoverRepositoryScripts(path), null)
    })
    await withRepo({ 'package.json': '{"name":"x"}' }, async path => {
      assert.strictEqual(await discoverRepositoryScripts(path), null)
    })
    await withRepo({ 'package.json': 'not json' }, async path => {
      assert.strictEqual(await discoverRepositoryScripts(path), null)
    })
  })

  it('reads scripts in declaration order and detects the package manager', async () => {
    const pkg = JSON.stringify({
      scripts: {
        dev: 'wrangler dev',
        'deploy:prod': 'wrangler deploy',
        bad: 1,
      },
    })
    await withRepo({ 'package.json': pkg, 'yarn.lock': '' }, async path => {
      const result = await discoverRepositoryScripts(path)
      assert.ok(result !== null)
      assert.strictEqual(result.packageManager, 'yarn')
      assert.strictEqual(result.detectedFromLockFile, true)
      assert.deepStrictEqual(
        result.scripts.map(s => s.name),
        ['dev', 'deploy:prod']
      )
      assert.strictEqual(result.scripts[1].command, 'wrangler deploy')
    })
  })

  it('prefers the packageManager field, then falls back to npm', async () => {
    const pkg = JSON.stringify({
      packageManager: 'pnpm@9.0.0',
      scripts: { test: 'vitest' },
    })
    await withRepo({ 'package.json': pkg, 'yarn.lock': '' }, async path => {
      const result = await discoverRepositoryScripts(path)
      assert.strictEqual(result?.packageManager, 'pnpm')
    })
    await withRepo(
      { 'package.json': '{"scripts":{"test":"vitest"}}' },
      async path => {
        const result = await discoverRepositoryScripts(path)
        assert.strictEqual(result?.packageManager, 'npm')
        assert.strictEqual(result?.detectedFromLockFile, false)
      }
    )
  })

  it('honours a globally preferred package manager', async () => {
    setPreferredPackageManager('bun')
    try {
      await withRepo(
        { 'package.json': '{"scripts":{"test":"vitest"}}', 'yarn.lock': '' },
        async path => {
          const result = await discoverRepositoryScripts(path)
          assert.strictEqual(result?.packageManager, 'bun')
          assert.strictEqual(result?.detectedFromLockFile, false)
        }
      )
    } finally {
      setPreferredPackageManager(undefined)
    }
  })

  it('builds run commands and quotes unusual script names', () => {
    assert.strictEqual(getScriptRunCommand('npm', 'test'), 'npm run test')
    assert.strictEqual(
      getScriptRunCommand('pnpm', 'deploy:staging'),
      'pnpm run deploy:staging'
    )
    assert.strictEqual(
      getScriptRunCommand('yarn', 'weird name'),
      __WIN32__ ? 'yarn run "weird name"' : "yarn run 'weird name'"
    )
  })

  it('persists per-repository config and confirmation rules', () => {
    const repository = new Repository('/tmp/does-not-matter', 4242, null, false)
    assert.deepStrictEqual(getRepositoryScriptsConfig(repository), {
      enabled: [],
      confirm: [],
    })

    setRepositoryScriptsConfig(repository, {
      enabled: ['dev', 'deploy:prod'],
      confirm: ['deploy:prod'],
    })
    const config = getRepositoryScriptsConfig(repository)
    assert.deepStrictEqual(config.enabled, ['dev', 'deploy:prod'])
    assert.strictEqual(shouldConfirmScript(config, 'deploy:prod'), true)
    assert.strictEqual(shouldConfirmScript(config, 'dev'), false)

    setAlwaysConfirmScripts(true)
    try {
      assert.strictEqual(shouldConfirmScript(config, 'dev'), true)
    } finally {
      setAlwaysConfirmScripts(false)
    }
  })
})
