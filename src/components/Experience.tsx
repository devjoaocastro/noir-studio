import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, Sparkles, useCursor, useScroll } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import { PAGES, setScrollEl } from '../scrollBus'

/** The camera walks the gallery from z=10 to z=10-DEPTH */
const SPACING = 14
const DEPTH = (PAGES - 1) * SPACING // 98

/* R3F pointer listeners are passive (preventDefault is ignored), so text
   selection during 3D drags is suppressed by locking user-select instead. */
const lockSelection = () => {
  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'
}
const unlockSelection = () => {
  document.body.style.userSelect = ''
  document.body.style.webkitUserSelect = ''
}

const BONE = '#efece6'
const INK = '#1a1916'
const RED = '#b3402a'
const RED_HOT = '#d4553a'
const WARM_LIGHT = '#ffe3b8'

/* ------------------------------------------------------------------ */
/* The hall — floor, walls, ceiling. A hushed gallery in warm dark.    */
/* ------------------------------------------------------------------ */

function Hall() {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -DEPTH / 2 + 5]}>
        <planeGeometry args={[24, DEPTH + 50]} />
        <meshStandardMaterial color="#1d1a16" roughness={0.55} metalness={0.12} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6.5, -DEPTH / 2 + 5]}>
        <planeGeometry args={[24, DEPTH + 50]} />
        <meshStandardMaterial color="#26221d" roughness={0.95} />
      </mesh>
      {/* side walls */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-10, 3.25, -DEPTH / 2 + 5]}>
        <planeGeometry args={[DEPTH + 50, 6.5]} />
        <meshStandardMaterial color="#2a2620" roughness={0.95} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[10, 3.25, -DEPTH / 2 + 5]}>
        <planeGeometry args={[DEPTH + 50, 6.5]} />
        <meshStandardMaterial color="#2a2620" roughness={0.95} />
      </mesh>
      {/* skirting accent lines along the floor edges */}
      <mesh position={[-9.9, 0.06, -DEPTH / 2 + 5]}>
        <boxGeometry args={[0.04, 0.12, DEPTH + 50]} />
        <meshStandardMaterial color="#3a342c" roughness={0.6} />
      </mesh>
      <mesh position={[9.9, 0.06, -DEPTH / 2 + 5]}>
        <boxGeometry args={[0.04, 0.12, DEPTH + 50]} />
        <meshStandardMaterial color="#3a342c" roughness={0.6} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* SpotCone — fake volumetric spotlight: additive cone + dust motes    */
/* (Sparkles) drifting inside the beam + a warm point light.           */
/* ------------------------------------------------------------------ */

