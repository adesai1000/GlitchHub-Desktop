import { Account } from '../models/account'

const Disable = false

/**
 * Where GlitchHub Desktop builds are published. Shown in the About dialog in
 * place of the update checker.
 */
export const GlitchHubReleasesURL =
  'https://github.com/adesai1000/GlitchHub-Desktop/releases'

/**
 * Whether to talk to GitHub's own services for the official app: the update
 * server (which would replace this fork with the official build) and the
 * usage statistics endpoint. Off for GlitchHub Desktop; new builds come from
 * the releases page instead.
 */
export function enableUpstreamServices(): boolean {
  return process.env.GLITCHHUB_UPSTREAM_SERVICES === '1'
}

/**
 * Enables the application to opt-in for preview features based on runtime
 * checks. This is backed by the GITHUB_DESKTOP_PREVIEW_FEATURES environment
 * variable, which is checked for non-development environments.
 */
function enableDevelopmentFeatures(): boolean {
  if (Disable) {
    return false
  }

  if (__DEV__) {
    return true
  }

  if (process.env.GITHUB_DESKTOP_PREVIEW_FEATURES === '1') {
    return true
  }

  return false
}

/** Should the app enable beta features? */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore: this will be used again in the future
function enableBetaFeatures(): boolean {
  return enableDevelopmentFeatures() || __RELEASE_CHANNEL__ === 'beta'
}

/**
 * Should the app show menu items that are used for testing various parts of the
 * UI
 *
 * For our own testing purposes, this will likely remain enabled. But, sometimes
 * we may want to create a test release for a user to test a fix in which case
 * they should not need access to the test menu items.
 */
export const enableTestMenuItems = () =>
  enableDevelopmentFeatures() || __RELEASE_CHANNEL__ === 'test'

export function enableReadmeOverwriteWarning(): boolean {
  return enableBetaFeatures()
}

/** Should the app detect Windows Subsystem for Linux as a valid shell? */
export function enableWSLDetection(): boolean {
  return enableBetaFeatures()
}

/**
 * Should we allow reporting unhandled rejections as if they were crashes?
 */
export function enableUnhandledRejectionReporting(): boolean {
  return enableBetaFeatures()
}

/**
 * Should we allow x64 apps running under ARM translation to auto-update to
 * ARM64 builds?
 */
export function enableUpdateFromEmulatedX64ToARM64(): boolean {
  if (__DARWIN__) {
    return true
  }

  return enableBetaFeatures()
}

/** Should we show previous tags as suggestions? */
export function enablePreviousTagSuggestions(): boolean {
  return enableBetaFeatures()
}

/** Should we show a pull-requests quick view? */
export function enablePullRequestQuickView(): boolean {
  return enableDevelopmentFeatures()
}

/** Should we support image previews for dds files? */
export function enableImagePreviewsForDDSFiles(): boolean {
  return enableBetaFeatures()
}

export const enableCustomIntegration = () => true

export const enableResizingToolbarButtons = () => true

/**
 * Whether Copilot can write commit messages. Always off in StickShift: GitHub
 * only serves Copilot to the official app, so the button and menu item would
 * offer something that can't work.
 */
export const enableCommitMessageGeneration = (_account: Account) => false

export const enableCopilotSdkCommitMessageGeneration = (account: Account) => {
  // Enabled for all users in beta and development channels, and for users with
  // the feature flag enabled in production.
  return (
    enableBetaFeatures() ||
    (account.features ?? []).includes(
      'desktop_enable_copilot_sdk_commit_message_generation'
    )
  )
}

/** Should we enable Copilot-powered merge conflict resolution? */
export const enableCopilotConflictResolution = () => true

export function enableAccessibleListToolTips(): boolean {
  return enableBetaFeatures()
}

export const enableHooksEnvironment = () => true

export const enableHooksByDefault = enableBetaFeatures

export const enableFormattingPreferences = () => true

/** Should the app enable worktree support? */
export const enableWorktreeSupport = () => true

/** Should stats be sent to the new telemetry endpoint? */
export function enableNewStatsEndpoint(): boolean {
  return enableBetaFeatures()
}
