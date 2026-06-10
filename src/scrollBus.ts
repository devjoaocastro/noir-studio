// Bridges DOM UI (nav, CTAs, depth meter) to the canvas ScrollControls element.

export const PAGES = 8

let el: HTMLElement | null = null

export function setScrollEl(element: HTMLElement) {
  el = element
}

export function scrollToPage(index: number) {
  if (!el) return
  const top = (index / (PAGES - 1)) * (el.scrollHeight - el.clientHeight)
  el.scrollTo({ top, behavior: 'smooth' })
}

/* Per-frame scroll offset bus — drives the DOM depth meter without React renders. */

type OffsetListener = (offset: number) => void

const offsetListeners = new Set<OffsetListener>()

export function onOffset(listener: OffsetListener): () => void {
  offsetListeners.add(listener)
  return () => {
    offsetListeners.delete(listener)
  }
}

export function publishOffset(offset: number) {
  offsetListeners.forEach((listener) => listener(offset))
}
