/**
 * A standing note at the top of every screen.
 *
 * It sits above the screen rather than inside it, edge to edge of the app
 * column, so it reads as something the app is saying rather than something
 * this particular page is — and so it says it in the same place every time,
 * whichever tab you are on.
 *
 * The handle carries the link rather than the whole strip: a banner that is
 * one big target is a banner you leave the app by hitting on the way to a
 * tab, and the underlined handle is the part that looks like it goes
 * somewhere. It opens in a new tab, the same as the trailer link, because
 * nothing about paying someone should cost you your place in the app.
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
      Donations appreciated via Venmo{' '}
      <a
        className="tl-focus-r6"
        href="https://venmo.com/u/Justin-Wai-324"
        target="_blank"
        rel="noreferrer noopener"
      >
        @Justin-Wai-324
      </a>
    </div>
  )
}
