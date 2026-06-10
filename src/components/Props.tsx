import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { game, emit, ZONES } from '../gameBus'
import { audio } from '../audio'
import { mulberry32 } from './World'

const CREAM = '#f3ead8'
const CORAL = '#ff6b57'
const SUN = '#ffc93c'
const BUILDING_TINTS = ['#1f8fb0', '#26a8c9', '#117a96', '#2cb3d1', '#0f6f8c']
const LEAF_TINTS = ['#43d9a3', '#36c893', '#52e2af', '#2fbf8a']

function clearOfRoadsAndZones(x: number, z: number, zoneMargin: number) {
  if (Math.abs(x) < 11) return false
  if (Math.abs(z) < 11) return false
  if (Math.hypot(x, z) < 22) return false
  for (const zo of ZONES) {
    if (Math.hypot(x - zo.x, z - zo.z) < zo.radius + zoneMargin) return false
  }
  return true
}

/* ------------------------------------------------------------------ */
/* Toy building                                                        */
/* ------------------------------------------------------------------ */

function Building({
  position,
  rotationY,
  w,
  h,
  d,
  tint,
  doorColor,
}: {
  position: [number, number, number]
  rotationY: number
  w: number
  h: number
  d: number
  tint: string
  doorColor: string
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[w, h, d]} radius={0.45} smoothness={3} position={[0, h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={tint} roughness={0.85} />
      </RoundedBox>
      {/* roof slab */}
      <RoundedBox args={[w + 0.7, 0.8, d + 0.7]} radius={0.3} smoothness={3} position={[0, h + 0.2, 0]} castShadow>
        <meshStandardMaterial color={CREAM} roughness={0.85} />
      </RoundedBox>
      {/* oversized door */}
      <RoundedBox args={[w * 0.34, h * 0.42, 0.5]} radius={0.18} smoothness={3} position={[0, h * 0.21, d / 2]}>
        <meshStandardMaterial color={doorColor} roughness={0.7} />
      </RoundedBox>
      {/* chunky windows */}
      <RoundedBox args={[w * 0.22, w * 0.22, 0.4]} radius={0.1} smoothness={2} position={[-w * 0.27, h * 0.66, d / 2]}>
        <meshStandardMaterial color={SUN} emissive={SUN} emissiveIntensity={0.45} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[w * 0.22, w * 0.22, 0.4]} radius={0.1} smoothness={2} position={[w * 0.27, h * 0.66, d / 2]}>
        <meshStandardMaterial color={SUN} emissive={SUN} emissiveIntensity={0.45} roughness={0.6} />
      </RoundedBox>
    </group>
  )
}

