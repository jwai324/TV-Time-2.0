import { createClient } from '@neon/neon-js/supabase'

/*
 * The Neon project "tideline": Neon Auth (Managed Better Auth) for accounts,
 * and the Data API for the tables. Both URLs are public by design — access to
 * data is governed by row-level security on the server, keyed to the signed-in
 * user's token, not by hiding these values.
 *
 * `allowAnonymous` lets calls made before sign-in (checking a username at
 * sign-up) carry an anonymous token; they run as the `anonymous` role, which
 * can execute username_available() and nothing else.
 */
const AUTH_URL = 'https://ep-proud-heart-bcar56vf.neonauth.c-16.us-east-1.aws.neon.tech/neondb/auth'
const DATA_API_URL = 'https://ep-proud-heart-bcar56vf.apirest.c-16.us-east-1.aws.neon.tech/neondb/rest/v1'

/*
 * What an email link brought back. A password-reset link lands with
 * `?token=…`, which is spent by choosing the new password; an expired or
 * already-used one lands with `?error=…`. Both are read here and taken off
 * the URL so a reload does not repeat them.
 */
const landing = new URLSearchParams(window.location.search)
export const resetToken = landing.get('token')
export const linkError = landing.get('error')
  ? 'That reset link has expired or was already used. Ask for a new one below.'
  : null
if (landing.has('token') || landing.has('error')) {
  landing.delete('token')
  landing.delete('error')
  const rest = landing.toString()
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash
  )
}

export const db = createClient({
  auth: { url: AUTH_URL, allowAnonymous: true },
  dataApi: { url: DATA_API_URL },
})

/** Spend a reset link's token on a new password. Resolves to an error message or null. */
export async function resetPassword(token, newPassword) {
  const { error } = await db.auth.getBetterAuthInstance().resetPassword({ newPassword, token })
  return error ? error.message || 'Could not save that password.' : null
}
