import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { COLLECTION_KEYS, getCollection, getGenreRail, getRecommendations, getTitle, searchTitles } from './data/catalog.js'
import {
  counts,
  episodeCode,
  lastTs,
  lastWatched,
  nextUnwatched,
  remainingMinutes,
  pctOf,
  trackedIds,
  wash,
} from './lib/progress.js'
import {
  cloneUser,
  episodeKey,
  fetchRemoteUser,
  loadUser,
  persistUser,
  pushRemoteUser,
  recordActivity,
} from './lib/user.js'
import { supabase } from './lib/supabase.js'
import TabBar from './components/TabBar.jsx'
import UpNext from './screens/UpNext.jsx'
import Library from './screens/Library.jsx'
import TitleDetail from './screens/TitleDetail.jsx'
import Discover from './screens/Discover.jsx'
import Stats from './screens/Stats.jsx'

/**
 * The design carries `darkMode` and `freshStart` as editor props with no UI
 * behind them. In the app, theme follows the system by default and both stay
 * reachable as query params (`?theme=dark`, `?fresh=1`) for demos and QA.
 */
function useOptions() {
  const params = new URLSearchParams(window.location.search)
  const themeParam = params.get('theme')
  const freshStart = params.get('fresh') === '1'

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  )

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = (ev) => setSystemDark(ev.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const dark = themeParam === 'dark' ? true : themeParam === 'light' ? false : systemDark
  return { dark, freshStart }
}

