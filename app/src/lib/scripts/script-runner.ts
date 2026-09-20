import { ChildProcess, spawn } from 'child_process'
import { Repository } from '../../models/repository'
import { getShellEnv } from '../hooks/get-shell-env'
import { getGitHookEnvShell } from '../hooks/config'

export type ScriptRunStatus = 'running' | 'succeeded' | 'failed' | 'stopped'

/** The state of a script that is running, or has run, for a repository. */
export interface IScriptRun {
  /** Unique, increasing id so runs can be told apart in the history. */
  readonly id: number
  readonly repositoryId: number
  readonly scriptName: string
  /** The full shell command that was executed, e.g. `npm run test`. */
  readonly command: string
  readonly status: ScriptRunStatus
  readonly exitCode: number | null
  readonly startedAt: number
  readonly finishedAt: number | null
  /**
   * Interleaved stdout and stderr chunks. Old chunks are dropped once the
   * buffer grows past the limit, see `outputTruncated` and `totalChunks`.
   */
  readonly output: ReadonlyArray<string>
  /** Whether chunks have been dropped from the start of `output`. */
  readonly outputTruncated: boolean
  /** Number of chunks ever appended, including dropped ones. */
  readonly totalChunks: number
}

/** Runs per repository, newest first. */
export type ScriptRunHistory = ReadonlyMap<number, ReadonlyArray<IScriptRun>>

/** Keep roughly this many characters of output for the running script. */
const maxOutputChars = 1_000_000

/** Once a run has finished, keep at most this much of its output around. */
const maxFinishedOutputChars = 200_000

/** How many finished runs to remember per repository. */
export const maxHistoryLength = 20

/** Reuse a resolved shell environment for this long. */
const shellEnvTtl = 5 * 60 * 1000

/** How long to wait after SIGTERM before sending SIGKILL. */
const killGracePeriod = 3000

interface ICachedEnv {
  readonly env: NodeJS.ProcessEnv
  readonly resolvedAt: number
}

/**
 * Runs package.json scripts for repositories, one at a time per repository,
 * and keeps a history of runs with their output so they can be reviewed.
 */
export class ScriptRunner {
  private readonly processes = new Map<number, ChildProcess>()
  private readonly history = new Map<number, ReadonlyArray<IScriptRun>>()
  private cachedEnv: ICachedEnv | null = null
  private updateTimeout: ReturnType<typeof setTimeout> | null = null
  private nextRunId = 1

  /**
   * @param onUpdate Called (throttled) whenever any run's state changes.
   */
  public constructor(private readonly onUpdate: () => void) {}

  public getHistory(): ScriptRunHistory {
    return this.history
  }

  /** The runs for a repository, newest first. */
  public getRuns(repository: Repository): ReadonlyArray<IScriptRun> {
    return this.history.get(repository.id) ?? []
  }

  /** The most recent run for the repository, if any. */
  public getLatestRun(repository: Repository): IScriptRun | undefined {
    return this.getRuns(repository)[0]
  }

  public getRun(repository: Repository, id: number): IScriptRun | undefined {
    return this.getRuns(repository).find(r => r.id === id)
  }

  /** The currently running script for the repository, if any. */
  public getRunningRun(repository: Repository): IScriptRun | undefined {
    return this.getRuns(repository).find(r => r.status === 'running')
  }

  public isRunning(repository: Repository) {
    return this.getRunningRun(repository) !== undefined
  }

