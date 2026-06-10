// Bridges DOM UI (nav, CTAs) to the canvas ScrollControls element.

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
