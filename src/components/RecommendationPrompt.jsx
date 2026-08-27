import { useState } from 'react'

import Modal from './Modal.jsx'
import Poster from './Poster.jsx'

const pillStyle = {
  font: "500 12.5px 'Inter Tight', sans-serif",
  color: 'var(--sub)',
  background: 'none',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '11px 16px',
  cursor: 'pointer',
  minHeight: 44,
}

/**
 * A friend has recommended something: decide, or decide later.
 *
 * The three answers are the whole dialog. Watchlisting it is the only one that
 * touches your record — passing and deferring say something about the
 * recommendation, not about the title — and deferring is deliberately not a
 * decision: the question comes back in three days exactly as it is now.
 *
 * Dismissing the dialog (Escape, or a tap outside it) defers as well, because
 * closing something without answering it is the same thing as putting it off.
 */
export default function RecommendationPrompt({ prompt, dark }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const act = (fn) => async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    const err = await fn()
    setBusy(false)
    setMessage(err || '')
  }

  const defer = act(() => prompt.onDefer())

  return (
    <Modal label={`${prompt.from} recommends ${prompt.name}`} onClose={defer}>
      <div
        style={{
          font: "400 11px 'IBM Plex Mono', monospace",
          color: 'var(--drift)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}
      >
        Recommended{prompt.remaining > 0 ? ` · ${prompt.remaining} more waiting` : ''}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: 12 }}>
        {prompt.title && <Poster title={prompt.title} dark={dark} width={72} height={100} radius={8} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              font: "600 18px/1.15 'Bricolage Grotesque', sans-serif",
              letterSpacing: '-0.02em',
              overflowWrap: 'anywhere',
            }}
          >
            {prompt.name}
          </div>
          {prompt.meta && (
            <div style={{ font: "400 11.5px 'IBM Plex Mono', monospace", color: 'var(--drift)', marginTop: 7 }}>
              {prompt.meta}
            </div>
          )}
          <div style={{ font: "400 12.5px 'Inter Tight', sans-serif", color: 'var(--aqua)', marginTop: 9 }}>
            {prompt.from} thinks you should watch this
          </div>
        </div>
      </div>

      {prompt.note && (
        <p
          style={{
            font: "400 13.5px/1.5 'Inter Tight', sans-serif",
            color: 'var(--sub)',
            margin: '14px 0 0',
            padding: '10px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            textWrap: 'pretty',
            overflowWrap: 'anywhere',
          }}
        >
          “{prompt.note}”
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
        <button
          className="tl-focus"
          disabled={busy}
          onClick={act(() => prompt.onAccept())}
          style={{
            font: "500 14px 'Inter Tight', sans-serif",
            color: '#0E332F',
            background: 'var(--seafoam)',
            border: '1px solid var(--seafoam)',
            borderRadius: 10,
            padding: '12px 18px',
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Add to watchlist
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="tl-focus tl-hover-pill"
            disabled={busy}
            onClick={defer}
            style={{ ...pillStyle, flex: 1 }}
          >
            Ask me in {prompt.deferDays} days
          </button>
          <button
            className="tl-focus tl-hover-pill"
            disabled={busy}
            onClick={act(() => prompt.onIgnore())}
            style={{ ...pillStyle, flex: 'none' }}
          >
            Not for me
          </button>
        </div>
      </div>

      <button
        className="tl-focus-r6"
        disabled={busy}
        onClick={prompt.onOpen}
        style={{
          font: "500 12.5px 'Inter Tight', sans-serif",
          color: 'var(--aqua)',
          background: 'none',
          border: 'none',
          padding: '10px 0 0',
          cursor: 'pointer',
          minHeight: 38,
        }}
      >
        See more about it first →
      </button>

      {message && (
        <div
          role="status"
          style={{ font: "400 11.5px 'IBM Plex Mono', monospace", color: 'var(--sub)', marginTop: 10 }}
        >
          {message}
        </div>
      )}
    </Modal>
  )
}
