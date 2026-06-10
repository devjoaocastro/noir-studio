// State bus syncing the 3D room-diorama carousel with the DOM room card.
// The carousel publishes whichever room currently faces the camera;
// the DOM card (and the booking widget) subscribe.

export type Room = {
  id: string
  name: string
  price: number
  blurb: string
  amenities: [string, string, string]
}

export const ROOMS: Room[] = [
  {
    id: 'varanda',
    name: 'A Varanda',
    price: 240,
    blurb: 'A wrought-iron balcony over the rooftops — breakfast arrives with the sunrise.',
    amenities: ['Private balcony', 'Rain shower', 'Queen bed'],
  },
  {
    id: 'estudio',
    name: 'O Estúdio',
    price: 310,
    blurb: 'Double-height ceilings, a writing desk in brass, and the soft hum of the funicular.',
    amenities: ['Writing desk', 'Record player', 'King bed'],
  },
  {
    id: 'torre',
    name: 'A Torre',
    price: 420,
    blurb: 'The turret suite. 360° of Lisbon blushing at dusk, and a bathtub facing the river.',
    amenities: ['360° turret view', 'Freestanding tub', 'Emperor bed'],
  },
]

type Listener = (index: number) => void

let active = 0
const listeners = new Set<Listener>()

export function setActiveRoom(index: number) {
  const next = ((index % ROOMS.length) + ROOMS.length) % ROOMS.length
  if (next === active) return
  active = next
  listeners.forEach((l) => l(active))
}

export function getActiveRoom() {
  return active
}

export function subscribeRoom(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// DOM → 3D: lets the room card arrows spin the platter too.
type Rotator = (index: number) => void
let rotator: Rotator | null = null

export function setCarouselRotator(fn: Rotator | null) {
  rotator = fn
}

export function rotateCarouselTo(index: number) {
  rotator?.(index)
}
