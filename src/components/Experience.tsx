import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, RoundedBox, Stars, useCursor, useScroll } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import { PAGES, setScrollEl } from '../scrollBus'
import { AmbientEmbers, BurstPool, type BurstHandle } from './Embers'
import { forgeTarget, useGameState } from '../gameStore'

/** World depth: the camera walks the smithy from z=10 down to -DEPTH+10 */
const DEPTH = (PAGES - 1) * 18 // 126

const EMBER = '#ff5c1c'
const EMBER_HOT = '#ffb35c'
const STEEL = '#9aa3ad'
const PIXEL = '#58e06b'
const SLATE = '#181d24'
const SLATE_DEEP = '#0c0f14'

/** Fade helper for drei <Html> labels — they ignore fog/depth, so we fade
 *  them with the scroll, keyed to the section they belong to. */
function useSectionFade(label: React.RefObject<HTMLDivElement | null>, section: number) {
  const scroll = useScroll()
  useFrame(() => {
    if (!label.current) return
    const sec = scroll.offset * (PAGES - 1)
    const visibility = Math.max(0, 1 - Math.abs(sec - section) * 1.7)
    label.current.style.opacity = visibility.toFixed(3)
    label.current.style.display = visibility < 0.04 ? 'none' : ''
  })
}

/* ------------------------------------------------------------------ */
/* Anvil + Hammer — click the anvil, the hammer strikes: screen-shake  */
/* lite + a burst of GLSL embers off the face.                         */
/* ------------------------------------------------------------------ */

function AnvilStation({
  burst,
  shake,
}: {
  burst: React.RefObject<BurstHandle | null>
  shake: React.RefObject<number>
}) {
  const hammer = useRef<THREE.Group>(null!)
  const glow = useRef<THREE.PointLight>(null!)
  const label = useRef<HTMLDivElement>(null)
  const strike = useRef({ start: -10, hit: true })
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  useSectionFade(label, 0)

  const clock = useThree((s) => s.clock)

  const triggerStrike = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const t = clock.elapsedTime
    if (t - strike.current.start < 0.55) return // let the swing finish
    strike.current = { start: t, hit: false }
  }

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const ph = t - strike.current.start

    // idle: hammer hovers, cocked back, breathing
    let angle = -0.95 + Math.sin(t * 1.5) * 0.07
    let lift = 0.1 + Math.sin(t * 1.1) * 0.05

    if (ph >= 0 && ph < 0.12) {
      // swing down — fast
      const k = ph / 0.12
      angle = -0.95 + k * k * 1.13 // ends at ~0.18 (impact)
      lift = 0.1 * (1 - k)
    } else if (ph >= 0.12 && ph < 0.62) {
      if (!strike.current.hit) {
        strike.current.hit = true
        burst.current?.spawn([0, 1.25, 0])
        shake.current = 1
      }
      // recover — slow
      const k = (ph - 0.12) / 0.5
      const e = 1 - Math.pow(1 - k, 3)
      angle = 0.18 - e * 1.13
      lift = 0.1 * e
    }

    hammer.current.rotation.z = angle
    hammer.current.position.y = 1.95 + lift

    // forge glow breathes; flares right after a hit
    const flare = ph >= 0.12 && ph < 0.5 ? (1 - (ph - 0.12) / 0.38) * 26 : 0
    glow.current.intensity = 9 + Math.sin(t * 3.1) * 2.5 + flare
  })

  return (
    <group position={[0, 0, 0]}>
      {/* stump */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.62, 0.74, 0.6, 10]} />
        <meshStandardMaterial color="#2a2118" roughness={0.95} />
      </mesh>

      {/* anvil — clickable */}
      <group
        position={[0, 0.6, 0]}
        onClick={triggerStrike}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[1.05, 0.28, 0.78]} />
          <meshStandardMaterial color={SLATE} metalness={0.75} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <boxGeometry args={[0.5, 0.26, 0.5]} />
          <meshStandardMaterial color={SLATE} metalness={0.75} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.56, 0]}>
          <boxGeometry args={[1.65, 0.26, 0.62]} />
          <meshStandardMaterial
            color={hovered ? '#2b333e' : SLATE}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
        {/* horn */}
        <mesh position={[1.05, 0.56, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.16, 0.6, 12]} />
          <meshStandardMaterial color={SLATE} metalness={0.8} roughness={0.3} />
        </mesh>
        {/* hot seam on the face */}
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.5, 0.025, 0.34]} />
          <meshBasicMaterial color={EMBER} toneMapped={false} />
        </mesh>
      </group>

      {/* hammer — pivots near the anvil edge */}
      <group ref={hammer} position={[1.45, 1.95, 0]}>
        <mesh position={[-0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.055, 1.45, 10]} />
          <meshStandardMaterial color="#5b4632" roughness={0.85} />
        </mesh>
        <mesh position={[-1.42, 0, 0]}>
          <boxGeometry args={[0.42, 0.3, 0.3]} />
          <meshStandardMaterial color={STEEL} metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[-1.64, 0, 0]}>
          <boxGeometry args={[0.06, 0.32, 0.32]} />
          <meshBasicMaterial color={EMBER_HOT} toneMapped={false} />
        </mesh>
      </group>

      {/* ambient embers rising off the hot face */}
      <AmbientEmbers position={[0, 1.3, 0]} count={90} radius={0.4} height={2.6} />
      <pointLight ref={glow} position={[0, 1.6, 0.6]} color={EMBER} distance={9} intensity={9} />

      <Html center position={[0, 2.9, 0]} className="pin-html" zIndexRange={[20, 0]}>
        <div ref={label} className="pin-label" style={{ opacity: 0, display: 'none' }}>
          <strong>THE ANVIL</strong>
          <span>click to strike</span>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Marching pixel-cube creatures — instanced voxels stepping in a loop */
