import { useEffect, useState } from 'react'

/**
 * Slate-style intro: a percentage counter climbs to 100%, then the
 * black veil fades and the letterbox bars open onto the hero.
 */
export default function Loader() {
  const [progress, setProgress] = useState(0)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const DURATION = 1500

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      // ease-out so the counter sprints early and lands softly
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(Math.round(eased * 100))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setTimeout(() => setGone(true), 500)
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
      <p className="loader__label">{done ? 'Roll camera' : 'Loading the dailies'}</p>
    </div>
  )
}
