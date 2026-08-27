import { useEffect, useRef } from 'react'

/**
 * The popup both halves of recommending use.
 *
 * A dialog rather than a screen, because both of these interrupt what you were
 * doing and hand it straight back: it sits over the app, Escape closes it, the
 * backdrop closes it, and focus moves inside on open and returns to whatever
 * had it when it closes. `onClose` is what "dismiss without deciding" means,
 * so a prompt that must be answered simply does not pass one.
 */
export default function Modal({ label, onClose, children }) {
  const card = useRef(null)
  const opener = useRef(null)

  useEffect(() => {
    opener.current = document.activeElement
    card.current?.focus()
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [])

  useEffect(() => {
    if (!onClose) return
    const onKey = (ev) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Tab is held inside the card: a dialog you can tab out of leaves the reader
  // somewhere they cannot see.
  const onKeyDown = (ev) => {
    if (ev.key !== 'Tab') return
    const stops = [...card.current.querySelectorAll('button, [href], input, textarea, select')].filter(
      (el) => !el.disabled && el.tabIndex !== -1
    )
    if (!stops.length) return
    const first = stops[0]
    const last = stops[stops.length - 1]
    const active = document.activeElement
    if (ev.shiftKey && (active === first || active === card.current)) {
      ev.preventDefault()
      last.focus()
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      onMouseDown={(ev) => {
        if (onClose && ev.target === ev.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(14, 51, 47, .45)',
      }}
    >
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          maxWidth: 398,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 18,
          outline: 'none',
          boxShadow: '0 18px 48px rgba(14, 51, 47, .28)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
