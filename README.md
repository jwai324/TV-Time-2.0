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

## The six screens

| Screen | What it does |
| --- | --- |
| **Up Next** | Your queue in two collapsible sections — **Currently watching** over **Haven't started yet**, each split into Shows and Movies — with a one-tap **Mark watched** and an **Undo** that steps back. |
| **Library** | Everything you track, filtered by All / Shows / Movies / Watchlist / Finished and sorted by recent activity (ties broken by the most hours left to watch), title, or progress. |
| **Title detail** | Poster, synopsis and progress. Shows get season accordions with per-episode checkboxes, **Catch up**, and a season button that reads **Mark season watched** or **Mark season unwatched** depending on where the season stands; films get a watched toggle, **Start watching**, and a five-star rating. |
| **Discover** | TMDB search plus this week's trending row. Watchlist pills throughout. |
| **Stats** | Hours watched, episodes this month, current streak, titles tracked, and a top-genres chart. |
| **Account** | Your username, your friends and the requests waiting on them, every show you are watching with someone, and the **Prompts** switches for the catch-up questions. |

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
  lib/prefs.js         device preferences — whether the catch-up prompts ask
  lib/social.js        usernames, friends, shares, and the marks they carry
  components/          TideBar, Poster, TabBar, DonationBanner, the recommend and catch-up popups
  screens/             UpNext, Library, TitleDetail, Discover, Stats, Account
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

## How Up Next is sorted into sections

The queue is two sections, each split into shows and films:

- **Currently watching** — shows with at least one episode marked, and films
  you have said you have started.
- **Haven't started yet** — everything else waiting: watchlisted shows you
  have not begun, and watchlisted films you have not started.

A section folds away by its header and stays folded across reloads, because a
section you closed is a decision rather than a scroll position. Only the two
outer sections collapse; Shows and Movies inside one are labels, not another
thing to tap, so nothing in the queue is ever more than two taps deep. A
sub-section with nothing in it is left out rather than drawn as an empty box,
and when the whole queue is empty the "Nothing queued" card stands in for all
of it.

Sectioning does not reorder anything. Cards keep the order Up Next already
settled on — most recent activity first, held so nothing reshuffles under your
thumb — and a caught-up show still sinks within its own sub-section rather
than to the bottom of the page.

### Films that are under way

A show tells you where you are by its episodes; a film has no such thing, so
being part-way through one is something you have to say. **Start watching** on
a film's screen moves it from Haven't started yet to Currently watching, and marking it
watched settles the question and takes the flag off. No percentage is invented
for a film in progress — nothing here knows how far into it you are — so its
card says `Watching` where an unstarted film says `Film`, and its tide bar
stays where it was.

Started films are a private note to yourself: unlike watched films, they are
not shared with anyone you are watching the film with, because where you got
to in it is yours.

## Catching up on what you skipped past

Marking something in the middle of a show leaves a question behind. Ticking
S03E07 could mean you have watched the six episodes before it and never got
round to marking them, or it could mean you deliberately started there. Only
the person tapping knows which, and the two answers produce very different
records — so the app asks rather than guesses.

Two questions, each raised only when there is a real gap behind the mark:

- **Marking a season watched** with unwatched episodes in earlier seasons asks
  whether you have watched all the previous seasons. *Yes* sweeps up every
  unmarked episode before it as well; *No* marks that season alone.
- **Ticking an episode** with earlier episodes of *that same season* still
  unmarked asks whether you have watched the previous episodes. *Yes* fills in
  the rest of the season up to it; *No* marks the one episode.

The episode question stays inside its own season on purpose. A viewer who
joined a show at its current season has not left a gap behind them — that is
the same reading `nextUnwatched` takes — so seasons they never started are not
something to ask about one episode at a time. The whole-show version of the
sweep already has a button: **Catch up**, which marks an episode and
everything before it across every season, and does not ask, because asking for
it is what pressing it means.

Each dialog carries a **Don't ask this again** switch, and what it saves is
your answer — not merely the fact that you are done being asked. Turning a
question off is not the same as answering it no: someone who always watches in
order silences the prompt on *Yes* and wants every later mark to catch up
behind it, and someone who never does silences it on *No*. So the switch arms
the dialog rather than acting on it, and the button you then press becomes the
standing answer, applied without asking the next time the same thing comes up.

Nothing is written until you answer, which is why dismissing an armed dialog
leaves the setting exactly as it was. Each question is remembered separately,
so silencing the episode prompt leaves the season prompt asking.

