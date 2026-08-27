/**
 * Usernames, friends, the shares that make two people's "watched" one thing,
 * and the recommendations they pass each other.
 *
 * Everything here is a round-trip against Supabase. The rule the whole
 * feature rests on: nobody ever writes to anybody else's record. A shared
 * mark is a row of its own, readable and writable by both members of the
 * share, and the client reads the union of your own record and the marks of
 * your live shares. So marking an episode marks it for both of you without a
 * single cross-user write, and un-marking it — a delete of that one row —
 * takes it back for both of you just as symmetrically. A recommendation is
 * the same idea in one direction: a row only its recipient can answer.
 */

import { supabase } from './supabase.js'

export const USERNAME_RULE = /^[A-Za-z0-9_]{3,20}$/

/** Human-readable reason a username is not usable, or null when it is fine. */
export function usernameProblem(name) {
  const value = (name || '').trim()
  if (!value) return 'Pick a username.'
  if (value.length < 3) return 'Usernames are at least 3 characters.'
  if (value.length > 20) return 'Usernames are at most 20 characters.'
  if (!USERNAME_RULE.test(value)) return 'Letters, numbers and underscores only.'
  return null
}

/** Free? Answered by a function, so sign-up can ask before there is a session. */
export async function usernameAvailable(name) {
  const { data, error } = await supabase.rpc('username_available', { p_username: name.trim() })
  if (error) throw error
  return data === true
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function claimUsername(userId, name) {
  const username = name.trim()
  const { data, error } = await supabase
    .from('profiles')
    .insert({ user_id: userId, username })
    .select('user_id, username')
    .single()
  // 23505 is the unique violation: someone holds this handle already.
  if (error) throw new Error(error.code === '23505' ? 'That username is taken.' : error.message)
  return data
}

/** The handles behind a set of account ids, as `{ [userId]: username }`. */
export async function fetchProfiles(ids) {
  if (!ids.length) return {}
  const { data, error } = await supabase.from('profiles').select('user_id, username').in('user_id', ids)
  if (error) throw error
  return Object.fromEntries((data || []).map((p) => [p.user_id, p.username]))
}

/** Resolve a handle to an account. Null when nobody holds it. */
export async function findByUsername(name) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username')
    .ilike('username', name.trim())
    .maybeSingle()
  if (error) throw error
  return data
}

// --- friends ---------------------------------------------------------------

export async function fetchFriendships() {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester, addressee, status, created_at')
  if (error) throw error
  return data || []
}

export async function sendFriendRequest(myId, username) {
  const target = await findByUsername(username)
  if (!target) return { error: `No account called ${username.trim()}.` }
  if (target.user_id === myId) return { error: 'That is you.' }

  const { error } = await supabase
    .from('friendships')
    .insert({ requester: myId, addressee: target.user_id, status: 'pending' })
  if (error) {
    if (error.code === '23505') return { error: `You and ${target.username} are already connected.` }
    return { error: error.message }
  }
  return { ok: `Request sent to ${target.username}.` }
}

export async function acceptFriendRequest(id) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Declining, withdrawing and unfriending are all this row going away. */
export async function removeFriendship(id) {
  const { error } = await supabase.from('friendships').delete().eq('id', id)
  if (error) throw error
}

// --- shares ----------------------------------------------------------------

export async function fetchShares() {
  const { data, error } = await supabase
    .from('watch_shares')
    .select('id, title_id, inviter, invitee, status, created_at')
  if (error) throw error
  return data || []
}

export async function inviteToWatch(myId, friendId, titleId) {
  const { data, error } = await supabase
    .from('watch_shares')
    .insert({ title_id: titleId, inviter: myId, invitee: friendId, status: 'pending' })
    .select('id, title_id, inviter, invitee, status')
    .single()
  if (error) {
    if (error.code === '23505') return { error: 'You already have this one going with them.' }
    return { error: error.message }
  }
  return { share: data }
}

export async function acceptShare(id) {
  const { error } = await supabase.from('watch_shares').update({ status: 'accepted' }).eq('id', id)
  if (error) throw error
}

/** Decline or withdraw an invitation that was never accepted. */
export async function dropShare(id) {
  const { error } = await supabase.from('watch_shares').delete().eq('id', id)
  if (error) throw error
}

