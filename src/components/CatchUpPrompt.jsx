import Modal from './Modal.jsx'

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
 * Ticking something off in the middle of a show leaves a question behind: did
 * you watch what came before it, or did you skip it?
 *
 * Only the person marking knows, so the app asks rather than guesses — and it
 * asks only when there is a real gap behind the mark. Both answers finish the
 * mark you started; the difference is whether the gap goes with it.
 *
 * Dismissing the dialog cancels the mark outright. Nothing has been written
 * yet at this point, so closing an unanswered question is the one reading that
 * cannot be wrong.
 */
export default function CatchUpPrompt({ prompt }) {
  return (
    <Modal label={prompt.heading} onClose={prompt.onCancel}>
      <div
        style={{
          font: "400 11px 'IBM Plex Mono', monospace",
          color: 'var(--drift)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}
      >
        {prompt.name}
      </div>

      <div
        style={{
          font: "600 18px/1.2 'Bricolage Grotesque', sans-serif",
          letterSpacing: '-0.02em',
          marginTop: 10,
          textWrap: 'pretty',
        }}
      >
        {prompt.heading}
      </div>

      <p
        style={{
          font: "400 13.5px/1.5 'Inter Tight', sans-serif",
          color: 'var(--sub)',
          margin: '10px 0 0',
          textWrap: 'pretty',
        }}
      >
        {prompt.detail}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
        <button
          className="tl-focus"
          onClick={prompt.onYes}
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
          {prompt.yesLabel}
        </button>
        <button className="tl-focus tl-hover-pill" onClick={prompt.onNo} style={pillStyle}>
          {prompt.noLabel}
        </button>
      </div>

      {/*
        A switch rather than a third answer: it says what the app should do
        next time, and leaves this time's question to the two buttons above.
        It takes effect the moment it is pressed, which is why the line under
        it says where to undo that.
      */}
      <button
        className="tl-focus tl-hover-line"
        role="switch"
        aria-checked={!prompt.ask}
        onClick={prompt.onToggleAsk}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          width: '100%',
          boxSizing: 'border-box',
          font: "500 12.5px 'Inter Tight', sans-serif",
          color: prompt.ask ? 'var(--sub)' : 'var(--aqua)',
          background: 'none',
          border: '1px solid var(--line)',
          borderRadius: 10,
          padding: '11px 14px',
          marginTop: 14,
          cursor: 'pointer',
          minHeight: 44,
          textAlign: 'left',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
            width: 18,
            height: 18,
            borderRadius: 5,
            fontSize: 11,
            lineHeight: 1,
            color: '#0E332F',
            background: prompt.ask ? 'transparent' : 'var(--aqua)',
            border: `1px solid ${prompt.ask ? 'var(--line)' : 'var(--aqua)'}`,
          }}
        >
          {prompt.ask ? '' : '✓'}
        </span>
        Don't ask this again
      </button>

      <div
        role="status"
        style={{ font: "400 11.5px 'IBM Plex Mono', monospace", color: 'var(--drift)', marginTop: 9 }}
      >
        {prompt.ask
          ? 'You can turn this question off for good — Account · Prompts brings it back.'
          : 'Off from now on. Turn it back on under Account · Prompts.'}
      </div>
    </Modal>
  )
}