  /**
   * Starts a script for the repository. Rejects if one is already running
   * for it. Resolves with the new run's id once the process has been spawned.
   */
  public async start(
    repository: Repository,
    scriptName: string,
    command: string
  ): Promise<number> {
    if (this.isRunning(repository)) {
      throw new Error(
        `A script is already running for ${repository.name}. Stop it first.`
      )
    }

    const env = await this.getEnv(repository.path)

    const run: IScriptRun = {
      id: this.nextRunId++,
      repositoryId: repository.id,
      scriptName,
      command,
      status: 'running',
      exitCode: null,
      startedAt: Date.now(),
      finishedAt: null,
      output: [`$ ${command}\r\n`],
      outputTruncated: false,
      totalChunks: 1,
    }
    this.history.set(repository.id, [
      run,
      ...this.getRuns(repository).slice(0, maxHistoryLength - 1),
    ])
    this.scheduleUpdate()

    let child: ChildProcess
    try {
      child = spawn(command, [], {
        cwd: repository.path,
        env,
        shell: true,
        // On Unix put the script in its own process group so that stopping
        // it also stops anything it spawned (dev servers, watchers, ...).
        detached: !__WIN32__,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (e) {
      this.finish(repository.id, run.id, 'failed', null, `${e}\r\n`)
      return run.id
    }

    this.processes.set(repository.id, child)

    child.stdout?.on('data', (chunk: Buffer) =>
      this.append(repository.id, run.id, chunk.toString('utf8'))
    )
    child.stderr?.on('data', (chunk: Buffer) =>
      this.append(repository.id, run.id, chunk.toString('utf8'))
    )
    child.on('error', err => {
      this.finish(repository.id, run.id, 'failed', null, `${err.message}\r\n`)
    })
    child.on('close', (code, signal) => {
      const current = this.getRunById(repository.id, run.id)
      if (current === undefined || current.status !== 'running') {
        // Already marked as stopped or failed
        this.processes.delete(repository.id)
        return
      }
      const status: ScriptRunStatus =
        signal !== null ? 'stopped' : code === 0 ? 'succeeded' : 'failed'
      const summary =
        signal !== null
          ? `\r\nStopped (${signal})\r\n`
          : `\r\nExited with code ${code}\r\n`
      this.finish(repository.id, run.id, status, code, summary)
    })

    return run.id
  }

  /** Stops the running script for the repository, if any. */
  public stop(repository: Repository) {
    const child = this.processes.get(repository.id)
    const run = this.getRunningRun(repository)

    if (child === undefined || run === undefined) {
      return
    }

    this.update(repository.id, run.id, r => ({ ...r, status: 'stopped' }))
    this.append(repository.id, run.id, '\r\nStopping…\r\n')

    if (__WIN32__ && child.pid !== undefined) {
      spawn('taskkill', ['/pid', `${child.pid}`, '/T', '/F'], {
        windowsHide: true,
      })
      return
    }

    const pid = child.pid
    if (pid === undefined) {
      return
    }

    const signalGroup = (signal: NodeJS.Signals) => {
      try {
        process.kill(-pid, signal)
      } catch {
        try {
          child.kill(signal)
        } catch {
          // Already gone
        }
      }
    }

    signalGroup('SIGTERM')
    setTimeout(() => {
      if (this.processes.get(repository.id) === child) {
        signalGroup('SIGKILL')
      }
    }, killGracePeriod)
  }

  /** Forgets every finished run for the repository. */
  public clearHistory(repository: Repository) {
    const running = this.getRunningRun(repository)
    this.history.set(repository.id, running !== undefined ? [running] : [])
    this.scheduleUpdate()
  }

  private getRunById(repositoryId: number, runId: number) {
    return this.history.get(repositoryId)?.find(r => r.id === runId)
  }

  private update(
    repositoryId: number,
    runId: number,
    fn: (run: IScriptRun) => IScriptRun
  ) {
    const runs = this.history.get(repositoryId)
    if (runs === undefined) {
      return
    }
    this.history.set(
      repositoryId,
      runs.map(r => (r.id === runId ? fn(r) : r))
    )
  }

  private finish(
    repositoryId: number,
    runId: number,
    status: ScriptRunStatus,
    exitCode: number | null,
    summary: string
  ) {
    this.processes.delete(repositoryId)
    this.update(repositoryId, runId, run => ({
      ...trimOutput(appendTo(run, summary), maxFinishedOutputChars),
      status,
      exitCode,
      finishedAt: Date.now(),
    }))
    this.scheduleUpdate()
  }

  private append(repositoryId: number, runId: number, chunk: string) {
    this.update(repositoryId, runId, run =>
      trimOutput(appendTo(run, chunk), maxOutputChars)
    )
    this.scheduleUpdate()
  }

  private scheduleUpdate() {
    if (this.updateTimeout !== null) {
      return
    }
    this.updateTimeout = setTimeout(() => {
      this.updateTimeout = null
      this.onUpdate()
    }, 50)
  }

  /**
   * The user's login shell environment so that scripts can find the same
   * tools they would from a terminal. Falls back to our own environment if
   * the shell can't be queried.
   */
  private async getEnv(cwd: string): Promise<NodeJS.ProcessEnv> {
    const now = Date.now()
    let env: NodeJS.ProcessEnv

    if (
      this.cachedEnv !== null &&
      now - this.cachedEnv.resolvedAt < shellEnvTtl
    ) {
      env = this.cachedEnv.env
    } else {
      try {
        const result = await getShellEnv(cwd, getGitHookEnvShell())
        env = result.kind === 'success' ? { ...result.env } : { ...process.env }
      } catch (e) {
        log.warn('scripts: unable to load shell environment', e)
        env = { ...process.env }
      }
      this.cachedEnv = { env, resolvedAt: now }
    }

    return {
      ...env,
      // Keep colors in the output view even though there's no TTY
      FORCE_COLOR: env.FORCE_COLOR ?? '1',
      GLITCHHUB_DESKTOP: '1',
    }
  }
}

function appendTo(run: IScriptRun, chunk: string): IScriptRun {
  return {
    ...run,
    output: [...run.output, chunk],
    totalChunks: run.totalChunks + 1,
  }
}

function trimOutput(run: IScriptRun, maxChars: number): IScriptRun {
  const output = [...run.output]
  let truncated = run.outputTruncated
  let size = output.reduce((sum, c) => sum + c.length, 0)

  while (size > maxChars && output.length > 1) {
    size -= output[0].length
    output.shift()
    truncated = true
  }

  return truncated === run.outputTruncated &&
    output.length === run.output.length
    ? run
    : { ...run, output, outputTruncated: truncated }
}
