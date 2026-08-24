export default function Stats({ tiles, topGenres }) {
  return (
    <>
      <div style={{ padding: '28px 20px 10px' }}>
        <h1 style={{ margin: 0, font: "600 28px/1.1 'Bricolage Grotesque', sans-serif", letterSpacing: '-0.03em' }}>
          Stats
        </h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          padding: '8px 20px 0',
        }}
      >
        {tiles.map((s) => (
          <div
            key={s.label}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                font: "600 26px/1 'Bricolage Grotesque', sans-serif",
                letterSpacing: '-0.02em',
                color: s.color,
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                font: "400 10.5px 'IBM Plex Mono', monospace",
                color: 'var(--drift)',
                marginTop: 8,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '26px 20px 8px',
          font: "400 11px 'IBM Plex Mono', monospace",
          color: 'var(--drift)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}
      >
        Top genres
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 20px' }}>
        {topGenres.map((g) => (
          <div key={g.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ font: "500 13.5px 'Inter Tight', sans-serif" }}>{g.name}</span>
              <span style={{ font: "400 11px 'IBM Plex Mono', monospace", color: 'var(--drift)' }}>{g.count}</span>
            </div>
            <div
              style={{
                position: 'relative',
                height: 4,
                background: 'var(--track)',
                borderRadius: 2,
                marginTop: 6,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: g.width,
                  background: 'var(--seafoam)',
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
