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

const cardStyle = {
  margin: '0 20px',
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: 16,
}

const sectionStyle = {
  padding: '26px 20px 8px',
  font: "400 11px 'IBM Plex Mono', monospace",
  color: 'var(--drift)',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
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

const quietButton = {
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

const noteStyle = { font: "400 11.5px 'IBM Plex Mono', monospace", color: 'var(--sub)', marginTop: 10 }
const mutedStyle = { font: "400 12.5px 'Inter Tight', sans-serif", color: 'var(--sub)' }

function Section({ label, children }) {
  return (
    <>
      <div style={sectionStyle}>{label}</div>
      <div style={cardStyle}>{children}</div>
    </>
  )
}

/** A name on the left, one or two actions on the right. */
function Row({ primary, secondary, actions, onOpen }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {onOpen ? (
          <button
            className="tl-focus-r6"
            onClick={onOpen}
            style={{
              font: "500 13.5px 'Inter Tight', sans-serif",
              color: 'var(--aqua)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              overflowWrap: 'anywhere',
            }}
          >
            {primary}
          </button>
        ) : (
          <div style={{ font: "500 13.5px 'Inter Tight', sans-serif", overflowWrap: 'anywhere' }}>{primary}</div>
        )}
        {secondary && (
          <div style={{ font: "400 11px 'IBM Plex Mono', monospace", color: 'var(--drift)', marginTop: 4 }}>
            {secondary}
          </div>
        )}
      </div>
      {actions}
    </div>
  )
}

/** Sign in, or create an account and take a username at the same time. */
function SignedOut({ account, say }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('in')

  const submit = async () => {
    setBusy(true)
    say('')
    const err = mode === 'in' ? await account.signIn(email, password) : await account.signUp(email, password, username)
    setBusy(false)
    say(err || '')
  }

  return (
    <>
      <div style={{ ...mutedStyle, marginBottom: 12 }}>
        Sign in to keep your history synced across devices and watch shows with friends. Without an account,
        everything stays on this device.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mode === 'up' && (
          <input
            className="tl-focus-inset1"
            autoComplete="username"
            placeholder="Username"
            aria-label="Username"
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
            style={inputStyle}
          />
        )}
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
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="tl-focus" onClick={submit} disabled={busy} style={primaryButton}>
          {mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button
          className="tl-focus tl-hover-pill"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            say('')
          }}
          disabled={busy}
          style={{ ...quietButton, borderRadius: 10, padding: '11px 16px', minHeight: 44 }}
        >
          {mode === 'in' ? 'Create account' : 'I have an account'}
        </button>
      </div>
    </>
  )
}

/** The one-time prompt for an account that predates usernames. */
function ChooseUsername({ account, say }) {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <>
      <div style={{ ...mutedStyle, marginBottom: 12 }}>
        Pick a username. It is how friends add you, and it is the only thing they can see about your account.
      </div>
      <input
        className="tl-focus-inset1"
        autoComplete="username"
        placeholder="Username"
        aria-label="Username"
        value={username}
        onChange={(ev) => setUsername(ev.target.value)}
        style={inputStyle}
      />
      <button
        className="tl-focus"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          say('')
          const err = await account.chooseUsername(username)
          setBusy(false)
          say(err || '')
        }}
        style={{ ...primaryButton, marginTop: 12 }}
      >
        Claim it
      </button>
    </>
  )
}

