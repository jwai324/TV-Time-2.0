// TMDB proxy (Neon Function): forwards an allowlisted read-only catalog path
// to api.themoviedb.org with the secret token attached, so the token never
// reaches the browser. The allowlist is the access control: only public
// catalog reads can pass through, so the function itself is public.
//
// Deployed as slug `tmdb` on the `tideline` Neon project. TMDB_TOKEN is set as
// the function's environment variable in the Neon Console, never committed.
const ALLOWED = /^\/3\/(search\/multi|trending\/all\/week|genre\/(movie|tv)\/list|discover\/(movie|tv)|movie\/(popular|top_rated|now_playing|upcoming)|tv\/(popular|top_rated|on_the_air)|movie\/\d+(\/recommendations)?|tv\/\d+(\/season\/\d+|\/recommendations)?)$/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const token = process.env.TMDB_TOKEN
  if (!token) return json(500, { error: 'TMDB_TOKEN is not set' })

  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  const target = new URL('https://api.themoviedb.org' + path)
  if (target.origin !== 'https://api.themoviedb.org' || !ALLOWED.test(target.pathname)) {
    return json(403, { error: 'path not allowed' })
  }
  for (const [k, v] of url.searchParams) if (k !== 'path') target.searchParams.set(k, v)

  const res = await fetch(target, { headers: { Authorization: `Bearer ${token}` } })
  return new Response(res.body, {
    status: res.status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      // Catalog data changes slowly; let caches soak up repeat requests.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
