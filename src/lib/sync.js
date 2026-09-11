/**
 * The account round-trip, made safe to call as often as the app likes.
 *
 * Two rules keep the account's copy of the record from going backwards.
 *
 * 1. One push at a time. Every tap pushes the whole record, and two pushes
 *    racing over a phone connection can land in the wrong order, leaving the
 *    account holding the older one — which the next reload then adopts. So a
 *    push waits for the one before it, and a record that changes while a push
 *    is in flight goes out afterwards: once, carrying everything that changed
 *    in between.
 *
 * 2. Remember what has not landed. A push that fails leaves this device
 *    holding changes the account never received. That fact is written to
 *    localStorage, so a reload does not adopt the account's older record over
 *    them; the local record is pushed instead. The flag clears only when a
 *    push of the latest record succeeds, or when the local record is replaced
 *    by an account's outright.
 */

export const SYNC_KEY = 'tideline.sync.v1'

const readSync = () => {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}
  } catch {
    return {}
  }
}

const writeSync = (value) => {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(value))
  } catch {
    /* memory-only session; the next successful push still re-syncs */
  }
}

/** Does this device hold changes for `userId` that the account has not received? */
export const hasUnsyncedChanges = (userId) => readSync().dirty === userId

export const markUnsynced = (userId) => writeSync({ dirty: userId })

/** The local record has just been replaced by an account's: nothing is unsynced. */
export const clearUnsynced = () => writeSync({})

/** A push of `userId`'s latest record landed. Another account's flag is left alone. */
export const markSynced = (userId) => {
  if (readSync().dirty === userId) writeSync({})
}

/** Retry a failed push after this long, doubling each time, up to a minute. */
const FIRST_RETRY_MS = 5000
const MAX_RETRY_MS = 60000

/**
 * Serialise pushes: one in flight, the newest record queued behind it.
 *
 * `push(userId, user)` performs the upsert and rejects on failure.
 * `onSettled(ok)` reports each attempt, so the app can show or clear the
 * offline banner.
 */
export function createPusher(push, onSettled) {
  let inflight = null
  let next = null
  let retryTimer = null
  let retryMs = 0

  const cancelRetry = () => {
    if (!retryTimer) return
    clearTimeout(retryTimer)
    retryTimer = null
  }

  const scheduleRetry = () => {
    if (retryTimer) return
    retryMs = Math.min(retryMs ? retryMs * 2 : FIRST_RETRY_MS, MAX_RETRY_MS)
    retryTimer = setTimeout(() => {
      retryTimer = null
      drain()
    }, retryMs)
  }

  async function run() {
    while (next) {
      const job = next
      next = null
      try {
        await push(job.userId, job.user)
        retryMs = 0
        // Only the latest record counts as landed; a newer one is still queued.
        if (!next) markSynced(job.userId)
        onSettled(true)
      } catch {
        // Keep this record for a later attempt, unless a newer one has arrived.
        if (!next) next = job
        onSettled(false)
        scheduleRetry()
        return
      }
    }
  }

  function drain() {
    if (inflight) return inflight
    inflight = run().finally(() => {
      inflight = null
    })
    return inflight
  }

  return {
    /** Queue the latest record; it goes out as soon as the line is free. */
    schedule(userId, user) {
      markUnsynced(userId)
      next = { userId, user }
      cancelRetry()
      drain()
    },
    /** Try again now — on focus, on coming back online, before signing out. */
    flush() {
      cancelRetry()
      return drain() || Promise.resolve()
    },
    /** Forget whatever is queued — after signing out, there is no account to push to. */
    reset() {
      cancelRetry()
      next = null
    },
  }
}
