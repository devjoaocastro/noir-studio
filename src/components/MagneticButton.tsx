import { useRef, type ReactNode, type CSSProperties } from 'react'

/**
 * Magnetic CTA — the element leans toward the cursor while hovered,
 * then springs back on leave. Works for <a> and <button>.
 */
export default function MagneticButton({
  as = 'a',
  href,
  type,
  onClick,
  className = '',
  children,
  strength = 0.35,
  style,
}: {
  as?: 'a' | 'button'
  href?: string
  type?: 'button' | 'submit'
  onClick?: () => void
  className?: string
  children: ReactNode
  strength?: number
  style?: CSSProperties
}) {
  const el = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null)

  const onPointerMove = (e: React.PointerEvent) => {
    const node = el.current
    if (!node || window.matchMedia('(pointer: coarse)').matches) return
    const rect = node.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    node.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`
  }

  const onPointerLeave = () => {
    const node = el.current
    if (!node) return
    node.style.transform = 'translate(0px, 0px)'
  }

  const shared = {
    className: `magnetic ${className}`,
    onPointerMove,
    onPointerLeave,
    style,
  }

  if (as === 'button') {
    return (
      <button
        ref={el as React.RefObject<HTMLButtonElement>}
        type={type ?? 'button'}
        onClick={onClick}
        {...shared}
      >
        {children}
      </button>
    )
  }

  return (
    <a ref={el as React.RefObject<HTMLAnchorElement>} href={href} onClick={onClick} {...shared}>
      {children}
    </a>
  )
}
