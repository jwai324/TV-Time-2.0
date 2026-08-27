import { useState } from 'react'

import Poster from '../components/Poster.jsx'
import TideBar from '../components/TideBar.jsx'

const pillStyle = {
  font: "500 12.5px 'Inter Tight', sans-serif",
  color: 'var(--sub)',
  background: 'none',
  border: '1px solid var(--line)',
  borderRadius: 999,
  padding: '8px 13px',
  cursor: 'pointer',
  minHeight: 38,
}

/**
 * Watch together: one row per friend, in whichever of the four states you are
 * in with them on this title.
 *
 * The state a row is in is the whole explanation of what the button does, so
 * each one says it rather than relying on an icon: invited and waiting,
 * asked and able to answer, already watching, or neither yet.
 */
function WatchTogether({ watchTogether }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!watchTogether || !watchTogether.signedIn || !watchTogether.hasUsername) return null

  const act = (fn) => async () => {
    setBusy(true)
    setMessage('')
    const err = await fn()
    setBusy(false)
    setMessage(err || '')
  }

  const { rows } = watchTogether

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          font: "400 11px 'IBM Plex Mono', monospace",
          color: 'var(--drift)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
          marginBottom: 10,
        }}
      >
        Watch together
      </div>

      {!rows.length && (
        <div style={{ font: "400 12.5px 'Inter Tight', sans-serif", color: 'var(--sub)' }}>
          Add a friend on the Account tab, then you can watch this one together.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => (
          <div key={row.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "500 13.5px 'Inter Tight', sans-serif", overflowWrap: 'anywhere' }}>
                {row.username}
              </div>
              {row.state !== 'none' && (
                <div style={{ font: "400 11px 'IBM Plex Mono', monospace", color: 'var(--drift)', marginTop: 3 }}>
                  {row.state === 'watching'
                    ? 'marks either of you make count for both'
                    : row.state === 'invited'
                      ? 'invited — waiting on them'
                      : 'asked to watch this with you'}
                </div>
              )}
            </div>

            {row.state === 'none' && (
              <button
                className="tl-focus tl-hover-pill"
                disabled={busy}
                onClick={act(() => watchTogether.onInvite(row.userId))}
                style={pillStyle}
              >
                Invite
              </button>
            )}
            {row.state === 'invited' && (
              <button
                className="tl-focus tl-hover-pill"
                disabled={busy}
                onClick={act(() => watchTogether.onDecline(row.shareId))}
                style={pillStyle}
              >
                Withdraw
              </button>
            )}
            {row.state === 'asked' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="tl-focus tl-hover-pill"
                  disabled={busy}
                  onClick={act(() => watchTogether.onAccept(row.shareId))}
                  style={{ ...pillStyle, color: 'var(--aqua)', borderColor: 'var(--aqua)' }}
                >
                  Accept
                </button>
                <button
                  className="tl-focus tl-hover-pill"
                  disabled={busy}
                  onClick={act(() => watchTogether.onDecline(row.shareId))}
                  style={pillStyle}
                >
                  Decline
                </button>
              </div>
            )}
            {row.state === 'watching' && (
              <button
                className="tl-focus tl-hover-pill"
                disabled={busy}
                onClick={act(() => watchTogether.onStop(row.shareId))}
                style={pillStyle}
              >
                Stop
              </button>
            )}
          </div>
        ))}
      </div>

      {message && (
        <div
          role="status"
          style={{ font: "400 11.5px 'IBM Plex Mono', monospace", color: 'var(--sub)', marginTop: 10 }}
        >
          {message}
        </div>
      )}
    </div>
  )
}