Both answers live under **Account · Prompts** as three choices — *Ask*,
*Always mark*, *Never mark* — which is the deal that makes a "don't ask this
again" safe to press: the setting shows what you silenced the question *into*,
not just that you silenced it, and any of the three can be picked back. They
are settings of the device rather than of the account (nothing about them is
watch history, so nothing about them needs to sync), stored in `localStorage`
under `tideline.prefs.v1` alongside the folded Up Next sections. That key held
a pair of booleans before an answer could be remembered; `false` meant "stop
asking", and stopping could only mean marking the one thing you ticked, so it
migrates to *Never mark* and a reader who silenced a prompt keeps the
behaviour they silenced it into.

Dismissing a catch-up dialog — Escape, or a tap outside it — cancels the mark
outright rather than picking an answer for you. Nothing has been written at
that point, so the mark not happening is the one reading that cannot be wrong.
And because the counts the dialog quotes are recomposed from the live record
each render rather than frozen when it opened, a friend's mark landing on a
shared show mid-question closes the gap and retires the question with it.

### Taking a season back

Every season carries exactly one button, and it is always the move that season
is not already in: **Mark season watched** until it is full, then **Mark season
unwatched** to take that back. Undoing a tap should cost a tap — un-ticking
twenty-odd checkboxes to reverse one press is not a symmetry anyone should
have to live with, and it is doubly true now that answering *Yes* to a
catch-up question can fill in several seasons at once.

Unmarking is drawn in the muted colour the app gives every other *Remove*,
*Withdraw* and *Stop*. Aqua is reserved for the action that adds something, so
the two buttons never read as the same offer.

It clears the season however it came to be watched: in one tap, an episode at
a time, or — on a show you are watching with someone — by episodes your friend
marked. The activity entries it leaves behind go with it, so the streak and
`episodes this month` read as if it never happened, and a finished show
returns to Up Next pointing at the first episode it just gave back.

Under the hood this is one write, not one per episode: `removeWatchedMany`
rewrites the record once and `removeMarks` deletes the shared rows in a single
statement, which is also what makes the whole season land on your friend's
screen together rather than trickling in.

## Behaviour carried over verbatim

These are deliberate choices in the design's logic, not accidents, so they are
reproduced as-is:

- A caught-up show leaves Up Next as soon as its last episode is marked, and
  returns the moment there is something to watch again — a new episode airs
  (unaired episodes join the list on their air date), or you un-mark the
  latest one from the title screen.
- **Next up follows the season you are on**, not the earliest gap. If you
  started a show at its current season, the seasons behind you were skipped,
  not missed — so next up is the next episode of that season. They are not
  forgotten: once the season you are on and everything after it are finished,
  the skipped seasons become what is left to watch, and the show still reaches
  100%.
- Up Next fixes its order when first built and holds it, so cards never
  reshuffle while you are working down the list. Sections re-file a card
  without moving it relative to its neighbours.
- A season opens by default when it holds your next unwatched episode — which
  means a season you fully complete closes itself, and a show you joined
  mid-run opens on the season you are actually watching.
- `episodes this month` counts single-episode activity only; *Catch up* and
  *Mark season watched* log their own labels and are excluded. A prompt
  answered *Yes* logs as a catch-up for the same reason. *Mark season
  unwatched* withdraws whatever the season logged, so the count falls back.

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

Your record — watched episodes, watched films, films you have started,
watchlist, ratings, activity — persists to `localStorage` under
`tideline.user.v2`. Device preferences (whether each catch-up prompt asks, and
the answer standing for it if not) sit apart from it under
`tideline.prefs.v1`, because they describe this browser rather than your
viewing. Sets do not survive JSON,
so they are stored as arrays and rehydrated on read. When storage is
unavailable (private browsing, a blocked origin), the app says so in a banner
and runs from memory for the session.

Signing in (the Account tab) syncs that same record to a Supabase
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
  that link to land somewhere sensible. The username you picked at sign-up is
  held until that round-trip brings a session back, then claimed.

## Friends, and watching a show together

Two people who follow the same show should not have to mark every episode
twice. Pair up on a title and one **Mark watched** counts for both of you.

- **Usernames.** Every account has one — 3–20 characters, letters, numbers and
  underscores, unique without regard to case. It is chosen at sign-up, and an
  account made before usernames existed is asked for one the next time it signs
  in. A username is the only thing a friend can see about your account, and it
  is what they add you by.
- **Friends are mutual.** You send a request to a username; nothing is shared
  until they accept. Declining, withdrawing and unfriending are all the same
  thing — the connection goes away.
- **Sharing is per title.** Being friends shares nothing by itself. On a
  show's screen, **Watch together** lists your friends; invite one and, once
  they accept, that show — and only that show — is shared. So you can work
  through one series with your partner and another with a sibling, and
  everything else stays yours.
