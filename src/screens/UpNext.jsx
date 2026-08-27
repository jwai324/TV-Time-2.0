import Poster from '../components/Poster.jsx'
import TideBar from '../components/TideBar.jsx'

/** One queued title: poster, where you are with it, and the two actions. */
function Card({ card: c, dark }) {
  return (
    <div
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
  )
}

/**
 * Up Next, in two halves: what you are part-way through, then what is waiting
 * to be started, each split into shows and films.
 *
 * A section folds away by its header, and stays folded across reloads. Only
 * the two outer sections collapse — the shows/films split inside one is a
 * label, not another thing to tap, which keeps a queue two taps deep at most.
 */
export default function UpNext({ sections, collapsed, onToggleSection, empty, dark, onDiscover }) {
  return (
    <>
      <div style={{ padding: '28px 20px 10px' }}>
        <h1 style={{ margin: 0, font: "600 28px/1.1 'Bricolage Grotesque', sans-serif", letterSpacing: '-0.03em' }}>
          Up next
        </h1>
      </div>

      {empty && (
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

      {sections.map((section) => {
        const open = !collapsed[section.key]
        return (
          <section key={section.key}>
            <h2 style={{ margin: 0, padding: '18px 20px 0' }}>
              <button
                className="tl-focus-inset1"
                onClick={() => onToggleSection(section.key)}
                aria-expanded={open}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 0',
                  cursor: 'pointer',
                  color: 'inherit',
                  textAlign: 'left',
                  minHeight: 44,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    font: "400 10px 'IBM Plex Mono', monospace",
                    color: 'var(--drift)',
                    // The caret turns rather than swapping glyph, so the
                    // header does not jump as the section opens.
                    transform: open ? 'rotate(90deg)' : 'none',
                    transition: 'transform .18s ease',
                    display: 'inline-block',
                    width: 10,
                  }}
                >
                  ▶
                </span>
                <span
                  style={{
                    flex: 1,
                    font: "600 18px 'Bricolage Grotesque', sans-serif",
                    letterSpacing: '-0.02em',
                  }}
                >
                  {section.label}
                </span>
                <span style={{ font: "400 11px 'IBM Plex Mono', monospace", color: 'var(--drift)' }}>
                  {section.count}
                </span>
              </button>
            </h2>

            {open &&
              section.groups.map((group) => (
                <div key={group.key}>
                  <div
                    style={{
                      padding: '10px 20px 8px',
                      font: "400 11px 'IBM Plex Mono', monospace",
                      color: 'var(--drift)',
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                    }}
                  >
                    {group.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 20px' }}>
                    {group.cards.map((c) => (
                      <Card key={c.id} card={c} dark={dark} />
                    ))}
                  </div>
                </div>
              ))}
          </section>
        )
      })}
    </>
  )
}
