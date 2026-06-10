import { useEffect, useState } from 'react'

/**
 * Intro veil: a percentage counter that climbs to 100%,
 * then the paper lifts away to reveal the prism.
 */
export default function Loader() {
  const [progress, setProgress] = useState(0)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const DURATION = 1700

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
      <div className="loader__bar">
        <div className="loader__bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="loader__label">{done ? 'Light is ready' : 'Splitting white light'}</p>
    </div>
  )
}
