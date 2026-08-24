import { createClient } from '@supabase/supabase-js'

/*
 * The publishable key is the browser-side client key by design — access to
 * data is governed by row-level security on the server, not by hiding this
 * value, so it is safe to ship in the bundle.
 */
const SUPABASE_URL = 'https://heaficaxneggnsayrrzs.supabase.co'
const SUPABASE_KEY = 'sb_publishable_9zZ7fwGEISNFXsAOMLRL9A_af-YlM04'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
