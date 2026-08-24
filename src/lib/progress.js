/**
 * Progress maths and poster colour — everything the screens need to turn a
 * title plus the user record into a percentage, a next episode, or a swatch.
 */

import { episodeKey } from './user.js'

const pad = (n) => String(n).padStart(2, '0')

/** `S03E06` */
export const episodeCode = (season, episode) => `S${pad(season)}E${pad(episode)}`

/** The first episode the user has not watched, in air order, or null. */
export function nextUnwatched(title, watchedEpisodes) {
  for (const s of title.seasons) {
    for (const ep of s.episodes) {
      if (!watchedEpisodes.has(episodeKey(title.id, s.number, ep.number))) {
        return { season: s.number, episode: ep.number, ep }
      }
    }
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

/** Completion 0–100. A film is all or nothing. */
export function pctOf(title, user) {
  if (title.type === 'movie') return user.watchedMovies.has(title.id) ? 100 : 0
  const { total, watched } = counts(title, user.watchedEpisodes)
  return total ? Math.round((watched / total) * 100) : 0
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
  Object.keys(user.ratings).forEach((id) => ids.add(id))
  return [...ids]
}
