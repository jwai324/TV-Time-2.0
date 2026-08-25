# Wiring up TMDB

A step-by-step guide to replacing Tideline's fictional catalog with real data
from [The Movie Database](https://www.themoviedb.org/) (TMDB).

> **Status: implemented** via Option A (the Supabase Edge Function proxy).
> The function is deployed as `tmdb`; the one manual step is setting the
> `TMDB_TOKEN` secret in the Supabase dashboard (Project Settings → Edge
> Functions → Secrets). This document remains as the design record.

## Why this is a small change

Every screen gets its titles through exactly three async functions in
`src/data/catalog.js`:

```js
getTitle(id)       // one full title: seasons, episodes, runtimes
getTrending()      // the Discover row
searchTitles(q)    // Discover search
```

Nothing else in the app knows where titles come from, and the functions are
already async. Wiring TMDB means re-implementing those three functions and a
mapping layer — no screen, state, or sync code changes. Your Supabase record
stores only *your* data (watched keys, watchlist, ratings) against title ids,
so it is untouched by the catalog swap.

---

## Step 0 — Get TMDB credentials

1. Create a free account at themoviedb.org.
2. Go to **Settings → API** and register for an API key (personal /
   non-commercial is instant).
3. Copy the **API Read Access Token** (the long `eyJ…` v4 token, not the short
   v3 key). It is sent as a `Authorization: Bearer` header.

## Step 1 — Decide where the token lives

Two workable options; A is the recommended one because the project already has
Supabase.

### Option A (recommended): proxy through a Supabase Edge Function

The token stays server-side in Supabase secrets; the browser calls your
function, the function calls TMDB. You also get one place to add caching
later.

Create `supabase/functions/tmdb/index.ts`:

```ts
// Forwards an allowlisted TMDB path with the secret token attached.
// The browser never sees the token.
const ALLOWED = /^\/3\/(search\/multi|trending\/all\/week|movie\/\d+|tv\/\d+(\/season\/\d+)?)$/

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  const target = new URL('https://api.themoviedb.org' + path)
  if (!ALLOWED.test(target.pathname)) {
    return new Response('forbidden', { status: 403, headers: cors })
  }
  for (const [k, v] of url.searchParams) if (k !== 'path') target.searchParams.set(k, v)

  const res = await fetch(target, {
    headers: { Authorization: `Bearer ${Deno.env.get('TMDB_TOKEN')}` },
  })
  return new Response(res.body, {
    status: res.status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
```

Deploy it and set the secret (Supabase CLI, or ask Claude — the MCP tools can
deploy edge functions):

```sh
supabase functions deploy tmdb --project-ref heaficaxneggnsayrrzs
supabase secrets set TMDB_TOKEN=eyJ... --project-ref heaficaxneggnsayrrzs
```

The fetch helper in the app then becomes:

```js
const PROXY = 'https://heaficaxneggnsayrrzs.supabase.co/functions/v1/tmdb'

async function tmdb(path, params = {}) {
  const url = new URL(PROXY)
  url.searchParams.set('path', path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` }, // the publishable key
  })
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}
```

### Option B (quicker): call TMDB straight from the browser

TMDB's API sends CORS headers, so direct browser calls work from GitHub
Pages. The read token then ships in the bundle — visible to anyone, like any
client-embedded key. TMDB's read token can only read public catalog data, so
many hobby apps accept this. If you do:

1. Put it in `.env.local` (gitignored): `VITE_TMDB_TOKEN=eyJ...`
2. Read it with `import.meta.env.VITE_TMDB_TOKEN`.
3. For the deployed build, add it as a GitHub Actions secret and pass it in
   the build step of `.github/workflows/deploy.yml`:

```yaml
      - run: npm run build
        env:
          VITE_TMDB_TOKEN: ${{ secrets.VITE_TMDB_TOKEN }}
