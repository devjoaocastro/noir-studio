import { useEffect, useRef } from 'react'
import { onOffset } from '../scrollBus'

const MAX_DEPTH = 4000

function zoneFor(meters: number) {
  if (meters < 200) return 'sunlit zone'
  if (meters < 1000) return 'twilight zone'
  if (meters < 3800) return 'midnight zone'
  return 'abyssal plain'
}

/**
 * Fixed gauge at the screen edge: current depth (0 m → 4,000 m)
 * bound 1:1 to the scroll offset, published per-frame by Experience.
 */
export default function DepthMeter() {
  const value = useRef<HTMLSpanElement>(null!)
  const zone = useRef<HTMLSpanElement>(null!)
  const fill = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    return onOffset((offset) => {
      const meters = Math.round(offset * MAX_DEPTH)
      value.current.textContent = `−${meters.toLocaleString('en-US')} m`
      zone.current.textContent = zoneFor(meters)
      fill.current.style.height = `${(offset * 100).toFixed(2)}%`
    })
  }, [])

  return (
    <div className="depth-meter" aria-hidden="true">
      <span ref={value} className="depth-meter__value">
        −0 m
      </span>
      <div className="depth-meter__track">
        <div ref={fill} className="depth-meter__fill" />
      </div>
      <span ref={zone} className="depth-meter__zone">
        sunlit zone
      </span>
    </div>
  )
}
