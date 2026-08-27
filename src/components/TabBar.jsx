const TABS = [
  ['upnext', 'Up Next'],
  ['library', 'Library'],
  ['discover', 'Discover'],
  ['stats', 'Stats'],
  ['account', 'Account'],
]

export default function TabBar({ tab, onSelect }) {
  return (
    <nav
      aria-label="Main"
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        background: 'var(--card)',
        borderTop: '1px solid var(--line)',
        display: 'flex',
        boxSizing: 'border-box',
      }}
    >
      {TABS.map(([key, label]) => {
        const active = tab === key
        return (
          <button
            key={key}
            className="tl-focus-tab"
            onClick={() => onSelect(key)}
            aria-current={active ? 'page' : 'false'}
            style={{
              flex: 1,
              minHeight: 60,
              padding: '0 2px',
              background: 'none',
              border: 'none',
              borderTop: `2px solid ${active ? 'var(--seafoam)' : 'transparent'}`,
              color: active ? 'var(--aqua)' : 'var(--sub)',
              font: `${active ? 600 : 500} 12.5px 'Inter Tight', sans-serif`,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        )
      })}
    </nav>
  )
}
