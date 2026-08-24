import { useState } from 'react'

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  font: "400 14px 'Inter Tight', sans-serif",
  color: 'var(--text)',
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '11px 13px',
}

/** Email + password account card: sync across devices, or stay a guest. */
function AccountCard({ account }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const run = (action) => async () => {
    setBusy(true)
    setMessage('')
    const err = await action(email, password)
    setBusy(false)
    setMessage(err || '')
  }

  return (
    <>
      <div
        style={{
          padding: '26px 20px 8px',
          font: "400 11px 'IBM Plex Mono', monospace",
          color: 'var(--drift)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}
      >
        Account
      </div>
      <div
        style={{
          margin: '0 20px',
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        {account.email ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "500 13.5px 'Inter Tight', sans-serif", overflowWrap: 'anywhere' }}>
                {account.email}
              </div>
              <div style={{ font: "400 11px 'IBM Plex Mono', monospace", color: 'var(--drift)', marginTop: 4 }}>
                syncing across devices
              </div>
            </div>
            <button
              className="tl-focus tl-hover-pill"
              onClick={run(account.signOut)}
              disabled={busy}
              style={{
                flex: 'none',
                font: "500 12.5px 'Inter Tight', sans-serif",
                color: 'var(--sub)',
                background: 'none',
                border: '1px solid var(--line)',
                borderRadius: 999,
                padding: '8px 13px',
                cursor: 'pointer',
                minHeight: 38,
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <>
            <div style={{ font: "400 12.5px 'Inter Tight', sans-serif", color: 'var(--sub)', marginBottom: 12 }}>
              Sign in to keep your history synced across devices. Without an account, everything stays on this
              device.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="tl-focus-inset1"
                type="email"
                autoComplete="email"
                placeholder="Email"
                aria-label="Email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                style={inputStyle}
              />
              <input
                className="tl-focus-inset1"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                className="tl-focus"
                onClick={run(account.signIn)}
                disabled={busy}
                style={{
                  font: "500 13.5px 'Inter Tight', sans-serif",
                  color: '#0E332F',
                  background: 'var(--seafoam)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '11px 16px',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                Sign in
              </button>
              <button
                className="tl-focus tl-hover-pill"
                onClick={run(account.signUp)}
                disabled={busy}
                style={{
                  font: "500 13.5px 'Inter Tight', sans-serif",
                  color: 'var(--sub)',
                  background: 'none',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '11px 16px',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                Create account
              </button>
            </div>
          </>
        )}
        {message && (
          <div
            role="status"
            style={{ font: "400 11.5px 'IBM Plex Mono', monospace", color: 'var(--sub)', marginTop: 10 }}
          >
            {message}
          </div>
        )}
      </div>
    </>
  )
}

export default function Stats({ tiles, topGenres, account }) {
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

      {account && <AccountCard account={account} />}
    </>
  )
}
