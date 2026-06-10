import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, Sparkles, useCursor, useScroll } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import { DEFAULT_TINT, TIERS, getTier, getTint, subscribe } from '../lib/aura'
import { PAGES, setScrollEl } from '../scrollBus'

/* ------------------------------------------------------------------ */
/* Per-section choreography for the flacon — position, yaw, scale.     */
/* The bottle glides to the empty half of each spread.                 */
/* ------------------------------------------------------------------ */

const SECTION_POS: [number, number, number][] = [
  [0, -0.55, 0], // 0 hero — centre stage
  [2.4, -0.15, 0], // 1 maison — text left, flacon right
  [-2.3, -0.1, 0], // 2 pyramid — panel right, flacon left
  [0, -0.35, 1.6], // 3 eau — close-up
  [-2.5, -0.3, 0], // 4 rituals — text right
  [0, -0.85, 0.4], // 5 collection — centre, low
  [2.5, 0.25, -0.6], // 6 atelier — small, off to the side
  [0, 0.55, -1.2], // 7 footer — receding above the seal
]
const SECTION_ROT = [0.45, 1.35, 0.85, 0.1, 2.3, 0.6, 1.9, 3.6]
const SECTION_SCALE = [1.55, 1.05, 1.0, 1.85, 1.0, 1.25, 0.78, 0.6]

const smooth = (t: number) => t * t * (3 - 2 * t)

function sectionLerp(sec: number, table: number[]) {
  const i0 = Math.min(table.length - 1, Math.max(0, Math.floor(sec)))
  const i1 = Math.min(table.length - 1, i0 + 1)
  return THREE.MathUtils.lerp(table[i0], table[i1], smooth(THREE.MathUtils.clamp(sec - i0, 0, 1)))
}

/* ------------------------------------------------------------------ */
/* Liquid gold — custom GLSL ShaderMaterial. The fill line (meniscus)  */
/* is an animated wave cut in the fragment shader; a fresnel term      */
/* makes the gold shimmer towards the silhouette.                      */
/* ------------------------------------------------------------------ */

