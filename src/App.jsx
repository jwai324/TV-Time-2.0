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
  unwatchedBeforeEpisode,
  unwatchedBeforeSeason,
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
  answerRecommendation,
  claimUsername,
  DEFER_DAYS,
  deferRecommendation,
  dropRecommendation,
  dropShare,
  endShare,
  fetchFriendships,
  fetchMarks,
  fetchProfile,
  fetchProfiles,
  fetchRecommendations,
  fetchShares,
  inviteToWatch,
  RECOMMENDATION_NOTE_MAX,
  removeFriendship,
  removeMark,
  removeMarks,
  sendFriendRequest,
  sendRecommendation,
  subscribeSocial,
  usernameAvailable,
  usernameProblem,
} from './lib/social.js'
import { ALWAYS, ASK, loadPrefs, NEVER, persistPrefs } from './lib/prefs.js'
import { supabase } from './lib/supabase.js'
import CatchUpPrompt from './components/CatchUpPrompt.jsx'
import DonationBanner from './components/DonationBanner.jsx'
import RecommendationPrompt from './components/RecommendationPrompt.jsx'
import RecommendDialog from './components/RecommendDialog.jsx'
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

const COLLAPSED_KEY = 'tideline.upnext.collapsed'

const readCollapsed = () => {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY)) || {}
  } catch {
    return {}
  }
}

const writeCollapsed = (value) => {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(value))
  } catch {
    /* memory-only session; the sections just reopen next time */
  }
}

const markSig = (m) => `${m.share_id}:${m.kind}:${m.key}`
const sameMark = (a, b) => a.share_id === b.share_id && a.kind === b.kind && a.key === b.key

