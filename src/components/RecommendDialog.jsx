import { useState } from 'react'

import Modal from './Modal.jsx'

const pillStyle = {
  flex: 'none',
  font: "500 12.5px 'Inter Tight', sans-serif",
  color: 'var(--sub)',
  background: 'none',
  border: '1px solid var(--line)',
  borderRadius: 999,
  padding: '8px 13px',
  cursor: 'pointer',
  minHeight: 38,
}

const primaryButton = {
  font: "500 13.5px 'Inter Tight', sans-serif",
  color: '#0E332F',
  background: 'var(--seafoam)',
  border: 'none',
  borderRadius: 10,
  padding: '11px 16px',
  cursor: 'pointer',
  minHeight: 44,
}

const mutedStyle = { font: "400 12.5px 'Inter Tight', sans-serif", color: 'var(--sub)' }

/** What a friend's row says when there is already a recommendation between you. */
const stateNote = {
  sent: 'sent — waiting on them',
  accepted: 'on their watchlist',
  ignored: 'they passed on this one',
}

/**
 * Recommend a title to friends.
 *
 * Several friends at once, because recommending is usually one thought about
 * more than one person, and one note for all of them — a note per friend would
 * be a different feature (a message), and this is not one.
 *
 * A friend you have already recommended this to is shown rather than hidden:
 * knowing you have already sent it is the answer to the question you opened
 * this for.
 */
export default function RecommendDialog({ recommend, onClose }) {
  const [picked, setPicked] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const { name, rows, noteMax } = recommend
  const open = rows.filter((r) => r.state === 'none')
  const already = rows.filter((r) => r.state !== 'none')

  const toggle = (userId) =>
    setPicked((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))

  const send = async () => {
    setBusy(true)
    setMessage('')
    const err = await recommend.onSend(picked, note)
    setBusy(false)
    if (err) {
      setMessage(err)
      return
    }
    onClose()
  }

  return (
    <Modal label={`Recommend ${name}`} onClose={onClose}>
      <div style={{ font: "600 17px 'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}>
        Recommend {name}
      </div>
      <div style={{ ...mutedStyle, marginTop: 6 }}>
        They decide what to do with it — nothing lands on their watchlist unless they say so.
      </div>

      {!rows.length && (
        <div style={{ ...mutedStyle, marginTop: 16 }}>
          No friends yet. Add someone by their username on the Account tab, then you can pass this along.
        </div>
      )}

      {open.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          {open.map((row) => {
            const on = picked.includes(row.userId)
            return (
              <button
                key={row.userId}
                className="tl-focus-r10"
                role="checkbox"
                aria-checked={on}
                disabled={busy}
                onClick={() => toggle(row.userId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  font: "500 13.5px 'Inter Tight', sans-serif",
                  color: on ? 'var(--aqua)' : 'var(--text)',
                  background: 'none',
                  border: `1px solid ${on ? 'var(--aqua)' : 'var(--line)'}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: 'none',
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: `1px solid ${on ? 'var(--aqua)' : 'var(--line)'}`,
                    background: on ? 'var(--aqua)' : 'transparent',
                    color: '#0E332F',
                    font: "600 11px 'Inter Tight', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{row.username}</span>
              </button>
            )
          })}
        </div>
      )}

      {already.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {already.map((row) => (
            <div key={row.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: "500 13.5px 'Inter Tight', sans-serif", overflowWrap: 'anywhere' }}>
                  {row.username}
                </div>
                <div style={{ font: "400 11px 'IBM Plex Mono', monospace", color: 'var(--drift)', marginTop: 3 }}>
                  {stateNote[row.state]}
                </div>
              </div>
              {row.state === 'sent' && (
                <button
                  className="tl-focus tl-hover-pill"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    setMessage('')
                    const err = await recommend.onWithdraw(row.recommendationId)
                    setBusy(false)
                    setMessage(err || '')
                  }}
                  style={pillStyle}
                >
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <>
          <textarea
            className="tl-focus-inset1"
            rows={2}
            maxLength={noteMax}
            placeholder="Say why (optional)"
            aria-label="Note"
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              marginTop: 14,
              font: "400 14px 'Inter Tight', sans-serif",
              color: 'var(--text)',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '11px 13px',
            }}
          />
          <div style={{ font: "400 10.5px 'IBM Plex Mono', monospace", color: 'var(--drift)', marginTop: 4 }}>
            {note.length}/{noteMax}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {open.length > 0 && (
          <button className="tl-focus" disabled={busy || !picked.length} onClick={send} style={primaryButton}>
            {picked.length > 1 ? `Send to ${picked.length} friends` : 'Send'}
          </button>
        )}
        <button
          className="tl-focus tl-hover-pill"
          disabled={busy}
          onClick={onClose}
          style={{ ...pillStyle, borderRadius: 10, padding: '11px 16px', minHeight: 44 }}
        >
          {open.length > 0 ? 'Cancel' : 'Close'}
        </button>
      </div>

      {message && (
        <div
          role="status"
          style={{ font: "400 11.5px 'IBM Plex Mono', monospace", color: 'var(--sub)', marginTop: 12 }}
        >
          {message}
        </div>
      )}
    </Modal>
  )
}
