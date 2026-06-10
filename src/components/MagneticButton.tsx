import { useRef, type MouseEvent, type ReactNode, type Ref } from 'react'

/**
 * Magnetic CTA: the whole button leans toward the cursor while the
 * label drifts a little further — released, both spring back.
 */
export default function MagneticButton({
  children,
  className = '',
  onClick,
  href,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  href?: string
}) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null)
  const inner = useRef<HTMLSpanElement>(null)

  const move = (e: MouseEvent) => {
    const el = ref.current
    if (!el || !inner.current) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    el.style.transform = `translate(${(dx * 0.24).toFixed(1)}px, ${(dy * 0.24).toFixed(1)}px)`
    inner.current.style.transform = `translate(${(dx * 0.11).toFixed(1)}px, ${(dy * 0.11).toFixed(1)}px)`
  }

  const leave = () => {
    const el = ref.current
    if (!el || !inner.current) return
    el.style.transform = ''
    inner.current.style.transform = ''
  }

  const content = (
    <span ref={inner} className="magnetic__inner">
      {children}
    </span>
  )

  if (href) {
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        className={`magnetic ${className}`}
        onMouseMove={move}
        onMouseLeave={leave}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      className={`magnetic ${className}`}
      onClick={onClick}
      onMouseMove={move}
      onMouseLeave={leave}
    >
      {content}
    </button>
  )
}
