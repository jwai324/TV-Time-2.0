// TMDB proxy: forwards an allowlisted read-only catalog path to
// api.themoviedb.org with the secret token attached, so the token never
// reaches the browser. The allowlist is the access control — only public
// catalog reads can pass through, so the function itself is public
// (verify_jwt off; the publishable key is not a JWT).
const ALLOWED = /^\/3\/(search\/multi|trending\/all\/week|movie\/\d+|tv\/\d+(\/season\/\d+)?)$/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const token = Deno.env.get('TMDB_TOKEN')
  if (!token) {
    return new Response(JSON.stringify({ error: 'TMDB_TOKEN secret is not set' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  const target = new URL('https://api.themoviedb.org' + path)
  if (target.origin !== 'https://api.themoviedb.org' || !ALLOWED.test(target.pathname)) {
    return new Response(JSON.stringify({ error: 'path not allowed' }), {
      status: 403,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
  for (const [k, v] of url.searchParams) if (k !== 'path') target.searchParams.set(k, v)

  const res = await fetch(target, { headers: { Authorization: `Bearer ${token}` } })
  return new Response(res.body, {
    status: res.status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      // Catalog data changes slowly; let the CDN soak up repeat requests.
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