function SpotCone({
  position,
  height = 4,
  radius = 1.3,
  intensity = 14,
  color = WARM_LIGHT,
}: {
  position: [number, number, number]
  height?: number
  radius?: number
  intensity?: number
  color?: string
}) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <coneGeometry args={[radius, height, 32, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.045}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Sparkles
        count={26}
        scale={[radius * 1.5, height * 0.9, radius * 1.5]}
        position={[0, height / 2, 0]}
        size={1.7}
        speed={0.18}
        opacity={0.55}
        color={color}
      />
      <pointLight position={[0, height * 0.55, 0]} intensity={intensity} distance={9} color={color} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Vitrine — glass box on a plinth, spotlit from above.                */
/* ------------------------------------------------------------------ */

function Vitrine({
  position,
  size = 1.7,
  height = 1.6,
  plinthH = 1.05,
  children,
}: {
  position: [number, number, number]
  size?: number
  height?: number
  plinthH?: number
  children?: ReactNode
}) {
  return (
    <group position={position}>
      {/* plinth */}
      <mesh position={[0, plinthH / 2, 0]}>
        <boxGeometry args={[size + 0.34, plinthH, size + 0.34]} />
        <meshStandardMaterial color="#2e2a24" roughness={0.9} />
      </mesh>
      {/* bone top slab on the plinth */}
      <mesh position={[0, plinthH + 0.02, 0]}>
        <boxGeometry args={[size + 0.3, 0.045, size + 0.3]} />
        <meshStandardMaterial color={BONE} roughness={0.7} />
      </mesh>
      {/* glass case */}
      <mesh position={[0, plinthH + height / 2 + 0.04, 0]}>
        <boxGeometry args={[size, height, size]} />
        <meshPhysicalMaterial
          transmission={1}
          thickness={0.12}
          roughness={0.06}
          ior={1.5}
          transparent
          color="#ffffff"
        />
      </mesh>
      {/* ink frame cap */}
      <mesh position={[0, plinthH + height + 0.07, 0]}>
        <boxGeometry args={[size + 0.07, 0.05, size + 0.07]} />
        <meshStandardMaterial color={INK} metalness={0.4} roughness={0.5} />
      </mesh>
      <SpotCone position={[0, plinthH + height + 0.1, 0]} height={6.4 - plinthH - height} radius={size * 0.75} />
      {/* the exhibit */}
      <group position={[0, plinthH + height / 2 + 0.04, 0]}>{children}</group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Penrose triad — three beams along X, Y, Z. Viewed exactly along the */
/* (1,1,1) diagonal the open ends coincide and the triangle "closes".  */
/* ------------------------------------------------------------------ */

const P_L = 1.7
const P_T = 0.32

function PenroseBars({ material, scale = 1 }: { material: THREE.Material; scale?: number }) {
  // rotate the (1,1,1) diagonal onto +Z so yaw=0 faces the camera correctly
  const q = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 1, 1).normalize(),
        new THREE.Vector3(0, 0, 1),
      ),
    [],
  )
  return (
    <group quaternion={q} scale={scale}>
      <group position={[-P_L / 2, -P_L / 2, -P_L / 2]}>
        <mesh position={[P_L / 2, 0, 0]} material={material}>
          <boxGeometry args={[P_L + P_T, P_T, P_T]} />
        </mesh>
        <mesh position={[P_L, P_L / 2, 0]} material={material}>
          <boxGeometry args={[P_T, P_L + P_T, P_T]} />
        </mesh>
        <mesh position={[P_L, P_L, P_L / 2]} material={material}>
          <boxGeometry args={[P_T, P_T, P_L]} />
        </mesh>
      </group>
    </group>
  )
}

