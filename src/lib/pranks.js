/**
 * Pranks: a one-off scare aimed at one account, sprung on its next watched
 * mark and never again.
 *
 * Each one names the username it is for, the image that fills the screen,
 * the sound that plays with it, and how long the two stay up. A prank that
 * has gone off is noted in the account's own record (`user.pranks`, keyed by
 * the prank's key), so it is once per account rather than once per device —
 * an account that signs in on a second phone has already been got.
 *
 * Assets live under `public/scare/` and are addressed relative to the app's
 * base URL, so the same paths work in dev and on GitHub Pages. Aiming a new
 * prank is a new entry here with a key nobody has been hit with yet.
 */
export const PRANKS = [
  {
    key: 'nun-scream',
    target: 'chicalatina',
    image: 'scare/nun.jpg',
    sound: 'scare/scream.mp3',
    durationMs: 5000,
  },
]

/** A public asset's URL, wherever the app is served from. */
export const asset = (path) => `${import.meta.env.BASE_URL}${path}`

/** A mark that says something was watched — as opposed to watchlisted. */
export const isWatchedMark = (entry) => entry.kind === 'episode' || entry.kind === 'movie'

/**
 * The prank waiting on this account, or null: nobody is signed in, none
 * names this username, or the one that does has already gone off.
 *
 * Usernames are unique without regard to case, so the match ignores it too.
 * The entries come straight from `PRANKS`, so the same prank is the same
 * object from one render to the next and can be depended on as such.
 */
export function duePrank(username, user) {
  if (!username || !user) return null
  const handle = username.toLowerCase()
  return PRANKS.find((p) => p.target === handle && !user.pranks[p.key]) || null
}

/** Note that a prank has gone off, so it does not again. */
export function markPrankFired(user, prank) {
  user.pranks[prank.key] = new Date().toISOString()
}

/**
 * Carry the notes one record holds into another that lacks them. True when
 * anything was carried.
 *
 * A note is a fact about the account — it went off — and the only way to
 * write one is to be the account it names. So when a device adopts the
 * account's record, any note its own copy holds is kept rather than lost to
 * a row that missed it: a push that failed, or a push from a session that
 * was open before the note existed and wrote the whole record without it.
 */
export function carryPrankNotes(from, into) {
  if (!from) return false
  let carried = false
  Object.entries(from.pranks).forEach(([key, when]) => {
    if (into.pranks[key]) return
    into.pranks[key] = when
    carried = true
  })
  return carried
}
