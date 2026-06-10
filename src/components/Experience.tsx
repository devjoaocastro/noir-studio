import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useScroll } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import { PAGES, setScrollEl } from '../scrollBus'
import Synth from './Synth'

/* Camera keyframes — one per page, orbiting the instrument.           */

const CAM: { pos: [number, number, number]; look: [number, number, number] }[] = [
  { pos: [0, 3.3, 8.8], look: [0, 2.0, 0] }, // 0 hero — 3/4 front, synth low in frame
  { pos: [-5.4, 2.4, 5.6], look: [2.4, 0.9, 0] }, // 1 philosophy — synth left, copy right
  { pos: [0, 7.0, 2.4], look: [0, 0.8, -0.2] }, // 2 engine — top down
  { pos: [-1.55, 2.7, 2.4], look: [-1.55, 1.3, -0.55] }, // 3 oscilloscope close-up
  { pos: [6.4, 2.6, 5.0], look: [2.4, 1.2, -0.6] }, // 4 artists — speaker side
  { pos: [-5.8, 1.6, 6.0], look: [3.0, 1.0, 0] }, // 5 specs — low angle, synth left
  { pos: [0, 2.4, 6.6], look: [0, 0.9, 0] }, // 6 pre-order — front
  { pos: [0, 7.6, 16.5], look: [0, 0.3, 0] }, // 7 footer — pull far back
]

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#101013" roughness={0.95} metalness={0} />
      </mesh>
      <gridHelper args={[90, 60, '#2a2a30', '#1b1b20']} position={[0, 0.005, 0]} />
    </group>
  )
}

/** Drifting dust motes — cheap depth cue in the dark studio. */
function Motes() {
  const ref = useRef<THREE.Points>(null!)

  const positions = useMemo(() => {
    const arr = new Float32Array(260 * 3)
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = (Math.random() - 0.5) * 30
      arr[i + 1] = Math.random() * 9 + 0.3
      arr[i + 2] = (Math.random() - 0.5) * 26
    }
    return arr
  }, [])

  useFrame((state) => {
    ref.current.rotation.y = state.clock.elapsedTime * 0.012
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#8d877a" transparent opacity={0.5} sizeAttenuation />
    </points>
  )
}

export default function Experience() {
  const scroll = useScroll()
  const posA = useMemo(() => new THREE.Vector3(), [])
  const posB = useMemo(() => new THREE.Vector3(), [])
  const lookA = useMemo(() => new THREE.Vector3(), [])
  const lookB = useMemo(() => new THREE.Vector3(), [])
  const lookCur = useMemo(() => new THREE.Vector3(0, 0.8, 0), [])

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    const o = scroll.offset
    const sec = o * (PAGES - 1)
    const i = Math.min(PAGES - 2, Math.max(0, Math.floor(sec)))
    const f = THREE.MathUtils.smoothstep(sec - i, 0, 1)

    posA.fromArray(CAM[i].pos)
    posB.fromArray(CAM[i + 1].pos)
    posA.lerp(posB, f)

    lookA.fromArray(CAM[i].look)
    lookB.fromArray(CAM[i + 1].look)
    lookA.lerp(lookB, f)

    // glide between keyframes + gentle mouse parallax
    easing.damp3(
      state.camera.position,
      [posA.x + state.pointer.x * 0.45, posA.y - state.pointer.y * 0.3, posA.z],
      0.3,
      delta,
    )
    easing.damp3(lookCur, lookA, 0.3, delta)
    state.camera.lookAt(lookCur)

    document.documentElement.style.setProperty('--scroll', o.toFixed(4))
  })

  return (
    <>
      {/* studio lighting: soft key + warm signal accent + cool fill */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 9, 6]} intensity={1.5} color="#fff6e8" />
      <directionalLight position={[-7, 4, -4]} intensity={0.4} color="#6f7cff" />
      <pointLight position={[-3, 3.5, 3]} intensity={14} distance={14} color="#ff5500" />
      <pointLight position={[4.5, 3.2, -2.5]} intensity={10} distance={12} color="#4afa6e" />

      <Ground />
      <Motes />
      <Synth />

      <EffectComposer>
        <Bloom intensity={0.75} luminanceThreshold={0.32} luminanceSmoothing={0.7} mipmapBlur />
        <Noise opacity={0.05} />
        <Vignette offset={0.18} darkness={0.85} />
      </EffectComposer>
    </>
  )
}