const LIQUID_VERTEX = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vW;

  void main() {
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const LIQUID_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uFill;
  uniform vec3 uColorA; // deep gold
  uniform vec3 uColorB; // light gold
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vW;

  void main() {
    // animated meniscus — two crossing waves over the fill level
    float wave =
      sin(vW.x * 7.0 + uTime * 2.1) * 0.035 +
      sin(vW.z * 6.0 - uTime * 1.6) * 0.030;
    float level = uFill + wave;
    if (vPos.y > level) discard;

    vec3 n = gl_FrontFacing ? vN : -vN;
    float fresnel = pow(1.0 - max(dot(n, vV), 0.0), 2.4);
    float shimmer = 0.5 + 0.5 * sin(vPos.y * 18.0 + vPos.x * 9.0 + uTime * 2.6);

    vec3 col = mix(uColorA, uColorB, fresnel * 0.85 + shimmer * 0.18);
    // bright rim right at the liquid surface
    float edge = smoothstep(0.07, 0.0, level - vPos.y);
    col += edge * uColorB * 0.9;
    col += fresnel * 0.22;

    gl_FragColor = vec4(col, 0.96);
  }
`

/* ------------------------------------------------------------------ */
/* Flacon — faceted icosahedron body + cylinder neck + sphere stopper. */
/* DRAGGABLE: grab it to spin; the stopper lifts while you hold it.    */
/* ------------------------------------------------------------------ */

function Flacon() {
  const group = useRef<THREE.Group>(null!)
  const stopper = useRef<THREE.Group>(null!)
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)
  const [grabbed, setGrabbed] = useState(false)
  useCursor(hovered || grabbed, grabbed ? 'grabbing' : 'grab')

  const drag = useRef({ active: false, px: 0, py: 0, vx: 0, vy: 0, rx: 0, ry: 0 })

  const liquid = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: LIQUID_VERTEX,
        fragmentShader: LIQUID_FRAGMENT,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uFill: { value: 0.22 },
          uColorA: { value: new THREE.Color('#b8860b') },
          uColorB: { value: new THREE.Color(DEFAULT_TINT) },
        },
      }),
    [],
  )

  const tintTarget = useMemo(() => new THREE.Color(), [])

  useEffect(() => () => liquid.dispose(), [liquid])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d.active) return
      d.vy = (e.clientX - d.px) * 0.006
      d.vx = (e.clientY - d.py) * 0.004
      d.ry += d.vy
      d.rx += d.vx
      d.px = e.clientX
      d.py = e.clientY
    }
    const up = () => {
      drag.current.active = false
      setGrabbed(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  useFrame((state, delta) => {
    const d = drag.current
    const o = scroll.offset
    const sec = o * (PAGES - 1)

    // glide between section marks
    const px = sectionLerp(sec, SECTION_POS.map((p) => p[0]))
    const py = sectionLerp(sec, SECTION_POS.map((p) => p[1]))
    const pz = sectionLerp(sec, SECTION_POS.map((p) => p[2]))
    easing.damp3(group.current.position, [px, py + Math.sin(state.clock.elapsedTime * 0.9) * 0.06, pz], 0.45, delta)

    const s = sectionLerp(sec, SECTION_SCALE)
    easing.damp3(group.current.scale, s, 0.45, delta)

    // drag inertia: keep spinning after release, slowly settle
    if (!d.active) {
      d.ry += d.vy
      d.vy *= 0.94
      d.rx = THREE.MathUtils.damp(d.rx, 0, 2.2, delta)
    }
    d.rx = THREE.MathUtils.clamp(d.rx, -0.8, 0.8)

    const baseY = sectionLerp(sec, SECTION_ROT) + state.clock.elapsedTime * 0.07
    group.current.rotation.y = baseY + d.ry
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, d.rx, 6, delta)
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.03

    // the stopper lifts while the flacon is held
    easing.damp(stopper.current.position, 'y', d.active ? 1.78 : 1.32, 0.22, delta)
    stopper.current.rotation.y += delta * (d.active ? 1.6 : 0.2)

    // liquid uniforms — tint follows the collection hover bus
    liquid.uniforms.uTime.value = state.clock.elapsedTime
    tintTarget.set(getTint())
    easing.dampC(liquid.uniforms.uColorB.value as THREE.Color, tintTarget, 0.4, delta)
    tintTarget.multiplyScalar(0.48)
    easing.dampC(liquid.uniforms.uColorA.value as THREE.Color, tintTarget, 0.4, delta)
  })

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onPointerDown={(e) => {
        e.stopPropagation()
        const d = drag.current
        d.active = true
        d.px = e.clientX
        d.py = e.clientY
        d.vx = 0
        d.vy = 0
        setGrabbed(true)
      }}
    >
      {/* faceted glass body */}
      <mesh>
        <icosahedronGeometry args={[0.95, 1]} />
        <meshPhysicalMaterial
          color="#fbf7ee"
          metalness={0}
          roughness={0.08}
          transparent
          opacity={0.32}
          clearcoat={1}
          clearcoatRoughness={0.12}
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* liquid gold inside — custom GLSL shader */}
      <mesh material={liquid}>
        <icosahedronGeometry args={[0.8, 5]} />
      </mesh>
      {/* neck */}
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 0.42, 24]} />
        <meshPhysicalMaterial
          color="#fbf7ee"
          metalness={0}
          roughness={0.1}
          transparent
          opacity={0.5}
          clearcoat={1}
        />
      </mesh>
      {/* gold collar */}
      <mesh position={[0, 1.18, 0]}>
        <torusGeometry args={[0.17, 0.028, 12, 36]} />
        <meshStandardMaterial color="#c79a3b" metalness={1} roughness={0.25} />
      </mesh>
      {/* stopper — lifts while dragging */}
      <group ref={stopper} position={[0, 1.32, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.085, 0.085, 0.3, 16]} />
          <meshStandardMaterial color="#c79a3b" metalness={1} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <sphereGeometry args={[0.21, 24, 24]} />
          <meshStandardMaterial color="#d8ab4c" metalness={1} roughness={0.18} />
        </mesh>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Aura — Sparkles + fog/background tint driven by the active pyramid  */
/* tier (state bus from the DOM). Particles morph per tier.            */
/* ------------------------------------------------------------------ */

function Aura() {
  const tier = useSyncExternalStore(subscribe, getTier)
  const recipe = TIERS[tier]
  const fogTarget = useMemo(() => new THREE.Color(), [])

  useFrame((state, delta) => {
    fogTarget.set(recipe.fog)
    const fog = state.scene.fog as THREE.Fog | null
    if (fog) easing.dampC(fog.color, fogTarget, 0.6, delta)
    if (state.scene.background instanceof THREE.Color) {
      easing.dampC(state.scene.background, fogTarget, 0.6, delta)
    }
  })

  return (
    <Sparkles
      key={tier}
      count={recipe.count}
      size={recipe.size}
      speed={recipe.speed}
      opacity={recipe.opacity}
      scale={recipe.scale}
      color={recipe.color}
      noise={1.4}
    />
  )
}

/* ------------------------------------------------------------------ */
/* TierLabel — drei <Html> note floating by the flacon during the      */
/* Pyramid spread; fades with the scroll so it never bleeds into       */
/* neighbouring sections (labels ignore fog/depth otherwise).          */
/* ------------------------------------------------------------------ */

function TierLabel() {
  const tier = useSyncExternalStore(subscribe, getTier)
  const label = useRef<HTMLDivElement>(null)
  const scroll = useScroll()

  useFrame(() => {
    if (label.current) {
      const sec = scroll.offset * (PAGES - 1)
      const visibility = Math.max(0, 1 - Math.abs(sec - 2) * 1.6)
      label.current.style.opacity = visibility.toFixed(3)
      label.current.style.display = visibility < 0.04 ? 'none' : ''
    }
  })

  return (
    <Html center position={[-2.3, 1.6, 0]} className="note-html" zIndexRange={[20, 0]}>
      <div ref={label} className="note-label" style={{ opacity: 0, display: 'none' }}>
        <strong>{TIERS[tier].label} notes</strong>
        <span>{TIERS[tier].notes}</span>
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/* Ribbon — golden silk: a stretched TorusKnot weaving behind the      */
/* flacon, unwinding with the scroll.                                  */
/* ------------------------------------------------------------------ */

function Ribbon() {
  const mesh = useRef<THREE.Mesh>(null!)
  const scroll = useScroll()

  useFrame((state, delta) => {
    const o = scroll.offset
    mesh.current.rotation.y = o * Math.PI * 2 + state.clock.elapsedTime * 0.05
    easing.damp(mesh.current.rotation, 'z', 0.35 + o * 0.9, 0.4, delta)
    easing.damp3(mesh.current.position, [0, -0.6 + Math.sin(o * Math.PI) * 1.4, -6.5], 0.4, delta)
  })

  return (
    <mesh ref={mesh} scale={[2.7, 5.4, 2.7]} position={[0, -0.6, -6.5]}>
      <torusKnotGeometry args={[1.55, 0.016, 420, 12, 2, 5]} />
      <meshStandardMaterial
        color="#c79a3b"
        metalness={1}
        roughness={0.26}
        emissive="#7a5a16"
        emissiveIntensity={0.18}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Droplet — on every section change a single gold drop falls and      */
/* ripples (expanding rings) on an invisible porcelain plane.          */
/* ------------------------------------------------------------------ */

const FALL = 0.55
const RING_COUNT = 3

function Droplet() {
  const scroll = useScroll()
  const drop = useRef<THREE.Mesh>(null!)
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const prevSection = useRef(0)
  const t0 = useRef(-10)

  useFrame((state) => {
    const sec = Math.round(scroll.offset * (PAGES - 1))
    if (sec !== prevSection.current) {
      prevSection.current = sec
      t0.current = state.clock.elapsedTime
    }
    const t = state.clock.elapsedTime - t0.current

    // falling drop
    if (t >= 0 && t < FALL) {
      const k = t / FALL
      drop.current.visible = true
      drop.current.position.y = 2.6 - k * k * 4.5
      drop.current.scale.set(0.8, 1 + k * 0.7, 0.8)
    } else {
      drop.current.visible = false
    }

    // ripple rings
    for (let i = 0; i < RING_COUNT; i++) {
      const ring = rings.current[i]
      if (!ring) continue
      const start = FALL + i * 0.16
      const k = THREE.MathUtils.clamp((t - start) / 1.1, 0, 1)
      const active = k > 0 && k < 1
      ring.visible = active
      if (active) {
        const e = 1 - Math.pow(1 - k, 2)
        ring.scale.setScalar(0.05 + e * 2.6)
        ;(ring.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.55
      }
    }
  })

  return (
    <group position={[1.9, 0, 0.8]}>
      <mesh ref={drop} visible={false}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#d8ab4c" toneMapped={false} />
      </mesh>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            rings.current[i] = el
          }}
          visible={false}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -1.9, 0]}
        >
          <ringGeometry args={[0.46, 0.5, 48]} />
          <meshBasicMaterial color="#b8860b" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — porcelain light, gentle camera parallax, post FX. */
/* ------------------------------------------------------------------ */

export default function Experience() {
  const scroll = useScroll()

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    easing.damp3(
      state.camera.position,
      [state.pointer.x * 0.55, state.pointer.y * 0.35, 9],
      0.5,
      delta,
    )
    state.camera.lookAt(0, 0, 0)
    document.documentElement.style.setProperty('--scroll', scroll.offset.toFixed(4))
  })

  return (
    <>
      {/* porcelain daylight */}
      <ambientLight intensity={0.85} color="#fffaf0" />
      <directionalLight position={[4, 6, 5]} intensity={1.5} color="#fff4dd" />
      <directionalLight position={[-6, 2, -4]} intensity={0.5} color="#e8dcc4" />
      <pointLight position={[0, -2.5, 3]} intensity={6} distance={10} color="#e6c36a" />

      <Flacon />
      <Aura />
      <TierLabel />
      <Ribbon />
      <Droplet />

      <EffectComposer>
        <Bloom intensity={0.35} luminanceThreshold={0.82} luminanceSmoothing={0.6} mipmapBlur />
        <Noise opacity={0.028} />
        <Vignette offset={0.12} darkness={0.42} />
      </EffectComposer>
    </>
  )
}