/* ------------------------------------------------------------------ */

// voxel layout for one creature (cube size 0.34): body row, head, 4 legs
const BODY: [number, number, number][] = [
  [-0.51, 0.78, 0],
  [-0.17, 0.78, 0],
  [0.17, 0.78, 0],
  [0.51, 0.78, 0],
  [0.78, 1.12, 0], // head
  [1.02, 1.0, 0], // snout
]
const LEGS: [number, number, number][] = [
  [-0.45, 0.42, 0.14],
  [-0.45, 0.42, -0.14],
  [0.45, 0.42, 0.14],
  [0.45, 0.42, -0.14],
]
const VOX_PER = BODY.length + LEGS.length
const CREATURES = 5
const MARCH_SPAN = 26

function PixelCreatures({ z }: { z: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const lanes = useMemo(
    () =>
      Array.from({ length: CREATURES }, (_, i) => ({
        offset: (i / CREATURES) * MARCH_SPAN,
        speed: 1.5 + (i % 3) * 0.45,
        laneZ: z - 1.2 + (i % 3) * 1.4,
        phase: i * 1.7,
      })),
    [z],
  )

  useEffect(() => {
    const c = new THREE.Color()
    const palette = [PIXEL, EMBER_HOT, STEEL, PIXEL, '#7ef08d']
    for (let i = 0; i < CREATURES; i++) {
      c.set(palette[i % palette.length])
      for (let v = 0; v < VOX_PER; v++) mesh.current.setColorAt(i * VOX_PER + v, c)
    }
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    lanes.forEach((lane, i) => {
      const x = ((t * lane.speed + lane.offset) % MARCH_SPAN) - MARCH_SPAN / 2
      const step = t * 7 + lane.phase
      const bodyBob = Math.abs(Math.sin(step)) * 0.05

      BODY.forEach((p, v) => {
        dummy.position.set(x + p[0], p[1] + bodyBob, lane.laneZ + p[2])
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.current.setMatrixAt(i * VOX_PER + v, dummy.matrix)
      })
      LEGS.forEach((p, v) => {
        const legPhase = step + (v % 2 === 0 ? 0 : Math.PI)
        const ly = Math.max(0, Math.sin(legPhase)) * 0.16
        const lx = Math.cos(legPhase) * 0.08
        dummy.position.set(x + p[0] + lx, p[1] + ly, lane.laneZ + p[2])
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.current.setMatrixAt(i * VOX_PER + BODY.length + v, dummy.matrix)
      })
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CREATURES * VOX_PER]} frustumCulled={false}>
      <boxGeometry args={[0.32, 0.32, 0.26]} />
      <meshStandardMaterial roughness={0.6} metalness={0.1} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/* Game slabs — three glowing cartridges for the GAMES section         */
/* ------------------------------------------------------------------ */

function GameSlab({
  position,
  rotation,
  accent,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  accent: string
}) {
  const group = useRef<THREE.Group>(null!)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const target: [number, number, number] = hovered
      ? [-state.pointer.y * 0.35, state.pointer.x * 0.4, 0]
      : [rotation[0], rotation[1] + Math.sin(t * 0.6 + position[0]) * 0.06, rotation[2]]
    easing.dampE(group.current.rotation, target, 0.22, delta)
    easing.damp3(
      group.current.position,
      [position[0], position[1] + Math.sin(t * 0.9 + position[0] * 2) * 0.12 + (hovered ? 0.25 : 0), position[2]],
      0.25,
      delta,
    )
  })

  return (
    <group
      ref={group}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[2.1, 2.7, 0.22]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color={SLATE} metalness={0.6} roughness={0.35} />
      </RoundedBox>
      {/* screen */}
      <mesh position={[0, 0.42, 0.13]}>
        <planeGeometry args={[1.7, 1.5]} />
        <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={hovered ? 0.95 : 0.55} />
      </mesh>
      {/* cartridge notch */}
      <mesh position={[0, -0.95, 0.13]}>
        <boxGeometry args={[1.2, 0.18, 0.04]} />
        <meshBasicMaterial color={EMBER} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* THE PLAYGROUND — 5 target cubes; click to shatter (pop + embers),   */
/* score lives in the shared gameStore so the DOM HUD updates live.    */
/* ------------------------------------------------------------------ */

function TargetCube({
  index,
  position,
  burst,
}: {
  index: number
  position: [number, number, number]
  burst: React.RefObject<BurstHandle | null>
}) {
  const game = useGameState()
  const forged = game.forged[index]
  const mesh = useRef<THREE.Mesh>(null!)
  const edge = useRef<THREE.Mesh>(null!)
  const popAt = useRef(-10)
  const scale = useRef(1)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && !forged)
  const clock = useThree((s) => s.clock)

  const smash = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (forged) return
    popAt.current = clock.elapsedTime
    burst.current?.spawn(mesh.current.getWorldPosition(new THREE.Vector3()))
    forgeTarget(index)
  }

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    if (forged) {
      const ph = t - popAt.current
      // pop: swell fast then collapse to nothing
      scale.current =
        ph < 0.14 ? 1 + (ph / 0.14) * 0.5 : Math.max(0.001, 1.5 * (1 - (ph - 0.14) / 0.24))
    } else {
      // (re)grow after a reset, breathe when alive
      scale.current = THREE.MathUtils.damp(scale.current, 1, 6, delta)
    }

    const bob = Math.sin(t * 1.3 + index * 1.9) * 0.16
    mesh.current.position.set(position[0], position[1] + bob, position[2])
    mesh.current.rotation.x = t * 0.45 + index
    mesh.current.rotation.y = t * 0.6 + index * 2.2
    const s = scale.current * (hovered && !forged ? 1.12 : 1)
    mesh.current.scale.setScalar(Math.max(0.001, s))
    edge.current.position.copy(mesh.current.position)
    edge.current.rotation.copy(mesh.current.rotation)
    edge.current.scale.setScalar(Math.max(0.001, s * 1.06))
  })

  return (
    <group>
      <mesh
        ref={mesh}
        onClick={smash}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.85, 0.85, 0.85]} />
        <meshStandardMaterial
          color={SLATE}
          metalness={0.7}
          roughness={0.3}
          emissive={hovered && !forged ? PIXEL : '#000000'}
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* glowing wireframe shell */}
      <mesh ref={edge}>
        <boxGeometry args={[0.85, 0.85, 0.85]} />
        <meshBasicMaterial color={PIXEL} wireframe toneMapped={false} transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

