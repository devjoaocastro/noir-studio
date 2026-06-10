import { useEffect, useState } from 'react'

/**
 * Intro veil: an arcade boot sequence — percentage climbs to 100%,
 * then the whole veil lifts to reveal the smithy.
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
      // ease-out so the counter sprints early and lands softly
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
      <p className="loader__label">{done ? 'PRESS ANY KEY' : 'STOKING THE FORGE'}</p>
    </div>
  )
}
