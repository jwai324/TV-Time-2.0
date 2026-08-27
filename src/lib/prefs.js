/**
 * Device-level preferences: the small answers about how the app should behave
 * that belong to this browser rather than to your watch history.
 *
 * They live beside the collapsed Up Next sections rather than inside the user
 * record — nothing here is progress, so nothing here needs to sync — and every
 * one of them is reachable again from the Account tab, which is what makes a
 * "don't ask this again" button safe to press.
 */

export const PREFS_KEY = 'tideline.prefs.v1'

/** Both catch-up questions are asked until you say otherwise. */
export const defaultPrefs = () => ({
  askPreviousSeasons: true,
  askPreviousEpisodes: true,
})

export const revivePrefs = (p) => ({
  ...defaultPrefs(),
  ...(p && typeof p === 'object' ? p : {}),
})

export function loadPrefs() {
  try {
    return revivePrefs(JSON.parse(localStorage.getItem(PREFS_KEY)))
  } catch {
    return defaultPrefs()
  }
}

/** Write preferences back. A failure is silent: the session just keeps them in memory. */
export function persistPrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* memory-only session; the prompts come back next time */
  }
}
