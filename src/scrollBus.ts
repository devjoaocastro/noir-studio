// Tiny bus that exposes the ScrollControls element to DOM UI (header nav, CTAs)
// so plain HTML buttons can drive the 3D scroll.

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
