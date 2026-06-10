import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, Text } from '@react-three/drei'
import { ZONES } from '../gameBus'

const CREAM = '#f3ead8'
const CORAL = '#ff6b57'
const SUN = '#ffc93c'

/* deterministic rng so the world never reshuffles */
export function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */
/* Roads: cream strips + dashed center line                            */
/* ------------------------------------------------------------------ */

function Road({
  position,
  vertical,
  length,
}: {
  position: [number, number]
  vertical: boolean
  length: number
}) {
  const dashes = useMemo(() => {
    const out: [number, number, number][] = []
    const n = Math.floor(length / 4.5)
    for (let i = 0; i < n; i++) {
      const along = -length / 2 + 2.2 + i * 4.5
      out.push(vertical ? [position[0], 0.14, position[1] + along] : [position[0] + along, 0.14, position[1]])
    }
    return out
  }, [position, vertical, length])

  return (
    <group>
      <mesh position={[position[0], 0.05, position[1]]} receiveShadow>
        <boxGeometry args={vertical ? [8, 0.12, length] : [length, 0.12, 8]} />
        <meshStandardMaterial color={CREAM} roughness={0.95} />
      </mesh>
      {dashes.map((d, i) => (
        <mesh key={i} position={d}>
          <boxGeometry args={vertical ? [0.34, 0.05, 2.1] : [2.1, 0.05, 0.34]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Chunky 3D arrow used on highway signs                               */
/* ------------------------------------------------------------------ */

function Arrow({
  position,
  dir,
  scale = 1,
  color = '#ffffff',
}: {
  position: [number, number, number]
  dir: 'up' | 'right' | 'left' | 'down'
  scale?: number
  color?: string
}) {
  const rz = dir === 'up' ? 0 : dir === 'right' ? -Math.PI / 2 : dir === 'left' ? Math.PI / 2 : Math.PI
  return (
    <group position={position} rotation={[0, 0, rz]} scale={scale}>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.22, 0.55, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <coneGeometry args={[0.32, 0.5, 4]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Highway sign: green rounded board on two poles                      */
/* ------------------------------------------------------------------ */

function HighwaySign({
  position,
  rotationY = 0,
  text,
  distance,
  dir,
}: {
  position: [number, number, number]
  rotationY?: number
  text: string
  distance: string
  dir: 'up' | 'right' | 'left' | 'down'
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[-2.6, 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.17, 4.2, 10]} />
        <meshStandardMaterial color={CREAM} roughness={0.8} />
      </mesh>
      <mesh position={[2.6, 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.17, 4.2, 10]} />
        <meshStandardMaterial color={CREAM} roughness={0.8} />
      </mesh>
      <RoundedBox args={[7, 2.3, 0.36]} radius={0.16} smoothness={3} position={[0, 5, 0]} castShadow>
        <meshStandardMaterial color="#2f9e63" roughness={0.7} />
      </RoundedBox>
      <Text
        position={[-0.55, 5.25, 0.22]}
        fontSize={0.74}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.04}
        outlineWidth={0.035}
        outlineColor="#1d6b42"
      >
        {text}
      </Text>
      <Text
        position={[-0.55, 4.5, 0.22]}
        fontSize={0.42}
        color="#cdeedd"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.1}
      >
        {distance}
      </Text>
      <Arrow position={[2.6, 4.9, 0.26]} dir={dir} scale={1.15} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Spawn arch                                                          */
/* ------------------------------------------------------------------ */

function SpawnArch() {
  return (
    <group position={[0, 0, -13]}>
      {[-6.5, 6.5].map((x) => (
        <RoundedBox key={x} args={[1.8, 7.2, 1.8]} radius={0.4} smoothness={3} position={[x, 3.5, 0]} castShadow>
          <meshStandardMaterial color={CORAL} roughness={0.6} />
        </RoundedBox>
      ))}
      <RoundedBox args={[16.4, 2.9, 2]} radius={0.5} smoothness={3} position={[0, 7.55, 0]} castShadow>
        <meshStandardMaterial color={CREAM} roughness={0.6} />
      </RoundedBox>
      <Text
        position={[0, 7.6, 1.1]}
        fontSize={1.7}
        color={CORAL}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.08}
        outlineColor="#ffffff"
      >
        VROOM®
      </Text>
      {/* back side too — readable when leaving the plaza */}
      <Text
        position={[0, 7.6, -1.1]}
        rotation={[0, Math.PI, 0]}
        fontSize={1.7}
        color={CORAL}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.08}
        outlineColor="#ffffff"
      >
        VROOM®
      </Text>
      {/* pillar trims */}
      {[-6.5, 6.5].map((x) => (
        <RoundedBox key={`trim-${x}`} args={[2.3, 0.8, 2.3]} radius={0.25} smoothness={3} position={[x, 0.4, 0]}>
          <meshStandardMaterial color={SUN} roughness={0.7} />
        </RoundedBox>
      ))}
    </group>
  )
}

function SpawnSign() {
  return (
    <group position={[7.5, 0, 5]} rotation={[0, -0.35, 0]}>
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 2.6, 10]} />
        <meshStandardMaterial color={CREAM} roughness={0.8} />
      </mesh>
      <RoundedBox args={[5.6, 1.5, 0.3]} radius={0.14} smoothness={3} position={[0, 3, 0]} castShadow>
        <meshStandardMaterial color={SUN} roughness={0.7} />
      </RoundedBox>
      <Text
        position={[-0.34, 3, 0.18]}
        fontSize={0.52}
        color="#7a4a00"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
      >
        Drive to explore
      </Text>
      <Arrow position={[2.2, 3, 0.2]} dir="right" scale={0.8} color="#7a4a00" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Pulsing zone rings on the ground                                    */
/* ------------------------------------------------------------------ */

function ZoneRings() {
  const group = useRef<THREE.Group>(null!)
  useFrame((state) => {
    const s = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.012
    group.current.scale.setScalar(s)
  })
  return (
    <group ref={group}>
      {ZONES.map((z) => (
        <mesh key={z.id} position={[z.x, 0.06, z.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[z.radius - 0.9, z.radius, 64]} />
          <meshBasicMaterial color={z.color} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */

export default function World() {
  const patches = useMemo(() => {
    const rand = mulberry32(77)
    const tints = ['#23a4c4', '#1186a6', '#2cb3d1', '#1d9cbd']
    const out: { x: number; z: number; r: number; c: string }[] = []
    for (let i = 0; i < 16; i++) {
      out.push({
        x: (rand() - 0.5) * 180,
        z: (rand() - 0.5) * 180,
        r: 8 + rand() * 16,
        c: tints[Math.floor(rand() * tints.length)]!,
      })
    }
    return out
  }, [])

  return (
    <group>
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[420, 420]} />
        <meshStandardMaterial color="#1797b8" roughness={1} />
      </mesh>
      {patches.map((p, i) => (
        <mesh key={i} position={[p.x, 0.015 + (i % 3) * 0.004, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[p.r, 28]} />
          <meshStandardMaterial color={p.c} roughness={1} />
        </mesh>
      ))}

      {/* central plaza */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[16, 16, 0.1, 48]} />
        <meshStandardMaterial color={CREAM} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[3.4, 3.4, 0.06, 32]} />
        <meshStandardMaterial color={CORAL} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[1.8, 1.8, 0.06, 32]} />
        <meshStandardMaterial color={SUN} roughness={0.9} />
      </mesh>

      {/* four roads N / E / S / W */}
      <Road position={[0, -49]} vertical length={70} />
      <Road position={[0, 49]} vertical length={70} />
      <Road position={[49, 0]} vertical={false} length={70} />
      <Road position={[-49, 0]} vertical={false} length={70} />

      <SpawnArch />
      <SpawnSign />
      <ZoneRings />

      {/* highway signs along each road */}
      <HighwaySign position={[8.5, 0, -26]} rotationY={0} text="PORTFOLIO" distance="60 m" dir="up" />
      <HighwaySign position={[26, 0, 9]} rotationY={-Math.PI / 2} text="SERVICES" distance="60 m" dir="up" />
      <HighwaySign position={[-26, 0, -9]} rotationY={Math.PI / 2} text="ABOUT" distance="60 m" dir="up" />
      <HighwaySign position={[-8.5, 0, 26]} rotationY={Math.PI} text="CONTACT" distance="60 m" dir="up" />
      {/* mid-way reminders */}
      <HighwaySign position={[8.5, 0, -52]} rotationY={0} text="PORTFOLIO" distance="20 m" dir="up" />
      <HighwaySign position={[-8.5, 0, 52]} rotationY={Math.PI} text="CONTACT" distance="20 m" dir="up" />
      {/* plaza crossroads sign pointing sideways */}
      <HighwaySign position={[14, 0, -17]} rotationY={0.5} text="SERVICES" distance="that way" dir="right" />
      <HighwaySign position={[-14, 0, -17]} rotationY={-0.5} text="ABOUT" distance="that way" dir="left" />
    </group>
  )
}
