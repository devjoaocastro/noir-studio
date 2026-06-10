/**
 * Tiny mutable game-state bus.
 * Fast-changing values (car pose, speed) are mutated every frame and read
 * by HUD widgets through requestAnimationFrame — no React re-renders.
 * Discrete moments (zone discovered, points, honk…) go through `emit`.
 */

export type ZoneId = 'portfolio' | 'services' | 'about' | 'contact'

export interface Zone {
  id: ZoneId
  label: string
  x: number
  z: number
  radius: number
  color: string
}

export const ZONES: Zone[] = [
  { id: 'portfolio', label: 'Portfolio', x: 0, z: -65, radius: 19, color: '#ffc93c' },
  { id: 'services', label: 'Services', x: 65, z: 0, radius: 19, color: '#ff6b57' },
  { id: 'about', label: 'About', x: -65, z: 0, radius: 19, color: '#7ef0c8' },
  { id: 'contact', label: 'Contact', x: 0, z: 65, radius: 19, color: '#ff8fb2' },
]

export const WORLD_BOUND = 90

export const game = {
  started: false,
  paused: false,
  muted: false,
  isCoarse:
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches,

  /* live values — mutated by the Car every frame */
  carX: 0,
  carZ: 14,
  carAngle: Math.PI, // facing north (-Z)
  speedKmh: 0,
  speed01: 0,
  boostJuice: 1,
  boosting: false,
  drifting: false,
  shake: 0,

  activeZone: null as ZoneId | null,
  visited: new Set<ZoneId>(),
  points: 0,

  input: {
    forward: false,
    back: false,
    left: false,
    right: false,
    drift: false,
    boost: false,
  },
}

export type GameEvents = {
  'zone-enter': ZoneId
  'zone-exit': ZoneId
  'zone-discover': ZoneId
  'close-panel': void
  popup: { text: string; big?: boolean }
  honk: void
}

type Handler<T> = (payload: T) => void
const listeners: Partial<Record<keyof GameEvents, Set<Handler<never>>>> = {}

export function on<K extends keyof GameEvents>(event: K, cb: Handler<GameEvents[K]>) {
  const set = (listeners[event] ??= new Set()) as Set<Handler<GameEvents[K]>>
  set.add(cb)
  return () => {
    set.delete(cb)
  }
}

export function emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]) {
  const set = listeners[event] as Set<Handler<GameEvents[K]>> | undefined
  set?.forEach((cb) => cb(payload))
}

/* Exposed for runtime tests (Playwright reads car position through this). */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__game = game
}
