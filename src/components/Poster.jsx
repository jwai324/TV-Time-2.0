import { posterBg } from '../lib/progress.js'

/** Cover art, falling back to the title's hue swatch. */
export default function Poster({ title, dark, width, height, radius }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: posterBg(title, dark),
        flex: 'none',
      }}
    />
  )
}
