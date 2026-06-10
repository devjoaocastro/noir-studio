import * as THREE from 'three'

/**
 * Tiny replacement for `maath`'s easing/random helpers so the project
 * builds on hosts that only resolve three.js core dependencies.
 * Exponential smoothing via THREE.MathUtils.damp.
 */

const dampN = (current: number, target: number, smoothTime: number, delta: number) =>
  THREE.MathUtils.damp(current, target, 4 / Math.max(0.0001, smoothTime), delta)

const tmpColor = new THREE.Color()

export const easing = {
  damp(obj: any, key: string, target: number, smoothTime: number, delta: number) {
    obj[key] = dampN(obj[key], target, smoothTime, delta)
  },

  damp3(
    v: THREE.Vector3,
    target: THREE.Vector3 | readonly number[] | number,
    smoothTime: number,
    delta: number,
  ) {
    let tx: number, ty: number, tz: number
    if (typeof target === 'number') {
      tx = ty = tz = target
    } else if (Array.isArray(target)) {
      tx = target[0]
      ty = target[1]
      tz = target[2]
    } else {
      const t = target as THREE.Vector3
      tx = t.x
      ty = t.y
      tz = t.z
    }
    v.set(
      dampN(v.x, tx, smoothTime, delta),
      dampN(v.y, ty, smoothTime, delta),
      dampN(v.z, tz, smoothTime, delta),
    )
  },

  dampE(e: THREE.Euler, target: readonly number[], smoothTime: number, delta: number) {
    e.set(
      dampN(e.x, target[0], smoothTime, delta),
      dampN(e.y, target[1], smoothTime, delta),
      dampN(e.z, target[2], smoothTime, delta),
    )
  },

  dampC(c: THREE.Color, target: THREE.Color | string, smoothTime: number, delta: number) {
    tmpColor.set(target as THREE.ColorRepresentation)
    c.r = dampN(c.r, tmpColor.r, smoothTime, delta)
    c.g = dampN(c.g, tmpColor.g, smoothTime, delta)
    c.b = dampN(c.b, tmpColor.b, smoothTime, delta)
  },
}

/** Uniformly distributed random points inside a sphere. */
export function inSphere(arr: Float32Array, radius: number) {
  for (let i = 0; i < arr.length; i += 3) {
    const theta = 2 * Math.PI * Math.random()
    const phi = Math.acos(2 * Math.random() - 1)
    const r = radius * Math.cbrt(Math.random())
    arr[i] = r * Math.sin(phi) * Math.cos(theta)
    arr[i + 1] = r * Math.sin(phi) * Math.sin(theta)
    arr[i + 2] = r * Math.cos(phi)
  }
  return arr
}