/**
 * Stop watching something together.
 *
 * The row is ended rather than deleted, and its marks are left in place: the
 * other person may not be online, and those marks are their history too. Each
 * side folds them into their own record the next time it sees the ended share
 * (see `materializeShare` in App), after which the share is inert.
 */
export async function endShare(id) {
  const { error } = await supabase
    .from('watch_shares')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// --- shared marks ----------------------------------------------------------

export async function fetchMarks(shareIds) {
  if (!shareIds.length) return []
  const { data, error } = await supabase
    .from('shared_marks')
    .select('share_id, kind, key, marked_by, marked_at')
    .in('share_id', shareIds)
  if (error) throw error
  return data || []
}

export async function addMarks(shareId, myId, entries) {
  if (!entries.length) return
  const { error } = await supabase.from('shared_marks').upsert(
    entries.map(({ kind, key }) => ({ share_id: shareId, kind, key, marked_by: myId })),
    { onConflict: 'share_id,kind,key', ignoreDuplicates: true }
  )
  if (error) throw error
}

export async function removeMark(shareId, kind, key) {
  const { error } = await supabase
    .from('shared_marks')
    .delete()
    .eq('share_id', shareId)
    .eq('kind', kind)
    .eq('key', key)
  if (error) throw error
}

// --- recommendations -------------------------------------------------------

/** A note is optional; this is as long as one may be. */
export const RECOMMENDATION_NOTE_MAX = 280

/** "Ask me later" is this long — long enough to forget, short enough to matter. */
export const DEFER_DAYS = 3

export async function fetchRecommendations() {
  const { data, error } = await supabase
    .from('recommendations')
    .select('id, title_id, sender, recipient, note, status, remind_at, created_at')
  if (error) throw error
  return data || []
}

/**
 * Put a title in front of a friend.
 *
 * The unique index covers one open recommendation per title per direction, so
 * sending the same one twice is reported rather than duplicated.
 */
export async function sendRecommendation(myId, friendId, titleId, note) {
  const trimmed = (note || '').trim()
  const { error } = await supabase.from('recommendations').insert({
    title_id: titleId,
    sender: myId,
    recipient: friendId,
    note: trimmed ? trimmed.slice(0, RECOMMENDATION_NOTE_MAX) : null,
    status: 'pending',
  })
  if (error) {
    if (error.code === '23505') return { error: 'You have already recommended this to them.' }
    return { error: error.message }
  }
  return {}
}

/** Watchlist it, or pass on it. Either way the question is settled. */
export async function answerRecommendation(id, status) {
  const { error } = await supabase
    .from('recommendations')
    .update({ status, remind_at: null, responded_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/**
 * Push the decision out.
 *
 * The row stays pending — a deferred recommendation is an open question, not
 * an answer — and `remind_at` says when the client should ask again.
 */
export async function deferRecommendation(id, days = DEFER_DAYS) {
  const when = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase.from('recommendations').update({ remind_at: when }).eq('id', id)
  if (error) throw error
}

/** Take back one you sent, or clear one you have already answered. */
export async function dropRecommendation(id) {
  const { error } = await supabase.from('recommendations').delete().eq('id', id)
  if (error) throw error
}

// --- realtime --------------------------------------------------------------

/**
 * Watch everything that can change under you: a friend's mark on a show you
 * share, a request, an invitation, a share ending, a title a friend has just
 * recommended.
 *
 * Marks are subscribed per share rather than table-wide. Realtime cannot
 * apply row-level security to a delete — the old row it sends carries no more
 * than what is replicated — so filtering by the share ids you belong to is
 * what keeps other people's deletes out of your channel.
 */
export function subscribeSocial({ userId, shareIds, onMarks, onSocial }) {
  const channel = supabase.channel(`tideline:${userId}`)

  shareIds.forEach((id) => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shared_marks', filter: `share_id=eq.${id}` },
      (payload) => onMarks(payload)
    )
  })

  ;[
    ['friendships', 'requester'],
    ['friendships', 'addressee'],
    ['watch_shares', 'inviter'],
    ['watch_shares', 'invitee'],
    ['recommendations', 'sender'],
    ['recommendations', 'recipient'],
  ].forEach(([table, column]) => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `${column}=eq.${userId}` },
      () => onSocial()
    )
  })

  channel.subscribe()
  return () => supabase.removeChannel(channel)
}
