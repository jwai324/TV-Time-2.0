import Poster from '../components/Poster.jsx'

/** Watchlist pill — same control on a result row and under a trending poster. */
function WatchlistButton({ item, style }) {
  return (
    <button
      className="tl-focus"
      onClick={item.onWatchlist}
      aria-pressed={item.inWatchlist}
      style={{
        flex: 'none',
        font: "500 12.5px 'Inter Tight', sans-serif",
        color: item.inWatchlist ? '#0E332F' : 'var(--sub)',
        background: item.inWatchlist ? 'var(--seafoam)' : 'transparent',
        border: '1px solid var(--line)',
        borderRadius: 999,
        padding: '9px 13px',
        cursor: 'pointer',
        minHeight: 38,
        ...style,
      }}
    >
      {item.inWatchlist ? 'Added' : 'Watchlist'}
    </button>
  )
}

/** A labelled horizontal poster rail — used for "For you" and "Trending". */
function PosterRow({ label, items, dark, onOpen }) {
  return (
    <>
      <div
        style={{
          padding: '24px 20px 8px',
          font: "400 11px 'IBM Plex Mono', monospace",
          color: 'var(--drift)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 8px' }}>
        {items.map((tr) => (
          <div key={tr.id} style={{ flex: 'none', width: 118 }}>
            <button
              className="tl-focus-r10"
              onClick={() => onOpen(tr.id)}
              style={{
                display: 'block',
                width: '100%',
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                textAlign: 'left',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <Poster title={tr.title} dark={dark} width={118} height={164} radius={10} />
              <div
                style={{
                  font: "600 13px/1.25 'Bricolage Grotesque', sans-serif",
                  letterSpacing: '-0.01em',
                  marginTop: 8,
                }}
              >
                {tr.name}
              </div>
              <div
                style={{
                  font: "400 10.5px 'IBM Plex Mono', monospace",
                  color: 'var(--drift)',
                  marginTop: 3,
                }}
              >
                {tr.meta}
              </div>
            </button>
            <WatchlistButton
              item={tr}
              style={{ marginTop: 7, font: "500 12px 'Inter Tight', sans-serif", padding: '7px 11px', minHeight: 34 }}
            />
          </div>
        ))}
      </div>
    </>
  )
}

export default function Discover({ query, onSearch, showResults, results, showRows, rows, dark, onOpen }) {
  return (
    <>
      <div style={{ padding: '28px 20px 10px' }}>
        <h1 style={{ margin: 0, font: "600 28px/1.1 'Bricolage Grotesque', sans-serif", letterSpacing: '-0.03em' }}>
          Discover
        </h1>
      </div>

      <div style={{ padding: '6px 20px 0' }}>
        <input
          className="tl-focus-inset1"
          value={query}
          onChange={(ev) => onSearch(ev.target.value)}
          type="search"
          placeholder="Search shows and movies"
          aria-label="Search titles"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            font: "400 16px 'Inter Tight', sans-serif",
            color: 'var(--text)',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '13px 16px',
          }}
        />
      </div>

      {showResults && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px 0' }}>
            {results.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <button
                  className="tl-focus-r8"
                  onClick={() => onOpen(r.id)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flex: 1,
                    minWidth: 0,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  <Poster title={r.title} dark={dark} width={38} height={52} radius={6} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        font: "600 15px/1.2 'Bricolage Grotesque', sans-serif",
                        letterSpacing: '-0.015em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.name}
                    </div>
                    <div
                      style={{
                        font: "400 11px 'IBM Plex Mono', monospace",
                        color: 'var(--drift)',
                        marginTop: 4,
                      }}
                    >
                      {r.meta}
                    </div>
                  </div>
                </button>
                <WatchlistButton item={r} />
              </div>
            ))}
          </div>

          {results.length === 0 && (
            <div
              style={{
                padding: '24px 20px',
                font: "400 13px 'Inter Tight', sans-serif",
                color: 'var(--sub)',
              }}
            >
              No matches. Try another word — titles and genres both work.
            </div>
          )}
        </>
      )}

      {showRows &&
        rows.map(
          (row) =>
            row.items.length > 0 && (
              <PosterRow key={row.key} label={row.label} items={row.items} dark={dark} onOpen={onOpen} />
            )
        )}
    </>
  )
}
