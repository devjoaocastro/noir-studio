import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * Custom GLSL ember particles — the studio's signature effect.
 *
 * One shader, two modes:
 *   uMode 0 — AMBIENT: embers loop forever, rising from the source,
 *             drifting sideways, flickering, dying and respawning.
 *   uMode 1 — BURST:   a one-shot explosion; uStart stamps the launch
 *             time and every particle flies along its aDir, rises,
 *             flickers and fades out. Used by the hammer strike and
 *             by every shattered target cube.
 */

const VERTEX = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aDir;

  uniform float uTime;
  uniform float uStart;
  uniform float uMode;
  uniform float uSpread;
  uniform float uHeight;
  uniform float uLifespan;
  uniform float uSize;

  varying float vAlpha;
  varying float vSeed;

  void main() {
    float life;
    vec3 pos;

    if (uMode < 0.5) {
      // ambient: each ember loops on its own clock
      life = fract(uTime * (0.10 + aSeed * 0.16) + aSeed * 7.31);
      float sway = 1.0 + aSeed * 0.8;
      pos = position + vec3(
        sin((uTime + aSeed * 43.0) * sway) * 0.22 * life,
        life * uHeight * (0.6 + aSeed * 0.7),
        cos((uTime + aSeed * 29.0) * sway * 0.8) * 0.22 * life
      );
    } else {
      // burst: radial flight + buoyant rise, then death
      float t = (uTime - uStart) / uLifespan;
      life = clamp(t, 0.0, 1.0);
      float ease = 1.0 - pow(1.0 - life, 2.2);
      pos = position
        + aDir * ease * uSpread * (0.7 + aSeed * 0.6)
        + vec3(0.0, life * life * uHeight, 0.0);
    }

    float flicker = 0.62 + 0.38 * sin(uTime * (9.0 + aSeed * 16.0) + aSeed * 93.7);
    vAlpha = (1.0 - life) * flicker;
    vSeed = aSeed;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uSize * (1.8 + aSeed * 4.2) * (1.0 - life * 0.55) * (160.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.5, 0.05, d);
    float hot = smoothstep(0.22, 0.0, d);
    vec3 col = mix(uColorA, uColorB, vSeed * 0.85) + hot * 0.55;
    float a = vAlpha * core;
    if (a < 0.012) discard;
    gl_FragColor = vec4(col, a);
  }
`

export function makeEmberMaterial(opts: {
  mode: 0 | 1
  spread?: number
  height?: number
  lifespan?: number
  size?: number
  colorA?: string
  colorB?: string
}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uStart: { value: -1000 },
      uMode: { value: opts.mode },
      uSpread: { value: opts.spread ?? 1.6 },
      uHeight: { value: opts.height ?? 2.4 },
      uLifespan: { value: opts.lifespan ?? 1.1 },
      uSize: { value: opts.size ?? 1 },
      uColorA: { value: new THREE.Color(opts.colorA ?? '#ff5c1c') },
      uColorB: { value: new THREE.Color(opts.colorB ?? '#ffb35c') },
    },
  })
}

export function makeEmberGeometry(count: number, radius: number) {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  const dir = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const a = Math.random() * Math.PI * 2
    const r = radius * Math.sqrt(Math.random())
    pos[i3] = Math.cos(a) * r
    pos[i3 + 1] = Math.random() * 0.08
    pos[i3 + 2] = Math.sin(a) * r
    seed[i] = Math.random()
    const th = Math.random() * Math.PI * 2
    const horiz = 0.35 + Math.random() * 0.85
    dir[i3] = Math.cos(th) * horiz
    dir[i3 + 1] = 0.45 + Math.random()
    dir[i3 + 2] = Math.sin(th) * horiz
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
  return geo
}

/* ------------------------------------------------------------------ */
/* AmbientEmbers — looping ember column (forge pits, anvil, devlog)    */
/* ------------------------------------------------------------------ */

export function AmbientEmbers({
  position,
  count = 110,
  radius = 0.45,
  height = 2.6,
  size = 1,
}: {
  position: [number, number, number]
  count?: number
  radius?: number
  height?: number
  size?: number
}) {
  const material = useMemo(
    () => makeEmberMaterial({ mode: 0, height, size }),
    [height, size],
  )
  const geometry = useMemo(() => makeEmberGeometry(count, radius), [count, radius])

  useEffect(() => {
    return () => {
      material.dispose()
      geometry.dispose()
    }
  }, [material, geometry])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return <points position={position} geometry={geometry} material={material} frustumCulled={false} />
}

/* ------------------------------------------------------------------ */
/* BurstPool — pool of one-shot ember explosions, spawned imperatively */
/* ------------------------------------------------------------------ */

export type BurstHandle = {
  spawn: (point: THREE.Vector3 | [number, number, number]) => void
}

const POOL_SIZE = 7

export function BurstPool({ api }: { api: React.RefObject<BurstHandle | null> }) {
  const materials = useMemo(
    () =>
      Array.from({ length: POOL_SIZE }, () =>
        makeEmberMaterial({ mode: 1, spread: 2.1, height: 1.4, lifespan: 1.15, size: 1.25 }),
      ),
    [],
  )
  const geometry = useMemo(() => makeEmberGeometry(110, 0.14), [])
  const points = useRef<(THREE.Object3D | null)[]>([])
  const cursor = useRef(0)
  const now = useRef(0)

  useEffect(() => {
    api.current = {
      spawn(point) {
        const i = cursor.current % POOL_SIZE
        cursor.current += 1
        const pts = points.current[i]
        if (!pts) return
        if (Array.isArray(point)) pts.position.set(point[0], point[1], point[2])
        else pts.position.copy(point)
        materials[i].uniforms.uStart.value = now.current
      },
    }
    return () => {
      api.current = null
    }
  }, [api, materials])

  useEffect(() => {
    return () => {
      materials.forEach((m) => m.dispose())
      geometry.dispose()
    }
  }, [materials, geometry])

  useFrame((state) => {
    now.current = state.clock.elapsedTime
    for (const m of materials) m.uniforms.uTime.value = now.current
  })

  return (
    <>
      {materials.map((m, i) => (
        <points
          key={i}
          ref={(el) => {
            points.current[i] = el
          }}
          geometry={geometry}
          material={m}
          frustumCulled={false}
        />
      ))}
    </>
  )
}