```

```js
async function tmdb(path, params = {}) {
  const url = new URL('https://api.themoviedb.org' + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_TMDB_TOKEN}` },
  })
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}
```

## Step 2 — Pick an id scheme

TMDB movie ids and TV ids are separate numeric spaces that overlap, so encode
the type into the app's string ids:

```js
export const tmdbId = (mediaType, id) => `${mediaType === 'movie' ? 'movie' : 'tv'}-${id}`
// 'tv-1396', 'movie-603'
const parseId = (id) => {
  const [, type, num] = id.match(/^(tv|movie)-(\d+)$/) ?? []
  return type ? { type, num } : null
}
```

Everything downstream already treats ids as opaque strings — watched-episode
keys become `tv-1396:2:5` and keep working.

## Step 3 — Map TMDB responses to Tideline's title shape

The app expects this shape (see the old `catalog.js` for reference):

```
{ id, name, type: 'show' | 'movie', year, genres: [names],
  status: 'returning' | 'ended',        // shows only
  posterHue, posterUrl,                 // posterBg() prefers posterUrl,
                                        // falls back to the hue swatch
  runtimeMinutes, overview,
  seasons: [{ number, episodes: [{ number, name, runtimeMinutes, airDate }] }] }
```

Mapping code:

```js
const IMG = 'https://image.tmdb.org/t/p/w342'
const today = () => new Date().toISOString().slice(0, 10)

// Deterministic hue from the id so the swatch/wash tint stays stable.
const hueOf = (id) => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

const yearOf = (date) => (date ? Number(date.slice(0, 4)) : 0)

function mapMovie(m) {
  const id = tmdbId('movie', m.id)
  return {
    id, name: m.title, type: 'movie',
    year: yearOf(m.release_date),
    genres: (m.genres ?? []).map((g) => g.name),
    posterHue: hueOf(id),
    posterUrl: m.poster_path ? IMG + m.poster_path : null,
    runtimeMinutes: m.runtime || 120,
    overview: m.overview || '',
    seasons: [],
  }
}

function mapShow(tv, seasonDetails) {
  const id = tmdbId('tv', tv.id)
  const fallbackRt = tv.episode_run_time?.[0] || 45
  return {
    id, name: tv.name, type: 'show',
    year: yearOf(tv.first_air_date),
    genres: (tv.genres ?? []).map((g) => g.name),
    status: tv.status === 'Returning Series' ? 'returning' : 'ended',
    posterHue: hueOf(id),
    posterUrl: tv.poster_path ? IMG + tv.poster_path : null,
    runtimeMinutes: fallbackRt,
    overview: tv.overview || '',
    seasons: seasonDetails
      .filter((s) => s.season_number > 0)             // drop "Specials"
      .map((s) => ({
        number: s.season_number,
        episodes: (s.episodes ?? [])
          .filter((ep) => ep.air_date && ep.air_date <= today())  // aired only
          .map((ep) => ({
            number: ep.episode_number,
            name: ep.name,
            runtimeMinutes: ep.runtime || fallbackRt,
            airDate: ep.air_date,
          })),
      }))
      .filter((s) => s.episodes.length > 0),
  }
}
```

Two decisions baked in there worth knowing about:

- **Specials (season 0) are dropped** — Tideline's progress model assumes
  linear seasons.
- **Unaired episodes are dropped** — otherwise a current show can never reach
  100% and "next unwatched" points at an episode that doesn't exist yet.

## Step 4 — Re-implement the three functions

Replace the bodies in `src/data/catalog.js` (keep the same exports; keep an
in-memory cache since `getTitle` is called often):

```js
const cache = new Map()

export async function getTitle(id) {
  if (cache.has(id)) return cache.get(id)
  const parsed = parseId(id)
  if (!parsed) return null            // old fictional ids resolve to nothing

  let title
  if (parsed.type === 'movie') {
    title = mapMovie(await tmdb(`/3/movie/${parsed.num}`))
  } else {
    const tv = await tmdb(`/3/tv/${parsed.num}`)
    // append_to_response fetches up to 20 seasons in ONE request
    const nums = tv.seasons.filter((s) => s.season_number > 0).map((s) => s.season_number)
    const appended = await tmdb(`/3/tv/${parsed.num}`, {
      append_to_response: nums.slice(0, 20).map((n) => `season/${n}`).join(','),
    })
    title = mapShow(tv, nums.map((n) => appended[`season/${n}`]).filter(Boolean))
  }
  cache.set(id, title)
  return title
}

export async function getTrending() {
  const { results } = await tmdb('/3/trending/all/week')
  return results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 10)
    .map(mapSummary)                  // a light card: id, name, type, year, poster
}

export async function searchTitles(query) {
  const q = query.trim()
  if (!q) return []
  const { results } = await tmdb('/3/search/multi', { query: q })
  return results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map(mapSummary)
}

// Search/trending results don't need seasons — a summary is enough for the
// cards. getTitle() fetches the full record when a title is opened, exactly
// as the app already does (openTitle() calls getTitle on demand).
function mapSummary(r) {
  const type = r.media_type === 'movie' ? 'movie' : 'show'
  const id = tmdbId(r.media_type, r.id)
  return {
    id, name: r.title ?? r.name, type,
    year: yearOf(r.release_date ?? r.first_air_date),
    genres: ['—'],                    // detail fetch fills real genres
    posterHue: hueOf(id),
    posterUrl: r.poster_path ? IMG + r.poster_path : null,
    runtimeMinutes: type === 'movie' ? 120 : 45,
    overview: r.overview || '',
    seasons: [],
  }
}
```

One subtlety: the app merges search/trending results into its `titles` map
with `titles[t.id] = titles[t.id] || t` — the summary never overwrites a full
record, and `openTitle()` fetches the full record if the stored one has no
seasons. Check that guard still holds; if you kept the code as-is, change the
merge to prefer records that have `seasons.length > 0`.

## Step 5 — Debounce search

The fictional catalog answered instantly, so `onSearch` queries on every
keystroke. Against a real API, debounce it (in `App.jsx`):

```js
const searchTimer = useRef(null)
const onSearch = useCallback((value) => {
  queryRef.current = value
  setQuery(value)
  if (!value.trim()) { setResults([]); setSearched(false); return }
  clearTimeout(searchTimer.current)
  searchTimer.current = setTimeout(() => {
    searchTitles(value).then((found) => {
      if (queryRef.current !== value) return
      /* same merge as today */
    })
  }, 300)
}, [])
```

The existing `queryRef.current !== value` guard already handles out-of-order
responses; the debounce just cuts the request count.

## Step 6 — Existing saved data

Watched keys, watchlist entries and ratings in localStorage / Supabase
reference the fictional ids (`severance-point`, …). After the swap those ids
return `null` from `getTitle` and silently drop out of the library — no
crash, but the seeded demo history disappears. Options:

- **Accept it** (fine for a personal app going real).
- **Fresh start**: bump `STORAGE_KEY` to `tideline.user.v2` so old records are
  ignored, and start clean.
- Keep the fictional module as a fallback resolver for old ids if you want the
  demo data to coexist (probably not worth it).

Also delete the now-unused fictional table from `catalog.js` once you're done
— it's ~450 lines of dead weight in the bundle otherwise.

## Step 7 — Attribution (required)

TMDB's terms require visible attribution. Add to the Stats screen or footer:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

with the TMDB logo (download from their
[brand page](https://www.themoviedb.org/about/logos-attribution)) linking to
themoviedb.org.

## Step 8 — Test checklist

- [ ] Search "breaking bad" → result opens → seasons expand, episode
      checkboxes work, `Mark watched` advances S01E01 → S01E02.
- [ ] A show with specials (e.g. Doctor Who) shows no "Season 0".
- [ ] A currently-airing show shows only aired episodes and can reach 100%.
- [ ] Trending row renders posters (real art now, not hue swatches).
- [ ] Sign in on a second browser → the same TMDB-id-based record appears.
- [ ] Kill the network in devtools → search fails quietly, marking still
      works locally (and the sync banner appears if signed in).
- [ ] `npm run build` — no `VITE_TMDB_TOKEN` in the bundle if you chose the
      edge-function route: `grep -r eyJ dist/assets` should find nothing.

## Rate limits and caching notes

TMDB allows roughly 50 requests/second — far beyond what one user generates.
The in-memory cache means each title is fetched once per session. If you want
cross-session caching later, the edge function is the place: add
`Cache-Control: public, max-age=86400` to its responses and Supabase's CDN
does the rest.