/** Add a friend by username, and answer the requests waiting on you. */
function Friends({ account, say }) {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)

  const act = (fn) => async () => {
    setBusy(true)
    say('')
    const err = await fn()
    setBusy(false)
    say(err || '')
  }

  const { friends, incomingRequests, outgoingRequests } = account

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="tl-focus-inset1"
          autoComplete="off"
          placeholder="Add by username"
          aria-label="Add a friend by username"
          value={username}
          onChange={(ev) => setUsername(ev.target.value)}
          style={inputStyle}
        />
        <button
          className="tl-focus"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            say('')
            const { ok, error } = await account.addFriend(username)
            setBusy(false)
            say(error || ok || '')
            if (!error) setUsername('')
          }}
          style={{ ...primaryButton, flex: 'none' }}
        >
          Add
        </button>
      </div>

      {incomingRequests.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {incomingRequests.map((r) => (
            <Row
              key={r.id}
              primary={r.username}
              secondary="wants to be friends"
              actions={
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="tl-focus tl-hover-pill"
                    disabled={busy}
                    onClick={act(() => account.acceptFriend(r.id))}
                    style={{ ...quietButton, color: 'var(--aqua)', borderColor: 'var(--aqua)' }}
                  >
                    Accept
                  </button>
                  <button
                    className="tl-focus tl-hover-pill"
                    disabled={busy}
                    onClick={act(() => account.removeFriend(r.id))}
                    style={quietButton}
                  >
                    Decline
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: friends.length || outgoingRequests.length ? 8 : 0 }}>
        {friends.map((f) => (
          <Row
            key={f.id}
            primary={f.username}
            actions={
              <button
                className="tl-focus tl-hover-pill"
                disabled={busy}
                onClick={act(() => account.removeFriend(f.id))}
                style={quietButton}
              >
                Remove
              </button>
            }
          />
        ))}
        {outgoingRequests.map((r) => (
          <Row
            key={r.id}
            primary={r.username}
            secondary="request sent"
            actions={
              <button
                className="tl-focus tl-hover-pill"
                disabled={busy}
                onClick={act(() => account.removeFriend(r.id))}
                style={quietButton}
              >
                Withdraw
              </button>
            }
          />
        ))}
      </div>

      {!friends.length && !incomingRequests.length && !outgoingRequests.length && (
        <div style={{ ...mutedStyle, marginTop: 14 }}>
          No friends yet. Add someone by their username, then open a show and pick them under Watch together.
        </div>
      )}
    </>
  )
}

/** Invitations to watch something together, and the shows already shared. */
function Together({ account, say }) {
  const [busy, setBusy] = useState(false)
  const { sharing, shareInvites, shareRequests } = account

  const act = (fn) => async () => {
    setBusy(true)
    say('')
    const err = await fn()
    setBusy(false)
    say(err || '')
  }

  if (!sharing.length && !shareInvites.length && !shareRequests.length) {
    return (
      <div style={mutedStyle}>
        Nothing shared yet. Open a show and pick a friend under Watch together — from then on, whatever either of
        you marks is marked for both.
      </div>
    )
  }

  return (
    <>
      {shareInvites.map((sh) => (
        <Row
          key={sh.id}
          primary={sh.name}
          secondary={`${sh.username} wants to watch this with you`}
          onOpen={() => account.openTitle(sh.titleId)}
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="tl-focus tl-hover-pill"
                disabled={busy}
                onClick={act(() => account.acceptInvite(sh.id))}
                style={{ ...quietButton, color: 'var(--aqua)', borderColor: 'var(--aqua)' }}
              >
                Accept
              </button>
              <button
                className="tl-focus tl-hover-pill"
                disabled={busy}
                onClick={act(() => account.declineInvite(sh.id))}
                style={quietButton}
              >
                Decline
              </button>
            </div>
          }
        />
      ))}
      {sharing.map((sh) => (
        <Row
          key={sh.id}
          primary={sh.name}
          secondary={`watching with ${sh.username}`}
          onOpen={() => account.openTitle(sh.titleId)}
          actions={
            <button
              className="tl-focus tl-hover-pill"
              disabled={busy}
              onClick={act(() => account.stopSharing(sh.id))}
              style={quietButton}
            >
              Stop
            </button>
          }
        />
      ))}
      {shareRequests.map((sh) => (
        <Row
          key={sh.id}
          primary={sh.name}
          secondary={`asked ${sh.username} to watch along`}
          onOpen={() => account.openTitle(sh.titleId)}
          actions={
            <button
              className="tl-focus tl-hover-pill"
              disabled={busy}
              onClick={act(() => account.declineInvite(sh.id))}
              style={quietButton}
            >
              Withdraw
            </button>
          }
        />
      ))}
    </>
  )
}

/**
 * Recommendations that are still open: the ones you put off or looked away
 * from, and the ones you sent that nobody has answered.
 *
 * A deferred recommendation is otherwise invisible until its three days are
 * up, and "I will decide later" should not mean "I cannot decide sooner" —
 * so *Decide now* brings the prompt straight back.
 */
