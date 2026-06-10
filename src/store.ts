import * as THREE from 'three'

export type Theme = 'day' | 'night'

/**
 * Mutable world state — the bridge between the DOM interface (React state)
 * and the 3D scene (read every frame inside useFrame, no re-renders needed).
 */
export const world = {
  /** 'day' | 'night' — set by the header toggle */
  theme: 'day' as Theme,
  /** 0 = full day, 1 = full night — damped towards the theme in useFrame (~1s) */
  blend: 0,
  /** monthly electricity bill in €, live from the calculator slider (50–400) */
  bill: 160,
  /** sun position along its sky arc, 0 = far left horizon, 1 = far right */
  sunU: 0.64,
  /** true while the user is dragging the sun across the sky */
  draggingSun: false,
  /** world-space sun/moon position, written by the scene each frame */
  sunPos: new THREE.Vector3(0, 10, -13),
}

/** Calculator → 3D bridge: how many panels the field shows for a given bill. */
export const PANEL_MIN = 24
export const PANEL_MAX = 160

export function billToCount(bill: number) {
  return PANEL_MIN + ((bill - 50) / 350) * (PANEL_MAX - PANEL_MIN)
}
