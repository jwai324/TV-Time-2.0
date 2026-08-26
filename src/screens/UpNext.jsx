import Poster from '../components/Poster.jsx'
import TideBar from '../components/TideBar.jsx'

export default function UpNext({ cards, dark, onDiscover }) {
  return (
    <>
      <div style={{ padding: '28px 20px 10px' }}>
        <h1 style={{ margin: 0, font: "600 28px/1.1 'Bricolage Grotesque', sans-serif", letterSpacing: '-0.03em' }}>
          Up next
        </h1>
      </div>

      {cards.length === 0 && (
        <div
          style={{
            margin: '32px 20px',
            padding: '36px 24px',
            border: '1px solid var(--line)',
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ font: "600 17px 'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}>
            Nothing queued.
          </div>
          <button
            className="tl-focus"
            onClick={onDiscover}
            style={{
              marginTop: 14,
              font: "500 14px 'Inter Tight', sans-serif",
              color: 'var(--text)',
              background: 'var(--seafoam)',
              border: 'none',
              borderRadius: 10,
              padding: '12px 18px',
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Find a show →
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 20px 0' }}>
        {cards.map((c) => (
          <div
            key={c.id}
            style={{
              background: c.wash,
              border: '1px solid var(--line)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 14,
                padding: '16px 16px 14px',
                alignItems: 'center',
                minHeight: 78,
              }}
            >
              <button
                className="tl-focus-r8"
                onClick={c.onOpen}
                style={{
                  display: 'flex',
                  gap: 14,
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
                <Poster title={c.title} dark={dark} width={48} height={66} radius={8} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      font: "600 17px/1.2 'Bricolage Grotesque', sans-serif",
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={c.infoStyle}>
                    {c.done ? (
                      <div
                        style={{
                          marginTop: 5,
                          font: "400 12px 'IBM Plex Mono', monospace",
                          color: 'var(--sub)',
                        }}
                      >
                        {c.doneLabel}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 5 }}>
                          <span style={{ font: "500 11.5px 'IBM Plex Mono', monospace", color: 'var(--aqua)' }}>
                            {c.code}
                          </span>
                          {c.epName && (
                            <span
                              style={{
                                font: "400 13.5px 'Inter Tight', sans-serif",
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {c.epName}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            font: "400 11px 'IBM Plex Mono', monospace",
                            color: 'var(--drift)',
                            marginTop: 4,
                          }}
                        >
                          {c.rt}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, flex: 'none' }}>
                {!c.done && (
                  <button
                    className="tl-focus tl-hover-mark"
                    onClick={c.onMark}
                    style={{
                      font: "500 13.5px 'Inter Tight', sans-serif",
                      color: '#0E332F',
                      background: 'var(--seafoam)',
                      border: 'none',
                      borderRadius: 10,
                      padding: '11px 14px',
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    Mark watched
                  </button>
                )}
                {c.canUndo && (
                  <button
                    className="tl-focus tl-hover-catch"
                    onClick={c.onUndo}
                    aria-label={`Undo — un-mark ${c.undoCode}`}
                    title={`Un-mark ${c.undoCode}`}
                    style={{
                      font: "400 11px 'IBM Plex Mono', monospace",
                      color: 'var(--sub)',
                      background: 'none',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      padding: '7px 10px',
                      cursor: 'pointer',
                      minHeight: 32,
                    }}
                  >
                    Undo
                  </button>
                )}
              </div>
            </div>

            <TideBar pct={c.pct} height={5} crest={!c.done} animate />
          </div>
        ))}
      </div>
    </>
  )
}
