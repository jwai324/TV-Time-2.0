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
  applyMark,
  cloneUser,
  episodeKey,
  fetchRemoteUser,
  loadUser,
  persistUser,
  pushRemoteUser,
  recordActivity,
  recordSharedActivity,
  unapplyMark,
  withSharedMarks,
  withdrawActivity,
} from './lib/user.js'
import {
  acceptFriendRequest,
  acceptShare,
  addMarks,
  claimUsername,
  dropShare,
  endShare,
  fetchFriendships,
  fetchMarks,
  fetchProfile,
  fetchProfiles,
  fetchShares,
  inviteToWatch,
  removeFriendship,
  removeMark,
  sendFriendRequest,
  subscribeSocial,
  usernameAvailable,
  usernameProblem,
} from './lib/social.js'
import { supabase } from './lib/supabase.js'
import TabBar from './components/TabBar.jsx'
import UpNext from './screens/UpNext.jsx'
import Library from './screens/Library.jsx'
import TitleDetail from './screens/TitleDetail.jsx'
import Discover from './screens/Discover.jsx'
import Stats from './screens/Stats.jsx'
import Account from './screens/Account.jsx'

/** A username typed at sign-up outlives the round-trip to the confirmation email. */
const PENDING_USERNAME_KEY = 'tideline.pendingUsername'

const readPendingUsername = () => {
  try {
    return localStorage.getItem(PENDING_USERNAME_KEY) || ''
  } catch {
    return ''
  }
}

const writePendingUsername = (value) => {
  try {
    if (value) localStorage.setItem(PENDING_USERNAME_KEY, value)
    else localStorage.removeItem(PENDING_USERNAME_KEY)
  } catch {
    /* memory-only session; the username can be claimed by hand instead */
  }
}

const markSig = (m) => `${m.share_id}:${m.kind}:${m.key}`
const sameMark = (a, b) => a.share_id === b.share_id && a.kind === b.kind && a.key === b.key

