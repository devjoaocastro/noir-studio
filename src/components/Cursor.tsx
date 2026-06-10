import { useEffect, useRef } from 'react'

/**
 * Custom cursor: instant dot + lazily-following ring.
 * The ring expands when hovering anything interactive — DOM (a/button)
 * or 3D objects (drei's useCursor sets body.style.cursor = 'pointer').
 */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null!)
  const ring = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    const pos = { x: innerWidth / 2, y: innerHeight / 2 }
    const target = { ...pos }
    let scale = 1
    let domHover = false

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      dot.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
      domHover = !!(e.target as Element | null)?.closest?.('a, button, [data-cursor]')
    }

    window.addEventListener('pointermove', onMove)

    let raf = 0
    const loop = () => {
      pos.x += (target.x - pos.x) * 0.16
      pos.y += (target.y - pos.y) * 0.16
      const hovering = domHover || document.body.style.cursor === 'pointer'
      scale += ((hovering ? 2 : 1) - scale) * 0.18
      ring.current.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${scale.toFixed(3)})`
      ring.current.classList.toggle('is-active', hovering)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <>
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
      <div ref={ring} className="cursor-ring" aria-hidden="true" />
    </>
  )
}
