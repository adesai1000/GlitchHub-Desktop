import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdir, mkdtemp, realpath, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  findClaudeCodeFolders,
  getClaudeCodeProjectName,
  isClaudeCodeConfigDirectory,
  isDefaultClaudeCodeConfigDirectory,
} from '../../src/lib/claude-code/claude-code-conversations'

describe('Claude Code conversations', () => {
  it('names project folders the way Claude Code does', () => {
    assert.equal(
      getClaudeCodeProjectName('/Users/me/Developer/Kinship/kinship-api'),
      '-Users-me-Developer-Kinship-kinship-api'
    )
    assert.equal(
      getClaudeCodeProjectName('/Users/me/code/.claude/skills'),
      '-Users-me-code--claude-skills'
    )
  })

  it('finds conversations kept for a folder above the repository', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'stickshift-')))
    const config = join(root, 'config')
    const parent = join(root, 'Kinship')
    const repository = join(parent, 'kinship-api')

    const projects = join(config, 'projects', getClaudeCodeProjectName(parent))
    await mkdir(projects, { recursive: true })
    await writeFile(join(projects, 'one.jsonl'), '')
    await writeFile(join(projects, 'two.jsonl'), '')
    await writeFile(join(projects, 'notes.txt'), '')

    const folders = await findClaudeCodeFolders(repository, config)

    assert.deepEqual(folders, [{ path: parent, conversationCount: 2 }])
  })

  it('treats the default folder, however it is written, as the default', () => {
    assert.ok(isDefaultClaudeCodeConfigDirectory('~/.claude'))
    assert.ok(isDefaultClaudeCodeConfigDirectory('~/.claude/'))
    assert.ok(!isDefaultClaudeCodeConfigDirectory('~/.claude-work'))
  })

  it('tells a configuration folder from a project folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stickshift-'))
    const config = join(root, 'config')
    await mkdir(join(config, 'projects'), { recursive: true })

    assert.ok(await isClaudeCodeConfigDirectory(config))
    assert.ok(!(await isClaudeCodeConfigDirectory(root)))
  })
})