export default function App() {
  const { dark, freshStart } = useOptions()

  const [loaded, setLoaded] = useState(false)
  const [storageFailed, setStorageFailed] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)
  const [session, setSession] = useState(null)
  const sessionRef = useRef(null)
  sessionRef.current = session
  const [titles, setTitles] = useState({})
  const [collections, setCollections] = useState({})

  // `user` is mirrored into a ref so an action can read the value a previous
  // action just wrote, without waiting for a re-render.
  const userRef = useRef(null)
  const [user, setUserState] = useState(null)
  const setUser = useCallback((next) => {
    userRef.current = next
    setUserState(next)
  }, [])

  const [screen, setScreen] = useState('upnext')
  const [tab, setTab] = useState('upnext')
  const [titleId, setTitleId] = useState(null)

  const [filter, setFilter] = useState('All')
  const [sortBy, setSortBy] = useState('recent')

  const [recs, setRecs] = useState([])
  const recSig = useRef('')
  const [genreRails, setGenreRails] = useState([])
  const genreSig = useRef('')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)

  const [openSeasons, setOpenSeasons] = useState({})
  const [anim, setAnim] = useState({})
  // Cards pinned on screen mid-interaction: a show marked to completion, or
  // undone back to zero watched, stays put instead of vanishing under the tap.
  const [pinned, setPinned] = useState({})

  const timers = useRef(new Set())
  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }, [])
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  useEffect(() => {
    document.body.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  // On sign-in, the account's record becomes the source of truth. A first
  // sign-in has no row yet, so whatever is on this device seeds the account.
  const syncedUserId = useRef(null)
  useEffect(() => {
    if (!loaded || !session || freshStart) return
    if (syncedUserId.current === session.user.id) return
    syncedUserId.current = session.user.id
    ;(async () => {
      try {
        const remote = await fetchRemoteUser(supabase)
        if (remote) {
          setUser(remote)
          persistUser(remote, { freshStart })
        } else {
          await pushRemoteUser(supabase, session.user.id, userRef.current)
        }
        setSyncFailed(false)
      } catch {
        syncedUserId.current = null
        setSyncFailed(true)
      }
    })()
  }, [loaded, session, freshStart, setUser])

  // Load the user, then resolve every title they have a relationship with.
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const { user: stored, storageFailed: readFailed } = loadUser({ freshStart })

      const ids = new Set(trackedIds(stored))
      stored.lastActivity.forEach((a) => ids.add(a.titleId))

      const resolved = {}
      await Promise.all(
        [...ids].map(async (id) => {
          const t = await getTitle(id).catch(() => null)
          if (t) resolved[id] = t
        })
      )

      const rails = Object.fromEntries(
        await Promise.all(COLLECTION_KEYS.map(async (key) => [key, await getCollection(key).catch(() => [])]))
      )
      Object.values(rails).forEach((list) =>
        list.forEach((t) => {
          resolved[t.id] = resolved[t.id] || t
        })
      )

      if (cancelled) return
      setUser(stored)
      setTitles(resolved)
      setCollections(rails)
      setStorageFailed(readFailed || !persistUser(stored, { freshStart }))
      setLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [freshStart, setUser])

  /** Apply a mutation to a fresh copy of the user, then persist it. */
  const mutate = useCallback(
    (fn) => {
      const next = cloneUser(userRef.current)
      fn(next)
      setUser(next)
      if (!persistUser(next, { freshStart })) setStorageFailed(true)
      const s = sessionRef.current
      if (s && !freshStart) {
        pushRemoteUser(supabase, s.user.id, next)
          .then(() => setSyncFailed(false))
          .catch(() => setSyncFailed(true))
      }
    },
    [freshStart, setUser]
  )

  /** Fetch the full record when we only hold a search/trending summary. */
  const ensureFull = useCallback(
    (id) => {
      const t = titles[id]
      if (t && !t.partial) return
      getTitle(id)
        .then((full) => {
          if (full) setTitles((prev) => ({ ...prev, [id]: full }))
        })
        .catch(() => {})
    },
    [titles]
  )

  const openTitle = useCallback(
    (id) => {
      ensureFull(id)
      setTitleId(id)
      setScreen('title')
    },
    [ensureFull]
  )

  const goTab = useCallback((next) => {
    setTab(next)
    setScreen(next)
    setTitleId(null)
  }, [])

  const toggleWatchlist = useCallback(
    (id) => {
      ensureFull(id)
      mutate((u) => {
        const i = u.watchlist.indexOf(id)
        if (i >= 0) u.watchlist.splice(i, 1)
        else u.watchlist.push(id)
      })
    },
    [mutate, ensureFull]
  )

  /**
   * Mark the next episode of a show watched.
   *
   * The episode line fades up and out, the record changes behind it, and the
   * new line drops in — so the tide bar and the text move together.
   */
  const markNext = useCallback(
    (id) => {
      if (anim[id]) return
      const title = titles[id]
      const next = nextUnwatched(title, userRef.current.watchedEpisodes)
      if (!next) return

      setAnim((a) => ({ ...a, [id]: 'out' }))
      later(() => {
        mutate((u) => {
          u.watchedEpisodes.add(episodeKey(id, next.season, next.episode))
          recordActivity(u, id, episodeCode(next.season, next.episode))
        })
        // Keep a just-finished show on screen showing "All caught up" rather
        // than yanking the card out from under the tap.
        if (!nextUnwatched(title, userRef.current.watchedEpisodes)) {
          setPinned((f) => ({ ...f, [id]: true }))
        }
        setAnim((a) => ({ ...a, [id]: 'in' }))
        later(() => setAnim((a) => ({ ...a, [id]: null })), 40)
      }, 190)
    },
    [anim, titles, mutate, later]
  )

  /**
   * Step one episode back: un-mark the latest watched episode before the next
   * unwatched one (the final episode, on a finished show), and withdraw its
   * activity entry so ordering and stats read as if it was never marked.
   */
  const undoLast = useCallback(
    (id) => {
      if (anim[id]) return
      const title = titles[id]
      const target = lastWatched(title, userRef.current.watchedEpisodes)
      if (!target) return

      setAnim((a) => ({ ...a, [id]: 'undo-out' }))
      later(() => {
        const code = episodeCode(target.season, target.episode)
        mutate((u) => {
          u.watchedEpisodes.delete(episodeKey(id, target.season, target.episode))
          const i = u.lastActivity.findIndex((a) => a.titleId === id && a.label === code)
          if (i >= 0) u.lastActivity.splice(i, 1)
        })
        if (counts(title, userRef.current.watchedEpisodes).watched === 0) {
          setPinned((f) => ({ ...f, [id]: true }))
        }
        setAnim((a) => ({ ...a, [id]: 'undo-in' }))
        later(() => setAnim((a) => ({ ...a, [id]: null })), 40)
      }, 190)
    },
    [anim, titles, mutate, later]
  )

  const toggleEpisode = useCallback(
    (id, season, episode) => {
      const key = episodeKey(id, season, episode)
      mutate((u) => {
        if (u.watchedEpisodes.has(key)) u.watchedEpisodes.delete(key)
        else {
          u.watchedEpisodes.add(key)
          recordActivity(u, id, episodeCode(season, episode))
        }
      })
    },
    [mutate]
  )

  const markSeason = useCallback(
    (id, seasonNumber) => {
      const season = titles[id].seasons.find((s) => s.number === seasonNumber)
      mutate((u) => {
        season.episodes.forEach((ep) => u.watchedEpisodes.add(episodeKey(id, seasonNumber, ep.number)))
        recordActivity(u, id, `Season ${seasonNumber} watched`)
      })
    },
    [titles, mutate]
  )

  /** Mark an episode and everything before it watched. */
  const catchUp = useCallback(
    (id, seasonNumber, episodeNumber) => {
      const title = titles[id]
      mutate((u) => {
        for (const s of title.seasons) {
          if (s.number > seasonNumber) break
          for (const ep of s.episodes) {
            if (s.number === seasonNumber && ep.number > episodeNumber) break
            u.watchedEpisodes.add(episodeKey(id, s.number, ep.number))
          }
        }
        recordActivity(u, id, `Caught up to ${episodeCode(seasonNumber, episodeNumber)}`)
      })
    },
    [titles, mutate]
  )

  const toggleMovie = useCallback(
    (id) => {
      mutate((u) => {
        if (u.watchedMovies.has(id)) u.watchedMovies.delete(id)
        else {
          u.watchedMovies.add(id)
          recordActivity(u, id, 'Watched')
        }
      })
    },
    [mutate]
  )

  const rate = useCallback(
    (id, n) => {
      mutate((u) => {
        if (u.ratings[id] === n) delete u.ratings[id]
        else u.ratings[id] = n
      })
    },
    [mutate]
  )

  const queryRef = useRef('')
  const searchTimer = useRef(null)
  const onSearch = useCallback((value) => {
    queryRef.current = value
    setQuery(value)
    clearTimeout(searchTimer.current)
    if (!value.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    searchTimer.current = setTimeout(() => {
      searchTitles(value)
        .then((found) => {
          if (queryRef.current !== value) return
          setTitles((prev) => {
            const merged = { ...prev }
            found.forEach((t) => {
              merged[t.id] = merged[t.id] || t
            })
            return merged
          })
          setResults(found)
          setSearched(true)
        })
        .catch(() => {})
    }, 300)
  }, [])

  /*
   * "For you": blend TMDB's recommendations for the five most recently
   * active titles the user has actually watched (a show with progress, or a
   * watched film). A title recommended by several of those seeds outranks a
   * one-off, already-tracked titles are excluded, and the row refreshes only
   * when the seed set itself changes.
   */
  useEffect(() => {
    if (!loaded || !user) return
    const seeds = trackedIds(user)
      .map((id) => titles[id])
      .filter(Boolean)
      .filter((t) =>
        t.type === 'movie' ? user.watchedMovies.has(t.id) : counts(t, user.watchedEpisodes).watched > 0
      )
      .sort((a, b) => lastTs(user, b.id) - lastTs(user, a.id))
      .slice(0, 5)
      .map((t) => t.id)
    const sig = seeds.join(',')
    if (sig === recSig.current) return
    recSig.current = sig
    if (!seeds.length) {
      setRecs([])
      return
    }
    Promise.all(seeds.map((id) => getRecommendations(id).catch(() => []))).then((lists) => {
      if (recSig.current !== sig) return
      const tracked = new Set(trackedIds(userRef.current))
      const scored = new Map()
      lists.forEach((list) =>
        list.forEach((t, position) => {
          if (tracked.has(t.id)) return
          const entry = scored.get(t.id) || { t, hits: 0, best: position }
          entry.hits += 1
          entry.best = Math.min(entry.best, position)
          scored.set(t.id, entry)
        })
      )
      const ranked = [...scored.values()]
        .sort((a, b) => b.hits - a.hits || a.best - b.best)
        .slice(0, 20)
        .map((e) => e.t)
      setRecs(ranked)
      setTitles((prev) => {
        const merged = { ...prev }
        ranked.forEach((t) => {
          merged[t.id] = merged[t.id] || t
        })
        return merged
      })
    })
  }, [loaded, user, titles])

  const account = useMemo(
    () => ({
      email: session?.user?.email ?? null,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? error.message : null
      },
      signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return error.message
        return data.session ? null : 'Check your email to confirm your account, then sign in.'
      },
      signOut: async () => {
        syncedUserId.current = null
        await supabase.auth.signOut()
        return null
      },
    }),
    [session]
  )

  // --- Derived views -------------------------------------------------------

  const inProgress = useMemo(() => {
    if (!user) return []
    return Object.values(titles).filter(
      (t) =>
        t.type === 'show' &&
        (counts(t, user.watchedEpisodes).watched > 0 || pinned[t.id]) &&
        (pctOf(t, user) < 100 || pinned[t.id])
    )
  }, [titles, user, pinned])

  // Up Next is ordered by recent activity when it is first built, then holds
  // that order so a card never jumps while you are working down the list.
  const upOrder = useRef(null)
  if (loaded && user && upOrder.current === null) {
    upOrder.current = inProgress
      .slice()
      .sort((a, b) => lastTs(user, b.id) - lastTs(user, a.id))
      .map((t) => t.id)
  }
  if (upOrder.current) {
    inProgress.forEach((t) => {
      if (!upOrder.current.includes(t.id)) upOrder.current.push(t.id)
    })
  }

  const cards = useMemo(() => {
    if (!user || !upOrder.current) return []
    const held = upOrder.current.filter((id) => inProgress.some((t) => t.id === id))
    // Caught-up shows sink to the bottom; each group keeps the held order, so
    // nothing else shifts when a card finishes or an Undo brings it back.
    const caughtUp = (id) => !nextUnwatched(titles[id], user.watchedEpisodes)
    return [...held.filter((id) => !caughtUp(id)), ...held.filter(caughtUp)]
      .map((id) => {
        const title = titles[id]
        const next = nextUnwatched(title, user.watchedEpisodes)
        const state = anim[id]
        // Mark slides the episode line up and out; Undo runs the same move
        // in reverse, so the direction of travel matches the action.
        const infoStyle =
          state === 'out'
            ? { opacity: 0, transform: 'translateY(-6px)', transition: 'opacity .18s ease, transform .18s ease' }
            : state === 'undo-out'
              ? { opacity: 0, transform: 'translateY(6px)', transition: 'opacity .18s ease, transform .18s ease' }
              : state === 'in'
                ? { opacity: 0, transform: 'translateY(6px)', transition: 'none' }
                : state === 'undo-in'
                  ? { opacity: 0, transform: 'translateY(-6px)', transition: 'none' }
                  : { opacity: 1, transform: 'none', transition: 'opacity .22s ease, transform .22s ease' }
        const undoTarget = lastWatched(title, user.watchedEpisodes)

        return {
          id,
          title,
          name: title.name,
          done: !next,
          code: next ? episodeCode(next.season, next.episode) : '',
          epName: next ? next.ep.name : '',
          rt: next ? `${next.ep.runtimeMinutes} min` : '',
          pct: pctOf(title, user),
          wash: wash(title),
          infoStyle,
          canUndo: !!undoTarget,
          undoCode: undoTarget ? episodeCode(undoTarget.season, undoTarget.episode) : '',
          onMark: () => markNext(id),
          onUndo: () => undoLast(id),
          onOpen: () => openTitle(id),
        }
      })
  }, [inProgress, titles, user, anim, markNext, undoLast, openTitle])

  const tracked = useMemo(
    () => (user ? trackedIds(user).map((id) => titles[id]).filter(Boolean) : []),
    [user, titles]
  )

  /*
   * "Because you like <genre>": one rail per top-two genre, tallied the same
   * way Stats does (a started show or a watched film counts). Tracked titles
   * are excluded, and the rails refetch only when the top genres change.
   */
  useEffect(() => {
    if (!loaded || !user) return
    const tally = {}
    tracked.forEach((t) => {
      const engaged =
        t.type === 'movie' ? user.watchedMovies.has(t.id) : counts(t, user.watchedEpisodes).watched > 0
      if (engaged) t.genres.forEach((g) => { tally[g] = (tally[g] || 0) + 1 })
    })
    const top = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([g]) => g)
    const sig = top.join(',')
    if (sig === genreSig.current) return
    genreSig.current = sig
    if (!top.length) {
      setGenreRails([])
      return
    }
    Promise.all(
      top.map(async (genre) => ({ genre, items: await getGenreRail(genre).catch(() => []) }))
    ).then((rails) => {
      if (genreSig.current !== sig) return
      setGenreRails(rails)
      setTitles((prev) => {
        const merged = { ...prev }
        rails.forEach((r) => r.items.forEach((t) => { merged[t.id] = merged[t.id] || t }))
        return merged
      })
    })
  }, [loaded, user, tracked])

  const libItems = useMemo(() => {
    if (!user) return []
    const filtered =
      filter === 'Shows' ? tracked.filter((t) => t.type === 'show')
      : filter === 'Movies' ? tracked.filter((t) => t.type === 'movie')
      : filter === 'Watchlist' ? tracked.filter((t) => user.watchlist.includes(t.id))
      : filter === 'Finished' ? tracked.filter((t) => pctOf(t, user) === 100)
      : tracked

    // Recent activity leads; titles that tie (none more recent than another,
    // including everything untouched) rank by the most hours left to watch.
    const sorted = filtered.slice().sort((a, b) =>
      sortBy === 'alpha' ? a.name.localeCompare(b.name)
      : sortBy === 'progress' ? pctOf(b, user) - pctOf(a, user)
      : lastTs(user, b.id) - lastTs(user, a.id) ||
        remainingMinutes(b, user) - remainingMinutes(a, user) ||
        a.name.localeCompare(b.name)
    )

    return sorted.map((t) => {
      const pct = pctOf(t, user)
      const c = t.type === 'show' ? counts(t, user.watchedEpisodes) : null
      const meta =
        t.type === 'show'
          ? `${t.year} · ${c.watched} of ${c.total} · ${pct}%`
          : `${t.year} · film · ${t.runtimeMinutes} min${user.watchedMovies.has(t.id) ? ' · watched' : ''}`
      return { id: t.id, title: t, name: t.name, meta, pct }
    })
  }, [tracked, user, filter, sortBy])

  const detail = useMemo(() => {
    if (!user || !titleId) return null
    const t = titles[titleId]
    if (!t) return null

    const isShow = t.type === 'show'
    const pct = pctOf(t, user)
    const next = isShow ? nextUnwatched(t, user.watchedEpisodes) : null
    const c = isShow ? counts(t, user.watchedEpisodes) : null
    const inWatchlist = user.watchlist.includes(t.id)
    const movieWatched = user.watchedMovies.has(t.id)

    return {
      title: t,
      name: t.name,
      isShow,
      isMovie: !isShow,
      meta: [t.year || null, ...t.genres, isShow ? (t.status === 'returning' ? 'returning' : 'ended') : null]
        .filter(Boolean)
        .join(' · '),
      overview: t.overview,
      progressLine: c ? `${c.watched} of ${c.total} episodes · ${pct}%` : '',
      pct,
      inWatchlist,
      watchlistLabel: inWatchlist ? 'On watchlist — remove' : 'Add to watchlist',
      onWatchlist: () => toggleWatchlist(t.id),
      movieWatched,
      movieLabel: movieWatched ? 'Watched — undo' : 'Mark watched',
      onToggleMovie: () => toggleMovie(t.id),
      rating: user.ratings[t.id] || 0,
      onRate: (n) => rate(t.id, n),
      seasons: isShow
        ? t.seasons.map((se) => {
            const key = `${t.id}:${se.number}`
            // Default the season holding the next episode open; an explicit
            // toggle wins from then on.
            const open = openSeasons[key] !== undefined ? openSeasons[key] : next ? next.season === se.number : false
            const watched = se.episodes.filter((ep) =>
              user.watchedEpisodes.has(episodeKey(t.id, se.number, ep.number))
            ).length

            return {
              number: se.number,
              title: `Season ${se.number}`,
              sub: `${watched} of ${se.episodes.length}`,
              open,
              showMarkAll: watched < se.episodes.length,
              onToggle: () => setOpenSeasons((prev) => ({ ...prev, [key]: !open })),
              onMarkAll: () => markSeason(t.id, se.number),
              episodes: open
                ? se.episodes.map((ep) => ({
                    number: ep.number,
                    code: episodeCode(se.number, ep.number),
                    name: ep.name,
                    sub: `${ep.runtimeMinutes} min · ${ep.airDate}`,
                    watched: user.watchedEpisodes.has(episodeKey(t.id, se.number, ep.number)),
                    onToggle: () => toggleEpisode(t.id, se.number, ep.number),
                    onCatchUp: () => catchUp(t.id, se.number, ep.number),
                  }))
                : [],
            }
          })
        : [],
    }
  }, [user, titles, titleId, openSeasons, toggleWatchlist, toggleMovie, rate, markSeason, toggleEpisode, catchUp])

  const discoverItem = useCallback(
    (t, withType) => ({
      id: t.id,
      title: t,
      name: t.name,
      meta: [t.year || null, t.type === 'show' ? 'show' : 'film', withType ? t.genres[0] : null]
        .filter(Boolean)
        .join(' · '),
      inWatchlist: user ? user.watchlist.includes(t.id) : false,
      onWatchlist: () => toggleWatchlist(t.id),
    }),
    [user, toggleWatchlist]
  )

  const resultItems = useMemo(() => results.map((t) => discoverItem(t, true)), [results, discoverItem])
  const recItems = useMemo(() => recs.map((t) => discoverItem(t, false)), [recs, discoverItem])

  const trackedSet = useMemo(() => new Set(user ? trackedIds(user) : []), [user])

  const discoverRows = useMemo(() => {
    const defs = [
      ['trending', 'Trending this week'],
      ['airing', 'Airing now'],
      ['theaters', 'In theaters'],
      ['topShows', 'Top rated shows'],
      ['topFilms', 'Top rated films'],
      ['upcoming', 'Coming soon'],
    ]
    return [
      { key: 'foryou', label: 'For you', items: recItems },
      // Personal genre rails sit above the global lists. Tracked titles are
      // filtered here, at render, so adding one removes it without a refetch.
      ...genreRails
        .map((r) => ({
          key: `genre-${r.genre}`,
          label: `Because you like ${r.genre}`,
          items: r.items.filter((t) => !trackedSet.has(t.id)).map((t) => discoverItem(t, false)),
        }))
        .filter((r) => r.items.length > 0),
      ...defs.map(([key, label]) => ({
        key,
        label,
        items: (collections[key] || []).map((t) => discoverItem(t, false)),
      })),
    ]
  }, [recItems, genreRails, trackedSet, collections, discoverItem])

  const statsView = useMemo(() => {
    if (!user) return { tiles: [], topGenres: [] }

    let minutes = 0
    user.watchedEpisodes.forEach((k) => {
      const t = titles[k.split(':')[0]]
      if (t) minutes += t.runtimeMinutes
    })
    user.watchedMovies.forEach((id) => {
      const t = titles[id]
      if (t) minutes += t.runtimeMinutes
    })

    const now = new Date()
    const episodesThisMonth = user.lastActivity.filter((a) => {
      const d = new Date(a.ts)
      return /^S\d{2}E\d{2}$/.test(a.label) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    // Consecutive days with activity, counting back from today (or from
    // yesterday, so a day that has not started yet does not break the run).
    const days = new Set(user.lastActivity.map((a) => new Date(a.ts).toDateString()))
    const cursor = new Date()
    if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1)
    let streak = 0
    while (days.has(cursor.toDateString())) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }

    const tally = {}
    tracked.forEach((t) => {
      const watched = t.type === 'movie' ? user.watchedMovies.has(t.id) : counts(t, user.watchedEpisodes).watched > 0
      if (watched) t.genres.forEach((g) => { tally[g] = (tally[g] || 0) + 1 })
    })
    const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 4)
    const max = ranked.length ? ranked[0][1] : 1

    return {
      tiles: [
        { value: `${Math.round(minutes / 60)} h`, label: 'total watched', color: 'var(--text)' },
        { value: String(episodesThisMonth), label: 'episodes this month', color: 'var(--text)' },
        { value: `${streak}${streak === 1 ? ' day' : ' days'}`, label: 'current streak', color: 'var(--sun)' },
        { value: String(tracked.length), label: 'titles tracked', color: 'var(--text)' },
      ],
      topGenres: ranked.map(([name, count]) => ({
        name,
        count: String(count),
        width: `${Math.round((count / max) * 100)}%`,
      })),
    }
  }, [user, titles, tracked])

  // --- Render --------------------------------------------------------------

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 430, minHeight: '100vh', padding: '0 0 92px', boxSizing: 'border-box' }}>
        {!loaded && (
          <div
            style={{
              padding: '80px 20px',
              textAlign: 'center',
              font: "400 12px 'IBM Plex Mono', monospace",
              color: 'var(--drift)',
            }}
          >
            Loading…
          </div>
        )}

        {loaded && syncFailed && (
          <div
            role="status"
            style={{
              margin: '12px 20px 0',
              padding: '10px 14px',
              border: '1px solid var(--line)',
              borderRadius: 12,
              font: "400 12px 'IBM Plex Mono', monospace",
              color: 'var(--sub)',
            }}
          >
            Sync is offline — changes are saved on this device and will sync when you're back.
          </div>
        )}

        {loaded && storageFailed && (
          <div
            role="status"
            style={{
              margin: '12px 20px 0',
              padding: '10px 14px',
              border: '1px solid var(--line)',
              borderRadius: 12,
              font: "400 12px 'IBM Plex Mono', monospace",
              color: 'var(--sub)',
            }}
          >
            Saving is off right now — your changes will live in memory for this session.
          </div>
        )}

        {loaded && screen === 'upnext' && (
          <UpNext cards={cards} dark={dark} onDiscover={() => goTab('discover')} />
        )}

        {loaded && screen === 'library' && (
          <Library
            filter={filter}
            onFilter={setFilter}
            sortBy={sortBy}
            onSort={setSortBy}
            items={libItems}
            dark={dark}
            onOpen={openTitle}
          />
        )}

        {loaded && screen === 'title' && (
          <TitleDetail
            detail={detail}
            dark={dark}
            onBack={() => {
              setScreen(tab)
              setTitleId(null)
            }}
          />
        )}

        {loaded && screen === 'discover' && (
          <Discover
            query={query}
            onSearch={onSearch}
            showResults={searched && query.trim().length > 0}
            results={resultItems}
            showRows={!query.trim()}
            rows={discoverRows}
            dark={dark}
            onOpen={openTitle}
          />
        )}

        {loaded && screen === 'stats' && (
          <Stats tiles={statsView.tiles} topGenres={statsView.topGenres} account={account} />
        )}
      </div>

      <TabBar tab={tab} onSelect={goTab} />
    </div>
  )
}
