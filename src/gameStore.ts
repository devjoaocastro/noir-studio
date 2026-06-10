import { useSyncExternalStore } from 'react'

/**
 * Tiny external store shared by the 3D scene (target cubes) and the DOM
 * interface (FORGED score HUD, achievement toast, footer HIGH SCORES,
 * coin-slot reset). No deps, no context — both worlds subscribe.
 */

export const TARGET_COUNT = 5

export type GameState = {
  forged: boolean[]
  /** monotonically increasing — lets the 3D scene react to resets */
  generation: number
}

let state: GameState = {
  forged: Array(TARGET_COUNT).fill(false),
  generation: 0,
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getState() {
  return state
}

export function forgeTarget(index: number) {
  if (state.forged[index]) return
  state = {
    ...state,
    forged: state.forged.map((f, i) => (i === index ? true : f)),
  }
  emit()
}

export function resetGame() {
  state = {
    forged: Array(TARGET_COUNT).fill(false),
    generation: state.generation + 1,
  }
  emit()
}

export function scoreOf(s: GameState) {
  return s.forged.filter(Boolean).length
}

export function useGameState() {
  return useSyncExternalStore(subscribe, getState)
}
