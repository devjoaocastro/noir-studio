import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Html, RoundedBox, useCursor, useScroll } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { easing, inSphere } from '../lib/easing'
import { donationVitality } from '../lib/donation'
import { PAGES, publishOffset, setScrollEl } from '../scrollBus'

/** World depth: the camera sinks from y=2 down to y = 2 - DESCENT. */
const STEP = 18
const DESCENT = (PAGES - 1) * STEP // 126

const SURFACE = new THREE.Color('#0a4f5e')
const ABYSS = new THREE.Color('#02060d')

/* ------------------------------------------------------------------ */
/* Caustics — custom GLSL ShaderMaterial: animated voronoi light       */
/* ripples dancing on a shallow shelf near the surface. The shader     */
/* fades out as the camera descends past the sunlit zone.              */
/* ------------------------------------------------------------------ */

const CAUSTICS_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CAUSTICS_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uFade;
  uniform vec3 uBase;
  uniform vec3 uGlow;

  vec2 hash2(vec2 p) {
    return fract(
      sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453
    );
  }

  // Animated voronoi: cell sites orbit their lattice point over time,
  // F1 distance gives the classic rippling caustic web.
  float voronoi(vec2 x, float t) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float md = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash2(n + g);
        o = 0.5 + 0.5 * sin(t + 6.2831 * o);
        vec2 r = g + o - f;
        md = min(md, dot(r, r));
      }
    }
    return sqrt(md);
  }

  void main() {
    vec2 uv = vUv * 16.0;
    float c1 = 1.0 - voronoi(uv + vec2(uTime * 0.22, 0.0), uTime * 0.9);
    float c2 = 1.0 - voronoi(uv * 1.8 - vec2(0.0, uTime * 0.17), uTime * 1.25 + 3.0);
    float light = pow(max(c1, 0.0), 4.0) + 0.55 * pow(max(c2, 0.0), 5.0);

    // melt the shelf into the blue at its edges
    float edge =
      smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) *
      smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);

    vec3 col = uBase + uGlow * light;
    gl_FragColor = vec4(col, uFade * edge);
  }
