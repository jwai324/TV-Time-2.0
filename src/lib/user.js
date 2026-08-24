/**
 * The single user record Tideline tracks, and its localStorage round-trip.
 *
 * Sets do not survive JSON, so `watchedEpisodes` and `watchedMovies` are stored
 * as arrays and rehydrated on the way back in.
 */

export const STORAGE_KEY = 'tideline.user.v1'

/** Every episode is addressed by `titleId:season:episode`. */
export const episodeKey = (titleId, season, episode) => `${titleId}:${season}:${episode}`

/** The wire format shared by localStorage and the Supabase user_state row. */
export const serializeUser = (user) => ({
  watchedEpisodes: [...user.watchedEpisodes],
  watchedMovies: [...user.watchedMovies],
  watchlist: user.watchlist,
  ratings: user.ratings,
  lastActivity: user.lastActivity,
})

export const reviveUser = (p) => ({
  watchedEpisodes: new Set(p.watchedEpisodes || []),
  watchedMovies: new Set(p.watchedMovies || []),
  watchlist: p.watchlist || [],
  ratings: p.ratings || {},
  lastActivity: p.lastActivity || [],
})

export const emptyUser = () => ({
  watchedEpisodes: new Set(),
  watchedMovies: new Set(),
  watchlist: [],
  ratings: {},
  lastActivity: [],
})

/** A lived-in starting library, so a first run has something to show. */
export function seedUser() {
  const now = Date.now()
  const day = 86400000
  const watchedEpisodes = new Set()
  const add = (id, s, from, to) => {
    for (let e = from; e <= to; e++) watchedEpisodes.add(episodeKey(id, s, e))
  }

  add('severance-point', 1, 1, 9)
  add('severance-point', 2, 1, 10)
  add('severance-point', 3, 1, 6)
  add('harbor-lights', 1, 1, 3)
  add('saltgrass', 1, 1, 10)
  add('saltgrass', 2, 1, 4)
  add('meridian', 1, 1, 9)
  add('the-quiet-divide', 1, 1, 10)
  add('the-quiet-divide', 2, 1, 10)
  add('undertow', 1, 1, 2)

  return {
    watchedEpisodes,
    watchedMovies: new Set(['the-salt-path', 'aurora-motel', 'petrichor', 'girder', 'the-foley-artist']),
    watchlist: ['open-water', 'the-ledger', 'late-frost', 'half-moon-bay', 'vantage'],
    ratings: {
      'the-salt-path': 4,
      'aurora-motel': 3,
      petrichor: 5,
      girder: 4,
      'the-foley-artist': 3,
      'the-quiet-divide': 5,
    },
    lastActivity: [
      { ts: now - 2 * 3600e3, titleId: 'severance-point', label: 'S03E06' },
      { ts: now - day, titleId: 'harbor-lights', label: 'S01E03' },
      { ts: now - 2 * day, titleId: 'saltgrass', label: 'S02E04' },
      { ts: now - 3 * day, titleId: 'meridian', label: 'S01E09' },
      { ts: now - 5 * day, titleId: 'undertow', label: 'S01E02' },
      { ts: now - 6 * day, titleId: 'petrichor', label: 'Watched' },
      { ts: now - 8 * day, titleId: 'the-quiet-divide', label: 'S02E10' },
    ],
  }
}

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
    return { user: seedUser(), storageFailed: true }
  }
  return { user: seedUser(), storageFailed: false }
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
})

/** Record an activity entry. Newest first, capped so storage cannot grow forever. */
export function recordActivity(user, titleId, label) {
  user.lastActivity.unshift({ ts: Date.now(), titleId, label })
  user.lastActivity = user.lastActivity.slice(0, 200)
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
