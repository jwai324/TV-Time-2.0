/**
 * Catalog — the read-only title source behind Tideline.
 *
 * `Tideline App.dc.html` loads this module and only ever calls the three async
 * functions at the bottom, so the in-memory table here can be swapped for a
 * real API without touching a screen.
 *
 * Titles are fictional.
 */

/** Expand `[name, runtimeMinutes, airDate]` rows into numbered episodes. */
const eps = (rows) =>
  rows.map(([name, runtimeMinutes, airDate], i) => ({ number: i + 1, name, runtimeMinutes, airDate }))

const season = (number, rows) => ({ number, episodes: eps(rows) })

const TITLES = [
  {
    id: 'severance-point',
    name: 'Severance Point',
    type: 'show',
    year: 2021,
    genres: ['Drama', 'Mystery'],
    status: 'returning',
    posterHue: 190,
    runtimeMinutes: 52,
    overview:
      'A skeleton crew keeps a decommissioned research station alive through the winter, and starts logging tides that nobody on the mainland can account for.',
    seasons: [
      season(1, [
        ['Low Water', 58, 'Sep 12, 2021'],
        ['The Standing Wave', 51, 'Sep 19, 2021'],
        ['Ninety Fathoms', 49, 'Sep 26, 2021'],
        ['Salvage Rights', 53, 'Oct 3, 2021'],
        ['What the Tide Keeps', 50, 'Oct 10, 2021'],
        ['Dead Reckoning', 54, 'Oct 17, 2021'],
        ['The Long Shelf', 48, 'Oct 24, 2021'],
        ['Cold Front', 52, 'Oct 31, 2021'],
        ['Severance Point', 61, 'Nov 7, 2021'],
      ]),
      season(2, [
        ['Second Winter', 54, 'Oct 2, 2022'],
        ['The Anchorage', 50, 'Oct 9, 2022'],
        ['Bearing Ninety', 49, 'Oct 16, 2022'],
        ['Undercurrent', 52, 'Oct 23, 2022'],
        ['Signal Fire', 51, 'Oct 30, 2022'],
        ['The Drowned Road', 55, 'Nov 6, 2022'],
        ['Marker Seven', 48, 'Nov 13, 2022'],
        ['Ebb', 50, 'Nov 20, 2022'],
        ['The Quiet Hour', 53, 'Nov 27, 2022'],
        ['Flood Stage', 63, 'Dec 4, 2022'],
      ]),
      season(3, [
        ['Return Passage', 55, 'Feb 4, 2024'],
        ['The Shipping Forecast', 51, 'Feb 11, 2024'],
        ['Slack Water', 49, 'Feb 18, 2024'],
        ['Every Light on the Coast', 53, 'Feb 25, 2024'],
        ['The Break', 52, 'Mar 3, 2024'],
        ['Holdfast', 50, 'Mar 10, 2024'],
        ['Storm Glass', 54, 'Mar 17, 2024'],
        ['Full Ebb', 66, 'Mar 24, 2024'],
      ]),
    ],
  },
  {
    id: 'harbor-lights',
    name: 'Harbor Lights',
    type: 'show',
    year: 2023,
    genres: ['Drama', 'Romance'],
    status: 'returning',
    posterHue: 32,
    runtimeMinutes: 44,
    overview:
      'Two families run competing boatyards on the same stretch of water. One good season would settle it. Neither of them is having one.',
    seasons: [
      season(1, [
        ['Slip 12', 46, 'Apr 6, 2023'],
        ['Off Season', 43, 'Apr 13, 2023'],
        ['The Dredger', 44, 'Apr 20, 2023'],
        ["Nor'easter", 45, 'Apr 27, 2023'],
        ['Small Craft Advisory', 42, 'May 4, 2023'],
        ['The Fish House', 44, 'May 11, 2023'],
        ['November Light', 43, 'May 18, 2023'],
        ['Homeport', 51, 'May 25, 2023'],
      ]),
    ],
  },
  {
    id: 'saltgrass',
    name: 'Saltgrass',
    type: 'show',
    year: 2019,
    genres: ['Drama', 'Crime'],
    status: 'ended',
    posterHue: 78,
    runtimeMinutes: 47,
    overview:
      'A marsh warden finds a car in nine feet of brackish water and pulls a decade of quiet arrangements up with it.',
    seasons: [
      season(1, [
        ['Brackish', 49, 'Jan 8, 2019'],
        ['The Levee', 46, 'Jan 15, 2019'],
        ['Nine Acres', 45, 'Jan 22, 2019'],
        ['Blind Channel', 47, 'Jan 29, 2019'],
        ['The Burn', 44, 'Feb 5, 2019'],
        ['Spartina', 48, 'Feb 12, 2019'],
        ['Backwater', 46, 'Feb 19, 2019'],
        ['The Weir', 45, 'Feb 26, 2019'],
        ['Sediment', 47, 'Mar 5, 2019'],
        ['High Marsh', 56, 'Mar 12, 2019'],
      ]),
      season(2, [
        ['Cutgrass', 47, 'Feb 2, 2021'],
        ['The Inlet Road', 45, 'Feb 9, 2021'],
        ['Silt', 46, 'Feb 16, 2021'],
        ['What Floats', 44, 'Feb 23, 2021'],
        ['The Shell Bank', 48, 'Mar 2, 2021'],
        ['Tidewrack', 45, 'Mar 9, 2021'],
        ['Dry Season', 46, 'Mar 16, 2021'],
        ['Saltgrass', 58, 'Mar 23, 2021'],
      ]),
    ],
  },
  {
    id: 'meridian',
    name: 'Meridian',
    type: 'show',
    year: 2022,
    genres: ['Sci-Fi', 'Thriller'],
    status: 'returning',
    posterHue: 262,
    runtimeMinutes: 55,
    overview:
      'A timekeeping satellite drifts four milliseconds out of true, and the people who notice first are the ones nobody will believe.',
    seasons: [
      season(1, [
        ['Prime', 57, 'Jun 3, 2022'],
        ['The Zero Line', 53, 'Jun 10, 2022'],
        ['Parallax', 52, 'Jun 17, 2022'],
        ['Local Noon', 54, 'Jun 24, 2022'],
        ['Ascension', 51, 'Jul 1, 2022'],
        ['The Grid', 55, 'Jul 8, 2022'],
        ['Sidereal', 53, 'Jul 15, 2022'],
        ['Antipode', 52, 'Jul 22, 2022'],
        ['The Long Count', 56, 'Jul 29, 2022'],
        ['Meridian', 64, 'Aug 5, 2022'],
      ]),
    ],
  },
  {
    id: 'the-quiet-divide',
    name: 'The Quiet Divide',
    type: 'show',
    year: 2018,
    genres: ['Drama', 'History'],
    status: 'ended',
    posterHue: 12,
    runtimeMinutes: 50,
    overview:
      'Two river villages spend a war on opposite banks of a bridge nobody is allowed to cross, and a peace they have to share afterwards.',
    seasons: [
      season(1, [
        ['The Ford', 52, 'Sep 2, 2018'],
        ['Two Rivers', 49, 'Sep 9, 2018'],
        ['Ration Book', 50, 'Sep 16, 2018'],
        ['The Crossing', 51, 'Sep 23, 2018'],
        ['Blackout', 48, 'Sep 30, 2018'],
        ['Letters Home', 50, 'Oct 7, 2018'],
        ['The Requisition', 49, 'Oct 14, 2018'],
        ['Frost', 51, 'Oct 21, 2018'],
        ['The Long Field', 50, 'Oct 28, 2018'],
        ['Armistice', 58, 'Nov 4, 2018'],
      ]),
      season(2, [
        ['After', 51, 'Oct 4, 2020'],
        ['The Returning', 49, 'Oct 11, 2020'],
        ['Fallow', 50, 'Oct 18, 2020'],
        ['The Inquest', 52, 'Oct 25, 2020'],
        ['New Money', 48, 'Nov 1, 2020'],
        ['The Orchard', 50, 'Nov 8, 2020'],
        ['Dust', 49, 'Nov 15, 2020'],
        ['The Sale', 51, 'Nov 22, 2020'],
        ['Michaelmas', 50, 'Nov 29, 2020'],
        ['The Quiet Divide', 62, 'Dec 6, 2020'],
      ]),
    ],
  },
  {
    id: 'undertow',
    name: 'Undertow',
    type: 'show',
    year: 2024,
    genres: ['Thriller', 'Mystery'],
    status: 'returning',
    posterHue: 210,
    runtimeMinutes: 48,
    overview:
      'A lifeguard on an unremarkable beach keeps pulling the same stretch of water, and keeps finding things that went in somewhere else.',
    seasons: [
      season(1, [
        ['Rip', 50, 'Jul 11, 2024'],
        ['The Sandbar', 47, 'Jul 18, 2024'],
        ['Breakwater', 46, 'Jul 25, 2024'],
        ['Green Water', 48, 'Aug 1, 2024'],
        ['The Shallows', 47, 'Aug 8, 2024'],
        ['Undertow', 55, 'Aug 15, 2024'],
      ]),
    ],
  },
  {
    id: 'open-water',
    name: 'Open Water',
    type: 'show',
    year: 2023,
    genres: ['Documentary', 'Adventure'],
    status: 'ended',
    posterHue: 196,
    runtimeMinutes: 42,
    overview:
      'Six sailors, one boat, and the long empty middle of an ocean that no camera crew has ever made look small.',
    seasons: [
      season(1, [
        ['Leaving the Shelf', 44, 'Mar 7, 2023'],
        ['Blue Desert', 41, 'Mar 14, 2023'],
        ['The Doldrums', 42, 'Mar 21, 2023'],
        ['Southern Ocean', 43, 'Mar 28, 2023'],
        ['Ice Edge', 42, 'Apr 4, 2023'],
        ['The Roaring Forties', 44, 'Apr 11, 2023'],
        ['Landfall', 41, 'Apr 18, 2023'],
        ['Open Water', 48, 'Apr 25, 2023'],
      ]),
    ],
  },
  {
    id: 'the-ledger',
    name: 'The Ledger',
    type: 'show',
    year: 2025,
    genres: ['Crime', 'Drama'],
    status: 'returning',
    posterHue: 44,
    runtimeMinutes: 51,
    overview:
      'A port authority bookkeeper balances to the cent every quarter for nineteen years. The twentieth is off by eleven thousand.',
    seasons: [
      season(1, [
        ['Opening Balance', 53, 'Jan 14, 2025'],
        ['Petty Cash', 50, 'Jan 21, 2025'],
        ['The Audit', 49, 'Jan 28, 2025'],
        ['Off Book', 51, 'Feb 4, 2025'],
        ['Write-Down', 50, 'Feb 11, 2025'],
        ['The Ledger', 58, 'Feb 18, 2025'],
      ]),
    ],
  },
  {
    id: 'vantage',
    name: 'Vantage',
    type: 'show',
    year: 2024,
    genres: ['Thriller', 'Drama'],
    status: 'returning',
    posterHue: 288,
    runtimeMinutes: 46,
    overview:
      'A surveyor mapping a ridge for a road that will never be built watches the valley below rehearse something for a year.',
    seasons: [
      season(1, [
        ['Sightline', 48, 'May 9, 2024'],
        ['The Blind', 45, 'May 16, 2024'],
        ['High Ground', 44, 'May 23, 2024'],
        ['The Overlook', 46, 'May 30, 2024'],
        ['Cover', 45, 'Jun 6, 2024'],
        ['Range', 44, 'Jun 13, 2024'],
        ['The Glass', 46, 'Jun 20, 2024'],
        ['Defilade', 45, 'Jun 27, 2024'],
        ['The Long Look', 47, 'Jul 4, 2024'],
        ['Vantage', 54, 'Jul 11, 2024'],
      ]),
    ],
  },
  {
    id: 'glasshouse',
    name: 'Glasshouse',
    type: 'show',
    year: 2025,
    genres: ['Sci-Fi', 'Drama'],
    status: 'returning',
    posterHue: 156,
    runtimeMinutes: 49,
    overview:
      'The last seed vault above the waterline runs on donated power and the goodwill of four people who no longer speak to each other.',
    seasons: [
      season(1, [
        ['Germination', 51, 'Mar 6, 2025'],
        ['The Cold Room', 48, 'Mar 13, 2025'],
        ['Provenance', 47, 'Mar 20, 2025'],
        ['Rootstock', 49, 'Mar 27, 2025'],
        ['The Grafting', 48, 'Apr 3, 2025'],
        ['Blight', 50, 'Apr 10, 2025'],
        ['Dormancy', 47, 'Apr 17, 2025'],
        ['Glasshouse', 57, 'Apr 24, 2025'],
      ]),
    ],
  },
  {
    id: 'north-light',
    name: 'North Light',
    type: 'show',
    year: 2024,
    genres: ['Drama'],
    status: 'ended',
    posterHue: 58,
    runtimeMinutes: 45,
    overview:
      'A painter takes a winter residency in a town with four hours of usable daylight and finishes nothing at all.',
    seasons: [
      season(1, [
        ['First Dark', 47, 'Nov 8, 2024'],
        ['The Commission', 44, 'Nov 15, 2024'],
        ['Underpainting', 43, 'Nov 22, 2024'],
        ['The Sitter', 45, 'Nov 29, 2024'],
        ['Varnish', 44, 'Dec 6, 2024'],
        ['North Light', 52, 'Dec 13, 2024'],
      ]),
    ],
  },

  // Films
  {
    id: 'the-salt-path',
    name: 'The Salt Path',
    type: 'movie',
    year: 2022,
    genres: ['Drama'],
    posterHue: 96,
    runtimeMinutes: 118,
    seasons: [],
    overview:
      'Two people walk a coastal footpath end to end because the alternative is deciding what happens next.',
  },
  {
    id: 'aurora-motel',
    name: 'Aurora Motel',
    type: 'movie',
    year: 2021,
    genres: ['Thriller', 'Noir'],
    posterHue: 340,
    runtimeMinutes: 104,
    seasons: [],
    overview:
      'Everyone checked in for one night. The night clerk has been counting how many of them are still on the register.',
  },
  {
    id: 'petrichor',
    name: 'Petrichor',
    type: 'movie',
    year: 2023,
    genres: ['Drama', 'Romance'],
    posterHue: 128,
    runtimeMinutes: 131,
    seasons: [],
    overview:
      'A drought breaks over a valley town on the same afternoon two people decide, separately, to leave it.',
  },
  {
    id: 'girder',
    name: 'Girder',
    type: 'movie',
    year: 2020,
    genres: ['Action', 'Drama'],
    posterHue: 20,
    runtimeMinutes: 126,
    seasons: [],
    overview:
      'Forty floors up, a crew finishes a tower nobody has been paid for, and nobody is willing to walk off.',
  },
  {
    id: 'the-foley-artist',
    name: 'The Foley Artist',
    type: 'movie',
    year: 2024,
    genres: ['Comedy', 'Drama'],
    posterHue: 300,
    runtimeMinutes: 97,
    seasons: [],
    overview:
      'She has made the sound of rain for two hundred films and has not been outside in one of them.',
  },
  {
    id: 'late-frost',
    name: 'Late Frost',
    type: 'movie',
    year: 2024,
    genres: ['Drama'],
    posterHue: 168,
    runtimeMinutes: 112,
    seasons: [],
    overview:
      'An orchard family gambles the whole season on one warm week in April, and gets six days of it.',
  },
  {
    id: 'half-moon-bay',
    name: 'Half Moon Bay',
    type: 'movie',
    year: 2023,
    genres: ['Romance', 'Drama'],
    posterHue: 350,
    runtimeMinutes: 108,
    seasons: [],
    overview:
      'They agree to meet on the same stretch of sand once a year. The film is only interested in the years they miss.',
  },
  {
    id: 'the-narrows',
    name: 'The Narrows',
    type: 'movie',
    year: 2025,
    genres: ['Thriller'],
    posterHue: 222,
    runtimeMinutes: 115,
    seasons: [],
    overview:
      'A pilot boat captain has ninety minutes of slack water to bring a ship through a channel that has closed behind her.',
  },
  {
    id: 'cormorant',
    name: 'Cormorant',
    type: 'movie',
    year: 2025,
    genres: ['Drama', 'Mystery'],
    posterHue: 200,
    runtimeMinutes: 122,
    seasons: [],
    overview:
      'A bird counter on an empty headland files the same numbers for eleven years, and then files different ones.',
  },
  {
    id: 'the-tin-shore',
    name: 'The Tin Shore',
    type: 'movie',
    year: 2022,
    genres: ['Documentary'],
    posterHue: 108,
    runtimeMinutes: 89,
    seasons: [],
    overview:
      'The last cannery on a hundred miles of coast works one final run, filmed by the people closing it.',
  },
]

const BY_ID = new Map(TITLES.map((t) => [t.id, t]))

const TRENDING_IDS = ['glasshouse', 'the-narrows', 'undertow', 'cormorant', 'vantage', 'north-light']

/** Fetch one title by id, or `null` when nothing matches. */
export async function getTitle(id) {
  return BY_ID.get(id) || null
}

/** The week's trending row, in curated order. */
export async function getTrending() {
  return TRENDING_IDS.map((id) => BY_ID.get(id)).filter(Boolean)
}

/**
 * Search titles and genres. Name matches outrank genre matches, and a match at
 * the start of a name outranks one in the middle, so typing "the" still leads
 * with the titles that begin with it.
 */
export async function searchTitles(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored = []
  for (const t of TITLES) {
    const name = t.name.toLowerCase()
    const rank = name.startsWith(q) ? 0
      : name.includes(q) ? 1
      : t.genres.some((g) => g.toLowerCase().includes(q)) ? 2
      : -1
    if (rank >= 0) scored.push({ t, rank })
  }
  scored.sort((a, b) => a.rank - b.rank || a.t.name.localeCompare(b.t.name))
  return scored.map((s) => s.t)
}