const TARGET_POSITIONS: [number, number, number][] = [
  // ~10–12 units ahead of the Playground viewpoint (camera z=-44) so all
  // five cubes sit inside the frustum at the exact section stop
  [-4.2, 2.6, -54],
  [-2.1, 3.6, -56],
  [0, 2.2, -55],
  [2.2, 3.4, -56.5],
  [4.3, 2.7, -54.5],
]

function Playground({ burst }: { burst: React.RefObject<BurstHandle | null> }) {
  const label = useRef<HTMLDivElement>(null)
  useSectionFade(label, 3)
  return (
    <group>
      {TARGET_POSITIONS.map((p, i) => (
        <TargetCube key={i} index={i} position={p} burst={burst} />
      ))}
      <Html center position={[0, 5.4, -55]} className="pin-html" zIndexRange={[20, 0]}>
        <div ref={label} className="pin-label" style={{ opacity: 0, display: 'none' }}>
          <strong>TARGET RANGE</strong>
          <span>smash the cubes</span>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Draggable game controller — drag to spin, with inertia              */
/* ------------------------------------------------------------------ */

function Controller({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null!)
  const dragging = useRef(false)
  const vel = useRef({ x: 0, y: 0.28 })
  const label = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  useSectionFade(label, 4)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      group.current.rotation.y += e.movementX * 0.0085
      group.current.rotation.x += e.movementY * 0.0085
      vel.current.y = e.movementX * 0.22
      vel.current.x = e.movementY * 0.22
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (!dragging.current) {
      // inertia, decaying towards a lazy idle spin
      group.current.rotation.y += vel.current.y * delta
      group.current.rotation.x += vel.current.x * delta
      vel.current.y = THREE.MathUtils.damp(vel.current.y, 0.28, 1.1, delta)
      vel.current.x = THREE.MathUtils.damp(vel.current.x, 0, 1.1, delta)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, 0, 0.35, delta)
    }
    group.current.position.y = position[1] + Math.sin(t * 0.9) * 0.14
  })

  return (
    <group position={position}>
      <group
        ref={group}
        onPointerDown={(e) => {
          e.stopPropagation()
          dragging.current = true
          // body has user-select:none; clear any pre-existing selection
          document.body.style.userSelect = 'none'
          window.getSelection?.()?.removeAllRanges?.()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* body */}
        <RoundedBox args={[2.7, 1.15, 0.42]} radius={0.16} smoothness={4}>
          <meshStandardMaterial color="#39424e" metalness={0.55} roughness={0.35} />
        </RoundedBox>
        {/* rim glow strip */}
        <mesh position={[0, 0.52, 0]}>
          <boxGeometry args={[2.2, 0.05, 0.3]} />
          <meshBasicMaterial color={EMBER} toneMapped={false} />
        </mesh>
        {/* grips */}
        <mesh position={[-1.25, -0.42, 0]} rotation={[0, 0, 0.5]}>
          <capsuleGeometry args={[0.26, 0.55, 6, 12]} />
          <meshStandardMaterial color="#22282f" metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh position={[1.25, -0.42, 0]} rotation={[0, 0, -0.5]}>
          <capsuleGeometry args={[0.26, 0.55, 6, 12]} />
          <meshStandardMaterial color="#22282f" metalness={0.5} roughness={0.45} />
        </mesh>
        {/* D-pad */}
        <mesh position={[-0.75, 0.08, 0.23]}>
          <boxGeometry args={[0.56, 0.18, 0.1]} />
          <meshStandardMaterial color="#3a424c" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[-0.75, 0.08, 0.23]}>
          <boxGeometry args={[0.18, 0.56, 0.1]} />
          <meshStandardMaterial color="#3a424c" metalness={0.4} roughness={0.5} />
        </mesh>
        {/* face buttons */}
        {(
          [
            [0.62, 0.08, PIXEL],
            [0.88, 0.26, EMBER],
            [0.88, -0.1, STEEL],
            [1.14, 0.08, '#f2f4f6'],
          ] as [number, number, string][]
        ).map(([x, y, c], i) => (
          <mesh key={i} position={[x, y, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.09, 16]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
        ))}
        {/* start/select */}
        <mesh position={[-0.1, -0.12, 0.23]}>
          <boxGeometry args={[0.22, 0.08, 0.08]} />
          <meshBasicMaterial color={EMBER_HOT} toneMapped={false} />
        </mesh>
        <mesh position={[0.2, -0.12, 0.23]}>
          <boxGeometry args={[0.22, 0.08, 0.08]} />
          <meshBasicMaterial color={EMBER_HOT} toneMapped={false} />
        </mesh>
      </group>

      {/* show-off spotlight so the pad reads against the dark smithy */}
      <pointLight position={[0.6, 1.4, 2.2]} intensity={18} distance={7} color="#cfd8e3" />

      <Html center position={[0, 1.6, 0]} className="pin-html" zIndexRange={[20, 0]}>
        <div ref={label} className="pin-label" style={{ opacity: 0, display: 'none' }}>
          <strong>FORGE-PAD</strong>
          <span>drag to spin</span>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Craft pillars — rise from the floor as the section approaches       */
/* ------------------------------------------------------------------ */

function CraftPillars({ z }: { z: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const caps = useRef<(THREE.Mesh | null)[]>([])
  const scroll = useScroll()
  const spec = useMemo(
    () =>
      [
        // keep the walking camera path (x ≈ ±1.2) clear — no pillar at x=0
        { x: -6.2, h: 5.2, c: EMBER },
        { x: 2.9, h: 7, c: PIXEL },
        { x: 7.4, h: 5.8, c: STEEL },
      ] as const,
    [],
  )

  useFrame(() => {
    const r = scroll.range(3.45 / (PAGES - 1), 0.9 / (PAGES - 1))
    spec.forEach((s, i) => {
      const body = refs.current[i]
      const cap = caps.current[i]
      if (!body || !cap) return
      const h = Math.max(0.001, r * s.h)
      body.scale.set(1, h, 1)
      body.position.y = h / 2
      cap.position.y = h + 0.08
      cap.scale.setScalar(r > 0.95 ? 1 : 0.001)
    })
  })

  return (
    <group position={[0, 0, z]}>
      {spec.map((s, i) => (
        <group key={i} position={[s.x, 0, 0]}>
          <mesh
            ref={(el) => {
              refs.current[i] = el
            }}
          >
            <boxGeometry args={[1.5, 1, 1.5]} />
            <meshStandardMaterial color={SLATE} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh
            ref={(el) => {
              caps.current[i] = el
            }}
          >
            <boxGeometry args={[1.6, 0.1, 1.6]} />
            <meshBasicMaterial color={s.c} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Forge pit — devlog backdrop: a hot pool + tall ember column         */
/* ------------------------------------------------------------------ */

function ForgePit({ z }: { z: number }) {
  const pool = useRef<THREE.Mesh>(null!)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const m = pool.current.material as THREE.MeshBasicMaterial
    m.opacity = 0.75 + Math.sin(t * 2.7) * 0.18
  })
  return (
    <group position={[0, 0, z]}>
      <mesh ref={pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[2.4, 40]} />
        <meshBasicMaterial color={EMBER} toneMapped={false} transparent opacity={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[2.4, 2.75, 40]} />
        <meshStandardMaterial color={SLATE} metalness={0.7} roughness={0.4} />
      </mesh>
      <AmbientEmbers position={[0, 0.2, 0]} count={260} radius={2} height={6.5} size={1.3} />
      <pointLight position={[0, 1.4, 0]} color={EMBER} intensity={40} distance={16} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Arcade cabinet — the finale standing at the end of the smithy       */
/* ------------------------------------------------------------------ */

function ArcadeCabinet({ z }: { z: number }) {
  const screen = useRef<THREE.Mesh>(null!)
  const marquee = useRef<THREE.Mesh>(null!)
  const colA = useMemo(() => new THREE.Color(EMBER), [])
  const colB = useMemo(() => new THREE.Color(PIXEL), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const m = screen.current.material as THREE.MeshBasicMaterial
    m.color.lerpColors(colA, colB, (Math.sin(t * 1.4) + 1) / 2)
    const mq = marquee.current.material as THREE.MeshBasicMaterial
    mq.opacity = 0.85 + Math.sin(t * 9) * 0.1 // neon buzz
  })

  return (
    <group position={[0, 0, z]}>
      {/* body */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[2.3, 3, 1.5]} />
        <meshStandardMaterial color={SLATE_DEEP} metalness={0.4} roughness={0.55} />
      </mesh>
      {/* screen */}
      <mesh ref={screen} position={[0, 2.05, 0.78]} rotation={[-0.12, 0, 0]}>
        <planeGeometry args={[1.7, 1.25]} />
        <meshBasicMaterial color={EMBER} toneMapped={false} />
      </mesh>
      {/* control deck */}
      <mesh position={[0, 1.25, 0.92]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[2.1, 0.12, 0.7]} />
        <meshStandardMaterial color={SLATE} metalness={0.5} roughness={0.45} />
      </mesh>
      {/* marquee */}
      <mesh ref={marquee} position={[0, 3.18, 0.7]}>
        <boxGeometry args={[2.3, 0.42, 0.16]} />
        <meshBasicMaterial color={EMBER_HOT} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <pointLight position={[0, 2.4, 2.4]} color={EMBER} intensity={26} distance={13} />
      <AmbientEmbers position={[0, 0.4, 1.4]} count={70} radius={1.4} height={3.4} size={0.8} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Ground + floating coal rocks                                        */
/* ------------------------------------------------------------------ */

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -DEPTH / 2]}>
        <planeGeometry args={[140, DEPTH + 150]} />
        <meshStandardMaterial color={SLATE_DEEP} roughness={0.95} metalness={0} />
      </mesh>
      <gridHelper args={[260, 130, '#2a323d', '#161b22']} position={[0, 0.01, -DEPTH / 2]} />
    </group>
  )
}

const ROCK_COUNT = 90

function CoalRocks() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const rocks = useMemo(() => {
    const rng = (a: number, b: number) => a + Math.random() * (b - a)
    return Array.from({ length: ROCK_COUNT }, () => ({
      x: (Math.random() < 0.5 ? -1 : 1) * rng(5, 16),
      y: rng(0.4, 6),
      z: 8 - Math.random() * (DEPTH + 26),
      s: rng(0.2, 0.8),
      spin: rng(0.1, 0.5),
      bob: rng(0.5, 1.4),
      ph: rng(0, Math.PI * 2),
    }))
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.y + Math.sin(t * r.bob + r.ph) * 0.3, r.z)
      dummy.rotation.set(t * r.spin + r.ph, t * r.spin * 0.7, 0)
      dummy.scale.setScalar(r.s)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, ROCK_COUNT]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#1c222b" roughness={0.9} metalness={0.2} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — walking camera, shake, ember light, post FX       */
/* ------------------------------------------------------------------ */

export default function Experience() {
  const scroll = useScroll()
  const mouseLight = useRef<THREE.PointLight>(null!)
  const burst = useRef<BurstHandle | null>(null)
  const shake = useRef(0)

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    const o = scroll.offset
    const z = -o * DEPTH + 10

    // walk the smithy + gentle mouse parallax
    easing.damp3(
      state.camera.position,
      [state.pointer.x * 1.2, 2.3 - state.pointer.y * 0.4, z],
      0.3,
      delta,
    )

    // screen-shake-lite after a hammer strike
    if (shake.current > 0.002) {
      state.camera.position.x += (Math.random() - 0.5) * 0.14 * shake.current
      state.camera.position.y += (Math.random() - 0.5) * 0.12 * shake.current
      shake.current *= Math.pow(0.0005, delta)
    }

    state.camera.lookAt(state.pointer.x * 2, 1.7, z - 9)

    // dolly settle on each section
    const cam = state.camera as THREE.PerspectiveCamera
    const sec = o * (PAGES - 1)
    const frac = Math.abs(sec - Math.round(sec))
    const targetFov = 46 - (1 - Math.min(1, frac * 2.5)) * 3
    cam.fov = THREE.MathUtils.damp(cam.fov, targetFov, 4, delta)
    cam.updateProjectionMatrix()

    // a warm ember light follows the cursor through the dark
    mouseLight.current.position.set(state.pointer.x * 10, 2.8, z - 5)

    document.documentElement.style.setProperty('--scroll', o.toFixed(4))
  })

  return (
    <>
      {/* a smithy at night: dark steel, revealed by ember light */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[8, 16, -8]} intensity={0.35} color="#5b6b80" />
      <pointLight ref={mouseLight} intensity={70} distance={16} color={EMBER_HOT} />

      <Stars radius={110} depth={60} count={2200} factor={4} saturation={0} fade speed={0.4} />

      <Ground />
      <CoalRocks />

      <BurstPool api={burst} />

      {/* 0 — hero */}
      <AnvilStation burst={burst} shake={shake} />

      {/* 1 — manifesto: pixel creatures marching */}
      <PixelCreatures z={-16} />

      {/* 2 — games: three glowing cartridges */}
      <GameSlab position={[-4.4, 2.6, -31]} rotation={[0, 0.4, 0]} accent={EMBER} />
      <GameSlab position={[0, 2.8, -33]} rotation={[0, 0, 0]} accent={PIXEL} />
      <GameSlab position={[4.4, 2.6, -35]} rotation={[0, -0.4, 0]} accent={STEEL} />

      {/* 3 — the playground */}
      <Playground burst={burst} />

      {/* 4 — tech & craft: pillars + draggable controller */}
      <CraftPillars z={-76} />
      <Controller position={[2.4, 3.0, -67]} />

      {/* 5 — devlog: the forge pit (off-axis so the camera walks BESIDE
          the fire, not through a whiteout of embers) */}
      <group position={[3.4, 0, 0]}>
        <ForgePit z={-86} />
      </group>

      {/* 6 — careers: a second anvil waits for new smiths */}
      <group position={[3.5, 0, -104]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.62, 0.74, 0.6, 10]} />
          <meshStandardMaterial color="#2a2118" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.74, 0]}>
          <boxGeometry args={[1.05, 0.28, 0.78]} />
          <meshStandardMaterial color={SLATE} metalness={0.75} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.16, 0]}>
          <boxGeometry args={[1.65, 0.26, 0.62]} />
          <meshStandardMaterial color={SLATE} metalness={0.8} roughness={0.3} />
        </mesh>
        <AmbientEmbers position={[0, 1.4, 0]} count={50} radius={0.35} height={2} size={0.8} />
      </group>

      {/* 7 — footer: the arcade cabinet */}
      <ArcadeCabinet z={-124} />

      <EffectComposer>
        <Bloom intensity={0.85} luminanceThreshold={0.28} luminanceSmoothing={0.7} mipmapBlur />
        <Noise opacity={0.05} />
        <Vignette offset={0.16} darkness={0.88} />
      </EffectComposer>
    </>
  )
}
