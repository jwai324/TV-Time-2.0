/**
 * Progress maths and poster colour — everything the screens need to turn a
 * title plus the user record into a percentage, a next episode, or a swatch.
 */

import { episodeKey } from './user.js'

const pad = (n) => String(n).padStart(2, '0')

/** `S03E06` */
export const episodeCode = (season, episode) => `S${pad(season)}E${pad(episode)}`

/** Every episode of a show in air order, flattened. */
const inOrder = (title) =>
  title.seasons.flatMap((s) => s.episodes.map((ep) => ({ season: s.number, episode: ep.number, ep })))

/**
 * The episode to watch next, or null when there is none.
 *
 * Air order, but from the season you are actually watching — the latest one
 * you have marked anything in. Someone who starts a show at its current
 * season has not left an unwatched episode behind them; they have decided
 * where to begin, and "next up" that points at S01E01 is answering a question
 * they did not ask.
 *
 * Seasons behind that one are not forgotten. They become what is left to
 * watch once the season you are on and everything after it are finished, so
 * the show still has somewhere to go and still reaches 100%.
 */
export function nextUnwatched(title, watchedEpisodes) {
  const seen = (season, number) => watchedEpisodes.has(episodeKey(title.id, season, number))

  const firstGap = (seasons) => {
    for (const s of seasons) {
      for (const ep of s.episodes) {
        if (!seen(s.number, ep.number)) return { season: s.number, episode: ep.number, ep }
      }
    }
    return null
  }

  const from = title.seasons.findLastIndex((s) => s.episodes.some((ep) => seen(s.number, ep.number)))
  if (from < 0) return firstGap(title.seasons)
  return firstGap(title.seasons.slice(from)) || firstGap(title.seasons)
}

/**
 * The episode Undo steps back from: the latest watched episode before the one
 * that is next — or the final episode when the show is fully watched. Null
 * when nothing is watched ahead of it.
 *
 * It is defined against `nextUnwatched` rather than against the first gap so
 * that Undo stays the inverse of Mark. A viewer part-way through the current
 * season has skipped seasons behind them, and taking back what they just
 * marked must not depend on a gap they never intended to fill.
 */
export function lastWatched(title, watchedEpisodes) {
  const all = inOrder(title)
  const next = nextUnwatched(title, watchedEpisodes)
  const stop = next ? all.findIndex((e) => e.season === next.season && e.episode === next.episode) : all.length
  for (let i = stop - 1; i >= 0; i--) {
    if (watchedEpisodes.has(episodeKey(title.id, all[i].season, all[i].episode))) return all[i]
  }
  return null
}

/** `{ total, watched }` episode counts across every season. */
export function counts(title, watchedEpisodes) {
  let total = 0
  let watched = 0
  for (const s of title.seasons) {
    for (const ep of s.episodes) {
      total++
      if (watchedEpisodes.has(episodeKey(title.id, s.number, ep.number))) watched++
    }
  }
  return { total, watched }
}

/**
 * Completion 0–100. A film is all or nothing.
 *
 * The endpoints are exact, never rounded: 100 means every episode is watched
 * and 0 means none are. Otherwise 249 of 250 would round to 100 and read as
 * finished everywhere a screen tests pct — dropping the show off Up Next with
 * an episode still to watch. In between, rounding is clamped to 1–99.
 */
export function pctOf(title, user) {
  if (title.type === 'movie') return user.watchedMovies.has(title.id) ? 100 : 0
  const { total, watched } = counts(title, user.watchedEpisodes)
  if (!total || !watched) return 0
  if (watched >= total) return 100
  return Math.min(99, Math.max(1, Math.round((watched / total) * 100)))
}

/** Minutes of unwatched runtime left on a title. */
export function remainingMinutes(title, user) {
  if (title.type === 'movie') return user.watchedMovies.has(title.id) ? 0 : title.runtimeMinutes
  let mins = 0
  for (const s of title.seasons) {
    for (const ep of s.episodes) {
      if (!user.watchedEpisodes.has(episodeKey(title.id, s.number, ep.number))) mins += ep.runtimeMinutes
    }
  }
  return mins
}

/** Timestamp of the most recent activity on a title, or 0. */
export function lastTs(user, titleId) {
  const a = user.lastActivity.find((x) => x.titleId === titleId)
  return a ? a.ts : 0
}

/** Flat hue swatch standing in for cover art, tuned per theme. */
export const swatch = (title, dark) => `hsl(${title.posterHue},30%,${dark ? '32%' : '40%'})`

/** Poster background: real art when we have it, the swatch underneath either way. */
export const posterBg = (title, dark) =>
  title.posterUrl ? `url(${title.posterUrl}) center/cover no-repeat, ${swatch(title, dark)}` : swatch(title, dark)

/** A barely-there tint of the poster hue over the card surface. */
export const wash = (title) =>
  `linear-gradient(0deg,hsla(${title.posterHue},35%,45%,.10),hsla(${title.posterHue},35%,45%,.10)),var(--card)`

/** Every title the user has any relationship with. */
export function trackedIds(user) {
  const ids = new Set(user.watchlist)
  user.watchedEpisodes.forEach((k) => ids.add(k.split(':')[0]))
  user.watchedMovies.forEach((id) => ids.add(id))
  user.startedMovies.forEach((id) => ids.add(id))
  Object.keys(user.ratings).forEach((id) => ids.add(id))
  return [...ids]
}
