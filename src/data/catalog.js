/**
 * Catalog — TMDB behind the same three async functions the app has always
 * used: getTitle / getTrending / searchTitles.
 *
 * Requests go through the `tmdb` Supabase Edge Function, which attaches the
 * secret TMDB token server-side and allows only read-only catalog paths, so
 * no credential ships in this bundle.
 *
 * Ids are strings with the media type baked in ("tv-1396", "movie-603"),
 * because TMDB's movie and TV id spaces overlap. Everything downstream treats
 * ids as opaque, so watched-episode keys like "tv-1396:2:5" work unchanged.
 */

const PROXY = 'https://heaficaxneggnsayrrzs.supabase.co/functions/v1/tmdb'
const IMG = 'https://image.tmdb.org/t/p/w342'

async function tmdb(path, params = {}) {
  const url = new URL(PROXY)
  url.searchParams.set('path', path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

export const tmdbId = (mediaType, id) => `${mediaType === 'movie' ? 'movie' : 'tv'}-${id}`

const parseId = (id) => {
  const m = /^(tv|movie)-(\d+)$/.exec(id)
  return m ? { type: m[1], num: m[2] } : null
}

/** Deterministic hue from the id, so swatches and washes stay stable. */
const hueOf = (id) => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

const yearOf = (date) => (date ? Number(date.slice(0, 4)) : 0)
const today = () => new Date().toISOString().slice(0, 10)

function mapMovie(m) {
  const id = tmdbId('movie', m.id)
  return {
    id,
    name: m.title,
    type: 'movie',
    year: yearOf(m.release_date),
    genres: (m.genres ?? []).map((g) => g.name),
    posterHue: hueOf(id),
    posterUrl: m.poster_path ? IMG + m.poster_path : null,
    runtimeMinutes: m.runtime || 120,
    overview: m.overview || '',
    seasons: [],
  }
}

function mapShow(tv, seasonDetails) {
  const id = tmdbId('tv', tv.id)
  const fallbackRt = tv.episode_run_time?.[0] || 45
  return {
    id,
    name: tv.name,
    type: 'show',
    year: yearOf(tv.first_air_date),
    genres: (tv.genres ?? []).map((g) => g.name),
    status: tv.status === 'Returning Series' ? 'returning' : 'ended',
    posterHue: hueOf(id),
    posterUrl: tv.poster_path ? IMG + tv.poster_path : null,
    runtimeMinutes: fallbackRt,
    overview: tv.overview || '',
    seasons: seasonDetails
      // Season 0 is "Specials" — the linear progress model has no place for it.
      .filter((s) => s && s.season_number > 0)
      .map((s) => ({
        number: s.season_number,
        episodes: (s.episodes ?? [])
          // Unaired episodes would make 100% unreachable and point "next up"
          // at something that doesn't exist yet.
          .filter((ep) => ep.air_date && ep.air_date <= today())
          .map((ep) => ({
            number: ep.episode_number,
            name: ep.name,
            runtimeMinutes: ep.runtime || fallbackRt,
            airDate: ep.air_date,
          })),
      }))
      .filter((s) => s.episodes.length > 0),
  }
}

/**
 * Search and trending only need what their cards show. `partial: true` tells
 * the app to fetch the full record (seasons, real genres, runtime) before it
 * matters — on open, or when a title joins the watchlist.
 */
function mapSummary(r) {
  const type = r.media_type === 'movie' ? 'movie' : 'show'
  const id = tmdbId(r.media_type, r.id)
  return {
    id,
    name: r.title ?? r.name,
    type,
    year: yearOf(r.release_date ?? r.first_air_date),
    genres: [],
    posterHue: hueOf(id),
    posterUrl: r.poster_path ? IMG + r.poster_path : null,
    runtimeMinutes: type === 'movie' ? 120 : 45,
    overview: r.overview || '',
    seasons: [],
    partial: true,
  }
}

const cache = new Map()

/** Fetch one full title. Unknown or legacy ids resolve to null. */
export async function getTitle(id) {
  if (cache.has(id)) return cache.get(id)
  const parsed = parseId(id)
  if (!parsed) return null

  let title
  if (parsed.type === 'movie') {
    title = mapMovie(await tmdb(`/3/movie/${parsed.num}`))
  } else {
    const tv = await tmdb(`/3/tv/${parsed.num}`)
    const nums = (tv.seasons ?? [])
      .filter((s) => s.season_number > 0)
      .map((s) => s.season_number)
      .slice(0, 200)
    // append_to_response folds at most 20 sub-requests into one call, so
    // fetch season payloads in chunks of 20 — up to 200 seasons per show.
    const chunks = []
    for (let i = 0; i < nums.length; i += 20) chunks.push(nums.slice(i, i + 20))
    const details = (
      await Promise.all(
        chunks.map(async (chunk) => {
          const appended = await tmdb(`/3/tv/${parsed.num}`, {
            append_to_response: chunk.map((n) => `season/${n}`).join(','),
          })
          return chunk.map((n) => appended[`season/${n}`]).filter(Boolean)
        })
      )
    ).flat()
    title = mapShow(tv, details)
  }
  cache.set(id, title)
  return title
}

const isTitle = (r) => r.media_type === 'movie' || r.media_type === 'tv'

/** This week's trending shows and films. */
export async function getTrending() {
  const { results } = await tmdb('/3/trending/all/week')
  return (results ?? []).filter(isTitle).slice(0, 10).map(mapSummary)
}

/** Search shows and films by name. */
export async function searchTitles(query) {
  const q = query.trim()
  if (!q) return []
  const { results } = await tmdb('/3/search/multi', { query: q })
  return (results ?? []).filter(isTitle).map(mapSummary)
}
