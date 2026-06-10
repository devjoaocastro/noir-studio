import { useRef, type MouseEvent, type ReactNode } from 'react'

/**
 * Magnetic wrapper: whatever sits inside is pulled towards the cursor
 * while hovered, then snaps back with a soft spring-like transition.
 */
export default function Magnetic({
  children,
  strength = 0.3,
}: {
  children: ReactNode
  strength?: number
}) {
  const ref = useRef<HTMLSpanElement>(null!)

  const onMove = (e: MouseEvent) => {
    const r = ref.current.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    ref.current.style.transform = `translate(${(dx * strength).toFixed(1)}px, ${(dy * strength).toFixed(1)}px)`
  }

  const onLeave = () => {
    ref.current.style.transform = 'translate(0px, 0px)'
  }

  return (
    <span className="magnetic" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </span>
  )
}
