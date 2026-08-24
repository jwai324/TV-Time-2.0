/**
 * The tide bar — a progress track with a small crest riding the waterline.
 *
 * The crest drifts sideways forever (`tidedrift`), and slides to its new
 * position when `animate` is set, which is what sells "mark watched" on the
 * Up Next cards.
 */
export default function TideBar({
  pct,
  height = 5,
  radius = 0,
  crest = false,
  crestWidth = 14,
  crestHeight = 8,
  drift = '4.5s',
  animate = false,
}) {
  const rounded = radius ? { borderRadius: radius } : null

  return (
    <div style={{ position: 'relative', height, background: 'var(--track)', ...rounded }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${pct}%`,
          background: 'var(--seafoam)',
          ...rounded,
          ...(animate ? { transition: 'width .35s ease' } : null),
        }}
      />
      {crest && (
        <div
          style={{
            position: 'absolute',
            left: `calc(${pct}% - ${crestWidth / 2}px)`,
            bottom: 0,
            width: crestWidth,
            height: crestHeight,
            background: 'var(--seafoam)',
            borderRadius: '100% 100% 0 0',
            animation: `tidedrift ${drift} ease-in-out infinite`,
            ...(animate ? { transition: 'left .35s ease' } : null),
          }}
        />
      )}
    </div>
  )
}
