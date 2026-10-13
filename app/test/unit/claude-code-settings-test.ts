import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  getClaudeCodeConfigDirectory,
  getClaudeCodeWorkingDirectory,
  moveMistakenConfigDirectory,
  setClaudeCodeConfigDirectory,
  setClaudeCodeWorkingDirectory,
} from '../../src/lib/claude-code/claude-code-settings'

describe('Claude Code settings', () => {
  beforeEach(() => {
    setClaudeCodeConfigDirectory(null)
    setClaudeCodeWorkingDirectory(null)
  })

  it('moves a configuration folder without Claude Code files to the working folder', () => {
    setClaudeCodeConfigDirectory('/Users/me/Developer/Kinship')

    moveMistakenConfigDirectory(() => false)

    assert.equal(getClaudeCodeWorkingDirectory(), '/Users/me/Developer/Kinship')
    assert.equal(getClaudeCodeConfigDirectory(), null)
  })

  it('keeps a real configuration folder', () => {
    setClaudeCodeConfigDirectory('/Users/me/.claude-work')

    moveMistakenConfigDirectory(() => true)

    assert.equal(getClaudeCodeConfigDirectory(), '/Users/me/.claude-work')
    assert.equal(getClaudeCodeWorkingDirectory(), null)
  })

  it('leaves both alone once a working folder is set', () => {
    setClaudeCodeConfigDirectory('/Users/me/somewhere')
    setClaudeCodeWorkingDirectory('/Users/me/Developer')

    moveMistakenConfigDirectory(() => false)

    assert.equal(getClaudeCodeConfigDirectory(), '/Users/me/somewhere')
    assert.equal(getClaudeCodeWorkingDirectory(), '/Users/me/Developer')
  })
})
