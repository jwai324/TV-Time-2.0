import { useCallback, useEffect, useRef, useState } from 'react'

import { asset } from '../lib/pranks.js'

/**
 * Silence a sound and let go of it. Pausing alone leaves a paused "Tideline"
 * control in the phone's media tray, pointing straight at the app; dropping
 * the source releases it.
 */
const stop = (sound) => {
  sound.pause()
  sound.removeAttribute('src')
  sound.load()
}

/**
 * Hold a prank ready, and let it off.
 *
 * `fire` plays the sound and puts the image up; `active` is the prank while
 * it is up, and null again once its time has run. The sound is started from
 * `fire` itself rather than from an effect, because a browser only lets a
 * page start audio inside a user gesture — the tap on Mark watched, or the
 * short timer the Up Next animation sets inside it — and an effect runs
 * later than that. Both assets are fetched while the prank is armed, so
 * nothing is still loading at the moment it goes off.
 */
export function useJumpscare(prank) {
  const [active, setActive] = useState(null)
  const armed = useRef(null)
  const playing = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!prank) return
    const img = new Image()
    img.src = asset(prank.image)
    const sound = new Audio(asset(prank.sound))
    sound.preload = 'auto'
    sound.load()
    armed.current = sound
    return () => {
      armed.current = null
    }
  }, [prank])

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (playing.current) stop(playing.current)
    },
    []
  )

  const fire = useCallback(() => {
    if (!prank) return
    // Let off twice in quick succession, it starts over rather than doubling up.
    if (playing.current) stop(playing.current)
    const sound = armed.current || new Audio(asset(prank.sound))
    armed.current = null
    playing.current = sound
    sound.currentTime = 0
    sound.volume = 1
    sound.play().catch(() => {
      /* the browser would not start audio here; the image still goes up */
    })
    setActive(prank)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      stop(sound)
      playing.current = null
      setActive(null)
    }, prank.durationMs)
  }, [prank])

  return { fire, active }
}

/** The image, over everything, for as long as the prank runs. */
export default function Jumpscare({ prank }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#000',
        overflow: 'hidden',
      }}
    >
      <img
        src={asset(prank.image)}
        alt=""
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          // It creeps closer for as long as it is up.
          animation: `scare-lunge ${prank.durationMs}ms ease-out both`,
        }}
      />
    </div>
  )
}
