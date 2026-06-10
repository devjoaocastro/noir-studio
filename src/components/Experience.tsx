import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import {
  Environment,
  Float,
  Lightformer,
  Line,
  RoundedBox,
  Sparkles,
  useCursor,
  useScroll,
} from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import { PAGES, setScrollEl } from '../scrollBus'

const SILVER = '#d6d6d6'
const RED = '#e3342f'
const WARM = '#ffe9c9'

/* ------------------------------------------------------------------ */
/* Section wrapper — fades/scales/rotates its content as it enters     */
/* and leaves the viewport while we scroll through the 3D world.       */
/* ------------------------------------------------------------------ */

function Section({ index, z = 0, children }: { index: number; z?: number; children: ReactNode }) {
  const inner = useRef<THREE.Group>(null!)
  const scroll = useScroll()
  const vh = useThree((s) => s.viewport.height)

  useFrame((_, delta) => {
    const progress = scroll.offset * (PAGES - 1) - index // 0 when section centered
    const visibility = Math.max(0, 1 - Math.abs(progress)) // 1 visible → 0 offscreen
    easing.damp3(inner.current.scale, 0.78 + visibility * 0.22, 0.2, delta)
    inner.current.rotation.y = progress * 0.25
    inner.current.position.z = z - (1 - visibility) * 1.6
  })

  return (
    <group position={[0, -index * vh, 0]}>
      <group ref={inner}>{children}</group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* LightCone — CUSTOM GLSL SHADER. Additive volumetric spotlight cone  */
/* with axial falloff (hot at the lamp, dying toward the floor) and    */
/* radial falloff (beam core glows, silhouette edges dissolve), plus   */
/* a subtle projector-shutter flicker.                                 */
/* ------------------------------------------------------------------ */

const coneVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const coneFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    // axial falloff — uv.y = 1 at the apex (lamp), 0 at the base (floor)
    float axial = pow(smoothstep(0.02, 0.95, vUv.y), 1.7);
    // radial falloff — facing surfaces glow, grazing edges dissolve
    float rim = pow(abs(dot(normalize(vNormal), normalize(vViewDir))), 1.6);
    // 24fps shutter shimmer
    float flicker = 0.9 + 0.1 * sin(uTime * 18.0) * sin(uTime * 7.3 + vUv.x * 6.2831);
    float a = axial * rim * uIntensity * flicker;
    gl_FragColor = vec4(uColor * a, a);
  }
`

function LightCone({
  position,
  rotation = [0, 0, 0],
  length = 4,
  radius = 1.3,
  color = WARM,
  intensity = 0.7,
  sway = 0,
  head = true,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  length?: number
  radius?: number
  color?: string
  intensity?: number
  sway?: number
  head?: boolean
}) {
  const group = useRef<THREE.Group>(null!)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uTime: { value: 0 },
          uIntensity: { value: intensity },
        },
        vertexShader: coneVertex,
        fragmentShader: coneFragment,
      }),
    [color, intensity],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    if (sway > 0) {
      group.current.rotation.z =
        rotation[2] + Math.sin(state.clock.elapsedTime * 0.45 + position[0] * 1.7) * sway
    }
  })

  return (
    <group ref={group} position={position} rotation={rotation}>
      {head && (
        <group position={[0, length / 2 + 0.16, 0]}>
          <mesh>
            <cylinderGeometry args={[0.15, 0.22, 0.3, 16]} />
            <meshStandardMaterial color="#161616" metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      )}
      <mesh>
        <coneGeometry args={[radius, length, 48, 16, true]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Film camera on a dolly — body, twin magazines, lens cylinders and   */
/* matte box built from primitives. It travels a CatmullRom track that */
/* snakes past every section as you scroll.                            */
/* ------------------------------------------------------------------ */

function FilmCameraModel() {
  return (
    <group>
      {/* body */}
      <RoundedBox args={[0.55, 0.48, 0.95]} radius={0.05}>
        <meshStandardMaterial color="#101010" metalness={0.7} roughness={0.35} />
      </RoundedBox>
      {/* twin film magazines */}
      {[-0.14, 0.26].map((z) => (
        <mesh key={z} position={[0, 0.42, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.13, 24]} />
          <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      {/* lens barrel + front element */}
      <mesh position={[0, 0.02, 0.66]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.42, 24]} />
        <meshStandardMaterial color="#0d0d0d" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.115, 0.1, 24]} />
        <meshStandardMaterial color="#1c1c1c" metalness={1} roughness={0.12} />
      </mesh>
      {/* matte box + top flag */}
      <mesh position={[0, 0.05, 1.06]}>
        <boxGeometry args={[0.46, 0.36, 0.16]} />
        <meshStandardMaterial color="#080808" metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.27, 1.1]} rotation={[-0.55, 0, 0]}>
        <boxGeometry args={[0.46, 0.02, 0.24]} />
        <meshStandardMaterial color="#080808" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* tally light — the rare blood-red accent */}
      <mesh position={[0.2, 0.18, -0.5]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color={RED} toneMapped={false} />
      </mesh>
      {/* dolly platform + wheels */}
      <mesh position={[0, -0.42, 0]}>
        <boxGeometry args={[0.7, 0.08, 1.1]} />
        <meshStandardMaterial color="#0c0c0c" metalness={0.6} roughness={0.4} />
      </mesh>
      {[
        [-0.3, -0.5],
        [0.3, -0.5],
        [-0.3, 0.5],
        [0.3, 0.5],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, -0.52, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
          <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function CameraDolly() {
  const scroll = useScroll()
  const vh = useThree((s) => s.viewport.height)
  const vw = useThree((s) => s.viewport.width)
  const rig = useRef<THREE.Group>(null!)
  const lookTarget = useMemo(() => new THREE.Vector3(), [])

  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < PAGES; i++) {
      const side = i % 2 === 0 ? 1 : -1
      pts.push(new THREE.Vector3(side * vw * 0.34, -i * vh + vh * 0.18, -2.4))
      pts.push(new THREE.Vector3(-side * vw * 0.2, -i * vh - vh * 0.36, -1.7))
    }
    return new THREE.CatmullRomCurve3(pts)
  }, [vh, vw])

  const trackPoints = useMemo(() => curve.getPoints(320), [curve])

  useFrame((_, delta) => {
    const o = THREE.MathUtils.clamp(scroll.offset, 0.001, 0.998)
    const p = curve.getPoint(o)
    easing.damp3(rig.current.position, [p.x, p.y, p.z], 0.08, delta)
    curve.getPoint(Math.min(o + 0.008, 1), lookTarget)
    rig.current.lookAt(lookTarget)
  })

  return (
    <group>
      {/* the dolly track */}
      <Line
        points={trackPoints}
        color={SILVER}
        transparent
        opacity={0.13}
        lineWidth={1}
        dashed
        dashSize={0.1}
        gapSize={0.12}
      />
      <group ref={rig}>
        <FilmCameraModel />
        <pointLight intensity={6} distance={5} color={SILVER} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Clapperboard — click and the top jaw SNAPS shut, then eases open.   */
/* ------------------------------------------------------------------ */

function ClapperStripes() {
  return (
    <group>
      {[-0.9, -0.45, 0, 0.45, 0.9].map((x) => (
        <mesh key={x} position={[x, 0, 0.055]} rotation={[0, 0, 0.7]}>
          <boxGeometry args={[0.15, 0.24, 0.012]} />
          <meshBasicMaterial color={SILVER} />
        </mesh>
      ))}
    </group>
  )
}

function Clapperboard() {
  const topJaw = useRef<THREE.Group>(null!)
  const closedRef = useRef(false)
  const timer = useRef(0)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useFrame((_, delta) => {
    const target = closedRef.current ? 0 : 0.48
    // SNAP shut, ease back open
    easing.damp(topJaw.current.rotation, 'z', target, closedRef.current ? 0.04 : 0.35, delta)
  })

  const clap = () => {
    if (closedRef.current) return
    closedRef.current = true
    timer.current = window.setTimeout(() => {
      closedRef.current = false
    }, 850)
  }

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        clap()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* slate */}
      <RoundedBox args={[2.3, 1.45, 0.1]} radius={0.03} position={[0, -0.48, 0]}>
        <meshStandardMaterial color="#0b0b0b" metalness={0.4} roughness={0.5} />
      </RoundedBox>
      {/* info strips on the slate */}
      {[-0.18, -0.52, -0.86].map((y) => (
        <mesh key={y} position={[-0.2, y, 0.06]}>
          <boxGeometry args={[1.5, 0.022, 0.01]} />
          <meshBasicMaterial color={SILVER} transparent opacity={0.65} />
        </mesh>
      ))}
      {/* red SCENE marker dot */}
      <mesh position={[0.85, -0.18, 0.06]}>
        <circleGeometry args={[0.06, 24]} />
        <meshBasicMaterial color={RED} toneMapped={false} />
      </mesh>
      {/* fixed lower jaw */}
      <group position={[0, 0.36, 0]}>
        <mesh>
          <boxGeometry args={[2.3, 0.22, 0.1]} />
          <meshStandardMaterial color="#0b0b0b" metalness={0.4} roughness={0.5} />
        </mesh>
        <ClapperStripes />
      </group>
      {/* hinged top jaw */}
      <group ref={topJaw} position={[-1.15, 0.47, 0]} rotation={[0, 0, 0.48]}>
        <group position={[1.15, 0.11, 0]}>
          <mesh>
            <boxGeometry args={[2.3, 0.22, 0.1]} />
            <meshStandardMaterial color="#0b0b0b" metalness={0.4} roughness={0.5} />
          </mesh>
          <ClapperStripes />
        </group>
      </group>
      {/* hinge pin */}
      <mesh position={[-1.15, 0.47, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.16, 16]} />
        <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Lens stack — floating lens elements for the Services section.      */
/* ------------------------------------------------------------------ */

function LensStack() {
  const group = useRef<THREE.Group>(null!)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useFrame((_, delta) => {
    group.current.rotation.y += delta * (hovered ? 1.6 : 0.35)
    easing.damp3(group.current.scale, hovered ? 1.15 : 1, 0.18, delta)
  })

  return (
    <group
      ref={group}
      rotation={[0.4, 0, 0.15]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {[
        { y: 0.85, r: 0.55 },
        { y: 0.3, r: 0.78 },
        { y: -0.3, r: 0.92 },
        { y: -0.9, r: 0.7 },
      ].map(({ y, r }) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[r, r, 0.09, 48]} />
          <meshStandardMaterial
            color="#1a1a1a"
            metalness={1}
            roughness={0.12}
            emissive={SILVER}
            emissiveIntensity={0.06}
          />
        </mesh>
      ))}
      {/* iris ring */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.04, 0.025, 12, 64]} />
        <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.2} emissive={SILVER} emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Scrub Room — THE DRAGGABLE INTERACTION. Pointer down + move on the  */
/* film reel spins it and scrubs the lighting rig of the miniature     */
/* set (table, two chairs, key-light boom), relighting the scene.      */
/* ------------------------------------------------------------------ */

function MiniatureSet({ lightRig }: { lightRig: RefObject<THREE.Group | null> }) {
  return (
    <group>
      {/* platform */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[1.75, 1.85, 0.12, 48]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* table */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.95, 0.05, 0.6]} />
        <meshStandardMaterial color="#141414" metalness={0.3} roughness={0.6} />
      </mesh>
      {[
        [-0.42, -0.24],
        [0.42, -0.24],
        [-0.42, 0.24],
        [0.42, 0.24],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.2, z]}>
          <boxGeometry args={[0.04, 0.4, 0.04]} />
          <meshStandardMaterial color="#141414" metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
      {/* two chairs facing each other across the table */}
      {[-0.85, 0.85].map((x) => (
        <group key={x} position={[x, 0, 0]} rotation={[0, x > 0 ? Math.PI : 0, 0]}>
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[0.3, 0.04, 0.3]} />
            <meshStandardMaterial color="#101010" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.42, -0.14]}>
            <boxGeometry args={[0.3, 0.34, 0.04]} />
            <meshStandardMaterial color="#101010" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[0.05, 0.26, 0.05]} />
            <meshStandardMaterial color="#101010" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* rotating key-light boom — driven by the reel drag */}
      <group ref={lightRig}>
        <mesh position={[1.45, 0.9, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.9, 12]} />
          <meshStandardMaterial color="#1c1c1c" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.9, 1.78, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 1.15, 12]} />
          <meshStandardMaterial color="#1c1c1c" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* the key light itself: custom-shader cone aimed at the table */}
        <group position={[0.42, 1.3, 0]} rotation={[0, 0, 0.32]}>
          <LightCone position={[0, 0, 0]} length={1.7} radius={0.62} color={WARM} intensity={0.85} />
          <pointLight position={[0, 0.9, 0]} intensity={9} distance={6} color={WARM} />
        </group>
      </group>
    </group>
  )
}

function ScrubRoom() {
  const vw = useThree((s) => s.viewport.width)
  const reel = useRef<THREE.Group>(null!)
  const lightRig = useRef<THREE.Group>(null)
  const angle = useRef(0.5)
  const velocity = useRef(0)
  const dragging = useRef(false)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    dragging.current = true
    let lastX = e.clientX
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - lastX
      lastX = ev.clientX
      const da = dx * 0.011
      angle.current += da
      velocity.current = da
    }
    const up = () => {
      dragging.current = false
      window.removeEventListener('pointermove', move)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  useFrame((_, delta) => {
    if (!dragging.current) {
      // inertia: keep spinning a little, then settle
      velocity.current = THREE.MathUtils.damp(velocity.current, 0, 3, delta)
      angle.current += velocity.current
    }
    reel.current.rotation.z = -angle.current * 2
    if (lightRig.current) {
      easing.damp(lightRig.current.rotation, 'y', angle.current, 0.12, delta)
    }
  })

  const spokes = useMemo(() => [0, 1, 2, 3, 4].map((i) => (i * Math.PI) / 5), [])

  return (
    <group>
      {/* the draggable reel */}
      <group position={[-vw * 0.21, 0.35, 0.8]}>
        <group
          ref={reel}
          onPointerDown={onPointerDown}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => setHovered(false)}
        >
          {/* invisible disc = generous hit area for the drag */}
          <mesh>
            <circleGeometry args={[1.3, 32]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* rim */}
          <mesh>
            <torusGeometry args={[1.05, 0.07, 16, 72]} />
            <meshStandardMaterial color={SILVER} metalness={0.95} roughness={0.2} />
          </mesh>
          {/* wound film mass */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.78, 0.78, 0.1, 48]} />
            <meshStandardMaterial color="#121212" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* spokes */}
          {spokes.map((a) => (
            <mesh key={a} rotation={[0, 0, a]}>
              <boxGeometry args={[0.07, 2.0, 0.06]} />
              <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.25} />
            </mesh>
          ))}
          {/* hub — with the rare red center */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.16, 24]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.09]}>
            <circleGeometry args={[0.08, 24]} />
            <meshBasicMaterial color={RED} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* the miniature set being relit */}
      <group position={[vw * 0.18, -1.1, 0]}>
        <MiniatureSet lightRig={lightRig} />
        {/* static silver rim light for contrast */}
        <LightCone
          position={[-1.6, 1.5, -1.2]}
          rotation={[0, 0, -0.4]}
          length={2.4}
          radius={0.7}
          color={SILVER}
          intensity={0.3}
          head={false}
        />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Film posters — noir one-sheets that lift and tilt to the cursor.    */
/* ------------------------------------------------------------------ */

function FilmPoster({
  position,
  rotation,
  accent = false,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  accent?: boolean
}) {
  const group = useRef<THREE.Group>(null!)
  const mat = useRef<THREE.MeshStandardMaterial>(null!)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useFrame((state, delta) => {
    const target: [number, number, number] = hovered
      ? [-state.pointer.y * 0.4, state.pointer.x * 0.4, 0]
      : rotation
    easing.dampE(group.current.rotation, target, 0.2, delta)
    easing.damp3(
      group.current.position,
      hovered ? [position[0], position[1] + 0.15, position[2] + 0.6] : position,
      0.2,
      delta,
    )
    easing.damp(mat.current, 'emissiveIntensity', hovered ? 0.35 : 0.08, 0.2, delta)
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
      <RoundedBox args={[1.9, 2.7, 0.1]} radius={0.05}>
        <meshStandardMaterial
          ref={mat}
          color="#0d0d0d"
          emissive={SILVER}
          emissiveIntensity={0.08}
          metalness={0.6}
          roughness={0.35}
        />
      </RoundedBox>
      {/* silver title bar */}
      <mesh position={[0, -1.05, 0.06]}>
        <boxGeometry args={[1.5, 0.05, 0.01]} />
        <meshBasicMaterial color={SILVER} />
      </mesh>
      <mesh position={[0, -0.88, 0.06]}>
        <boxGeometry args={[0.9, 0.025, 0.01]} />
        <meshBasicMaterial color={SILVER} transparent opacity={0.5} />
      </mesh>
      {/* festival laurel dot */}
      <mesh position={[-0.7, 1.1, 0.07]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={accent ? RED : SILVER} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Process — five track lights that switch on as the scroll passes.    */
/* ------------------------------------------------------------------ */

function ProcessLights() {
  const scroll = useScroll()
  const bulbs = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useFrame((_, delta) => {
    const sec = scroll.offset * (PAGES - 1)
    bulbs.current.forEach((m, i) => {
      if (!m) return
      const lit = sec > 4.45 + i * 0.12 ? 1 : 0.05
      m.opacity = THREE.MathUtils.damp(m.opacity, lit, 6, delta)
    })
  })

  return (
    <group>
      {/* overhead rail */}
      <mesh position={[0, 1.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 6.6, 12]} />
        <meshStandardMaterial color="#161616" metalness={0.8} roughness={0.3} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[(i - 2) * 1.5, 0.2, 0]}>
          <mesh position={[0, 1.32, 0]}>
            <sphereGeometry args={[0.085, 16, 16]} />
            <meshBasicMaterial
              ref={(m) => {
                bulbs.current[i] = m
              }}
              color={WARM}
              transparent
              opacity={0.05}
              toneMapped={false}
            />
          </mesh>
          <LightCone
            position={[0, 0.1, 0]}
            length={2.1}
            radius={0.55}
            color={WARM}
            intensity={0.4}
            head={false}
          />
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — camera travel + sections + lights + film-grain    */
/* post stack.                                                         */
/* ------------------------------------------------------------------ */

export default function Experience() {
  const scroll = useScroll()
  const vh = useThree((s) => s.viewport.height)
  const vw = useThree((s) => s.viewport.width)
  const lightRig = useRef<THREE.Group>(null!)

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    const o = scroll.offset
    const y = -o * vh * (PAGES - 1)
    // travel down the world + mouse parallax
    easing.damp3(
      state.camera.position,
      [state.pointer.x * 0.6, y - state.pointer.y * 0.3, 10],
      0.28,
      delta,
    )
    state.camera.lookAt(0, y, 0)
    if (lightRig.current) lightRig.current.position.y = y
    // feed the DOM progress bar
    document.documentElement.style.setProperty('--scroll', o.toFixed(4))
  })

  const x = (f: number) => vw * f

  return (
    <>
      <ambientLight intensity={0.22} />
      <group ref={lightRig}>
        <pointLight position={[6, 2, 6]} intensity={42} color={SILVER} />
        <pointLight position={[-6, -2, 4]} intensity={18} color="#8a8a8a" />
        <pointLight position={[0, -4, 6]} intensity={7} color={RED} />
      </group>

      {/* studio-style reflections without any network fetch */}
      <Environment resolution={64}>
        <group rotation={[-Math.PI / 3, 0, 0]}>
          <Lightformer intensity={3.4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
          <Lightformer color={SILVER} intensity={1.6} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer color="#6b6b6b" intensity={1.6} position={[10, 1, 0]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
        </group>
      </Environment>

      {/* drifting dust caught in the projector beams */}
      <Sparkles
        count={240}
        scale={[vw * 1.6, vh * PAGES, 10]}
        position={[0, (-vh * (PAGES - 1)) / 2, -2]}
        size={1.5}
        speed={0.2}
        color={SILVER}
        opacity={0.4}
      />

      {/* the film camera dollying down its track through every scene */}
      <CameraDolly />

      {/* 0 — Hero: spotlight cones cut the dark */}
      <Section index={0}>
        <LightCone position={[x(-0.2), 1.5, -1.4]} rotation={[0, 0, 0.18]} length={5} radius={1.6} color={SILVER} intensity={0.4} sway={0.06} />
        <LightCone position={[x(0.22), 1.8, -2]} rotation={[0, 0, -0.22]} length={5.5} radius={1.8} color={WARM} intensity={0.32} sway={0.05} />
        <Sparkles count={80} scale={[8, 5, 5]} size={2.2} speed={0.3} color={SILVER} opacity={0.55} />
      </Section>

      {/* 1 — Showreel manifesto: the clapperboard */}
      <Section index={1}>
        <group position={[x(0.2), 0.1, 0]}>
          <Float speed={1.3} rotationIntensity={0.25} floatIntensity={0.5}>
            <Clapperboard />
          </Float>
          <LightCone position={[0, 2.2, -1]} length={3.4} radius={1.1} color={SILVER} intensity={0.3} head={false} />
        </group>
      </Section>

      {/* 2 — Services: the lens stack */}
      <Section index={2}>
        <group position={[x(0.24), 0, 0]}>
          <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.6}>
            <LensStack />
          </Float>
        </group>
      </Section>

      {/* 3 — Scrub room: drag the reel, relight the miniature */}
      <Section index={3} z={0.4}>
        <ScrubRoom />
      </Section>

      {/* 4 — Selected films: noir one-sheets */}
      <Section index={4} z={0.4}>
        <FilmPoster position={[-x(0.26), -0.4, -0.4]} rotation={[0, 0.4, -0.04]} />
        <FilmPoster position={[-x(0.09), -0.2, 0.2]} rotation={[0, 0.12, 0.02]} accent />
        <FilmPoster position={[x(0.09), -0.2, 0.2]} rotation={[0, -0.12, -0.02]} />
        <FilmPoster position={[x(0.26), -0.4, -0.4]} rotation={[0, -0.4, 0.04]} />
      </Section>

      {/* 5 — Process: track lights switching on step by step */}
      <Section index={5}>
        <group position={[0, -0.8, 0]}>
          <ProcessLights />
        </group>
      </Section>

      {/* 6 — Contact: one great beam */}
      <Section index={6}>
        <LightCone position={[0, 1.3, -1.8]} length={6} radius={2.1} color={WARM} intensity={0.4} sway={0.04} />
        <Sparkles count={60} scale={[7, 5, 4]} size={2} speed={0.25} color={RED} opacity={0.35} />
      </Section>

      {/* 7 — Footer: the houselights stay low */}
      <Section index={7}>
        <LightCone position={[0, 2, -2.4]} length={4.4} radius={1.4} color={SILVER} intensity={0.2} sway={0.05} head={false} />
      </Section>

      <EffectComposer>
        <Bloom intensity={0.65} luminanceThreshold={0.22} luminanceSmoothing={0.7} mipmapBlur />
        <Noise opacity={0.09} />
        <Vignette offset={0.12} darkness={0.92} />
      </EffectComposer>
    </>
  )
}
