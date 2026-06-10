import { useEffect, useState } from 'react'

/**
 * Intro veil: a percentage counter that climbs to 100%,
 * then the whole veil zooms away to reveal the globe.
 */
export default function Loader() {
  const [progress, setProgress] = useState(0)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const DURATION = 1900

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      // ease-out so the counter sprints early and lands softly
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(Math.round(eased * 100))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setTimeout(() => setGone(true), 700)
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
      <p className="loader__label">{done ? 'The map ends here' : 'Charting the route'}</p>
    </div>
  )
}
