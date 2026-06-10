// Tiny state bus shared between the DOM interface and the 3D scene.
// - `tier`  → which scent-pyramid tier is active (drives the particle aura + fog tint)
// - `tint`  → liquid gold tint inside the flacon (driven by collection card hover)

export type Tier = 'top' | 'heart' | 'base'

export const DEFAULT_TINT = '#e6c36a'

type Listener = () => void

let tier: Tier = 'top'
let tint: string = DEFAULT_TINT
const listeners = new Set<Listener>()

const emit = () => listeners.forEach((l) => l())

export const getTier = () => tier
export const getTint = () => tint

export function setTier(next: Tier) {
  if (next === tier) return
  tier = next
  emit()
}

export function setTint(next: string) {
  if (next === tint) return
  tint = next
  emit()
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Visual recipe per pyramid tier — sparkle aura + porcelain fog tint. */
export const TIERS: Record<
  Tier,
  {
    label: string
    notes: string
    color: string
    fog: string
    count: number
    size: number
    speed: number
    scale: number
    opacity: number
  }
> = {
  top: {
    label: 'Top',
    notes: 'bergamot · pink pepper',
    color: '#efdd9c',
    fog: '#f7f1e4',
    count: 160,
    size: 2.2,
    speed: 1.7,
    scale: 4.6,
    opacity: 0.9,
  },
  heart: {
    label: 'Heart',
    notes: 'orris · fig',
    color: '#cf9f56',
    fog: '#f4ecdc',
    count: 95,
    size: 3.6,
    speed: 0.8,
    scale: 3.6,
    opacity: 0.8,
  },
  base: {
    label: 'Base',
    notes: 'amber · cedar',
    color: '#8a6437',
    fog: '#eee3cf',
    count: 55,
    size: 5.2,
    speed: 0.3,
    scale: 2.9,
    opacity: 0.75,
  },
}
