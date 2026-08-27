/**
 * The single user record Tideline tracks, and its localStorage round-trip.
 *
 * Sets do not survive JSON, so `watchedEpisodes` and `watchedMovies` are stored
 * as arrays and rehydrated on the way back in.
 */

// v2: the v1 records referenced the fictional demo catalog's ids, which no
// longer resolve now that titles come from TMDB.
export const STORAGE_KEY = 'tideline.user.v2'

/** Every episode is addressed by `titleId:season:episode`. */
export const episodeKey = (titleId, season, episode) => `${titleId}:${season}:${episode}`

/** The wire format shared by localStorage and the Supabase user_state row. */
export const serializeUser = (user) => ({
  watchedEpisodes: [...user.watchedEpisodes],
  watchedMovies: [...user.watchedMovies],
  watchlist: user.watchlist,
  ratings: user.ratings,
  lastActivity: user.lastActivity,
  materializedShares: user.materializedShares,
})

export const reviveUser = (p) => ({
  watchedEpisodes: new Set(p.watchedEpisodes || []),
  watchedMovies: new Set(p.watchedMovies || []),
  watchlist: p.watchlist || [],
  ratings: p.ratings || {},
  lastActivity: p.lastActivity || [],
  materializedShares: p.materializedShares || [],
})

export const emptyUser = () => ({
  watchedEpisodes: new Set(),
  watchedMovies: new Set(),
  watchlist: [],
  ratings: {},
  lastActivity: [],
  materializedShares: [],
})

/**
 * Read the stored user.
 *
 * Returns `{ user, storageFailed }`. A `storageFailed` of true means the read
 * threw — private-mode Safari, a blocked origin, corrupt JSON — and the caller
 * should tell the user their session is memory-only.
 */
export function loadUser({ freshStart = false } = {}) {
  if (freshStart) return { user: emptyUser(), storageFailed: false }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { user: reviveUser(JSON.parse(raw)), storageFailed: false }
  } catch {
    return { user: emptyUser(), storageFailed: true }
  }
  return { user: emptyUser(), storageFailed: false }
}

/** Write the user back. Returns false when storage is unavailable. */
export function persistUser(user, { freshStart = false } = {}) {
  if (freshStart) return true
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeUser(user)))
    return true
  } catch {
    return false
  }
}

/** Shallow-clone the user so every mutation produces a new object for React. */
export const cloneUser = (u) => ({
  watchedEpisodes: new Set(u.watchedEpisodes),
  watchedMovies: new Set(u.watchedMovies),
  watchlist: [...u.watchlist],
  ratings: { ...u.ratings },
  lastActivity: [...u.lastActivity],
  materializedShares: [...u.materializedShares],
})

/**
 * The three things a mark can be, applied to a record.
 *
 * A shared mark and a private one say exactly the same thing — the only
 * difference is which side of `withSharedMarks` it arrives from.
 */
export function applyMark(user, { kind, key }) {
  if (kind === 'episode') user.watchedEpisodes.add(key)
  else if (kind === 'movie') user.watchedMovies.add(key)
  else if (!user.watchlist.includes(key)) user.watchlist.push(key)
}

export function unapplyMark(user, { kind, key }) {
  if (kind === 'episode') user.watchedEpisodes.delete(key)
  else if (kind === 'movie') user.watchedMovies.delete(key)
  else {
    const i = user.watchlist.indexOf(key)
    if (i >= 0) user.watchlist.splice(i, 1)
  }
}

/**
 * Your record as the screens should see it: your own, plus the marks of every
 * show you are currently watching with someone.
 *
 * Nothing is copied between accounts — the union happens here, at read time,
 * which is why pairing up on a title changes neither person's history and why
 * ending a share can hand each of you your own copy of what you watched
 * together.
 */
export function withSharedMarks(user, marks) {
  if (!marks.length) return user
  const merged = cloneUser(user)
  marks.forEach((m) => applyMark(merged, m))
  return merged
}

/** Record an activity entry. Newest first, capped so storage cannot grow forever. */
export function recordActivity(user, titleId, label) {
  user.lastActivity.unshift({ ts: Date.now(), titleId, label })
  user.lastActivity = user.lastActivity.slice(0, 200)
}

/**
 * Record a friend's mark on a shared title as activity of your own.
 *
 * Activity is what orders Up Next and feeds the streak, and a shared episode
 * is watched by you too — so it has to land in your record. `sk` identifies
 * the mark it came from, so seeing the same one again (on reload, on another
 * device) does not log it twice. It carries the mark's own timestamp, so the
 * list is re-sorted rather than pushed to the front.
 */
export function recordSharedActivity(user, entries) {
  if (!entries.length) return
  user.lastActivity = [...user.lastActivity, ...entries]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 200)
}

/**
 * Take back the activity entry a mark left behind, so an undo reads as if the
 * mark never happened. Prefers the entry logged for that exact shared mark,
 * and falls back to the most recent one with the same label.
 */
export function withdrawActivity(user, titleId, label, sk) {
  let i = sk ? user.lastActivity.findIndex((a) => a.sk === sk) : -1
  if (i < 0) i = user.lastActivity.findIndex((a) => a.titleId === titleId && a.label === label)
  if (i >= 0) user.lastActivity.splice(i, 1)
}

/**
 * Remote round-trip against the Supabase `user_state` row. Row-level security
 * scopes every query to the signed-in user, so reads take no id at all.
 */
export async function fetchRemoteUser(supabase) {
  const { data, error } = await supabase.from('user_state').select('data').maybeSingle()
  if (error) throw error
  return data ? reviveUser(data.data) : null
}

export async function pushRemoteUser(supabase, userId, user) {
  const { error } = await supabase
    .from('user_state')
    .upsert({ user_id: userId, data: serializeUser(user) })
  if (error) throw error
}
