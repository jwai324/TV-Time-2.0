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

/**
 * What a catch-up question resolves to.
 *
 * `ASK` raises the dialog. The other two are a saved answer: turning a
 * question off is not the same as answering it no, so the answer you gave when
 * you silenced it is the one that runs from then on.
 */
export const ASK = 'ask'
export const ALWAYS = 'always'
export const NEVER = 'never'

const ANSWERS = new Set([ASK, ALWAYS, NEVER])

/** Both catch-up questions are asked until you answer one for good. */
export const defaultPrefs = () => ({
  previousSeasons: ASK,
  previousEpisodes: ASK,
})

/**
 * Read one question's setting, migrating the boolean the first version stored.
 *
 * Back then a silenced prompt could only mean "mark the one thing I ticked" —
 * there was nothing else to remember — so `false` becomes `NEVER` and readers
 * who turned a prompt off keep exactly the behaviour they turned it off into.
 */
const readAnswer = (value, legacy) => {
  if (ANSWERS.has(value)) return value
  return legacy === false ? NEVER : ASK
}

export const revivePrefs = (p) => {
  const raw = p && typeof p === 'object' ? p : {}
  return {
    previousSeasons: readAnswer(raw.previousSeasons, raw.askPreviousSeasons),
    previousEpisodes: readAnswer(raw.previousEpisodes, raw.askPreviousEpisodes),
  }
}

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