`

function CausticsShelf() {
  const scroll = useScroll()

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CAUSTICS_VERTEX,
        fragmentShader: CAUSTICS_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uFade: { value: 1 },
          uBase: { value: new THREE.Color('#0d4a57') },
          uGlow: { value: new THREE.Color('#7fe6d8') },
        },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    const sec = scroll.offset * (PAGES - 1)
    material.uniforms.uFade.value = Math.max(0, 1 - sec / 2.1)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, -16]} material={material}>
      <planeGeometry args={[150, 90]} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Turtle — primitives only: flattened sphere shell + box flippers.    */
/* Swims slow circles, keeping pace with the camera through the        */
/* sunlit zone, then stays behind as we sink past it.                  */
/* ------------------------------------------------------------------ */

function Turtle() {
  const group = useRef<THREE.Group>(null!)
  const fl = useRef<THREE.Group>(null!)
  const fr = useRef<THREE.Group>(null!)
  const bl = useRef<THREE.Group>(null!)
  const br = useRef<THREE.Group>(null!)
  const scroll = useScroll()
  const pos = useMemo(() => new THREE.Vector3(-3, -2, -7), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const camY = 2 - scroll.offset * DESCENT
    const followY = Math.max(camY - 4.5, -27)

    const x = Math.sin(t * 0.3) * 4.4
    const z = -8 + Math.cos(t * 0.3) * 3.2
    const y = followY + Math.sin(t * 0.9) * 0.5
    easing.damp3(pos, [x, y, z], 0.7, delta)
    group.current.position.copy(pos)

    ahead.set(Math.sin(t * 0.3 + 0.14) * 4.4, y, -8 + Math.cos(t * 0.3 + 0.14) * 3.2)
    group.current.lookAt(ahead)

    const flap = Math.sin(t * 2.1) * 0.5
    fl.current.rotation.z = 0.28 + flap
    fr.current.rotation.z = -0.28 - flap
    bl.current.rotation.z = 0.18 + flap * 0.55
    br.current.rotation.z = -0.18 - flap * 0.55
  })

  return (
    <group ref={group}>
      {/* shell */}
      <mesh scale={[1, 0.45, 1.25]}>
        <sphereGeometry args={[0.9, 24, 18]} />
        <meshStandardMaterial color="#14524a" roughness={0.7} metalness={0.1} />
      </mesh>
      {/* belly */}
      <mesh position={[0, -0.12, 0]} scale={[0.92, 0.3, 1.12]}>
        <sphereGeometry args={[0.9, 20, 14]} />
        <meshStandardMaterial color="#caa977" roughness={0.85} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.04, 1.2]}>
        <sphereGeometry args={[0.27, 18, 14]} />
        <meshStandardMaterial color="#2b7f6d" roughness={0.7} />
      </mesh>
      {/* front flippers */}
      <group ref={fl} position={[-0.8, 0, 0.5]}>
        <mesh position={[-0.42, 0, 0]} rotation={[0, 0.35, 0]}>
          <boxGeometry args={[0.85, 0.06, 0.34]} />
          <meshStandardMaterial color="#2b7f6d" roughness={0.7} />
        </mesh>
      </group>
      <group ref={fr} position={[0.8, 0, 0.5]}>
        <mesh position={[0.42, 0, 0]} rotation={[0, -0.35, 0]}>
          <boxGeometry args={[0.85, 0.06, 0.34]} />
          <meshStandardMaterial color="#2b7f6d" roughness={0.7} />
        </mesh>
      </group>
      {/* back flippers */}
      <group ref={bl} position={[-0.6, 0, -0.75]}>
        <mesh position={[-0.26, 0, -0.08]} rotation={[0, -0.5, 0]}>
          <boxGeometry args={[0.5, 0.05, 0.26]} />
          <meshStandardMaterial color="#26705f" roughness={0.7} />
        </mesh>
      </group>
      <group ref={br} position={[0.6, 0, -0.75]}>
        <mesh position={[0.26, 0, -0.08]} rotation={[0, 0.5, 0]}>
          <boxGeometry args={[0.5, 0.05, 0.26]} />
          <meshStandardMaterial color="#26705f" roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* FishSchool — instanced cones with a boid-ish wander: every fish     */
/* orbits a drifting personal centre with its own radius, speed and    */
/* vertical bob, oriented along its path.                              */
/* ------------------------------------------------------------------ */

const FISH_COUNT = 120

type Fish = {
  cx: number
  cy: number
  cz: number
  r: number
  sp: number
  ph: number
  vph: number
  va: number
}

function FishSchool() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const next = useMemo(() => new THREE.Vector3(), [])

  const fishes = useMemo<Fish[]>(() => {
    const rng = (a: number, b: number) => a + Math.random() * (b - a)
    return Array.from({ length: FISH_COUNT }, () => ({
      cx: rng(-3, 3),
      cy: rng(-38, -30),
      cz: rng(-9, -3),
      r: rng(1.6, 5.6),
      sp: rng(0.25, 0.7) * (Math.random() < 0.5 ? 1 : -1),
      ph: rng(0, Math.PI * 2),
      vph: rng(0, Math.PI * 2),
      va: rng(0.5, 1.4),
    }))
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    fishes.forEach((f, i) => {
      const a = f.ph + t * f.sp
      const y = f.cy + Math.sin(t * f.va + f.vph) * 1.1
      dummy.position.set(f.cx + Math.cos(a) * f.r, y, f.cz + Math.sin(a) * f.r * 0.7)
      next.set(
        f.cx + Math.cos(a + 0.2 * Math.sign(f.sp)) * f.r,
        y,
        f.cz + Math.sin(a + 0.2 * Math.sign(f.sp)) * f.r * 0.7,
      )
      dummy.lookAt(next)
      dummy.rotateX(Math.PI / 2)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, FISH_COUNT]}>
      <coneGeometry args={[0.09, 0.42, 6]} />
      <meshStandardMaterial
        color="#79c7c4"
        emissive="#0d3b3f"
        roughness={0.45}
        metalness={0.35}
      />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/* ROV — the draggable research submarine. Pointer-drag moves it       */
/* inside bounds on its depth plane; its spotlight sweeps a cone of    */
/* light through the marine snow and lights up the survey motes.       */
/* ------------------------------------------------------------------ */

const ROV_HOME: [number, number, number] = [0, -52.5, -3]

function Rov() {
  const group = useRef<THREE.Group>(null!)
  const propL = useRef<THREE.Mesh>(null!)
  const propR = useRef<THREE.Mesh>(null!)
  const label = useRef<HTMLDivElement>(null)
  const scroll = useScroll()

  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered || dragging, dragging ? 'grabbing' : 'grab')

  const target = useRef(new THREE.Vector3(...ROV_HOME))
  // drag plane: z = ROV_HOME[2]  →  normal (0,0,1), constant -z
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), -ROV_HOME[2]), [])
  const hit = useMemo(() => new THREE.Vector3(), [])

  const spot = useMemo(
    () => new THREE.SpotLight('#cfeeff', 160, 24, Math.PI / 5.5, 0.45, 1.6),
    [],
  )

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    // body has user-select:none; clear any pre-existing selection too
    document.body.style.userSelect = 'none'
    window.getSelection?.()?.removeAllRanges?.()
    setDragging(true)
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    if (e.ray.intersectPlane(plane, hit)) {
      target.current.set(
        THREE.MathUtils.clamp(hit.x, -6.5, 6.5),
        THREE.MathUtils.clamp(hit.y, ROV_HOME[1] - 4.5, ROV_HOME[1] + 4.5),
        ROV_HOME[2],
      )
    }
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    document.body.style.userSelect = ''
    setDragging(false)
  }

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // idle bob when at rest
    const bobY = dragging ? 0 : Math.sin(t * 0.8) * 0.25
    easing.damp3(
      group.current.position,
      [target.current.x, target.current.y + bobY, target.current.z],
      dragging ? 0.12 : 0.4,
      delta,
    )

    // bank towards the direction of travel
    const vx = target.current.x - group.current.position.x
    const vy = target.current.y - group.current.position.y
    easing.dampE(
      group.current.rotation,
      [THREE.MathUtils.clamp(vy * 0.12, -0.3, 0.3), 0, THREE.MathUtils.clamp(-vx * 0.1, -0.35, 0.35)],
      0.25,
      delta,
    )

    propL.current.rotation.y = t * 14
    propR.current.rotation.y = -t * 14

    // HTML hint ignores fog — fade it with the ROV Lab section (page 3)
    if (label.current) {
      const sec = scroll.offset * (PAGES - 1)
      const visibility = Math.max(0, 1 - Math.abs(sec - 3) * 1.6)
      label.current.style.opacity = visibility.toFixed(3)
      label.current.style.display = visibility < 0.04 ? 'none' : ''
    }
  })

  return (
    <group
      ref={group}
      position={ROV_HOME}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* hull */}
      <RoundedBox args={[1.5, 0.8, 1.1]} radius={0.16} smoothness={4}>
        <meshStandardMaterial color="#e6bd4e" roughness={0.45} metalness={0.35} />
      </RoundedBox>
      {/* top frame */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[1.1, 0.18, 0.8]} />
        <meshStandardMaterial color="#15202b" roughness={0.6} metalness={0.5} />
      </mesh>
      {/* porthole */}
      <mesh position={[0, 0.06, 0.6]}>
        <sphereGeometry args={[0.24, 18, 14]} />
        <meshStandardMaterial
          color="#0c2330"
          emissive="#36e2d2"
          emissiveIntensity={0.45}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
      {/* side thrusters + props */}
      <mesh position={[-0.9, 0, -0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.3, 12]} />
        <meshStandardMaterial color="#15202b" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0.9, 0, -0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.3, 12]} />
        <meshStandardMaterial color="#15202b" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh ref={propL} position={[-0.9, 0, -0.38]}>
        <boxGeometry args={[0.26, 0.03, 0.06]} />
        <meshStandardMaterial color="#9fb3bd" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh ref={propR} position={[0.9, 0, -0.38]}>
        <boxGeometry args={[0.26, 0.03, 0.06]} />
        <meshStandardMaterial color="#9fb3bd" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* headlights */}
      <mesh position={[-0.32, -0.18, 0.58]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshBasicMaterial color="#d8fbff" toneMapped={false} />
      </mesh>
      <mesh position={[0.32, -0.18, 0.58]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshBasicMaterial color="#d8fbff" toneMapped={false} />
      </mesh>

      {/* spotlight + target (transforms with the ROV) */}
      <primitive object={spot} position={[0, -0.3, 0.5]} />
      <primitive object={spot.target} position={[0, -5, 5]} />

      {/* volumetric-looking beam */}
      <group position={[0, -0.3, 0.5]} rotation={[-0.62, 0, 0]}>
        <mesh position={[0, -3.2, 0]}>
          <coneGeometry args={[2.1, 6.4, 24, 1, true]} />
          <meshBasicMaterial
            color="#9fe5ef"
            transparent
            opacity={0.055}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* drag hint — drei Html with scroll-bound label fade */}
      <Html center position={[0, 1.35, 0]} className="rov-html" zIndexRange={[20, 0]}>
        <div ref={label} className="rov-label" style={{ opacity: 0, display: 'none' }}>
          <strong>R/V NEREID-2</strong>
          <span>{dragging ? 'steady… steady…' : '✦ drag the ROV'}</span>
        </div>
      </Html>
    </group>
  )
}

/* Survey motes — standard-material flecks around the ROV lab so the   */
/* spotlight visibly illuminates something as it is dragged around.    */

const MOTE_COUNT = 60

function SurveyMotes() {
  const mesh = useRef<THREE.InstancedMesh>(null!)

  useEffect(() => {
    const dummy = new THREE.Object3D()
    for (let i = 0; i < MOTE_COUNT; i++) {
      dummy.position.set(
        ROV_HOME[0] + (Math.random() - 0.5) * 17,
        ROV_HOME[1] + (Math.random() - 0.5) * 12 - 2,
        ROV_HOME[2] + (Math.random() - 0.5) * 9,
      )
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      dummy.scale.setScalar(0.5 + Math.random())
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MOTE_COUNT]}>
      <tetrahedronGeometry args={[0.07]} />
      <meshStandardMaterial color="#a8c4cf" roughness={1} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/* Bioluminescence — cyan particle field (inSphere) in the midnight    */
/* zone, additive + toneMapped:false so Bloom makes it glow.           */
/* ------------------------------------------------------------------ */

function Bioluminescence() {
  const points = useRef<THREE.Points>(null!)
  const positions = useMemo(() => inSphere(new Float32Array(900 * 3), 21), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    points.current.rotation.y = t * 0.02
    const mat = points.current.material as THREE.PointsMaterial
    mat.opacity = 0.65 + Math.sin(t * 0.7) * 0.2
  })

  return (
    <points ref={points} position={[0, -84, -8]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#36e2d2"
        size={0.14}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

/* ------------------------------------------------------------------ */
/* Anglerfish — a dark silhouette patrolling the midnight zone, its    */
/* lure the only warm-cyan point of light down here.                   */
/* ------------------------------------------------------------------ */

function Anglerfish() {
  const group = useRef<THREE.Group>(null!)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const x = 2 + Math.sin(t * 0.16) * 5.5
    group.current.position.set(x, -87.5 + Math.sin(t * 0.5) * 0.9, -11)
    const heading = Math.cos(t * 0.16) >= 0 ? Math.PI / 2 : -Math.PI / 2
    easing.damp(group.current.rotation, 'y', heading, 0.9, delta)
  })

  return (
    <group ref={group}>
      {/* body silhouette */}
      <mesh scale={[1.05, 0.85, 1.35]}>
        <sphereGeometry args={[0.85, 20, 16]} />
        <meshStandardMaterial color="#060d16" roughness={1} />
      </mesh>
      {/* tail */}
      <mesh position={[0, 0, -1.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.4, 0.9, 10]} />
        <meshStandardMaterial color="#060d16" roughness={1} />
      </mesh>
      {/* dorsal fin */}
      <mesh position={[0, 0.75, -0.3]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.25, 0.55, 8]} />
        <meshStandardMaterial color="#060d16" roughness={1} />
      </mesh>
      {/* lure rod */}
      <mesh position={[0, 0.85, 0.75]} rotation={[0.85, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.1, 6]} />
        <meshStandardMaterial color="#0b1622" roughness={1} />
      </mesh>
      {/* glowing lure + its light */}
      <mesh position={[0, 1.2, 1.2]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshBasicMaterial color="#bffaf0" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.2, 1.2]} intensity={16} distance={9} color="#7ef3e2" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Sea floor — abyssal plain with a seamount and one coral cluster     */
/* that COLORS UP as the donation slider rises (reads the donation     */
/* store every frame, no React re-render involved).                    */
/* ------------------------------------------------------------------ */

const CORAL_GRAY = new THREE.Color('#3a464e')
const CORAL_TARGETS = ['#ff6f61', '#36e2d2', '#f4a259', '#e76f8a', '#7be0c8', '#ff8f5c', '#caa9ff']

type CoralPiece = {
  kind: 'cone' | 'ico' | 'sphere' | 'torus'
  pos: [number, number, number]
  rot: [number, number, number]
  scale: number
}

const CORAL_PIECES: CoralPiece[] = [
  { kind: 'cone', pos: [0, 1.3, 0], rot: [0, 0, 0], scale: 1 },
  { kind: 'cone', pos: [0.85, 0.95, 0.4], rot: [0, 0, -0.28], scale: 0.75 },
  { kind: 'cone', pos: [-0.75, 0.8, -0.3], rot: [0, 0, 0.32], scale: 0.65 },
  { kind: 'ico', pos: [0.35, 0.5, 0.75], rot: [0.3, 0.5, 0], scale: 1 },
  { kind: 'sphere', pos: [-0.55, 0.35, 0.5], rot: [0, 0, 0], scale: 1 },
  { kind: 'torus', pos: [1.3, 0.45, -0.45], rot: [Math.PI / 2, 0, 0], scale: 1 },
  { kind: 'cone', pos: [1.5, 0.6, 0.25], rot: [0, 0, -0.45], scale: 0.5 },
]

function CoralCluster() {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const glow = useRef<THREE.PointLight>(null!)
  const tmp = useMemo(() => new THREE.Color(), [])
  const targets = useMemo(() => CORAL_TARGETS.map((c) => new THREE.Color(c)), [])

  useFrame((_, delta) => {
    const k = donationVitality()
    mats.current.forEach((m, i) => {
      if (!m) return
      tmp.copy(CORAL_GRAY).lerp(targets[i], k)
      easing.dampC(m.color, tmp, 0.45, delta)
      m.emissive.copy(m.color).multiplyScalar(k * 0.6)
    })
    glow.current.intensity = THREE.MathUtils.damp(glow.current.intensity, 2 + k * 38, 3, delta)
  })

  const geometryFor = (piece: CoralPiece, index: number) => {
    const material = (
      <meshStandardMaterial
        ref={(m: THREE.MeshStandardMaterial | null) => {
          mats.current[index] = m
        }}
        color="#3a464e"
        roughness={0.75}
      />
    )
    switch (piece.kind) {
      case 'cone':
        return (
          <mesh key={index} position={piece.pos} rotation={piece.rot} scale={piece.scale}>
            <coneGeometry args={[0.34, 2.5, 7]} />
            {material}
          </mesh>
        )
      case 'ico':
        return (
          <mesh key={index} position={piece.pos} rotation={piece.rot} scale={piece.scale}>
            <icosahedronGeometry args={[0.52, 0]} />
            {material}
          </mesh>
        )
      case 'sphere':
        return (
          <mesh key={index} position={piece.pos} rotation={piece.rot} scale={piece.scale}>
            <sphereGeometry args={[0.4, 14, 12]} />
            {material}
          </mesh>
        )
      case 'torus':
        return (
          <mesh key={index} position={piece.pos} rotation={piece.rot} scale={piece.scale}>
            <torusGeometry args={[0.42, 0.12, 10, 22]} />
            {material}
          </mesh>
        )
    }
  }

  return (
    <group position={[0, -124.2, -6]} scale={1.5}>
      {CORAL_PIECES.map((piece, i) => geometryFor(piece, i))}
      <pointLight ref={glow} position={[0, 1.6, 1]} intensity={2} distance={16} color="#5fe8d8" />
    </group>
  )
}

const ROCK_COUNT = 36

function SeaFloor() {
  const rocks = useRef<THREE.InstancedMesh>(null!)

  useEffect(() => {
    const dummy = new THREE.Object3D()
    for (let i = 0; i < ROCK_COUNT; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 70,
        -128.4 + Math.random() * 0.5,
        4 - Math.random() * 38,
      )
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      dummy.scale.setScalar(0.4 + Math.random() * 1.7)
      dummy.updateMatrix()
      rocks.current.setMatrixAt(i, dummy.matrix)
    }
    rocks.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <group>
      {/* abyssal plain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -128.8, -10]}>
        <planeGeometry args={[220, 120]} />
        <meshStandardMaterial color="#0d1a24" roughness={0.95} />
      </mesh>
      {/* seamount carrying the coral cluster */}
      <mesh position={[0, -126.4, -6]}>
        <coneGeometry args={[4.6, 5, 22]} />
        <meshStandardMaterial color="#13222e" roughness={0.9} />
      </mesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, ROCK_COUNT]}>
        <dodecahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#13202b" roughness={0.95} />
      </instancedMesh>
      <CoralCluster />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Marine snow — fine suspended particles across the whole descent.    */
/* ------------------------------------------------------------------ */

function MarineSnow() {
  const points = useRef<THREE.Points>(null!)

  const positions = useMemo(() => {
    const arr = new Float32Array(750 * 3)
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = (Math.random() - 0.5) * 60
      arr[i + 1] = 8 - Math.random() * 146
      arr[i + 2] = 12 - Math.random() * 42
    }
    return arr
  }, [])

  useFrame((state) => {
    points.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.08
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#9fd6cf"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — sinking camera, scroll-driven water colour,       */
/* depth-faded sun, post FX.                                           */
/* ------------------------------------------------------------------ */

export default function Experience() {
  const scroll = useScroll()
  const sun = useRef<THREE.DirectionalLight>(null!)
  const ambient = useRef<THREE.AmbientLight>(null!)
  const camLight = useRef<THREE.PointLight>(null!)
  const water = useMemo(() => new THREE.Color('#0a4f5e'), [])

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    const o = scroll.offset
    const y = 2 - o * DESCENT

    // sink + gentle pointer parallax
    easing.damp3(state.camera.position, [state.pointer.x * 1.2, y, 10], 0.3, delta)
    state.camera.lookAt(state.pointer.x * 2.6, y - 2.2 + state.pointer.y * 1.2, -6)

    // dolly-zoom settle on each section
    const cam = state.camera as THREE.PerspectiveCamera
    const sec = o * (PAGES - 1)
    const frac = Math.abs(sec - Math.round(sec))
    const targetFov = 46 - (1 - Math.min(1, frac * 2.5)) * 3
    cam.fov = THREE.MathUtils.damp(cam.fov, targetFov, 4, delta)
    cam.updateProjectionMatrix()

    // THE DESCENT: water colour from surface aqua to abyssal black,
    // driven directly by the scroll offset (background + fog together)
    water.copy(SURFACE).lerp(ABYSS, Math.pow(Math.min(1, o * 1.15), 0.8))
    if (state.scene.background instanceof THREE.Color) state.scene.background.copy(water)
    const fog = state.scene.fog as THREE.Fog | null
    if (fog) fog.color.copy(water)

    // sunlight dies with depth; the diver's lamp takes over
    sun.current.intensity = 0.1 + 1.6 * Math.pow(1 - o, 2.4)
    ambient.current.intensity = 0.16 + 0.5 * (1 - o)
    camLight.current.position.set(state.pointer.x * 5, y + 1.2, 7)
    camLight.current.intensity = 6 + o * 34

    publishOffset(o)
    document.documentElement.style.setProperty('--scroll', o.toFixed(4))
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={0.6} color="#7fc4c9" />
      <directionalLight ref={sun} position={[6, 30, 8]} intensity={1.7} color="#bfeee9" />
      <pointLight ref={camLight} intensity={6} distance={22} color="#2e8d96" />

      <CausticsShelf />
      <Turtle />
      <FishSchool />
      <Rov />
      <SurveyMotes />
      <Bioluminescence />
      <Anglerfish />
      <SeaFloor />
      <MarineSnow />

      <EffectComposer>
        <Bloom intensity={0.85} luminanceThreshold={0.22} luminanceSmoothing={0.65} mipmapBlur />
        <Noise opacity={0.05} />
        <Vignette offset={0.16} darkness={0.9} />
      </EffectComposer>
    </>
  )
}
