import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, Text } from '@react-three/drei'
import { easing } from '../lib/easing'
import { game } from '../gameBus'

const CREAM = '#f3ead8'
const CORAL = '#ff6b57'
const SUN = '#ffc93c'
const MINT = '#7ef0c8'

export const PROJECTS = [
  { name: 'ÓRBITA', url: 'https://orbita-3d.vulk.host', blurb: 'A scroll-through solar system for a creative agency.' },
  { name: 'TERRANOVA', url: 'https://terranova-3d.vulk.host', blurb: 'Procedural island worlds for an eco travel brand.' },
  { name: 'SYNTH LAB', url: 'https://synth-lab.vulk.host', blurb: 'A playable web synthesizer with neon vibes.' },
  { name: 'OCEANIC', url: 'https://oceanic-foundation.vulk.host', blurb: 'Deep-sea storytelling for an ocean charity.' },
  { name: 'PELAGIC', url: 'https://pelagic.vulk.host', blurb: 'Dive-with-a-shark WebGL experience.' },
  { name: 'FORGE', url: 'https://forge-games.vulk.host', blurb: 'Lava-soaked landing page for a game studio.' },
] as const

/* ------------------------------------------------------------------ */
/* PORTFOLIO (north): 6 angled billboards                              */
/* ------------------------------------------------------------------ */

function Billboard({
  position,
  rotationY,
  label,
  index,
  color,
}: {
  position: [number, number, number]
  rotationY: number
  label: string
  index: number
  color: string
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} position={[x, 1.6, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 3.2, 10]} />
          <meshStandardMaterial color={CREAM} roughness={0.8} />
        </mesh>
      ))}
      <RoundedBox args={[7.6, 4.1, 0.5]} radius={0.3} smoothness={3} position={[0, 5.1, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.65} />
      </RoundedBox>
      <Text
        position={[0, 5.45, 0.32]}
        fontSize={0.96}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.05}
        outlineWidth={0.05}
        outlineColor="#00405277"
      >
        {label}
      </Text>
      <Text position={[0, 4.35, 0.32]} fontSize={0.4} color="#ffffffcc" anchorX="center" anchorY="middle" letterSpacing={0.22}>
        {`PROJECT 0${index + 1}`}
      </Text>
    </group>
  )
}