function Buildings() {
  const items = useMemo(() => {
    const rand = mulberry32(1234)
    const out: {
      pos: [number, number, number]
      rot: number
      w: number
      h: number
      d: number
      tint: string
      door: string
    }[] = []
    let guard = 0
    while (out.length < 30 && guard++ < 600) {
      const x = (rand() - 0.5) * 170
      const z = (rand() - 0.5) * 170
      if (!clearOfRoadsAndZones(x, z, 8)) continue
      if (out.some((b) => Math.hypot(b.pos[0] - x, b.pos[2] - z) < 14)) continue
      out.push({
        pos: [x, 0, z],
        rot: Math.round(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.3,
        w: 5 + rand() * 4,
        h: 5 + rand() * 7,
        d: 5 + rand() * 3,
        tint: BUILDING_TINTS[Math.floor(rand() * BUILDING_TINTS.length)]!,
        door: rand() > 0.5 ? CORAL : CREAM,
      })
    }
    return out
  }, [])

  return (
    <group>
      {items.map((b, i) => (
        <Building
          key={i}
          position={b.pos}
          rotationY={b.rot}
          w={b.w}
          h={b.h}
          d={b.d}
          tint={b.tint}
          doorColor={b.door}
        />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Fluffy tree                                                         */
/* ------------------------------------------------------------------ */

function Tree({ position, scale, tint }: { position: [number, number, number]; scale: number; tint: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 1.8, 8]} />
        <meshStandardMaterial color="#b07a4f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.3, 0]} castShadow>
        <sphereGeometry args={[1.05, 14, 14]} />
        <meshStandardMaterial color={tint} roughness={0.9} />
      </mesh>
      <mesh position={[0.62, 1.9, 0.25]} castShadow>
        <sphereGeometry args={[0.7, 12, 12]} />
        <meshStandardMaterial color={tint} roughness={0.9} />
      </mesh>
      <mesh position={[-0.58, 2, -0.2]} castShadow>
        <sphereGeometry args={[0.65, 12, 12]} />
        <meshStandardMaterial color={tint} roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.05, 0]} castShadow>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshStandardMaterial color={tint} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Trees({ count }: { count: number }) {
  const items = useMemo(() => {
    const rand = mulberry32(4242)
    const out: { pos: [number, number, number]; s: number; tint: string }[] = []
    let guard = 0
    while (out.length < count && guard++ < 900) {
      const x = (rand() - 0.5) * 180
      const z = (rand() - 0.5) * 180
      if (!clearOfRoadsAndZones(x, z, 4)) continue
      out.push({
        pos: [x, 0, z],
        s: 0.8 + rand() * 1.1,
        tint: LEAF_TINTS[Math.floor(rand() * LEAF_TINTS.length)]!,
      })
    }
    return out
  }, [count])
  /* hand-placed trees framing the spawn plaza */
  const plazaTrees: { pos: [number, number, number]; s: number; tint: string }[] = [
    { pos: [13.5, 0, -17], s: 1.4, tint: LEAF_TINTS[0]! },
    { pos: [-14.5, 0, -19.5], s: 1.2, tint: LEAF_TINTS[2]! },
    { pos: [17, 0, 13], s: 1.3, tint: LEAF_TINTS[1]! },
    { pos: [-13, 0, 15.5], s: 1.1, tint: LEAF_TINTS[3]! },
    { pos: [-17.5, 0, -13], s: 0.9, tint: LEAF_TINTS[0]! },
  ]
  return (
    <group>
      {items.map((t, i) => (
        <Tree key={i} position={t.pos} scale={t.s} tint={t.tint} />
      ))}
      {plazaTrees.map((t, i) => (
        <Tree key={`p-${i}`} position={t.pos} scale={t.s} tint={t.tint} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Street lamps along the roads                                        */
/* ------------------------------------------------------------------ */

function Lamp({ position, flip }: { position: [number, number, number]; flip: boolean }) {
  const s = flip ? -1 : 1
  return (
    <group position={position}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 4.4, 8]} />
        <meshStandardMaterial color={CREAM} roughness={0.8} />
      </mesh>
      <mesh position={[s * 0.55, 4.35, 0]} rotation={[0, 0, s * -0.8]}>
        <cylinderGeometry args={[0.09, 0.09, 1.3, 8]} />
        <meshStandardMaterial color={CREAM} roughness={0.8} />
      </mesh>
      <mesh position={[s * 1.05, 4.55, 0]}>
        <sphereGeometry args={[0.32, 14, 14]} />
        <meshStandardMaterial color="#fff3c4" emissive={SUN} emissiveIntensity={1.5} />
      </mesh>
    </group>
  )
}

function Lamps() {
  const items = useMemo(() => {
    const out: { pos: [number, number, number]; flip: boolean }[] = []
    for (let i = 0; i < 4; i++) {
      const along = 24 + i * 18
      out.push({ pos: [-5.6, 0, -along], flip: false })
      out.push({ pos: [5.6, 0, along], flip: true })
      out.push({ pos: [along, 0, 5.6], flip: false })
      out.push({ pos: [-along, 0, -5.6], flip: true })
    }
    return out
  }, [])
  return (
    <group>
      {items.map((l, i) => (
        <Lamp key={i} position={l.pos} flip={l.flip} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Parked toy cars                                                     */
/* ------------------------------------------------------------------ */

function ParkedCar({ position, rotationY, color }: { position: [number, number, number]; rotationY: number; color: string }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[1.6, 0.55, 2.8]} radius={0.18} smoothness={3} position={[0, 0.5, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[1.25, 0.5, 1.3]} radius={0.16} smoothness={3} position={[0, 0.95, -0.15]} castShadow>
        <meshStandardMaterial color={CREAM} roughness={0.6} />
      </RoundedBox>
      {(
        [
          [-0.75, 0.3, 0.9],
          [0.75, 0.3, 0.9],
          [-0.75, 0.3, -0.9],
          [0.75, 0.3, -0.9],
        ] as [number, number, number][]
      ).map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.3, 14]} />
          <meshStandardMaterial color="#28323c" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function ParkedCars() {
  const cars: { pos: [number, number, number]; rot: number; color: string }[] = useMemo(
    () => [
      { pos: [-7.2, 0, -32], rot: 0.1, color: SUN },
      { pos: [7.2, 0, 36], rot: Math.PI - 0.08, color: '#7ef0c8' },
      { pos: [40, 0, -7.2], rot: Math.PI / 2 + 0.06, color: '#ff8fb2' },
      { pos: [-44, 0, 7.2], rot: -Math.PI / 2, color: CREAM },
      { pos: [13, 0, 10], rot: 2.4, color: '#9b8cff' },
    ],
    [],
  )
  return (
    <group>
      {cars.map((c, i) => (
        <ParkedCar key={i} position={c.pos} rotationY={c.rot} color={c.color} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Knockables: cones + crates that fly when hit                        */
/* ------------------------------------------------------------------ */

interface KnockState {
  hit: boolean
  dead: boolean
  vel: THREE.Vector3
  ang: THREE.Vector3
  scale: number
}

function Knockables({ reduced }: { reduced: boolean }) {
  const items = useMemo(() => {
    const rand = mulberry32(909)
    const out: { pos: [number, number, number]; crate: boolean; rot: number }[] = []
    /* cones along all four road edges */
    const edges = reduced ? 3 : 5
    for (let i = 0; i < edges; i++) {
      const along = 20 + i * 13
      const side = i % 2 === 0 ? 5.1 : -5.1
      out.push({ pos: [side, 0, -along], crate: false, rot: rand() * Math.PI })
      out.push({ pos: [-side, 0, along], crate: false, rot: rand() * Math.PI })
      out.push({ pos: [along, 0, side], crate: false, rot: rand() * Math.PI })
      out.push({ pos: [-along, 0, -side], crate: false, rot: rand() * Math.PI })
    }
    /* cones + crates around the plaza */
    const ringN = reduced ? 5 : 9
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2 + 0.35
      const r = 11.5 + rand() * 2
      out.push({
        pos: [Math.cos(a) * r, 0, Math.sin(a) * r],
        crate: rand() > 0.55,
        rot: rand() * Math.PI,
      })
    }
    return out
  }, [reduced])

  const refs = useRef<(THREE.Group | null)[]>([])
  const states = useRef<KnockState[]>(
    items.map(() => ({
      hit: false,
      dead: false,
      vel: new THREE.Vector3(),
      ang: new THREE.Vector3(),
      scale: 1,
    })),
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    if (game.paused) return
    for (let i = 0; i < items.length; i++) {
      const g = refs.current[i]
      const s = states.current[i]
      if (!g || !s || s.dead) continue

      if (!s.hit) {
        const dx = g.position.x - game.carX
        const dz = g.position.z - game.carZ
        if (dx * dx + dz * dz < 2.4 && game.speedKmh > 12) {
          s.hit = true
          const d = Math.max(0.4, Math.hypot(dx, dz))
          const power = 4 + game.speed01 * 16
          s.vel.set((dx / d) * power, 5 + Math.random() * 5, (dz / d) * power)
          s.ang.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12)
          game.points += 10
          game.shake = Math.min(1, game.shake + 0.4)
          audio.bonk()
          emit('popup', { text: '+10' })
        }
        continue
      }

      /* simple ballistic flight */
      s.vel.y -= 22 * dt
      g.position.addScaledVector(s.vel, dt)
      g.rotation.x += s.ang.x * dt
      g.rotation.y += s.ang.y * dt
      g.rotation.z += s.ang.z * dt
      if (g.position.y < 0 && s.vel.y < 0) {
        if (Math.abs(s.vel.y) > 3) {
          g.position.y = 0
          s.vel.y *= -0.4
          s.vel.x *= 0.6
          s.vel.z *= 0.6
        } else {
          /* settle then shrink away */
          s.scale = Math.max(0, s.scale - dt * 1.6)
          g.scale.setScalar(Math.max(0.001, s.scale))
          if (s.scale <= 0) {
            s.dead = true
            g.visible = false
          }
        }
      }
    }
  })

  return (
    <group>
      {items.map((it, i) => (
        <group
          key={i}
          ref={(g) => {
            refs.current[i] = g
          }}
          position={it.pos}
          rotation={[0, it.rot, 0]}
        >
          {it.crate ? (
            <RoundedBox args={[1.1, 1.1, 1.1]} radius={0.14} smoothness={2} position={[0, 0.55, 0]} castShadow>
              <meshStandardMaterial color={SUN} roughness={0.8} />
            </RoundedBox>
          ) : (
            <group>
              <mesh position={[0, 0.08, 0]} castShadow>
                <cylinderGeometry args={[0.5, 0.58, 0.16, 12]} />
                <meshStandardMaterial color={CORAL} roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.55, 0]} castShadow>
                <coneGeometry args={[0.4, 0.95, 14]} />
                <meshStandardMaterial color={CORAL} roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.27, 0.33, 0.18, 14]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */

export default function Props() {
  const reduced = game.isCoarse
  return (
    <group>
      <Buildings />
      <Trees count={reduced ? 22 : 40} />
      <Lamps />
      <ParkedCars />
      <Knockables reduced={reduced} />
    </group>
  )
}