export default function TitleDetail({ detail, watchTogether, dark, onBack }) {
  return (
    <>
      <div style={{ padding: '16px 20px 0' }}>
        <button
          className="tl-focus-r6"
          onClick={onBack}
          style={{
            font: "500 14px 'Inter Tight', sans-serif",
            color: 'var(--aqua)',
            background: 'none',
            border: 'none',
            padding: '10px 0',
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          ← Back
        </button>
      </div>

      {detail && (
        <div style={{ padding: '6px 20px 0' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <Poster title={detail.title} dark={dark} width={96} height={134} radius={10} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1
                style={{
                  margin: 0,
                  font: "600 24px/1.1 'Bricolage Grotesque', sans-serif",
                  letterSpacing: '-0.03em',
                }}
              >
                {detail.name}
              </h1>
              <div
                style={{
                  font: "400 11.5px 'IBM Plex Mono', monospace",
                  color: 'var(--drift)',
                  marginTop: 8,
                }}
              >
                {detail.meta}
              </div>
              {detail.isShow && (
                <div
                  style={{
                    font: "400 12px 'IBM Plex Mono', monospace",
                    color: 'var(--sub)',
                    marginTop: 14,
                  }}
                >
                  {detail.progressLine}
                </div>
              )}
              {detail.recommendedBy && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    font: "400 11.5px 'IBM Plex Mono', monospace",
                    color: 'var(--sun)',
                    marginTop: 8,
                  }}
                >
                  <span>recommended by {detail.recommendedBy}</span>
                  {detail.onDecideRecommendation && (
                    <button
                      className="tl-focus-r6"
                      onClick={detail.onDecideRecommendation}
                      style={{
                        font: "500 11.5px 'Inter Tight', sans-serif",
                        color: 'var(--aqua)',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      Decide
                    </button>
                  )}
                </div>
              )}
              {detail.sharedWith.length > 0 && (
                <div
                  style={{
                    font: "400 11.5px 'IBM Plex Mono', monospace",
                    color: 'var(--aqua)',
                    marginTop: 8,
                  }}
                >
                  watching with {detail.sharedWith.join(', ')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button
                  className="tl-focus tl-hover-pill"
                  onClick={detail.onWatchlist}
                  aria-pressed={detail.inWatchlist}
                  style={{
                    font: "500 12.5px 'Inter Tight', sans-serif",
                    color: 'var(--sub)',
                    background: 'none',
                    border: '1px solid var(--line)',
                    borderRadius: 999,
                    padding: '8px 13px',
                    cursor: 'pointer',
                  }}
                >
                  {detail.watchlistLabel}
                </button>
                {detail.canRecommend && (
                  <button
                    className="tl-focus tl-hover-pill"
                    onClick={detail.onRecommend}
                    style={{
                      font: "500 12.5px 'Inter Tight', sans-serif",
                      color: 'var(--sub)',
                      background: 'none',
                      border: '1px solid var(--line)',
                      borderRadius: 999,
                      padding: '8px 13px',
                      cursor: 'pointer',
                    }}
                  >
                    Recommend
                  </button>
                )}
                {detail.trailerUrl && (
                  <a
                    className="tl-focus tl-hover-pill"
                    href={detail.trailerUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{
                      font: "500 12.5px 'Inter Tight', sans-serif",
                      color: 'var(--sub)',
                      textDecoration: 'none',
                      border: '1px solid var(--line)',
                      borderRadius: 999,
                      padding: '8px 13px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: 10 }}>▶</span> Trailer
                  </a>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <TideBar
              pct={detail.pct}
              height={5}
              radius={3}
              crest={detail.pct > 0 && detail.pct < 100}
              animate
            />
          </div>

          <p
            style={{
              font: "400 14px/1.55 'Inter Tight', sans-serif",
              color: 'var(--sub)',
              margin: '16px 0 0',
              textWrap: 'pretty',
            }}
          >
            {detail.overview}
          </p>

          <WatchTogether watchTogether={watchTogether} />

          {detail.isMovie && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginTop: 22,
                flexWrap: 'wrap',
              }}
            >
              <button
                className="tl-focus"
                onClick={detail.onToggleMovie}
                aria-pressed={detail.movieWatched}
                style={{
                  font: "500 14px 'Inter Tight', sans-serif",
                  color: detail.movieWatched ? '#0E332F' : 'var(--text)',
                  background: detail.movieWatched ? 'var(--seafoam)' : 'transparent',
                  border: '1px solid var(--seafoam)',
                  borderRadius: 10,
                  padding: '12px 18px',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                {detail.movieLabel}
              </button>
              {detail.onToggleStarted && (
                <button
                  className="tl-focus tl-hover-pill"
                  onClick={detail.onToggleStarted}
                  aria-pressed={detail.movieStarted}
                  style={{ ...pillStyle, color: detail.movieStarted ? 'var(--aqua)' : 'var(--sub)' }}
                >
                  {detail.startedLabel}
                </button>
              )}
              <div style={{ display: 'flex', gap: 2 }} role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = n <= detail.rating
                  return (
                    <button
                      key={n}
                      className="tl-focus-r6"
                      role="radio"
                      aria-checked={n === detail.rating}
                      aria-label={`Rate ${n} of 5`}
                      onClick={() => detail.onRate(n)}
                      style={{
                        fontSize: 22,
                        lineHeight: 1,
                        color: filled ? 'var(--sun)' : 'var(--drift)',
                        background: 'none',
                        border: 'none',
                        padding: '8px 3px',
                        cursor: 'pointer',
                        minHeight: 44,
                      }}
                    >
                      {filled ? '★' : '☆'}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {detail.isShow && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              {detail.seasons.map((se) => (
                <div
                  key={se.number}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    background: 'var(--card)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px' }}>
                    <button
                      className="tl-focus-inset"
                      onClick={se.onToggle}
                      aria-expanded={se.open}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 10,
                        flex: 1,
                        minWidth: 0,
                        background: 'none',
                        border: 'none',
                        padding: 12,
                        margin: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'inherit',
                        minHeight: 44,
                      }}
                    >
                      <span
                        style={{
                          font: "600 14.5px 'Bricolage Grotesque', sans-serif",
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {se.title}
                      </span>
                      <span style={{ font: "400 11px 'IBM Plex Mono', monospace", color: 'var(--drift)' }}>
                        {se.sub}
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          font: "400 12px 'IBM Plex Mono', monospace",
                          color: 'var(--drift)',
                        }}
                        aria-hidden="true"
                      >
                        {se.open ? '−' : '+'}
                      </span>
                    </button>
                    {/*
                      A season always offers the move it is not already in:
                      *Mark season watched* until it is full, then *Mark season
                      unwatched* to take that back. Undoing is drawn in the
                      muted colour the app gives every other Remove and Stop —
                      aqua is reserved for the action that adds something.
                    */}
                    <button
                      className="tl-focus tl-hover-line"
                      onClick={se.onMarkAll}
                      style={{
                        flex: 'none',
                        font: "400 11px 'IBM Plex Mono', monospace",
                        color: se.watchedAll ? 'var(--sub)' : 'var(--aqua)',
                        background: 'none',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        minHeight: 36,
                      }}
                    >
                      {se.markLabel}
                    </button>
                  </div>

                  {se.open && (
                    <div style={{ padding: '0 16px 8px' }}>
                      {se.episodes.map((ep) => (
                        <div
                          key={ep.number}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '9px 0',
                            borderTop: '1px solid var(--track)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={ep.watched}
                            onChange={ep.onToggle}
                            aria-label={`Mark ${ep.code} watched`}
                            style={{
                              width: 19,
                              height: 19,
                              accentColor: 'var(--aqua)',
                              margin: 0,
                              flex: 'none',
                              cursor: 'pointer',
                            }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                              <span
                                style={{
                                  font: "500 11px 'IBM Plex Mono', monospace",
                                  color: 'var(--aqua)',
                                }}
                              >
                                {ep.code}
                              </span>
                              <span
                                style={{
                                  font: "400 13.5px 'Inter Tight', sans-serif",
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {ep.name}
                              </span>
                            </div>
                            <div
                              style={{
                                font: "400 10.5px 'IBM Plex Mono', monospace",
                                color: 'var(--drift)',
                                marginTop: 3,
                              }}
                            >
                              {ep.sub}
                            </div>
                          </div>
                          {!ep.watched && (
                            <button
                              className="tl-focus tl-hover-catch"
                              onClick={ep.onCatchUp}
                              title="Mark this and all previous episodes watched"
                              style={{
                                flex: 'none',
                                font: "400 10.5px 'IBM Plex Mono', monospace",
                                color: 'var(--sub)',
                                background: 'none',
                                border: '1px solid var(--line)',
                                borderRadius: 8,
                                padding: '7px 9px',
                                cursor: 'pointer',
                              }}
                            >
                              Catch up
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