/** Small static penrose for the collection row (pre-aligned, slow turn). */
function MiniPenrose({ scale = 0.34 }: { scale?: number }) {
  const group = useRef<THREE.Group>(null!)
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.4, metalness: 0.5 }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame((_, delta) => {
    group.current.rotation.y += delta * 0.4
  })
  return (
    <group ref={group}>
      <PenroseBars material={material} scale={scale} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* THE ALIGNMENT ROOM — draggable turntable. Drag the Penrose triad;   */
/* within tolerance of the magic angle it snaps, flashes (bloom chime) */
/* and the wall label "ILLUSION ALIGNED" lights up.                    */
/* ------------------------------------------------------------------ */

function AlignmentRoom({ z }: { z: number }) {
  const scroll = useScroll()
  const outer = useRef<THREE.Group>(null!)
  const flashLight = useRef<THREE.PointLight>(null!)
  const haloMat = useRef<THREE.MeshBasicMaterial>(null!)
  const label = useRef<HTMLDivElement>(null)

  const yaw = useRef(2.6)
  const yawTarget = useRef(2.6)
  const dragging = useRef(false)
  const lastX = useRef(0)
  const flash = useRef(0)
  const lockedRef = useRef(false)

  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const barMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d8d2c4',
        roughness: 0.32,
        metalness: 0.55,
        emissive: new THREE.Color(RED_HOT),
        emissiveIntensity: 0,
      }),
    [],
  )
  useEffect(() => () => barMaterial.dispose(), [barMaterial])

  // global listeners so a drag survives leaving the mesh
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return
      yawTarget.current += (e.clientX - lastX.current) * 0.011
      lastX.current = e.clientX
    }
    const up = () => {
      dragging.current = false
      unlockSelection()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    lockSelection()
    dragging.current = true
    lastX.current = e.clientX
  }

  useFrame((_, delta) => {
    const twoPi = Math.PI * 2
    // gentle snap toward the magic angle when released nearby
    const wrappedTarget =
      THREE.MathUtils.euclideanModulo(yawTarget.current + Math.PI, twoPi) - Math.PI
    if (!dragging.current && Math.abs(wrappedTarget) < 0.18) {
      yawTarget.current -= wrappedTarget * Math.min(1, delta * 6)
    }
    yaw.current = THREE.MathUtils.damp(yaw.current, yawTarget.current, 8, delta)
    outer.current.rotation.y = yaw.current

    const wrapped = THREE.MathUtils.euclideanModulo(yaw.current + Math.PI, twoPi) - Math.PI
    const aligned = !dragging.current && Math.abs(wrapped) < 0.09
    if (aligned && !lockedRef.current) {
      lockedRef.current = true
      flash.current = 1 // chime of light
    } else if (!aligned && lockedRef.current) {
      lockedRef.current = false
    }

    flash.current = Math.max(0, flash.current - delta * 0.85)
    barMaterial.emissiveIntensity = lockedRef.current ? 0.45 + flash.current * 3.6 : 0
    flashLight.current.intensity = flash.current * 95 + (lockedRef.current ? 7 : 0)
    haloMat.current.opacity = Math.min(1, flash.current * 1.5) * 0.9

    // drei <Html> label-fade fix: HTML ignores fog — fade with the section
    if (label.current) {
      const sec = scroll.offset * (PAGES - 1)
      const near = Math.max(0, 1 - Math.abs(sec - 2) * 1.8)
      const v = lockedRef.current ? near : 0
      label.current.style.opacity = v.toFixed(3)
      label.current.style.display = v < 0.04 ? 'none' : ''
    }
  })

  return (
    <group position={[0, 0, z]}>
      {/* wide plinth + turntable disc */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[3.2, 1, 3.2]} />
        <meshStandardMaterial color="#2e2a24" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.07, 0]}>
        <cylinderGeometry args={[1.5, 1.6, 0.16, 48]} />
        <meshStandardMaterial color={BONE} roughness={0.65} />
      </mesh>
      {/* red datum line across the turntable — points at the magic angle */}
      <mesh position={[0, 1.16, 0]}>
        <boxGeometry args={[0.03, 0.012, 3]} />
        <meshBasicMaterial color={RED} toneMapped={false} />
      </mesh>

      {/* the draggable artefact */}
      <group ref={outer} position={[0, 2.45, 0]}>
        <PenroseBars material={barMaterial} scale={0.62} />
        {/* invisible drag handle (raycast target, generous radius) */}
        <mesh
          onPointerDown={onPointerDown}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* halo ring — the chime of light on lock */}
        <mesh>
          <ringGeometry args={[1.05, 1.22, 64]} />
          <meshBasicMaterial
            ref={haloMat}
            color={RED_HOT}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      <pointLight ref={flashLight} position={[0, 2.5, 1.4]} intensity={0} distance={12} color={RED_HOT} />
      <SpotCone position={[0, 4.2, 0]} height={2.3} radius={1.7} intensity={18} />

      <Html center position={[0, 4.55, 0]} className="aligned-html" zIndexRange={[20, 0]}>
        <div ref={label} className="aligned-label" style={{ opacity: 0, display: 'none' }}>
          Illusion aligned
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Klein vessel — a glossy ink torus knot with a red sheen.            */
/* ------------------------------------------------------------------ */

function KleinKnot({ scale = 1, speed = 0.3 }: { scale?: number; speed?: number }) {
  const mesh = useRef<THREE.Mesh>(null!)
  useFrame((state, delta) => {
    mesh.current.rotation.y += delta * speed
    mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.3
  })
  return (
    <mesh ref={mesh} scale={scale}>
      <torusKnotGeometry args={[0.5, 0.18, 200, 28, 2, 3]} />
      <meshPhysicalMaterial
        color={INK}
        roughness={0.18}
        metalness={0.25}
        clearcoat={1}
        clearcoatRoughness={0.25}
        sheen={1}
        sheenColor={new THREE.Color(RED)}
      />
    </mesh>
  )
}

