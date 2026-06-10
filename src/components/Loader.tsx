import { useEffect, useState } from 'react'

/**
 * Intro veil: a percentage counter that climbs to 100%,
 * then the curtain of midnight velvet lifts to reveal the hotel.
 */
export default function Loader() {
  const [progress, setProgress] = useState(0)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const DURATION = 1800

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(Math.round(eased * 100))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setTimeout(() => setGone(true), 650)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (gone) return null

  const done = progress >= 100

  return (
    <div className={`loader ${done ? 'loader--done' : ''}`} aria-hidden="true">
      <div className="loader__counter">
        {progress}
        <span>%</span>
      </div>
      <p className="loader__label">{done ? 'The city is blushing' : 'Drawing the curtains'}</p>
    </div>
  )
}