function PortfolioDistrict() {
  const spots: { pos: [number, number, number]; rot: number; color: string }[] = [
    { pos: [-11, 0, -56], rot: 0.5, color: CORAL },
    { pos: [11, 0, -56], rot: -0.5, color: '#1f8fb0' },
    { pos: [-13, 0, -66], rot: 0.65, color: SUN },
    { pos: [13, 0, -66], rot: -0.65, color: '#9b8cff' },
    { pos: [-10, 0, -76], rot: 0.4, color: '#ff8fb2' },
    { pos: [10, 0, -76], rot: -0.4, color: '#2f9e63' },
  ]
  return (
    <group>
      {spots.map((s, i) => (
        <Billboard key={i} position={s.pos} rotationY={s.rot} label={PROJECTS[i]!.name} index={i} color={s.color} />
      ))}
      <Text
        position={[0, 0.2, -84]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={3.4}
        color={SUN}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
        outlineWidth={0.14}
        outlineColor="#0f6f8c"
      >
        PORTFOLIO
      </Text>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* SERVICES (east): 4 glowing pylons                                   */
/* ------------------------------------------------------------------ */

const SERVICES = ['IMMERSIVE WEB', '3D WORLDS', 'GAME-SITES', 'ART DIRECTION'] as const

function Pylon({ position, label, hue }: { position: [number, number, number]; label: string; hue: string }) {
  const glow = useRef<THREE.MeshStandardMaterial>(null!)
  const seed = useMemo(() => Math.random() * 10, [])
  useFrame((state) => {
    glow.current.emissiveIntensity = 0.9 + Math.sin(state.clock.elapsedTime * 2 + seed) * 0.45
  })
  return (
    <group position={position}>
      <RoundedBox args={[2.4, 0.9, 2.4]} radius={0.25} smoothness={3} position={[0, 0.45, 0]} castShadow>
        <meshStandardMaterial color={CREAM} roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[1.5, 7.5, 1.5]} radius={0.5} smoothness={3} position={[0, 4.4, 0]} castShadow>
        <meshStandardMaterial ref={glow} color={hue} emissive={hue} emissiveIntensity={0.9} roughness={0.4} />
      </RoundedBox>
      <RoundedBox args={[6.4, 1.4, 0.4]} radius={0.2} smoothness={3} position={[0, 9, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
        <meshStandardMaterial color="#0f6f8c" roughness={0.7} />
      </RoundedBox>
      <Text
        position={[-0.26, 9, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        fontSize={0.62}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.03}
        outlineColor="#073544"
      >
        {label}
      </Text>
    </group>
  )
}

function ServicesDistrict() {
  const hues = [MINT, SUN, CORAL, '#9b8cff']
  return (
    <group>
      {SERVICES.map((s, i) => (
        <Pylon key={s} position={[56 + (i % 2) * 16, 0, i < 2 ? -9 : 9]} label={s} hue={hues[i]!} />
      ))}
      <Text
        position={[66, 0.2, 0]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        fontSize={3}
        color={CORAL}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
        outlineWidth={0.13}
        outlineColor="#ffffff"
      >
        SERVICES
      </Text>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* ABOUT (west): friendly monolith whose eyes follow the car           */
/* ------------------------------------------------------------------ */

function Monolith() {
  const group = useRef<THREE.Group>(null!)
  const pupilL = useRef<THREE.Mesh>(null!)
  const pupilR = useRef<THREE.Mesh>(null!)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    /* car position in monolith local space → pupil offsets */
    tmp.set(game.carX, 1, game.carZ)
    group.current.worldToLocal(tmp)
    const ox = THREE.MathUtils.clamp(tmp.x * 0.02, -0.16, 0.16)
    const oy = THREE.MathUtils.clamp((tmp.y - 7) * 0.01, -0.12, 0.06)
    easing.damp(pupilL.current.position, 'x', -1.05 + ox, 0.12, delta)
    easing.damp(pupilL.current.position, 'y', 8.2 + oy, 0.12, delta)
    easing.damp(pupilR.current.position, 'x', 1.05 + ox, 0.12, delta)
    easing.damp(pupilR.current.position, 'y', 8.2 + oy, 0.12, delta)
  })

  return (
    /* faces east, toward the incoming road */
    <group ref={group} position={[-70, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <RoundedBox args={[7, 12.5, 4.6]} radius={0.9} smoothness={4} position={[0, 6.2, 0]} castShadow>
        <meshStandardMaterial color={CREAM} roughness={0.75} />
      </RoundedBox>
      {/* eyes */}
      {[-1.05, 1.05].map((x) => (
        <mesh key={x} position={[x, 8.2, 2.32]}>
          <sphereGeometry args={[0.62, 18, 18]} />
          <meshStandardMaterial color="#ffffff" roughness={0.35} />
        </mesh>
      ))}
      <mesh ref={pupilL} position={[-1.05, 8.2, 2.78]}>
        <sphereGeometry args={[0.26, 14, 14]} />
        <meshStandardMaterial color="#1a2a33" roughness={0.3} />
      </mesh>
      <mesh ref={pupilR} position={[1.05, 8.2, 2.78]}>
        <sphereGeometry args={[0.26, 14, 14]} />
        <meshStandardMaterial color="#1a2a33" roughness={0.3} />
      </mesh>
      {/* rosy cheeks + smile */}
      {[-1.7, 1.7].map((x) => (
        <mesh key={`cheek-${x}`} position={[x, 7.4, 2.3]}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshStandardMaterial color="#ff8fb2" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 6.9, 2.32]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.55, 0.12, 10, 20, Math.PI]} />
        <meshStandardMaterial color="#1a2a33" roughness={0.5} />
      </mesh>
      {/* little crown */}
      <RoundedBox args={[2.4, 0.8, 2]} radius={0.25} smoothness={3} position={[0, 12.9, 0]} castShadow>
        <meshStandardMaterial color={SUN} roughness={0.7} />
      </RoundedBox>
    </group>
  )
}

function AboutDistrict() {
  return (
    <group>
      <Monolith />
      <Text
        position={[-62, 0.2, 10]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={3}
        color={MINT}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.2}
        outlineWidth={0.13}
        outlineColor="#0f6f8c"
      >
        ABOUT
      </Text>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* CONTACT (south): giant mailbox, flag flips on arrival               */
/* ------------------------------------------------------------------ */

function Mailbox() {
  const flag = useRef<THREE.Group>(null!)
  useFrame((_, delta) => {
    const up = game.visited.has('contact')
    easing.damp(flag.current.rotation, 'z', up ? 0 : -1.45, 0.3, delta)
  })
  return (
    /* faces north, toward the incoming road */
    <group position={[0, 0, 70]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.75, 4.8, 12]} />
        <meshStandardMaterial color={CREAM} roughness={0.8} />
      </mesh>
      <RoundedBox args={[5, 4.6, 7.5]} radius={1.4} smoothness={4} position={[0, 6.6, 0]} castShadow>
        <meshStandardMaterial color={CORAL} roughness={0.6} />
      </RoundedBox>
      {/* mail slot */}
      <RoundedBox args={[3, 0.6, 0.5]} radius={0.25} smoothness={3} position={[0, 7.3, 3.6]}>
        <meshStandardMaterial color="#7c2316" roughness={0.8} />
      </RoundedBox>
      <Text
        position={[0, 6, 3.82]}
        fontSize={1.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.07}
        outlineColor="#7c2316"
      >
        @
      </Text>
      {/* flipping flag */}
      <group position={[2.6, 7.6, 1.6]}>
        <group ref={flag} rotation={[0, 0, -1.45]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 2.2, 8]} />
            <meshStandardMaterial color={CREAM} roughness={0.8} />
          </mesh>
          <RoundedBox args={[0.18, 0.9, 1.5]} radius={0.08} smoothness={2} position={[0, 2.2, -0.7]}>
            <meshStandardMaterial color={SUN} roughness={0.7} />
          </RoundedBox>
        </group>
      </group>
    </group>
  )
}

function ContactDistrict() {
  return (
    <group>
      <Mailbox />
      <Text
        position={[0, 0.2, 84]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={3.2}
        color="#ff8fb2"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
        outlineWidth={0.14}
        outlineColor="#ffffff"
      >
        CONTACT
      </Text>
    </group>
  )
}

/* ------------------------------------------------------------------ */

export default function Districts() {
  return (
    <group>
      <PortfolioDistrict />
      <ServicesDistrict />
      <AboutDistrict />
      <ContactDistrict />
    </group>
  )
}