const EMPTY_SOCIAL = { friendships: [], shares: [], names: {}, marks: [], recommendations: [] }

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
  // Which Up Next sections are folded away. Kept across reloads, because a
  // section you closed is a decision, not a scroll position.
  const [collapsed, setCollapsed] = useState(readCollapsed)

  // How this device wants to be asked things. Saved on every change, so a
  // "don't ask this again" survives the reload it was pressed before.
  const [prefs, setPrefs] = useState(loadPrefs)
  const setPref = useCallback((key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      persistPrefs(next)
      return next
    })
  }, [])

  const [anim, setAnim] = useState({})
  // Cards pinned on screen mid-interaction: a show marked to completion, or
  // undone back to zero watched, stays put instead of vanishing under the tap.
  const [pinned, setPinned] = useState({})

  // Recommendations the reader chose to look at the title for before
  // answering. Held for the session only: the recommendation is still open,
  // so it is waiting on the Account tab and comes back on the next visit.
  const [peeked, setPeeked] = useState(() => new Set())

  // Recommendations the reader has asked to answer now, ahead of a deferral
  // they set earlier. Also session-only: overriding a deferral is a decision
  // about this moment, not a change to the recommendation.
  const [answerNow, setAnswerNow] = useState(() => new Set())

  /*
   * A deferred recommendation is due at a moment, not on a reload, so the
   * clock the due-check reads has to move. A minute is finer than any deferral
   * needs and cheap enough to leave running.
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

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
      const [friendships, shares, recommendations] = await Promise.all([
        fetchFriendships(),
        fetchShares(),
        fetchRecommendations(),
      ])
      const ids = new Set()
      friendships.forEach((f) => {
        ids.add(f.requester)
        ids.add(f.addressee)
      })
      shares.forEach((sh) => {
        ids.add(sh.inviter)
        ids.add(sh.invitee)
      })
      recommendations.forEach((r) => {
        ids.add(r.sender)
        ids.add(r.recipient)
      })
      ids.delete(s.user.id)
      // Marks are read for ended shares too — that is what lets each side
      // keep its own copy of what you watched together.
      const [names, marks] = await Promise.all([
        fetchProfiles([...ids]),
        fetchMarks(shares.filter((sh) => sh.status !== 'pending').map((sh) => sh.id)),
      ])
      setSocial({ friendships, shares, names, marks, recommendations })
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
      if (document.visibilityState !== 'visible') return
      setNow(Date.now())
      refreshSocial()
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
    // you have marked anything on it — the invitation names it. A recommended
    // title is the same: the prompt has to be able to show what it is about.
    social.shares.forEach((sh) => need.add(sh.title_id))
    social.recommendations.forEach((r) => need.add(r.title_id))
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
  }, [loaded, user, titles, social.shares, social.recommendations])

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

  /**
   * Take back a run of marks at once — the batch counterpart of
   * `removeWatched`, and the mirror of how `addWatched` already takes a list.
   *
   * A season is up to a couple of dozen episodes, and undoing it a mark at a
   * time would mean a record clone, a storage write and a network round trip
   * each. Here the record is rewritten once and the shared rows go in one
   * delete per kind, so the season also reaches whoever you are watching it
   * with as the single thing that happened.
   *
   * `labels` is every activity entry the run could have left behind — the
   * batch's own label and the individual marks' — because the same episodes
   * can be reached either way, and an undo should leave the record reading as
   * if none of it happened.
   */
  const removeWatchedMany = useCallback(
    (id, entries, labels = []) => {
      const share = liveShareOf(id)
      const shared = share
        ? entries
            .map((e) => marksRef.current.find((m) => sameMark(m, { share_id: share.id, ...e })))
            .filter(Boolean)
        : []
      const isShared = new Set(shared.map((m) => `${m.kind}:${m.key}`))
      const own = entries.filter((e) => !isShared.has(`${e.kind}:${e.key}`))

      mutate((u) => {
        own.forEach((e) => unapplyMark(u, e))
        labels.forEach((label) => withdrawActivity(u, id, label))
      })

      if (!shared.length) return
      setMarks((prev) => prev.filter((m) => !shared.some((s) => sameMark(s, m))))

      const byKind = {}
      shared.forEach((m) => (byKind[m.kind] = [...(byKind[m.kind] || []), m.key]))
      Promise.all(Object.entries(byKind).map(([kind, keys]) => removeMarks(share.id, kind, keys)))
        .then(() => setSyncFailed(false))
        .catch(() => {
          setMarks((prev) => [...prev, ...shared.filter((s) => !prev.some((m) => sameMark(m, s)))])
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

  /** Accepting a recommendation adds; a title already queued is left alone. */
  const addToWatchlist = useCallback(
    (id) => {
      ensureFull(id)
      if (effRef.current.watchlist.includes(id)) return
      addWatched(id, [{ kind: 'watchlist', key: id }])
    },
    [ensureFull, addWatched]
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

  /**
   * Films are the one thing here with no natural halfway point — a show tells
   * you where you are by its episodes, a film does not. Saying you have
   * started one is what puts it under Currently watching rather than Start
   * new; finishing it settles the question, so the flag comes off.
   */
  const toggleStarted = useCallback(
    (id) => {
      mutate((u) => {
        if (u.startedMovies.has(id)) u.startedMovies.delete(id)
        else u.startedMovies.add(id)
      })
    },
    [mutate]
  )

  const settleMovie = useCallback(
    (id) => {
      if (!userRef.current.startedMovies.has(id)) return
      mutate((u) => u.startedMovies.delete(id))
    },
    [mutate]
  )

  /** Mark a queued film watched from Up Next; the card leaves the queue. */
  const markMovieNext = useCallback(
    (id) => {
      if (anim[id]) return
      if (effRef.current.watchedMovies.has(id)) return
      setAnim((a) => ({ ...a, [id]: 'out' }))
      later(() => {
        addWatched(id, [{ kind: 'movie', key: id }], 'Watched')
        settleMovie(id)
        setPinned((f) => (f[id] ? { ...f, [id]: false } : f))
        setAnim((a) => ({ ...a, [id]: 'in' }))
        later(() => setAnim((a) => ({ ...a, [id]: null })), 40)
      }, 190)
    },
    [anim, addWatched, settleMovie, later]
  )

  /*
   * Marking part-way into a show raises a question the app cannot answer for
   * you: the episodes behind the one you ticked are either watched-and-never-
   * marked or genuinely skipped, and the two lead to different records.
   *
   * `askCatchUp` is that question, held open over whatever screen you were on
   * until you answer it. It carries only the mark it is about — the gap behind
   * that mark is recomposed from the live record each render, so a friend's
   * mark landing mid-question cannot leave the dialog describing a gap that
   * has already closed.
   */
  const [askCatchUp, setAskCatchUp] = useState(null)

  /** Leaving the title the question was raised on drops the question with it. */
  useEffect(() => setAskCatchUp(null), [titleId])

  /** Write an episode mark, optionally sweeping up the gap behind it. */
  const markEpisode = useCallback(
    (id, season, episode, withEarlier) => {
      const key = episodeKey(id, season, episode)
      const code = episodeCode(season, episode)
      if (!withEarlier) {
        addWatched(id, [{ kind: 'episode', key }], code)
        return
      }
      const behind = unwatchedBeforeEpisode(titles[id], season, episode, effRef.current.watchedEpisodes)
      addWatched(
        id,
        [...behind.map((e) => ({ kind: 'episode', key: e.key })), { kind: 'episode', key }],
        `Caught up to ${code}`
      )
    },
    [titles, addWatched]
  )

  const toggleEpisode = useCallback(
    (id, season, episode) => {
      const key = episodeKey(id, season, episode)
      if (effRef.current.watchedEpisodes.has(key)) {
        removeWatched(id, { kind: 'episode', key }, episodeCode(season, episode))
        return
      }
      const behind = unwatchedBeforeEpisode(titles[id], season, episode, effRef.current.watchedEpisodes)
      if (behind.length && prefs.previousEpisodes === ASK) {
        setAskCatchUp({ scope: 'episode', id, season, episode })
        return
      }
      markEpisode(id, season, episode, behind.length > 0 && prefs.previousEpisodes === ALWAYS)
    },
    [titles, prefs, markEpisode, removeWatched]
  )

  /** Write a season mark, optionally sweeping up the seasons behind it. */
  const markSeasonMarks = useCallback(
    (id, seasonNumber, withEarlier) => {
      const title = titles[id]
      const season = title.seasons.find((s) => s.number === seasonNumber)
      const mine = season.episodes.map((ep) => ({
        kind: 'episode',
        key: episodeKey(id, seasonNumber, ep.number),
      }))
      if (!withEarlier) {
        addWatched(id, mine, `Season ${seasonNumber} watched`)
        return
      }
      const behind = unwatchedBeforeSeason(title, seasonNumber, effRef.current.watchedEpisodes)
      addWatched(
        id,
        [...behind.map((e) => ({ kind: 'episode', key: e.key })), ...mine],
        `Caught up through season ${seasonNumber}`
      )
    },
    [titles, addWatched]
  )

  const markSeason = useCallback(
    (id, seasonNumber) => {
      const behind = unwatchedBeforeSeason(titles[id], seasonNumber, effRef.current.watchedEpisodes)
      if (behind.length && prefs.previousSeasons === ASK) {
        setAskCatchUp({ scope: 'season', id, season: seasonNumber })
        return
      }
      markSeasonMarks(id, seasonNumber, behind.length > 0 && prefs.previousSeasons === ALWAYS)
    },
    [titles, prefs, markSeasonMarks]
  )

  /**
   * Put a whole season back to unwatched.
   *
   * The inverse of *Mark season watched*, and the only way to take that button
   * back in one move — un-ticking twenty-odd checkboxes to undo one tap is not
   * a symmetry anyone should have to live with.
   */
  const unmarkSeason = useCallback(
    (id, seasonNumber) => {
      const season = titles[id].seasons.find((s) => s.number === seasonNumber)
      removeWatchedMany(
        id,
        season.episodes.map((ep) => ({ kind: 'episode', key: episodeKey(id, seasonNumber, ep.number) })),
        // However the season came to be watched: in one tap, or an episode at
        // a time — including the episodes a friend marked on a shared show.
        [`Season ${seasonNumber} watched`, ...season.episodes.map((ep) => episodeCode(seasonNumber, ep.number))]
      )
    },
    [titles, removeWatchedMany]
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
      else {
        addWatched(id, [{ kind: 'movie', key: id }], 'Watched')
        settleMovie(id)
      }
    },
    [addWatched, removeWatched, settleMovie]
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

  /**
   * Take up an invitation to watch something together.
   *
   * Saying yes is a decision to watch the thing, so it joins your watchlist —
   * exactly what accepting a recommendation does. The mark goes into your own
   * record rather than onto the share: the share already queues the title
   * while it is live, and what your watchlist holds should outlive it and
   * stay yours to take back.
   */
  const acceptInvite = useCallback(
    async (id) => {
      const share = socialRef.current.shares.find((sh) => sh.id === id)
      const error = await socialAction(() => acceptShare(id))
      if (error) return error
      if (share) mutate((u) => applyMark(u, { kind: 'watchlist', key: share.title_id }))
      return null
    },
    [socialAction, mutate]
  )

  // --- Recommendations -----------------------------------------------------

  /** Everything anyone has recommended to you, newest question first. */
  const incomingRecs = useMemo(
    () =>
      social.recommendations
        .filter((r) => r.recipient === myId)
        .slice()
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    [social.recommendations, myId]
  )

  const sentRecs = useMemo(
    () => social.recommendations.filter((r) => r.sender === myId),
    [social.recommendations, myId]
  )

  /**
   * The open ones to ask about now: not yet answered, not put off until later
   * — or put off and asked for anyway, which is what `answerNow` holds.
   */
  const queuedRecs = useMemo(
    () =>
      incomingRecs.filter(
        (r) =>
          r.status === 'pending' &&
          !peeked.has(r.id) &&
          (answerNow.has(r.id) || !r.remind_at || Date.parse(r.remind_at) <= now)
      ),
    [incomingRecs, peeked, answerNow, now]
  )

  /**
   * Responding ends the session override: a recommendation pulled forward with
   * *Decide now* and then put off again is put off, and asking to answer it
   * now must not outlive the answer.
   */
  const clearOverride = useCallback((id) => {
    setAnswerNow((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const answerRec = useCallback(
    (id, status) => {
      clearOverride(id)
      return socialAction(() => answerRecommendation(id, status))
    },
    [clearOverride, socialAction]
  )

  const acceptRec = useCallback(
    (id, recTitleId) => {
      addToWatchlist(recTitleId)
      return answerRec(id, 'accepted')
    },
    [addToWatchlist, answerRec]
  )

  const deferRec = useCallback(
    (id) => {
      clearOverride(id)
      return socialAction(() => deferRecommendation(id))
    },
    [clearOverride, socialAction]
  )

  const dropRec = useCallback((id) => socialAction(() => dropRecommendation(id)), [socialAction])

  /**
   * The one recommendation being asked about right now.
   *
   * They arrive one at a time even when several are waiting — three films at
   * once is a list to get through, not a question to answer — so the prompt
   * says how many are behind it and the next takes its place once this one is
   * settled.
   */
  const prompt = useMemo(() => {
    const r = queuedRecs[0]
    if (!r) return null
    const t = titles[r.title_id]
    return {
      id: r.id,
      title: t || null,
      name: t?.name || 'A title',
      meta: t
        ? [t.year || null, t.type === 'show' ? 'show' : 'film', t.genres?.[0] || null]
            .filter(Boolean)
            .join(' · ')
        : '',
      from: nameOf(r.sender),
      note: r.note || '',
      remaining: queuedRecs.length - 1,
      deferDays: DEFER_DAYS,
      onAccept: () => acceptRec(r.id, r.title_id),
      onIgnore: () => answerRec(r.id, 'ignored'),
      onDefer: () => deferRec(r.id),
      // Looking first is not an answer: the recommendation stays open, and
      // the title screen carries the same three buttons.
      onOpen: () => {
        setPeeked((prev) => new Set(prev).add(r.id))
        openTitle(r.title_id)
      },
    }
  }, [queuedRecs, titles, nameOf, acceptRec, answerRec, deferRec, openTitle])

  /**
   * Recommendations as the Account tab lists them: the ones you have sent and
   * are waiting on, and the ones you put off — the only place a deferred
   * recommendation is reachable before its three days are up.
   */
  const recommendRows = useMemo(() => {
    const row = (r, userId) => ({
      id: r.id,
      titleId: r.title_id,
      name: titleName(r.title_id),
      username: nameOf(userId),
      note: r.note || '',
    })
    const asking = new Set(queuedRecs.map((r) => r.id))
    return {
      waiting: incomingRecs
        .filter((r) => r.status === 'pending' && !asking.has(r.id))
        .map((r) => ({ ...row(r, r.sender), deferred: !peeked.has(r.id) })),
      sent: sentRecs.filter((r) => r.status === 'pending').map((r) => row(r, r.recipient)),
    }
  }, [incomingRecs, sentRecs, queuedRecs, peeked, titleName, nameOf])

  /**
   * Bring one back to the front: it stops being looked away from, and a
   * deferral is overridden for this session rather than written away — the
   * reader asked to answer it now, which is not the same as un-deferring it.
   */
  const decideRec = useCallback((id) => {
    setPeeked((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setAnswerNow((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])

  // The Recommend dialog belongs to the title it was opened from, so leaving
  // that title closes it rather than carrying it to the next one.
  const [recommending, setRecommending] = useState(false)
  useEffect(() => setRecommending(false), [titleId])

  /** The Recommend dialog on a title: one row per friend, with where it stands. */
  const recommend = useMemo(() => {
    if (!titleId) return null
    const mine = sentRecs.filter((r) => r.title_id === titleId)
    const rows = friends.map((f) => {
      const r = mine.find((x) => x.recipient === f.userId)
      return {
        userId: f.userId,
        username: f.username,
        state: !r ? 'none' : r.status === 'pending' ? 'sent' : r.status,
        recommendationId: r?.id || null,
      }
    })
    return {
      name: titleName(titleId),
      rows,
      noteMax: RECOMMENDATION_NOTE_MAX,
      onSend: async (friendIds, note) => {
        const results = await Promise.all(
          friendIds.map((friendId) =>
            sendRecommendation(myId, friendId, titleId, note).catch((err) => ({ error: err.message }))
          )
        )
        await refreshSocial()
        return results.find((r) => r.error)?.error || null
      },
      onWithdraw: (id) => dropRec(id),
    }
  }, [titleId, sentRecs, friends, titleName, myId, refreshSocial, dropRec])

  /*
   * The open catch-up question, written out: what is behind the mark, what
   * each answer will do, and where the switch that silences it stands.
   *
   * It is derived rather than stored, so the counts it quotes are the counts
   * as of this render, and a gap that closes underneath the dialog — a shared
   * mark, a sync landing — simply retires the question.
   */
  const catchUpPrompt = useMemo(() => {
    if (!askCatchUp || !user) return null
    const { scope, id, season, episode } = askCatchUp
    const title = titles[id]
    if (!title || title.type !== 'show') return null

    const behind =
      scope === 'season'
        ? unwatchedBeforeSeason(title, season, user.watchedEpisodes)
        : unwatchedBeforeEpisode(title, season, episode, user.watchedEpisodes)
    if (!behind.length) return null

    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
    const seasonsBehind = new Set(behind.map((e) => e.season))
    const done = () => setAskCatchUp(null)

    /*
     * One answer, applied now and — when the reader asked for it — kept as the
     * standing answer to this question. The saved value is the answer itself
     * rather than a flag, so silencing the dialog on *Yes* keeps catching you
     * up and silencing it on *No* stops, which is what pressing each of them
     * meant in the first place.
     */
    const answer = (withEarlier, run) => (remember) => {
      if (remember) {
        setPref(scope === 'season' ? 'previousSeasons' : 'previousEpisodes', withEarlier ? ALWAYS : NEVER)
      }
      run()
      done()
    }

    const common = { name: title.name, onCancel: done }

    if (scope === 'season') {
      return {
        ...common,
        heading: 'Have you watched all the previous seasons?',
        detail: `You're marking season ${season} watched, but ${plural(
          behind.length,
          'episode'
        )} across ${plural(seasonsBehind.size, 'earlier season')} ${
          behind.length === 1 ? 'is' : 'are'
        } still unmarked.`,
        yesLabel: 'Yes — mark those too',
        noLabel: 'No — just this season',
        onYes: answer(true, () => markSeasonMarks(id, season, true)),
        onNo: answer(false, () => markSeasonMarks(id, season, false)),
      }
    }

    return {
      ...common,
      heading: 'Have you watched all the previous episodes?',
      detail: `You're marking ${episodeCode(season, episode)} watched, but ${plural(
        behind.length,
        'earlier episode'
      )} in season ${season} ${behind.length === 1 ? 'is' : 'are'} still unmarked.`,
      yesLabel: 'Yes — mark those too',
      noLabel: 'No — just this episode',
      onYes: answer(true, () => markEpisode(id, season, episode, true)),
      onNo: answer(false, () => markEpisode(id, season, episode, false)),
    }
  }, [askCatchUp, user, titles, setPref, markSeasonMarks, markEpisode])

  // A question that answered itself — the gap behind the mark closed while it
  // was open — is put down rather than left half-held.
  useEffect(() => {
    if (askCatchUp && !catchUpPrompt) setAskCatchUp(null)
  }, [askCatchUp, catchUpPrompt])

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
      acceptInvite,
      declineInvite: (id) => socialAction(() => dropShare(id)),
      stopSharing: (id) => socialAction(() => endShare(id)),
      recommendationsWaiting: recommendRows.waiting,
      recommendationsSent: recommendRows.sent,
      decideRecommendation: decideRec,
      withdrawRecommendation: dropRec,
      // The prompts are settings of this device, not of the account, so they
      // are here for everyone — signed in or not.
      prefs,
      setPref,
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
      acceptInvite,
      recommendRows,
      decideRec,
      dropRec,
      prefs,
      setPref,
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
      onAccept: acceptInvite,
      onDecline: (id) => socialAction(() => dropShare(id)),
      onStop: (id) => socialAction(() => endShare(id)),
    }
  }, [titleId, social.shares, friends, myId, profile, refreshSocial, socialAction, acceptInvite])

  // --- Derived views -------------------------------------------------------

  const queue = useMemo(() => {
    if (!user) return []
    return Object.values(titles).filter((t) => {
      if (t.partial) return false
      if (pinned[t.id]) return true
      // Saying you have started a film queues it, the same as watchlisting it —
      // otherwise Start watching would move it into a section it cannot reach.
      const queued =
        user.watchlist.includes(t.id) || sharedTitleIds.has(t.id) || user.startedMovies.has(t.id)
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
          const started = !watched && user.startedMovies.has(id)
          return {
            id,
            title,
            name: title.name,
            group: watched || started ? 'watching' : 'new',
            kind: 'movie',
            done: watched,
            doneLabel: 'Watched',
            // A film has no episode to name, so the line says where you are
            // with it instead. No percentage is invented for a started film —
            // nothing here knows how far in you are.
            code: started ? 'Watching' : 'Film',
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

        const watchedCount = counts(title, user.watchedEpisodes).watched
        return {
          id,
          title,
          name: title.name,
          group: watchedCount > 0 ? 'watching' : 'new',
          kind: 'show',
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

  /*
   * Up Next in two halves: what you are part-way through, then what is
   * waiting to be started — each split into shows and films.
   *
   * The order inside a group is the order `cards` already settled on, so
   * sectioning re-files a card without moving it relative to its neighbours,
   * and an empty group is dropped rather than drawn as an empty box.
   */
  const sections = useMemo(() => {
    const pick = (group, kind) => cards.filter((c) => c.group === group && c.kind === kind)
    return [
      { key: 'watching', label: 'Currently watching' },
      { key: 'new', label: "Haven't started yet" },
    ]
      .map(({ key, label }) => {
        const groups = [
          { key: `${key}-shows`, label: 'Shows', cards: pick(key, 'show') },
          { key: `${key}-movies`, label: 'Movies', cards: pick(key, 'movie') },
        ].filter((g) => g.cards.length > 0)
        return { key, label, groups, count: groups.reduce((n, g) => n + g.cards.length, 0) }
      })
      .filter((section) => section.count > 0)
  }, [cards])

  const toggleSection = useCallback((key) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      writeCollapsed(next)
      return next
    })
  }, [])

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
    const movieStarted = !movieWatched && user.startedMovies.has(t.id)
    // A recommendation you opened the title to think about is still open, so
    // the screen carries it: who sent it, and the way back to answering.
    const openRec = incomingRecs.find((r) => r.title_id === t.id && r.status === 'pending')

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
      // Recommending needs an account with a username, the same as everything
      // else that names a friend.
      canRecommend: !!myId && !!profile,
      onRecommend: () => setRecommending(true),
      recommendedBy: openRec ? nameOf(openRec.sender) : null,
      onDecideRecommendation: openRec ? () => decideRec(openRec.id) : null,
      movieWatched,
      movieLabel: movieWatched ? 'Watched — undo' : 'Mark watched',
      onToggleMovie: () => toggleMovie(t.id),
      movieStarted,
      // Hidden once the film is watched: there is nothing left to start.
      startedLabel: movieStarted ? 'Watching — undo' : 'Start watching',
      onToggleStarted: movieWatched ? null : () => toggleStarted(t.id),
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
              // One action per season, and always the one that isn't already
              // true of it: fill it in, or — once it is full — empty it again.
              watchedAll: watched === se.episodes.length,
              markLabel: watched === se.episodes.length ? 'Mark season unwatched' : 'Mark season watched',
              onToggle: () => setOpenSeasons((prev) => ({ ...prev, [key]: !open })),
              onMarkAll: () =>
                watched === se.episodes.length ? unmarkSeason(t.id, se.number) : markSeason(t.id, se.number),
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
    incomingRecs,
    nameOf,
    myId,
    profile,
    decideRec,
    toggleWatchlist,
    toggleMovie,
    toggleStarted,
    rate,
    markSeason,
    unmarkSeason,
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
        {/* Above the screens rather than in them: one note, in one place, on every tab. */}
        <DonationBanner />

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
          <UpNext
            sections={sections}
            collapsed={collapsed}
            onToggleSection={toggleSection}
            empty={cards.length === 0}
            dark={dark}
            onDiscover={() => goTab('discover')}
          />
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

      {loaded && recommending && recommend && (
        <RecommendDialog recommend={recommend} onClose={() => setRecommending(false)} />
      )}

      {/*
        A catch-up question is about the tap that just happened, so it comes
        first and holds everything else back until it is answered.
      */}
      {loaded && catchUpPrompt && <CatchUpPrompt prompt={catchUpPrompt} />}

      {/*
        An incoming recommendation is a question, so it is asked rather than
        filed: it comes up over whatever screen you are on, and the next one
        takes its place once this one is answered. The send dialog holds it
        back for a moment — two popups at once is neither question answered.
      */}
      {loaded && prompt && !recommending && !catchUpPrompt && <RecommendationPrompt prompt={prompt} dark={dark} />}

      <TabBar tab={tab} onSelect={goTab} />
    </div>
  )
}
