import { useRef } from 'react'

/**
 * Magnetic CTA — the button leans towards the cursor while it roams a
 * generous hover zone, then snaps back on leave.
 */
export default function MagneticCTA({
  href,
  className = '',
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  const zone = useRef<HTMLSpanElement>(null!)
  const btn = useRef<HTMLAnchorElement>(null!)

  const onMove = (e: React.MouseEvent) => {
    const r = zone.current.getBoundingClientRect()
    const x = e.clientX - r.left - r.width / 2
    const y = e.clientY - r.top - r.height / 2
    btn.current.style.transform = `translate(${(x * 0.32).toFixed(1)}px, ${(y * 0.38).toFixed(1)}px)`
  }

  const onLeave = () => {
    btn.current.style.transform = 'translate(0px, 0px)'
  }

  return (
    <span className="magnet" ref={zone} onMouseMove={onMove} onMouseLeave={onLeave}>
      <a ref={btn} className={`cta cta--magnet ${className}`} href={href}>
        {children}
      </a>
    </span>
  )
}