function Recommendations({ account, say }) {
  const [busy, setBusy] = useState(false)
  const { recommendationsWaiting: waiting, recommendationsSent: sent } = account

  if (!waiting.length && !sent.length) {
    return (
      <div style={mutedStyle}>
        Nothing waiting. Open a title and hit <strong style={{ fontWeight: 500 }}>Recommend</strong> to put it in
        front of a friend — they choose whether it lands on their watchlist.
      </div>
    )
  }

  return (
    <>
      {waiting.map((r) => (
        <Row
          key={r.id}
          primary={r.name}
          secondary={`${r.username} recommended this${r.deferred ? ' — you put it off' : ''}`}
          onOpen={() => account.openTitle(r.titleId)}
          actions={
            <button
              className="tl-focus tl-hover-pill"
              disabled={busy}
              onClick={() => account.decideRecommendation(r.id)}
              style={{ ...quietButton, color: 'var(--aqua)', borderColor: 'var(--aqua)' }}
            >
              Decide now
            </button>
          }
        />
      ))}
      {sent.map((r) => (
        <Row
          key={r.id}
          primary={r.name}
          secondary={`recommended to ${r.username} — not answered yet`}
          onOpen={() => account.openTitle(r.titleId)}
          actions={
            <button
              className="tl-focus tl-hover-pill"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                say('')
                const err = await account.withdrawRecommendation(r.id)
                setBusy(false)
                say(err || '')
              }}
              style={quietButton}
            >
              Withdraw
            </button>
          }
        />
      ))}
    </>
  )
}

/**
 * The questions the app asks while you mark things off, and whether it still
 * asks them.
 *
 * Every "don't ask this again" in the app lands here, which is the deal that
 * makes such a button safe to press: turning a prompt off is never the last
 * word on it. These are settings of the device rather than of the account, so
 * the section stands whether or not anyone is signed in.
 */
function Prompts({ account }) {
  const rows = [
    {
      key: 'askPreviousSeasons',
      primary: 'Ask about previous seasons',
      secondary: 'when you mark a season watched with earlier seasons unwatched',
    },
    {
      key: 'askPreviousEpisodes',
      primary: 'Ask about previous episodes',
      secondary: 'when you tick an episode with earlier ones in the season unwatched',
    },
  ]

  return (
    <>
      {rows.map((row) => {
        const on = !!account.prefs[row.key]
        return (
          <Row
            key={row.key}
            primary={row.primary}
            secondary={row.secondary}
            actions={
              <button
                className="tl-focus tl-hover-pill"
                role="switch"
                aria-checked={on}
                aria-label={row.primary}
                onClick={() => account.setPref(row.key, !on)}
                style={on ? { ...quietButton, color: 'var(--aqua)', borderColor: 'var(--aqua)' } : quietButton}
              >
                {on ? 'On' : 'Off'}
              </button>
            }
          />
        )
      })}
    </>
  )
}

export default function Account({ account }) {
  const [message, setMessage] = useState('')
  const signedIn = !!account.email

  return (
    <>
      <div style={{ padding: '28px 20px 10px' }}>
        <h1 style={{ margin: 0, font: "600 28px/1.1 'Bricolage Grotesque', sans-serif", letterSpacing: '-0.03em' }}>
          Account
        </h1>
      </div>

      <div style={{ ...cardStyle, marginTop: 6 }}>
        {!signedIn && <SignedOut account={account} say={setMessage} />}
        {signedIn && account.needsUsername && <ChooseUsername account={account} say={setMessage} />}
        {signedIn && !account.needsUsername && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "500 15px 'Inter Tight', sans-serif", overflowWrap: 'anywhere' }}>
                {account.username}
              </div>
              <div style={{ font: "400 11px 'IBM Plex Mono', monospace", color: 'var(--drift)', marginTop: 4 }}>
                {account.email} · syncing across devices
              </div>
            </div>
            <button
              className="tl-focus tl-hover-pill"
              onClick={async () => {
                setMessage('')
                setMessage((await account.signOut()) || '')
              }}
              style={quietButton}
            >
              Sign out
            </button>
          </div>
        )}
        {message && (
          <div role="status" style={noteStyle}>
            {message}
          </div>
        )}
      </div>

      {signedIn && !account.needsUsername && (
        <>
          <Section label="Friends">
            <Friends account={account} say={setMessage} />
          </Section>
          <Section label="Watching together">
            <Together account={account} say={setMessage} />
          </Section>
          <Section label="Recommendations">
            <Recommendations account={account} say={setMessage} />
          </Section>
        </>
      )}

      <Section label="Prompts">
        <Prompts account={account} />
      </Section>

      <div
        style={{
          padding: '22px 20px 8px',
          font: "400 10.5px 'IBM Plex Mono', monospace",
          color: 'var(--drift)',
        }}
      >
        This product uses the <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a> API
        but is not endorsed or certified by TMDB.
      </div>
    </>
  )
}
