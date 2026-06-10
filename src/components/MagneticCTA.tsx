import { useRef, type MouseEvent, type ReactNode } from 'react'

/**
 * Magnetic CTA — the element leans towards the cursor while hovered
 * and snaps back on leave.
 */
export default function MagneticCTA({
  href,
  className = '',
  children,
  onClick,
}: {
  href?: string
  className?: string
  children: ReactNode
  onClick?: () => void
}) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null)

  const onMove = (e: MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    el.style.transform = `translate(${(dx * 0.3).toFixed(1)}px, ${(dy * 0.32).toFixed(1)}px)`
  }

  const onLeave = () => {
    const el = ref.current
    if (el) el.style.transform = 'translate(0px, 0px)'
  }

  if (href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        className={`magnetic ${className}`}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onClick}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      className={`magnetic ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
