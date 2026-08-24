import Poster from '../components/Poster.jsx'
import TideBar from '../components/TideBar.jsx'

export const FILTERS = ['All', 'Shows', 'Movies', 'Watchlist', 'Finished']

export default function Library({ filter, onFilter, sortBy, onSort, items, dark, onOpen }) {
  return (
    <>
      <div style={{ padding: '28px 20px 10px' }}>
        <h1 style={{ margin: 0, font: "600 28px/1.1 'Bricolage Grotesque', sans-serif", letterSpacing: '-0.03em' }}>
          Library
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 20px 4px' }}>
        {FILTERS.map((label) => {
          const active = filter === label
          return (
            <button
              key={label}
              className="tl-focus"
              onClick={() => onFilter(label)}
              aria-pressed={active}
              style={{
                flex: 'none',
                font: "500 13px 'Inter Tight', sans-serif",
                padding: '9px 14px',
                borderRadius: 999,
                border: `1px solid ${active ? 'var(--text)' : 'var(--line)'}`,
                background: active ? 'var(--text)' : 'var(--card)',
                color: active ? 'var(--bg)' : 'var(--sub)',
                cursor: 'pointer',
                minHeight: 38,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px 2px' }}>
        <select
          className="tl-focus-flat"
          value={sortBy}
          onChange={(ev) => onSort(ev.target.value)}
          aria-label="Sort library"
          style={{
            font: "400 12px 'IBM Plex Mono', monospace",
            color: 'var(--sub)',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '7px 8px',
          }}
        >
          <option value="recent">recent activity</option>
          <option value="alpha">alphabetical</option>
          <option value="progress">progress</option>
        </select>
      </div>

      {items.length === 0 && (
        <div
          style={{
            margin: '28px 20px',
            font: "400 13px 'Inter Tight', sans-serif",
            color: 'var(--sub)',
          }}
        >
          Nothing here yet. Add titles from Discover.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 20px 0' }}>
        {items.map((it) => (
          <button
            key={it.id}
            className="tl-focus"
            onClick={() => onOpen(it.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              color: 'inherit',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px' }}>
              <Poster title={it.title} dark={dark} width={38} height={52} radius={6} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    font: "600 15px/1.2 'Bricolage Grotesque', sans-serif",
                    letterSpacing: '-0.015em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {it.name}
                </div>
                <div
                  style={{
                    font: "400 11px 'IBM Plex Mono', monospace",
                    color: 'var(--drift)',
                    marginTop: 4,
                  }}
                >
                  {it.meta}
                </div>
              </div>
            </div>
            <TideBar
              pct={it.pct}
              height={4}
              crest={it.pct > 0 && it.pct < 100}
              crestWidth={12}
              crestHeight={7}
              drift="5s"
            />
          </button>
        ))}
      </div>
    </>
  )
}
