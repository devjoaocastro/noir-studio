// Tiny bus that exposes the ScrollControls element to DOM UI (header nav, CTAs)
// so plain HTML buttons can drive the 3D scroll — plus a destination bus that
// keeps the 3D globe pins and the DOM expedition cards in sync.

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

/* ------------------------------------------------------------------ */
/* Destinations — shared by the 3D globe pins and the DOM cards        */
/* ------------------------------------------------------------------ */

export type Destination = {
  id: string
  name: string
  region: string
  lat: number
  lon: number
  dates: string
  price: string
  difficulty: number
  blurb: string
}

export const DESTINATIONS: Destination[] = [
  {
    id: 'svalbard',
    name: 'Svalbard',
    region: 'Arctic Norway · 78°N',
    lat: 78.2,
    lon: 15.6,
    dates: 'Mar — May 2026',
    price: '€6,400',
    difficulty: 4,
    blurb:
      'Eight days by ski and pulk across Spitsbergen under the midnight sun. Glacier crossings, a night in a trapper hut, and — with luck and distance — the king of the Arctic.',
  },
  {
    id: 'atacama',
    name: 'Atacama',
    region: 'Northern Chile · 23°S',
    lat: -23.9,
    lon: -68.2,
    dates: 'Jun — Aug 2026',
    price: '€4,900',
    difficulty: 3,
    blurb:
      'The driest place on Earth, and the clearest sky. High-altitude salt flats, geysers at dawn, and three nights of naked-eye astronomy at 4,000 metres.',
  },
  {
    id: 'faroe',
    name: 'Faroe Islands',
    region: 'North Atlantic · 62°N',
    lat: 62.0,
    lon: -6.8,
    dates: 'Sep — Oct 2026',
    price: '€3,800',
    difficulty: 2,
    blurb:
      'Sea-cliff ridgelines, grass-roofed villages and ferry crossings between eighteen islands. The weather changes every eleven minutes; that is the point.',
  },
  {
    id: 'hokkaido',
    name: 'Hokkaido',
    region: 'Northern Japan · 43°N',
    lat: 43.2,
    lon: 142.8,
    dates: 'Jan — Feb 2027',
    price: '€5,200',
    difficulty: 3,
    blurb:
      'Deep-winter Japan: snowshoe traverses through silver-birch forest, red-crowned cranes at dawn, onsen at dusk, and the lightest powder on the planet.',
  },
  {
    id: 'patagonia',
    name: 'Patagonia',
    region: 'Chile & Argentina · 50°S',
    lat: -50.5,
    lon: -73.2,
    dates: 'Nov 2026 — Jan 2027',
    price: '€5,800',
    difficulty: 5,
    blurb:
      'Twelve days on foot between Torres del Paine and the Southern Ice Field. Wind you can lean on, granite that ignores you, and the best camp coffee of your life.',
  },
]

type DestinationListener = (index: number) => void

let activeDestination = 0
const destinationListeners = new Set<DestinationListener>()

export function getActiveDestination() {
  return activeDestination
}

export function setActiveDestination(index: number) {
  activeDestination = index
  destinationListeners.forEach((l) => l(index))
}

export function onDestinationChange(listener: DestinationListener) {
  destinationListeners.add(listener)
  return () => {
    destinationListeners.delete(listener)
  }
}
