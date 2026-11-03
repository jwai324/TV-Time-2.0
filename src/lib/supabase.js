import { createClient } from '@supabase/supabase-js'

/*
 * The publishable key is the browser-side client key by design — access to
 * data is governed by row-level security on the server, not by hiding this
 * value, so it is safe to ship in the bundle.
 */
const SUPABASE_URL = 'https://heaficaxneggnsayrrzs.supabase.co'
const SUPABASE_KEY = 'sb_publishable_9zZ7fwGEISNFXsAOMLRL9A_af-YlM04'

/*
 * What an email link brought back, read before the client consumes it. A
 * password-reset link arrives with `type=recovery` in the hash; the client
 * signs in from it and clears it, and announces the recovery on a timer that
 * can fire before anything is listening — so it is noted here instead. An
 * expired or already-used link arrives with an error description, which is
 * kept and taken off the URL so a reload does not repeat it.
 */
const landing = new URLSearchParams(window.location.hash.slice(1))
export const arrivedFromRecovery = landing.get('type') === 'recovery'
export const linkError = landing.get('error_description')
if (linkError) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
