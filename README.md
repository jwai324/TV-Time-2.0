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
| **Up Next** | Every show you are mid-way through, most recent activity first, each with its next unwatched episode, a one-tap **Mark watched**, and an **Undo** that steps back one episode. |
| **Library** | Everything you track, filtered by All / Shows / Movies / Watchlist / Finished and sorted by recent activity, title, or progress. |
| **Title detail** | Poster, synopsis and progress. Shows get season accordions with per-episode checkboxes, **Catch up**, and **Mark season watched**; films get a watched toggle and a five-star rating. |
| **Discover** | Search across titles and genres, plus a trending row. Watchlist pills throughout. |
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
  the next load, rather than vanishing under your tap.
- Up Next fixes its order when first built and holds it, so cards never
  reshuffle while you are working down the list.
- A season opens by default when it holds your next unwatched episode — which
  means a season you fully complete closes itself.
- `episodes this month` counts single-episode activity only; *Catch up* and
  *Mark season watched* log their own labels and are excluded.

## Data

`src/data/catalog.js` is an in-memory table of fictional titles behind three
async functions — `getTitle`, `getTrending`, `searchTitles`. Nothing else
touches it, so swapping in a real API is a change to that one file.

A first run seeds a lived-in library (six shows in progress, five films
watched, five on the watchlist) so every screen has something to show.

## State and storage

Your record — watched episodes, watched films, watchlist, ratings, activity —
persists to `localStorage` under `tideline.user.v1`. Sets do not survive JSON,
so they are stored as arrays and rehydrated on read. When storage is
unavailable (private browsing, a blocked origin), the app says so in a banner
and runs from memory for the session.

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
