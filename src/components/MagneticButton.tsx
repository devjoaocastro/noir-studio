import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Magnetic CTA: when the cursor enters a proximity radius the button is
 * pulled toward it; when it leaves, the button springs back to rest.
 */
export default function MagneticButton({
  href,
  className = '',
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLAnchorElement>(null!)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    const el = ref.current
    const RADIUS = 180
    const pos = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      if (Math.hypot(dx, dy) < RADIUS) {
        target.x = dx * 0.38
        target.y = dy * 0.38
      } else {
        target.x = 0
        target.y = 0
      }
    }

    let raf = 0
    const loop = () => {
      // spring-ish lerp: snappy pull, soft return
      pos.x += (target.x - pos.x) * 0.14
      pos.y += (target.y - pos.y) * 0.14
      el.style.transform = `translate(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    window.addEventListener('pointermove', onMove)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <a ref={ref} className={`magnetic ${className}`} href={href}>
      {children}
    </a>
  )
}