- **What carries across.** Watched episodes, watched films, and watchlist
  entries on a shared title. **Catch up**, **Mark season watched** and **Mark
  season unwatched** carry across the same way. Star ratings stay personal — the whole point of a
  rating is that it is yours.
- **Undo is symmetric.** Un-marking an episode of a shared show takes it back
  for both of you, whoever marked it. The two records say the same thing at
  all times, which is the only version of this that stays easy to reason
  about.
- **You start from where you are.** Pairing up copies no history in either
  direction: only marks made after the invitation is accepted are shared. This
  does mean two people who share a show mid-run can show different progress on
  it, which is the honest reading of "we started watching this together now".
- **It lands live.** A friend's mark appears within a second, over Supabase
  Realtime — no reload, no refresh. Coming back to the app re-reads the shared
  marks as well, so a socket that was asleep or blocked cannot leave you
  behind.
- **Stopping is not losing.** Stop watching something together and the
  episodes you marked while sharing become yours to keep — each side folds
  its own copy in. Nothing is deleted from under anybody. You can start the
  same show over together later; that is a new share, and the old one is left
  as it was.

## Recommending a title to a friend

Watching something together is a commitment. Passing something along is not —
so **Recommend**, on any film or show's screen, is its own thing: it puts the
title in front of a friend and leaves the decision entirely with them.

- **Sending.** Pick one friend or several, add a note if you want to say why,
  send. A friend you have already recommended this title to is shown with
  where it stands rather than hidden — that you already sent it is usually the
  thing you opened the dialog to find out.
- **Receiving.** It arrives as a question, over whatever screen you are on:
  the title, who sent it, their note, and three answers. **Add to watchlist**
  queues it. **Not for me** closes it. **Ask me in 3 days** puts the question
  itself off, unchanged, and it comes back when the three days are up.
- **Nothing lands without a yes.** A recommendation touches your record only
  when you accept one — which is what makes it safe to send, and safe to
  receive from someone whose taste you are not sure about.
- **Looking first is not answering.** *See more about it first* opens the
  title and steps the prompt aside for the session; the title's screen says
  who recommended it, with **Decide** to bring the question back.
- **They arrive one at a time.** Three recommendations at once is a list to
  get through, not a question to answer, so the prompt asks about the oldest
  and says how many are behind it.
- **A deferral is reachable before it is due.** The Account tab lists what you
  put off and what you have sent that nobody has answered — *Decide now*
  overrides your own deferral, and *Withdraw* takes back an unanswered one.
- **An answer is final, a title is not.** Passing on something does not stop a
  friend recommending it again later; that is a new recommendation, and your
  old answer stays as it was.

### How it is put together

Your own record still lives in `user_state` as one jsonb blob. Shared marks do
not go there — they live in their own rows, in `shared_marks`, which both
members of a share can read and write. The screens read the union of the two
(`withSharedMarks` in `src/lib/user.js`).

That union is the whole design, and it buys three things at once. Marking an
episode reaches your friend without anyone writing to anyone else's account,
so row-level security stays simple and each policy scopes writes to the
writer's own rows. Un-marking is the deletion of a single row, which is what
makes undo symmetric for free. And pairing up copies nothing, so "start fresh
from now" is not a rule the client has to enforce — it is just what the data
already says.

A recommendation is the same idea pointed one way: `recommendations` holds a
row both sides can read and only the recipient can answer, so accepting one is
the recipient's own client adding the title to their own watchlist — never a
write into someone else's record. Deferring is deliberately not a fourth
status: the row stays `pending` and `remind_at` says when the question is due
again, which is why "ask me later" is an open question rather than an answer,
and why overriding your own deferral needs nothing written at all.

The five tables (`profiles`, `friendships`, `watch_shares`, `shared_marks`,
`recommendations`), their policies and the realtime publication are in
[`supabase/migrations`](./supabase/migrations/), applied to the project.

## The donation banner

Every screen carries the same line above it — *Donations appreciated via Venmo
@Justin-Wai-324*. It is rendered once, in `App`, above the screen rather than
inside any of them, so it says the same thing in the same place on every tab
and on the title screen, and appears while the app is still loading.