const EMPTY_SOCIAL = { friendships: [], shares: [], names: {}, marks: [] }

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

  // `rawUser` is mirrored into a ref so an action can read the value a previous
  // action just wrote, without waiting for a re-render.
  const userRef = useRef(null)
  const [rawUser, setUserState] = useState(null)
  const setUser = useCallback((next) => {
    userRef.current = next
    setUserState(next)
  }, [])

  // Friends, the shows you are watching with them, and the marks those shows
  // carry. `names` maps an account id to its username.
  const [profile, setProfile] = useState(null)
  const [social, setSocial] = useState(EMPTY_SOCIAL)
  const socialRef = useRef(social)
  socialRef.current = social

  const myId = session?.user?.id ?? null

  /** The shares that are live: accepted, so marks flow both ways. */
  const liveShares = useMemo(
    () => social.shares.filter((sh) => sh.status === 'accepted'),
    [social.shares]
  )

  /** The marks those shares carry — the half of your record you share. */
  const liveMarks = useMemo(() => {
    const live = new Set(liveShares.map((sh) => sh.id))
    return social.marks.filter((m) => live.has(m.share_id))
  }, [liveShares, social.marks])

  // A show you are watching with a friend is tracked from the moment you pair
  // up on it, the same as one you have put on your watchlist.
  const sharedTitleIds = useMemo(() => new Set(liveShares.map((sh) => sh.title_id)), [liveShares])

  /*
   * What every screen reads: your own record with the marks of your live
   * shares folded in. Your record itself is never written by anyone else, so
   * marking an episode of a shared show reaches your friend as a row here,
   * not as an edit to their account.
   */
  const user = useMemo(() => (rawUser ? withSharedMarks(rawUser, liveMarks) : null), [rawUser, liveMarks])
  const effRef = useRef(null)
  effRef.current = user

  const marksRef = useRef(social.marks)
  marksRef.current = social.marks

  const setMarks = useCallback((fn) => setSocial((prev) => ({ ...prev, marks: fn(prev.marks) })), [])

  /** The live share on a title, or null when it is yours alone. */
  const liveShareOf = useCallback(
    (id) => socialRef.current.shares.find((sh) => sh.status === 'accepted' && sh.title_id === id) || null,
    []
  )

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

  // The username, once there is an account to hang it on. A username typed at
  // sign-up is claimed here, after the confirmation round-trip brings a
  // session back.
  useEffect(() => {
    if (!session) {
      setProfile(null)
      setSocial(EMPTY_SOCIAL)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        let mine = await fetchProfile(session.user.id)
        const pending = readPendingUsername()
        if (!mine && pending) {
          mine = await claimUsername(session.user.id, pending).catch(() => null)
          if (mine) writePendingUsername('')
        }
        if (!cancelled) setProfile(mine)
      } catch {
        if (!cancelled) setProfile(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session])

  /** Re-read friends, shares and marks. Every social action ends here. */
  const refreshSocial = useCallback(async () => {
    const s = sessionRef.current
    if (!s) {
      setSocial(EMPTY_SOCIAL)
      return
    }
    try {
      const [friendships, shares] = await Promise.all([fetchFriendships(), fetchShares()])
      const ids = new Set()
      friendships.forEach((f) => {
        ids.add(f.requester)
        ids.add(f.addressee)
      })
      shares.forEach((sh) => {
        ids.add(sh.inviter)
        ids.add(sh.invitee)
      })
      ids.delete(s.user.id)
      // Marks are read for ended shares too — that is what lets each side
      // keep its own copy of what you watched together.
      const [names, marks] = await Promise.all([
        fetchProfiles([...ids]),
        fetchMarks(shares.filter((sh) => sh.status !== 'pending').map((sh) => sh.id)),
      ])
      setSocial({ friendships, shares, names, marks })
      setSyncFailed(false)
    } catch {
      setSyncFailed(true)
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    refreshSocial()
  }, [profile, refreshSocial])

  /*
   * A friend's mark should land while you are both watching, not on next
   * load. Marks arrive already applied; anything else about the friendship
   * just triggers a re-read.
   */
  useEffect(() => {
    if (!myId || !profile) return
    const shareIds = liveShares.map((sh) => sh.id)
    return subscribeSocial({
      userId: myId,
      shareIds,
      onMarks: (payload) => {
        if (payload.eventType === 'DELETE') {
          const gone = payload.old
          if (!gone?.share_id) return
          setMarks((prev) => prev.filter((m) => !sameMark(m, gone)))
        } else if (payload.new) {
          const row = payload.new
          setMarks((prev) => (prev.some((m) => sameMark(m, row)) ? prev : [...prev, row]))
        }
      },
      onSocial: () => refreshSocial(),
    })
  }, [myId, profile, liveShares, refreshSocial, setMarks])

  /*
   * Realtime is the fast path, not the only one. A socket that was asleep,
   * blocked or dropped would otherwise leave a friend's marks unseen until a
   * reload, so coming back to the app re-reads them too.
   */
  useEffect(() => {
    if (!profile) return
    const refresh = () => {
      if (document.visibilityState === 'visible') refreshSocial()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [profile, refreshSocial])

  /*
   * A share that has ended stops being shared and starts being yours: its
   * marks are folded into your own record, once, and remembered so they are
   * not folded in again. The other side does the same on their next load, so
   * neither of you loses an episode when you stop watching together.
   */
  useEffect(() => {
    if (!loaded || !rawUser || !myId || freshStart) return
    const ended = social.shares.filter(
      (sh) => sh.status === 'ended' && !rawUser.materializedShares.includes(sh.id)
    )
    if (!ended.length) return
    const ids = new Set(ended.map((sh) => sh.id))
    mutate((u) => {
      social.marks.filter((m) => ids.has(m.share_id)).forEach((m) => applyMark(u, m))
      ended.forEach((sh) => u.materializedShares.push(sh.id))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, rawUser, myId, freshStart, social.shares, social.marks])

  /*
   * A friend marking an episode makes it watched for you, so it belongs in
   * your activity too — that is what orders Up Next and feeds the streak.
   * Marks you made yourself were logged when you made them.
   */
  useEffect(() => {
    if (!loaded || !rawUser || !myId) return
    const logged = new Set(rawUser.lastActivity.map((a) => a.sk).filter(Boolean))
    const fresh = liveMarks.filter(
      (m) => m.kind === 'episode' && m.marked_by !== myId && !logged.has(markSig(m))
    )
    if (!fresh.length) return
    const entries = fresh
      .map((m) => {
        const [id, season, episode] = m.key.split(':')
        return {
          ts: new Date(m.marked_at).getTime(),
          titleId: id,
          label: episodeCode(Number(season), Number(episode)),
          sk: markSig(m),
        }
      })
      .filter((e) => Number.isFinite(e.ts))
    if (!entries.length) return
    mutate((u) => recordSharedActivity(u, entries))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, rawUser, myId, liveMarks])

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

  /*
   * Whenever the user record changes (chiefly: replaced by the account's
   * record at sign-in), fetch full titles for any tracked id this device
   * doesn't hold yet — otherwise shows watched on another device silently
   * miss Up Next and the Library. Ids already being fetched (or known
   * unresolvable) are skipped.
   */
  const titleFetches = useRef(new Set())
  useEffect(() => {
    if (!loaded || !user) return
    const need = new Set(trackedIds(user))
    user.lastActivity.forEach((a) => need.add(a.titleId))
    // A show a friend has invited you to watch has to be resolvable before
    // you have marked anything on it — the invitation names it.
    social.shares.forEach((sh) => need.add(sh.title_id))
    const missing = [...need].filter((id) => {
      const t = titles[id]
      return (!t || t.partial) && !titleFetches.current.has(id)
    })
    if (!missing.length) return
    missing.forEach((id) => titleFetches.current.add(id))
    Promise.all(missing.map(async (id) => [id, await getTitle(id).catch(() => null)])).then((pairs) => {
      const found = pairs.filter(([, t]) => t)
      if (!found.length) return
      setTitles((prev) => {
        const merged = { ...prev }
        found.forEach(([id, t]) => {
          merged[id] = t
        })
        return merged
      })
    })
  }, [loaded, user, titles, social.shares])

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

  /**
   * Add marks to a title: to the share when you are watching it with someone,
   * to your own record when you are not.
   *
   * A shared mark is written optimistically so the tide bar moves under your
   * thumb, and withdrawn again if the write does not land. The activity entry
   * stays yours either way — your friend logs their own when the mark reaches
   * them.
   */
  const addWatched = useCallback(
    (id, entries, label) => {
      const share = liveShareOf(id)
      if (!share) {
        mutate((u) => {
          entries.forEach((e) => applyMark(u, e))
          if (label) recordActivity(u, id, label)
        })
        return
      }

      const now = new Date().toISOString()
      const rows = entries
        .map((e) => ({ share_id: share.id, kind: e.kind, key: e.key, marked_by: myId, marked_at: now }))
        .filter((row) => !marksRef.current.some((m) => sameMark(m, row)))
      if (!rows.length) return

      setMarks((prev) => [...prev, ...rows])
      if (label) mutate((u) => recordActivity(u, id, label))
      addMarks(share.id, myId, entries)
        .then(() => setSyncFailed(false))
        .catch(() => {
          setMarks((prev) => prev.filter((m) => !rows.some((row) => sameMark(row, m))))
          setSyncFailed(true)
        })
    },
    [liveShareOf, mutate, myId, setMarks]
  )

  /**
   * Take a mark back. A shared mark is a row both of you can delete, so an
   * undo reaches your friend the same way the mark did; anything that was
   * only ever yours — progress from before you paired up — comes out of your
   * own record and stays there.
   */
  const removeWatched = useCallback(
    (id, entry, label) => {
      const share = liveShareOf(id)
      const shared = share
        ? marksRef.current.find((m) => sameMark(m, { share_id: share.id, ...entry }))
        : null

      if (!shared) {
        mutate((u) => {
          unapplyMark(u, entry)
          if (label) withdrawActivity(u, id, label)
        })
        return
      }

      setMarks((prev) => prev.filter((m) => !sameMark(m, shared)))
      if (label) mutate((u) => withdrawActivity(u, id, label, markSig(shared)))
      removeMark(share.id, entry.kind, entry.key)
        .then(() => setSyncFailed(false))
        .catch(() => {
          setMarks((prev) => (prev.some((m) => sameMark(m, shared)) ? prev : [...prev, shared]))
          setSyncFailed(true)
        })
    },
    [liveShareOf, mutate, setMarks]
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
      const entry = { kind: 'watchlist', key: id }
      if (effRef.current.watchlist.includes(id)) removeWatched(id, entry)
      else addWatched(id, [entry])
    },
    [ensureFull, addWatched, removeWatched]
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
      const next = nextUnwatched(title, effRef.current.watchedEpisodes)
      if (!next) return

      setAnim((a) => ({ ...a, [id]: 'out' }))
      later(() => {
        const key = episodeKey(id, next.season, next.episode)
        addWatched(id, [{ kind: 'episode', key }], episodeCode(next.season, next.episode))
        // A caught-up show leaves Up Next; it returns when a new episode airs
        // or the latest one is un-marked. Clear any pin from an earlier undo
        // so it can't hold the finished card on screen.
        const after = new Set(effRef.current.watchedEpisodes).add(key)
        if (!nextUnwatched(title, after)) {
          setPinned((f) => (f[id] ? { ...f, [id]: false } : f))
        }
        setAnim((a) => ({ ...a, [id]: 'in' }))
        later(() => setAnim((a) => ({ ...a, [id]: null })), 40)
      }, 190)
    },
    [anim, titles, addWatched, later]
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

      if (title.type === 'movie') {
        if (!effRef.current.watchedMovies.has(id)) return
        setAnim((a) => ({ ...a, [id]: 'undo-out' }))
        later(() => {
          removeWatched(id, { kind: 'movie', key: id }, 'Watched')
          setPinned((f) => ({ ...f, [id]: true }))
          setAnim((a) => ({ ...a, [id]: 'undo-in' }))
          later(() => setAnim((a) => ({ ...a, [id]: null })), 40)
        }, 190)
        return
      }

      const target = lastWatched(title, effRef.current.watchedEpisodes)
      if (!target) return

      setAnim((a) => ({ ...a, [id]: 'undo-out' }))
      later(() => {
        const key = episodeKey(id, target.season, target.episode)
        removeWatched(id, { kind: 'episode', key }, episodeCode(target.season, target.episode))
        const after = new Set(effRef.current.watchedEpisodes)
        after.delete(key)
        if (counts(title, after).watched === 0) {
          setPinned((f) => ({ ...f, [id]: true }))
        }
        setAnim((a) => ({ ...a, [id]: 'undo-in' }))
        later(() => setAnim((a) => ({ ...a, [id]: null })), 40)
      }, 190)
    },
    [anim, titles, removeWatched, later]
  )

  /** Mark a queued film watched from Up Next; the card leaves the queue. */
  const markMovieNext = useCallback(
    (id) => {
      if (anim[id]) return
      if (effRef.current.watchedMovies.has(id)) return
      setAnim((a) => ({ ...a, [id]: 'out' }))
      later(() => {
        addWatched(id, [{ kind: 'movie', key: id }], 'Watched')
        setPinned((f) => (f[id] ? { ...f, [id]: false } : f))
        setAnim((a) => ({ ...a, [id]: 'in' }))
        later(() => setAnim((a) => ({ ...a, [id]: null })), 40)
      }, 190)
    },
    [anim, addWatched, later]
  )

  const toggleEpisode = useCallback(
    (id, season, episode) => {
      const key = episodeKey(id, season, episode)
      const code = episodeCode(season, episode)
      if (effRef.current.watchedEpisodes.has(key)) removeWatched(id, { kind: 'episode', key }, code)
      else addWatched(id, [{ kind: 'episode', key }], code)
    },
    [addWatched, removeWatched]
  )

  const markSeason = useCallback(
    (id, seasonNumber) => {
      const season = titles[id].seasons.find((s) => s.number === seasonNumber)
      addWatched(
        id,
        season.episodes.map((ep) => ({ kind: 'episode', key: episodeKey(id, seasonNumber, ep.number) })),
        `Season ${seasonNumber} watched`
      )
    },
    [titles, addWatched]
  )

  /** Mark an episode and everything before it watched. */
  const catchUp = useCallback(
    (id, seasonNumber, episodeNumber) => {
      const title = titles[id]
      const entries = []
      for (const s of title.seasons) {
        if (s.number > seasonNumber) break
        for (const ep of s.episodes) {
          if (s.number === seasonNumber && ep.number > episodeNumber) break
          entries.push({ kind: 'episode', key: episodeKey(id, s.number, ep.number) })
        }
      }
      addWatched(id, entries, `Caught up to ${episodeCode(seasonNumber, episodeNumber)}`)
    },
    [titles, addWatched]
  )

  const toggleMovie = useCallback(
    (id) => {
      if (effRef.current.watchedMovies.has(id)) removeWatched(id, { kind: 'movie', key: id }, 'Watched')
      else addWatched(id, [{ kind: 'movie', key: id }], 'Watched')
    },
    [addWatched, removeWatched]
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
      const tracked = new Set(trackedIds(effRef.current))
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

  // --- Friends -------------------------------------------------------------

  const nameOf = useCallback((id) => social.names[id] || 'someone', [social.names])
  const titleName = useCallback((id) => titles[id]?.name || 'a title', [titles])

  const friends = useMemo(() => {
    if (!myId) return []
    return social.friendships
      .filter((f) => f.status === 'accepted')
      .map((f) => {
        const other = f.requester === myId ? f.addressee : f.requester
        return { id: f.id, userId: other, username: nameOf(other) }
      })
      .sort((a, b) => a.username.localeCompare(b.username))
  }, [social.friendships, myId, nameOf])

  const incomingRequests = useMemo(
    () =>
      social.friendships
        .filter((f) => f.status === 'pending' && f.addressee === myId)
        .map((f) => ({ id: f.id, username: nameOf(f.requester) })),
    [social.friendships, myId, nameOf]
  )

  const outgoingRequests = useMemo(
    () =>
      social.friendships
        .filter((f) => f.status === 'pending' && f.requester === myId)
        .map((f) => ({ id: f.id, username: nameOf(f.addressee) })),
    [social.friendships, myId, nameOf]
  )

  const shareRow = useCallback(
    (sh) => ({
      id: sh.id,
      titleId: sh.title_id,
      name: titleName(sh.title_id),
      username: nameOf(sh.inviter === myId ? sh.invitee : sh.inviter),
    }),
    [titleName, nameOf, myId]
  )

  const sharing = useMemo(() => liveShares.map(shareRow), [liveShares, shareRow])
  const shareInvites = useMemo(
    () => social.shares.filter((sh) => sh.status === 'pending' && sh.invitee === myId).map(shareRow),
    [social.shares, myId, shareRow]
  )
  const shareRequests = useMemo(
    () => social.shares.filter((sh) => sh.status === 'pending' && sh.inviter === myId).map(shareRow),
    [social.shares, myId, shareRow]
  )

  /** Run a social action, then re-read. Returns an error string, or null. */
  const socialAction = useCallback(
    async (fn) => {
      try {
        const result = await fn()
        await refreshSocial()
        return result || null
      } catch (err) {
        return err.message || 'That did not go through — try again.'
      }
    },
    [refreshSocial]
  )

  const account = useMemo(
    () => ({
      email: session?.user?.email ?? null,
      username: profile?.username ?? null,
      // A username is what a friend adds you by, so an account without one
      // cannot take part until it picks one.
      needsUsername: !!session && !profile,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? error.message : null
      },
      signUp: async (email, password, username) => {
        const problem = usernameProblem(username)
        if (problem) return problem
        try {
          if (!(await usernameAvailable(username))) return 'That username is taken.'
        } catch {
          return 'Could not check that username — try again.'
        }
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return error.message
        if (!data.session) {
          // The account exists but there is no session to hang the username
          // on yet; claim it when the confirmation link brings one back.
          writePendingUsername(username.trim())
          return 'Check your email to confirm your account, then sign in.'
        }
        try {
          setProfile(await claimUsername(data.session.user.id, username))
        } catch (err) {
          return err.message
        }
        return null
      },
      signOut: async () => {
        syncedUserId.current = null
        await supabase.auth.signOut()
        setProfile(null)
        setSocial(EMPTY_SOCIAL)
        return null
      },
      chooseUsername: async (username) => {
        const problem = usernameProblem(username)
        if (problem) return problem
        if (!session) return 'Sign in first.'
        try {
          setProfile(await claimUsername(session.user.id, username))
          writePendingUsername('')
          return null
        } catch (err) {
          return err.message
        }
      },
      friends,
      incomingRequests,
      outgoingRequests,
      // Resolves to `{ ok }` or `{ error }` — the card shows either as it is.
      addFriend: async (username) => {
        if (!myId) return { error: 'Sign in first.' }
        const result = await sendFriendRequest(myId, username).catch((err) => ({ error: err.message }))
        await refreshSocial()
        return result
      },
      acceptFriend: (id) => socialAction(() => acceptFriendRequest(id)),
      removeFriend: (id) => socialAction(() => removeFriendship(id)),
      sharing,
      shareInvites,
      shareRequests,
      acceptInvite: (id) => socialAction(() => acceptShare(id)),
      declineInvite: (id) => socialAction(() => dropShare(id)),
      stopSharing: (id) => socialAction(() => endShare(id)),
      openTitle,
    }),
    [
      session,
      profile,
      friends,
      incomingRequests,
      outgoingRequests,
      sharing,
      shareInvites,
      shareRequests,
      myId,
      refreshSocial,
      socialAction,
      openTitle,
    ]
  )

  /*
   * The watch-together controls on a title: one row per friend, carrying
   * whichever of the four states you are in with them on this title.
   */
  const watchTogether = useMemo(() => {
    if (!titleId) return null
    const relevant = social.shares.filter((sh) => sh.title_id === titleId && sh.status !== 'ended')
    const rows = friends.map((f) => {
      const sh = relevant.find((x) => x.inviter === f.userId || x.invitee === f.userId)
      const state = !sh
        ? 'none'
        : sh.status === 'accepted'
          ? 'watching'
          : sh.inviter === myId
            ? 'invited'
            : 'asked'
      return { userId: f.userId, username: f.username, state, shareId: sh?.id || null }
    })
    return {
      signedIn: !!myId,
      hasUsername: !!profile,
      rows,
      onInvite: async (friendId) => {
        const { error } = await inviteToWatch(myId, friendId, titleId)
        await refreshSocial()
        return error || null
      },
      onAccept: (id) => socialAction(() => acceptShare(id)),
      onDecline: (id) => socialAction(() => dropShare(id)),
      onStop: (id) => socialAction(() => endShare(id)),
    }
  }, [titleId, social.shares, friends, myId, profile, refreshSocial, socialAction])

  // --- Derived views -------------------------------------------------------

  const queue = useMemo(() => {
    if (!user) return []
    return Object.values(titles).filter((t) => {
      if (t.partial) return false
      if (pinned[t.id]) return true
      const queued = user.watchlist.includes(t.id) || sharedTitleIds.has(t.id)
      if (t.type === 'show') {
        const watched = counts(t, user.watchedEpisodes).watched
        if (watched > 0) return pctOf(t, user) < 100
        return queued // queued but not started
      }
      return queued && !user.watchedMovies.has(t.id)
    })
  }, [titles, user, pinned, sharedTitleIds])

  // Up Next is ordered by recent activity when it is first built, then holds
  // that order so a card never jumps while you are working down the list.
  const upOrder = useRef(null)
  if (loaded && user && upOrder.current === null) {
    const wlIndex = (t) => {
      const i = user.watchlist.indexOf(t.id)
      return i < 0 ? Number.MAX_SAFE_INTEGER : i
    }
    upOrder.current = queue
      .slice()
      .sort((a, b) => lastTs(user, b.id) - lastTs(user, a.id) || wlIndex(a) - wlIndex(b))
      .map((t) => t.id)
  }
  if (upOrder.current) {
    queue.forEach((t) => {
      if (!upOrder.current.includes(t.id)) upOrder.current.push(t.id)
    })
  }

  const cards = useMemo(() => {
    if (!user || !upOrder.current) return []
    const held = upOrder.current.filter((id) => queue.some((t) => t.id === id))
    // Finished cards sink to the bottom; each group keeps the held order, so
    // nothing else shifts when a card finishes or an Undo brings it back.
    const caughtUp = (id) =>
      titles[id].type === 'movie'
        ? user.watchedMovies.has(id)
        : !nextUnwatched(titles[id], user.watchedEpisodes)
    return [...held.filter((id) => !caughtUp(id)), ...held.filter(caughtUp)]
      .map((id) => {
        const title = titles[id]
        const next = title.type === 'show' ? nextUnwatched(title, user.watchedEpisodes) : null
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
        const undoTarget = title.type === 'show' ? lastWatched(title, user.watchedEpisodes) : null

        if (title.type === 'movie') {
          const watched = user.watchedMovies.has(id)
          return {
            id,
            title,
            name: title.name,
            done: watched,
            doneLabel: 'Watched',
            code: 'Film',
            epName: '',
            rt: `${title.runtimeMinutes} min`,
            pct: watched ? 100 : 0,
            wash: wash(title),
            infoStyle,
            canUndo: watched,
            undoCode: title.name,
            onMark: () => markMovieNext(id),
            onUndo: () => undoLast(id),
            onOpen: () => openTitle(id),
          }
        }

        return {
          id,
          title,
          name: title.name,
          done: !next,
          doneLabel: 'All caught up',
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
  }, [queue, titles, user, anim, markNext, markMovieNext, undoLast, openTitle])

  const tracked = useMemo(() => {
    if (!user) return []
    const ids = new Set(trackedIds(user))
    sharedTitleIds.forEach((id) => ids.add(id))
    return [...ids].map((id) => titles[id]).filter(Boolean)
  }, [user, titles, sharedTitleIds])

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
      sharedWith: liveShares
        .filter((sh) => sh.title_id === t.id)
        .map((sh) => nameOf(sh.inviter === myId ? sh.invitee : sh.inviter)),
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
      trailerUrl: t.trailerUrl || null,
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
  }, [
    user,
    titles,
    titleId,
    openSeasons,
    liveShares,
    nameOf,
    myId,
    toggleWatchlist,
    toggleMovie,
    rate,
    markSeason,
    toggleEpisode,
    catchUp,
  ])

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

  const trackedSet = useMemo(() => new Set(tracked.map((t) => t.id)), [tracked])

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
            watchTogether={watchTogether}
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

        {loaded && screen === 'stats' && <Stats tiles={statsView.tiles} topGenres={statsView.topGenres} />}

        {loaded && screen === 'account' && <Account account={account} />}
      </div>

      <TabBar tab={tab} onSelect={goTab} />
    </div>
  )
}
