/**
 * A standing note at the top of every screen.
 *
 * It sits above the screen rather than inside it, edge to edge of the app
 * column, so it reads as something the app is saying rather than something
 * this particular page is — and so it says it in the same place every time,
 * whichever tab you are on.
 */
export default function DonationBanner() {
  return (
    <div
      role="note"
      style={{
        padding: '9px 20px',
        background: 'var(--track)',
        borderBottom: '1px solid var(--line)',
        font: "400 11.5px/1.4 'IBM Plex Mono', monospace",
        color: 'var(--sub)',
        textAlign: 'center',
        textWrap: 'balance',
      }}
    >
      Donations appreciated via Venmo <span style={{ color: 'var(--aqua)' }}>@Justin-Wai-324</span>
    </div>
  )
}