The handle links to [venmo.com/u/Justin-Wai-324](https://venmo.com/u/Justin-Wai-324),
and only the handle does. A strip that is one big target is a strip you leave
the app by catching on the way to a tab, and the underlined handle is the part
that looks like it goes somewhere. It opens in a new tab, the same as the
trailer link — nothing about paying someone should cost you your place in the
app.

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

*Mark season unwatched* was driven in Chromium against a stubbed three-season
show: a full season offers it while the others offer *Mark season watched*,
pressing it drops 4 of 9 to 1 of 9 and leaves exactly the other seasons' marks
in the record, the `Season 2 watched` activity entry is withdrawn with it, the
label flips back and the state survives a reload, marking the season again
raises the catch-up question as it should, and unmarking a season on a
100%-complete show returns it to Up Next pointing at S01E01. Checked at 320px
and in the dark theme with no horizontal overflow.

The catch-up prompts were driven in Chromium against a stubbed three-season
show: **Mark season watched** on season 3 raises the season question naming
the right gap (6 episodes across 2 earlier seasons), *No* marks that season
alone (3 of 9), ticking S01E03 raises the episode question scoped to its own
season (2 earlier episodes in season 1), *Yes* fills the season in (6 of 9),
and **Don't ask this again** followed by an answer saves that answer: armed
and answered *Yes*, a later season mark with three seasons behind it sweeps
straight to 12 of 12 with no dialog; armed and answered *No*, the next episode
tick marks only itself while the season question still asks. Dismissing an
armed dialog writes nothing and marks nothing. A v1 boolean of `false`
migrates to *Never mark*. **Account · Prompts** shows the standing answer for
each question and choosing *Ask* brings the dialog back. Up Next reads
*Haven't started yet* and no longer says *Start new*.

The sectioned Up Next was driven in Chromium against a stubbed project, with
one title seeded for each of the four sub-sections: the two sections appear in
order with the right titles under the right headings, folding one hides its
cards and leaves the other alone, the fold survives a reload, marking still
works from inside a section, **Start watching** moves a film from Haven't started yet
to Currently watching, and marking that film watched takes the started flag back
off.

Driven end to end in Chromium: 57 checks across the first five screens covering
marking, catch-up, season completion, filters, all three sort orders, search by
title and by genre, watchlist toggles, rating (including clearing it),
persistence across a reload, empty states, and the dark theme.

The donation banner was checked in Chromium — 13 checks: the exact copy, that
it is present before the app has loaded, that it sits at the top of all five
tabs and above the **← Back** link on the title screen, that there is exactly
one of it in the document rather than one per screen, the dark theme, and that
it wraps onto two lines at 320px without the page scrolling sideways. The link
was checked too: the handle alone carries it and is underlined, the browser
requests `https://venmo.com/u/Justin-Wai-324`, it opens in a new tab under
`noreferrer noopener` with the app still on the screen behind it, and it is
the first tab stop on the page, drawing the design's own aqua focus ring.

`nextUnwatched` and `lastWatched` are covered by 23 assertions over a
three-season show: a viewer who starts at season three is taken through that
season rather than back to S01E01, a gap inside the season they are on is
still next, finishing that season hands the skipped seasons back so the show
can reach 100%, contiguous viewing from S01E01 is unchanged, Undo remains the
exact inverse of Mark whether or not seasons were skipped, and empty seasons
and season-less shows return nothing instead of throwing. The same case was
then driven in Chromium — 15 checks: the Up Next line and Mark/Undo round
trip, the title screen opening season three with season one folded, progress
still measured across all nine episodes, the fall back to the skipped seasons,
and a finished show leaving Up Next at 100%.

Recommending was driven in Chromium as two signed-in accounts sharing a
stubbed project — 36 checks: the button on a film and on a show, sending with
and without a note, the row that write produces, the prompt naming sender and
note, all three answers (watchlist, pass, defer), that only accepting touches
the watchlist, that a deferral stays pending with `remind_at` three days out,
that a deferred one is reachable from the Account tab and *Decide now* brings
it back, that two waiting arrive oldest-first with the count of what is behind
it, that *See more about it first* leaves it unanswered and the title screen
credits the sender, that the sender sees the outcome and can withdraw an
unanswered one, and the prompt in the dark theme with Escape deferring rather
than answering. One round-trip is checked in both directions: putting a
recommendation off, pulling it forward with *Decide now*, and putting it off
again — the second deferral has to stick rather than re-asking immediately.

Shared watching was verified in three passes. The policies were walked through
as three signed-in users against the live project — 26 checks covering username
uniqueness and format, forged and crossing friend requests, inviting someone
who is not a friend, marking before an invitation is accepted, signing a mark
as somebody else, a stranger reading or deleting a share's marks, deleting an
accepted share outright, and re-sharing a title after ending it. The record
maths — the union, the round trip, activity ordering and withdrawal — was
checked directly, 11 cases. The screens were then driven in Chromium against a
stubbed project: marking a shared episode writes a shared mark rather than a
private one, undo deletes that row, a friend's mark counts as your own, an
ended share folds into your record exactly once, and a title you do not share
never touches the shared table.
