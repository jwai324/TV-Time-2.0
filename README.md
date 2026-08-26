# Tideline

A TV and film tracker built from the Claude Design artboard in
[`Tideline App.dc.html`](./Tideline%20App.dc.html). It keeps the shows you are
part-way through in front of you, and marks the tide line on each one as you
work down the list.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle into dist/
npm run preview  # serve the built bundle
```

## The five screens

| Screen | What it does |
| --- | --- |
| **Up Next** | Your queue: shows mid-progress (most recent activity first), then watchlisted shows you haven't started and watchlisted films — each with a one-tap **Mark watched** and an **Undo** that steps back. |
| **Library** | Everything you track, filtered by All / Shows / Movies / Watchlist / Finished and sorted by recent activity (ties broken by the most hours left to watch), title, or progress. |
| **Title detail** | Poster, synopsis and progress. Shows get season accordions with per-episode checkboxes, **Catch up**, and **Mark season watched**; films get a watched toggle and a five-star rating. |
| **Discover** | TMDB search plus this week's trending row. Watchlist pills throughout. |
| **Stats** | Hours watched, episodes this month, current streak, titles tracked, and a top-genres chart. |

## How the code maps to the design

The artboard carries its logic in a `DCLogic` class with a single `renderVals()`
method. That has been split along its natural seams rather than transcribed:

```
src/
  App.jsx              state, actions, and the view models renderVals() produced
  main.jsx             entry point
  index.css            design tokens, tidedrift keyframes, focus/hover states
  data/catalog.js      getTitle / getTrending / searchTitles — the title source
  lib/user.js          the user record, seeding, and its localStorage round-trip
  lib/progress.js      progress maths, next-episode lookup, poster colour
  components/          TideBar, Poster, TabBar
  screens/             UpNext, Library, TitleDetail, Discover, Stats
```

Every colour, type ramp, radius and spacing value is carried over unchanged, so
the built app matches the artboard pixel for pixel. Two details worth naming:

- **The tide bar.** `TideBar` is the progress track with the crest riding its
  waterline. The crest drifts sideways forever via the `tidedrift` keyframes and
  slides to its new position when `animate` is set — that slide, paired with the
  episode line fading out and back in, is what sells *Mark watched*.
- **`style-hover` / `style-focus`.** The design DSL expresses interaction states
  as attributes. Those became one class per state in `index.css`, so each
  element keeps the exact focus-ring offset and radius it was drawn with.

## Behaviour carried over verbatim

These are deliberate choices in the design's logic, not accidents, so they are
reproduced as-is:

- A show you *just* finished stays on Up Next reading **All caught up** until
  the next load, rather than vanishing under your tap — it sinks to the bottom
  of the list so what is still in progress stays on top.
- Up Next fixes its order when first built and holds it, so cards never
  reshuffle while you are working down the list; sinking a caught-up show is
  the one exception.
- A season opens by default when it holds your next unwatched episode — which
  means a season you fully complete closes itself.
- `episodes this month` counts single-episode activity only; *Catch up* and
  *Mark season watched* log their own labels and are excluded.

## Data

Titles come from [TMDB](https://www.themoviedb.org/), behind the same three
async functions the app has always used — `getTitle`, `getTrending`,
`searchTitles` in `src/data/catalog.js`. Requests go through the `tmdb`
Supabase Edge Function (`supabase/functions/tmdb/index.ts`), which attaches
the secret TMDB read token server-side and allows only read-only catalog
paths, so no credential ships in the bundle. The function needs a
`TMDB_TOKEN` secret set in the Supabase dashboard.

Ids carry the media type (`tv-1396`, `movie-603`) because TMDB's movie and TV
id spaces overlap. Two mapping decisions to know about: season 0 ("Specials")
is dropped, and unaired episodes are excluded — otherwise a current show could
never reach 100% and "next up" would point at an episode that doesn't exist
yet. Search and trending return light summaries; the full record (seasons,
genres, runtimes) is fetched when a title is opened or watchlisted.

A first run starts empty — find something real on Discover.
[docs/wiring-up-tmdb.md](./docs/wiring-up-tmdb.md) documents the whole
integration.

## State, storage and sync

Your record — watched episodes, watched films, watchlist, ratings, activity —
persists to `localStorage` under `tideline.user.v1`. Sets do not survive JSON,
so they are stored as arrays and rehydrated on read. When storage is
unavailable (private browsing, a blocked origin), the app says so in a banner
and runs from memory for the session.

Signing in (the Account card on Stats) syncs that same record to a Supabase
project — one `user_state` row per user holding the record as jsonb, guarded
by row-level security so each user can only ever touch their own row. The app
stays a static bundle: `supabase-js` talks to the project straight from the
browser, so nothing about the GitHub Pages hosting changes, and the
publishable key in `src/lib/supabase.js` is the client key Supabase designs
to be shipped publicly.

How the sync behaves:

- **Guest mode is untouched.** Without an account everything works exactly as
  before, on this device only.
- **First sign-in adopts this device.** If the account has no record yet,
  whatever you see locally becomes the account's record. After that, the
  account is the source of truth on every device you sign in on.
- **Every change pushes.** Mutations write localStorage first (so the app
  never waits on the network), then upsert the record to the account. If the
  push fails, a banner says changes are safe on this device, and the next
  successful change re-syncs.
- Account creation may ask you to confirm your email; the confirmation link's
  landing page is configured in the Supabase dashboard (Auth → URL
  Configuration), so set the Site URL there to the deployed URL if you want
  that link to land somewhere sensible.

## Theme

The design carries `darkMode` and `freshStart` as editor props with no UI behind
them. In the app, **theme follows the operating system** and both stay reachable
as query params:

- `?theme=dark` / `?theme=light` — override the system preference
- `?fresh=1` — start from an empty library, without touching what is stored

Adding a theme toggle would have meant drawing a control the design does not
have, so this is the one place the implementation had to make a call.

## Accessibility

Tap targets meet 44px, focus rings are the design's own aqua at the offsets it
specifies, `prefers-reduced-motion` disables the crest drift and every
transition, and the tab bar marks the current screen with `aria-current`. The
star rating declares `role="radiogroup"` as the design does, with each star a
`role="radio"` carrying `aria-checked` so the group is valid to a screen reader.

## Verification

Driven end to end in Chromium: 57 checks across all five screens covering
marking, catch-up, season completion, filters, all three sort orders, search by
title and by genre, watchlist toggles, rating (including clearing it),
persistence across a reload, empty states, and the dark theme.