/** A levitating rough stone — the museum's joke about gravity. */
function FloatStone({ scale = 1 }: { scale?: number }) {
  const mesh = useRef<THREE.Mesh>(null!)
  useFrame((state, delta) => {
    mesh.current.position.y = Math.sin(state.clock.elapsedTime * 1.1) * 0.1
    mesh.current.rotation.y += delta * 0.25
  })
  return (
    <mesh ref={mesh} scale={scale}>
      <icosahedronGeometry args={[0.5, 1]} />
      <meshStandardMaterial color="#8d867a" roughness={0.95} flatShading />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* MÖBIUS — custom GLSL ShaderMaterial: a stripe pattern flows along   */
/* the single surface forever, with a pulsing museum-red seam.         */
/* ------------------------------------------------------------------ */

function makeMobiusGeometry(segU = 240, segV = 16, R = 1.5, w = 0.62) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segU; i++) {
    const u = (i / segU) * Math.PI * 2
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV - 0.5) * w
      const x = (R + v * Math.cos(u / 2)) * Math.cos(u)
      const y = (R + v * Math.cos(u / 2)) * Math.sin(u)
      const z = v * Math.sin(u / 2)
      positions.push(x, y, z)
      uvs.push(i / segU, j / segV)
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j
      const b = a + segV + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

const MOBIUS_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const MOBIUS_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vec3 bone = vec3(0.937, 0.925, 0.902);
    vec3 ink  = vec3(0.102, 0.098, 0.086);
    vec3 red  = vec3(0.831, 0.333, 0.227);

    // parametric stripes flowing along the strip forever
    float flow = fract(vUv.x * 12.0 - uTime * 0.32);
    float stripe = smoothstep(0.30, 0.36, flow) - smoothstep(0.60, 0.66, flow);

    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 v = normalize(-vViewPos);
    float diff = 0.32 + 0.68 * max(dot(n, normalize(vec3(0.35, 0.9, 0.55))), 0.0);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.2);

    vec3 base = mix(ink, bone, stripe);
    vec3 col = base * diff + red * fresnel * 0.85;

    // a red pulse that laps the loop — proof there is only one side
    float pulse = smoothstep(0.93, 1.0, 0.5 + 0.5 * sin(vUv.x * 12.566 - uTime * 1.5));
    col += red * pulse * 1.7;

    // soft edge darkening across the band
    float edge = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.84, vUv.y);
    col *= mix(0.55, 1.0, edge);

    gl_FragColor = vec4(col, 1.0);
  }
`

function MobiusStrip({
  position,
  scale = 1,
  spin = 0.22,
}: {
  position: [number, number, number]
  scale?: number
  spin?: number
}) {
  const group = useRef<THREE.Group>(null!)
  const geometry = useMemo(() => makeMobiusGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: MOBIUS_VERT,
        fragmentShader: MOBIUS_FRAG,
      }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state, delta) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    group.current.rotation.y += delta * spin
    group.current.rotation.x = 0.5 + Math.sin(state.clock.elapsedTime * 0.35) * 0.16
  })

  return (
    <group ref={group} position={position} scale={scale}>
      <mesh geometry={geometry} material={material} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* SINGULARITY I — a tiny black hole: dark sphere, tilted accretion    */
/* ring, and a lensing ring that always faces the visitor.             */
/* ------------------------------------------------------------------ */

function BlackHole({ scale = 1 }: { scale?: number }) {
  const disk = useRef<THREE.Group>(null!)
  const lens = useRef<THREE.Mesh>(null!)

  useFrame((state, delta) => {
    disk.current.rotation.y += delta * 0.8
    lens.current.lookAt(state.camera.position)
  })

  return (
    <group scale={scale}>
      {/* the hole */}
      <mesh>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* accretion disk */}
      <group ref={disk} rotation={[0.42, 0, 0.12]}>
        <mesh scale={[1, 0.22, 1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.72, 0.07, 8, 96]} />
          <meshBasicMaterial color="#ff8a50" toneMapped={false} />
        </mesh>
        <mesh scale={[1, 0.16, 1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.92, 0.025, 8, 96]} />
          <meshBasicMaterial color="#ffc9a0" toneMapped={false} transparent opacity={0.7} />
        </mesh>
      </group>
      {/* gravitational lensing — a bright ring facing the camera */}
      <mesh ref={lens}>
        <ringGeometry args={[0.48, 0.535, 64]} />
        <meshBasicMaterial
          color="#ffdfc0"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight intensity={7} distance={7} color="#ff8a50" />
    </group>
  )
}

/** Wall label in 3D for the singularity vitrine (fades with section 5). */
function SingularityLabel({ position }: { position: [number, number, number] }) {
  const scroll = useScroll()
  const label = useRef<HTMLDivElement>(null)
  useFrame(() => {
    if (!label.current) return
    const sec = scroll.offset * (PAGES - 1)
    const v = Math.max(0, 1 - Math.abs(sec - 5) * 1.8)
    label.current.style.opacity = v.toFixed(3)
    label.current.style.display = v < 0.04 ? 'none' : ''
  })
  return (
    <Html center position={position} className="aligned-html" zIndexRange={[20, 0]}>
      <div ref={label} className="exhibit-tag" style={{ opacity: 0, display: 'none' }}>
        <strong>Singularity I</strong>
        <span>please do not lean in</span>
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/* Membership pedestals — three gyro rings, one per tier.              */
/* ------------------------------------------------------------------ */

function Pedestal({
  x,
  z,
  color,
  phase,
}: {
  x: number
  z: number
  color: string
  phase: number
}) {
  const ring = useRef<THREE.Mesh>(null!)
  useFrame((state) => {
    const t = state.clock.elapsedTime + phase
    ring.current.rotation.x = t * 0.7
    ring.current.rotation.y = t * 0.45
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.4, 0.48, 1.1, 24]} />
        <meshStandardMaterial color="#2e2a24" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.46, 0.46, 0.05, 24]} />
        <meshStandardMaterial color={BONE} roughness={0.7} />
      </mesh>
      <mesh ref={ring} position={[0, 1.7, 0]}>
        <torusGeometry args={[0.32, 0.024, 12, 64]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.8, 0]} intensity={4} distance={5} color={color} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* End wall — a glowing red doorway that opens onto nothing.           */
/* ------------------------------------------------------------------ */

function EndWall({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 3.25, 0]}>
        <planeGeometry args={[24, 6.5]} />
        <meshStandardMaterial color="#2a2620" roughness={0.95} />
      </mesh>
      {/* the impossible door — outline only, leads nowhere */}
      <group position={[0, 0, 0.05]}>
        <mesh position={[-0.85, 1.45, 0]}>
          <boxGeometry args={[0.05, 2.9, 0.05]} />
          <meshBasicMaterial color={RED_HOT} toneMapped={false} />
        </mesh>
        <mesh position={[0.85, 1.45, 0]}>
          <boxGeometry args={[0.05, 2.9, 0.05]} />
          <meshBasicMaterial color={RED_HOT} toneMapped={false} />
        </mesh>
        <mesh position={[0, 2.9, 0]}>
          <boxGeometry args={[1.75, 0.05, 0.05]} />
          <meshBasicMaterial color={RED_HOT} toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 1.6, 1.6]} intensity={16} distance={11} color={RED_HOT} />
      <Sparkles count={42} scale={[7, 4.6, 3]} position={[0, 2.2, 1.6]} size={1.8} speed={0.16} opacity={0.5} color="#ffc9b0" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — walking camera, hushed light, post FX.            */
/* ------------------------------------------------------------------ */

export default function Experience() {
  const scroll = useScroll()

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    const o = scroll.offset
    const z = 10 - o * DEPTH

    // walk the gallery + gentle mouse parallax
    easing.damp3(
      state.camera.position,
      [state.pointer.x * 1.1, 1.9 - state.pointer.y * 0.35, z],
      0.3,
      delta,
    )
    state.camera.lookAt(state.pointer.x * 1.8, 1.75, z - 9)

    // subtle dolly settle on each room
    const cam = state.camera as THREE.PerspectiveCamera
    const sec = o * (PAGES - 1)
    const frac = Math.abs(sec - Math.round(sec))
    const targetFov = 47 - (1 - Math.min(1, frac * 2.5)) * 3
    cam.fov = THREE.MathUtils.damp(cam.fov, targetFov, 4, delta)
    cam.updateProjectionMatrix()

    document.documentElement.style.setProperty('--scroll', o.toFixed(4))
  })

  return (
    <>
      {/* hushed gallery — almost dark, warmed by the vitrines */}
      <ambientLight intensity={0.14} color="#f0e4d2" />
      <directionalLight position={[4, 10, 6]} intensity={0.22} color="#cabba2" />

      <Hall />
      <EndWall z={-97} />

      {/* 1 — Current exhibition: Klein vessel & the levitating stone */}
      <Vitrine position={[-3.4, 0, -11]}>
        <KleinKnot scale={1.05} />
      </Vitrine>
      <Vitrine position={[3.4, 0, -13]}>
        <FloatStone />
      </Vitrine>

      {/* 2 — The Alignment Room (draggable Penrose turntable) */}
      <AlignmentRoom z={-25} />

      {/* 3 — Collection highlights: four miniatures in a row */}
      <Vitrine position={[-4.7, 0, -41]} size={1.25} height={1.25}>
        <MiniPenrose />
      </Vitrine>
      <Vitrine position={[-1.65, 0, -39]} size={1.25} height={1.25}>
        <KleinKnot scale={0.6} speed={0.45} />
      </Vitrine>
      <Vitrine position={[1.65, 0, -39]} size={1.25} height={1.25}>
        <MobiusStrip position={[0, 0, 0]} scale={0.26} spin={0.5} />
      </Vitrine>
      <Vitrine position={[4.7, 0, -41]} size={1.25} height={1.25}>
        <BlackHole scale={0.45} />
      </Vitrine>

      {/* 4 — The Möbius Hall: the shader piece, floating free */}
      <group position={[1.9, 0, -53]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[1.5, 1.7, 0.9, 48]} />
          <meshStandardMaterial color="#2e2a24" roughness={0.9} />
        </mesh>
        <MobiusStrip position={[0, 2.75, 0]} scale={0.95} />
        <SpotCone position={[0, 4.7, 0]} height={1.8} radius={1.9} intensity={20} />
      </group>

      {/* 5 — Plan your visit: Singularity I keeps the queue company */}
      <Vitrine position={[3.6, 0, -67]} size={1.9} height={1.9}>
        <BlackHole scale={0.95} />
      </Vitrine>
      <SingularityLabel position={[3.6, 4.4, -67]} />

      {/* 6 — Membership: three tiers, three rings */}
      <Pedestal x={-3.1} z={-81} color={BONE} phase={0} />
      <Pedestal x={0} z={-82} color={RED_HOT} phase={2.1} />
      <Pedestal x={3.1} z={-81} color="#ffd9a0" phase={4.2} />

      {/* ambient hall dust */}
      <Sparkles count={120} scale={[16, 5, DEPTH + 20]} position={[0, 2.6, -DEPTH / 2 + 5]} size={1.2} speed={0.12} opacity={0.25} color="#e8dcc8" />

      <EffectComposer>
        <Bloom intensity={0.85} luminanceThreshold={0.26} luminanceSmoothing={0.7} mipmapBlur />
        <Noise opacity={0.045} />
        <Vignette offset={0.16} darkness={0.9} />
      </EffectComposer>
    </>
  )
}
