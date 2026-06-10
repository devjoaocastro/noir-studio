import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, useCursor, useScroll } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import { PAGES, setScrollEl } from '../scrollBus'
import { world, billToCount, PANEL_MAX } from '../store'

/* ------------------------------------------------------------------ */
/* Theme palette — every frame the scene lerps between these by        */
/* world.blend (0 = day, 1 = night), driven by the header toggle.      */
/* ------------------------------------------------------------------ */

const DAY_BG = new THREE.Color('#cfe8ff')
const NIGHT_BG = new THREE.Color('#071426')
const DAY_LIGHT = new THREE.Color('#fff3d0')
const NIGHT_LIGHT = new THREE.Color('#bccbe6')
const DAY_GROUND = new THREE.Color('#7db26b')
const NIGHT_GROUND = new THREE.Color('#0e2418')
const SUN_DAY = new THREE.Color('#ffb928').multiplyScalar(2.4)
const MOON_NIGHT = new THREE.Color('#e6eefb').multiplyScalar(1.7)
const FLOW_DAY = new THREE.Color('#ffb928')
const FLOW_NIGHT = new THREE.Color('#cfe0ff')

/* Sun arc geometry: the sun travels a semicircle over the field. */
const ARC_R = 22
const ARC_H = 13
const ARC_Z = -14

function arcPoint(u: number, out: THREE.Vector3) {
  const a = Math.PI * (1 - u)
  out.set(Math.cos(a) * ARC_R, Math.sin(a) * ARC_H + 0.6, ARC_Z)
  return out
}

/* ------------------------------------------------------------------ */
/* SunMoon — THE draggable interaction. Grab the orb and slide it      */
/* along its sky arc; panels, light and the energy flow all react.     */
/* At night the same orb becomes the moon.                             */
/* ------------------------------------------------------------------ */

function SunMoon() {
  const group = useRef<THREE.Group>(null!)
  const orbMat = useRef<THREE.MeshBasicMaterial>(null!)
  const light = useRef<THREE.PointLight>(null!)
  const hint = useRef<HTMLDivElement>(null)
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const u = useRef(world.sunU)

  useEffect(() => {
    const up = () => {
      world.draggingSun = false
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    world.draggingSun = true
  }

  useFrame((state, delta) => {
    // while dragging, the horizontal pointer position steers the arc
    if (world.draggingSun) {
      world.sunU = THREE.MathUtils.clamp(state.pointer.x * 0.5 + 0.5, 0.05, 0.95)
    }
    easing.damp(u, 'current', world.sunU, world.draggingSun ? 0.06 : 0.25, delta)
    arcPoint(u.current, group.current.position)
    world.sunPos.copy(group.current.position)

    const b = world.blend
    orbMat.current.color.lerpColors(SUN_DAY, MOON_NIGHT, b)
    light.current.intensity = THREE.MathUtils.lerp(60, 26, b)
    light.current.color.lerpColors(DAY_LIGHT, NIGHT_LIGHT, b)

    // gentle breathing
    const breathe = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.03
    group.current.scale.setScalar(breathe * (hovered || world.draggingSun ? 1.12 : 1))

    // drei <Html> label-fade fix: labels ignore fog/depth, so we fade +
    // display:none them by scroll position (visible on the hero only)
    if (hint.current) {
      const sec = scroll.offset * (PAGES - 1)
      const visibility = Math.max(0, 1 - sec * 1.7)
      hint.current.style.opacity = visibility.toFixed(3)
      hint.current.style.display = visibility < 0.04 ? 'none' : ''
    }
  })

  return (
    <group
      ref={group}
      onPointerDown={onDown}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh>
        <sphereGeometry args={[1.5, 48, 48]} />
        <meshBasicMaterial ref={orbMat} toneMapped={false} />
      </mesh>
      {/* oversized invisible grab handle so the drag is forgiving */}
      <mesh>
        <sphereGeometry args={[3.4, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight ref={light} distance={90} decay={0.6} />
      <Html center position={[0, 3.6, 0]} className="orb-html" zIndexRange={[20, 0]}>
        <div ref={hint} className="orb-hint" style={{ opacity: 0, display: 'none' }}>
          <strong>← drag the sun →</strong>
          <span>the field follows</span>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* PanelField — instanced solar panels that TRACK the sun in real      */
/* time. The calculator's slider scales how many are deployed.         */
/* ------------------------------------------------------------------ */

function PanelField() {
  const heads = useRef<THREE.InstancedMesh>(null!)
  const posts = useRef<THREE.InstancedMesh>(null!)
  const headMat = useRef<THREE.MeshStandardMaterial>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = useRef({ v: billToCount(world.bill) })

  const spots = useMemo(() => {
    const arr: THREE.Vector3[] = []
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 16; c++) {
        arr.push(
          new THREE.Vector3(
            -13.4 + c * 0.94 + (Math.random() - 0.5) * 0.18,
            0.95,
            -10.6 + r * 1.18 + (Math.random() - 0.5) * 0.18,
          ),
        )
      }
    }
    // grow outward from the field centre as the calculator adds panels
    const cx = -6.4
    const cz = -5.3
    arr.sort(
      (a, b) =>
        (a.x - cx) ** 2 + (a.z - cz) ** 2 - ((b.x - cx) ** 2 + (b.z - cz) ** 2),
    )
    return arr
  }, [])

  useFrame((_, delta) => {
    easing.damp(count.current, 'v', billToCount(world.bill), 0.4, delta)
    const n = count.current.v

    for (let i = 0; i < PANEL_MAX; i++) {
      const p = spots[i]
      const s = Math.max(0.001, THREE.MathUtils.clamp(n - i, 0, 1))

      // the panel head aims at the sun — instant heliostat tracking
      dummy.position.copy(p)
      dummy.lookAt(world.sunPos)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      heads.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(p.x, 0.45, p.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      posts.current.setMatrixAt(i, dummy.matrix)
    }
    heads.current.instanceMatrix.needsUpdate = true
    posts.current.instanceMatrix.needsUpdate = true

    // panels glow gold at night (stored energy showing off)
    headMat.current.emissiveIntensity = THREE.MathUtils.lerp(0.02, 0.75, world.blend)
  })

  return (
    <group>
      <instancedMesh ref={heads} args={[undefined, undefined, PANEL_MAX]}>
        <boxGeometry args={[0.82, 0.6, 0.05]} />
        <meshStandardMaterial
          ref={headMat}
          color="#16263c"
          metalness={0.65}
          roughness={0.3}
          emissive="#ffb928"
          emissiveIntensity={0.02}
        />
      </instancedMesh>
      <instancedMesh ref={posts} args={[undefined, undefined, PANEL_MAX]}>
        <cylinderGeometry args={[0.035, 0.045, 0.9, 8]} />
        <meshStandardMaterial color="#5b6a78" metalness={0.7} roughness={0.45} />
      </instancedMesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* House — boxes + a triangular-prism roof. The windows glow warm at   */
/* night (battery keeping the lights on).                              */
/* ------------------------------------------------------------------ */

function House() {
  // ONE shared window material so every pane glows in sync at night
  const winMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#9cc2e2',
        emissive: new THREE.Color('#ffd27a'),
        emissiveIntensity: 0.04,
        roughness: 0.2,
        metalness: 0.4,
      }),
    [],
  )

  useEffect(() => () => winMat.dispose(), [winMat])

  useFrame(() => {
    winMat.emissiveIntensity = THREE.MathUtils.lerp(0.04, 2.6, world.blend)
  })

  return (
    <group position={[6.5, 0, -2]}>
      {/* body */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[3, 2.2, 2.6]} />
        <meshStandardMaterial color="#e8e2d5" roughness={0.85} />
      </mesh>
      {/* triangular prism roof: 3-segment cylinder laid along x, apex up */}
      <mesh position={[0, 2.85, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.75, 1.75, 3.4, 3, 1]} />
        <meshStandardMaterial color="#9a4f38" roughness={0.8} flatShading />
      </mesh>
      {/* door */}
      <mesh position={[0, 0.62, 1.31]}>
        <boxGeometry args={[0.6, 1.24, 0.05]} />
        <meshStandardMaterial color="#3c4c5c" roughness={0.6} />
      </mesh>
      {/* front windows — glow at night */}
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 1.35, 1.31]} material={winMat}>
          <boxGeometry args={[0.62, 0.62, 0.04]} />
        </mesh>
      ))}
      {/* side window */}
      <mesh position={[-1.51, 1.35, 0]} material={winMat}>
        <boxGeometry args={[0.04, 0.62, 0.9]} />
      </mesh>
      {/* rooftop panel — the house has its own */}
      <mesh position={[0.4, 3.45, 0.8]} rotation={[-0.6, 0, 0]}>
        <boxGeometry args={[1.4, 0.9, 0.05]} />
        <meshStandardMaterial color="#16263c" metalness={0.65} roughness={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* EnergyFlow — the custom GLSL shader. A tube runs from the panel     */
/* field to the house; animated dashes of light flow along it, speed   */
/* proportional to the sun's height in the sky.                        */
/* ------------------------------------------------------------------ */

function EnergyFlow() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
          uPhase: { value: 0 },
          uColor: { value: FLOW_DAY.clone() },
          uBoost: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uPhase;
          uniform vec3 uColor;
          uniform float uBoost;
          varying vec2 vUv;

          void main() {
            // repeating dash that travels along the tube's length (vUv.x)
            float flow = fract(vUv.x * 14.0 - uPhase);
            float dash = smoothstep(0.0, 0.22, flow) * (1.0 - smoothstep(0.4, 0.68, flow));
            // soft rim falloff around the tube circumference
            float rim = 0.55 + 0.45 * sin(vUv.y * 6.28318);
            float glow = (0.12 + dash * 1.7 * uBoost) * rim;
            float alpha = 0.1 + dash * 0.85;
            gl_FragColor = vec4(uColor * glow, alpha);
          }
        `,
      }),
    [],
  )

  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.2, 1.05, -4.2),
      new THREE.Vector3(-1.2, 1.9, -3.2),
      new THREE.Vector3(2.6, 2.3, -2.4),
      new THREE.Vector3(6.1, 2.5, -2),
    ])
    return new THREE.TubeGeometry(curve, 90, 0.07, 10, false)
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_, delta) => {
    // speed ∝ sun height: high noon pumps electrons, dusk trickles
    const h01 = THREE.MathUtils.clamp((world.sunPos.y - 0.6) / ARC_H, 0, 1)
    const daySpeed = 0.6 + h01 * 2.8
    // at night the battery discharges towards the house at a calm rate
    const speed = THREE.MathUtils.lerp(daySpeed, 0.9, world.blend)
    material.uniforms.uPhase.value += delta * speed
    material.uniforms.uBoost.value = THREE.MathUtils.lerp(0.7 + h01, 1.1, world.blend)
    ;(material.uniforms.uColor.value as THREE.Color).lerpColors(
      FLOW_DAY,
      FLOW_NIGHT,
      world.blend,
    )
  })

  return <mesh geometry={geometry} material={material} />
}

/* ------------------------------------------------------------------ */
/* Battery — a tower that visibly FILLS with stored energy as you      */
/* scroll, with an Html % label (same fade fix).                       */
/* ------------------------------------------------------------------ */

function Battery() {
  const fill = useRef<THREE.Mesh>(null!)
  const fillMat = useRef<THREE.MeshStandardMaterial>(null!)
  const label = useRef<HTMLDivElement>(null)
  const pct = useRef<HTMLSpanElement>(null)
  const scroll = useScroll()

  useFrame(() => {
    const o = scroll.offset
    const h = Math.max(0.02, o * 1.66)
    fill.current.scale.y = h
    fill.current.position.y = 0.14 + h / 2
    fillMat.current.emissiveIntensity = 0.35 + world.blend * 0.9

    if (label.current && pct.current) {
      const sec = o * (PAGES - 1)
      const visibility = Math.max(0, 1 - Math.abs(sec - 3) * 1.5)
      label.current.style.opacity = visibility.toFixed(3)
      label.current.style.display = visibility < 0.04 ? 'none' : ''
      pct.current.textContent = `${Math.round(o * 100)}%`
    }
  })

  return (
    <group position={[3.4, 0, 0.6]}>
      {/* casing */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.9, 2, 0.9]} />
        <meshStandardMaterial
          color="#aebdca"
          transparent
          opacity={0.22}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
      {/* terminal cap */}
      <mesh position={[0, 2.12, 0]}>
        <boxGeometry args={[0.4, 0.24, 0.4]} />
        <meshStandardMaterial color="#3c4c5c" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* the fill — unit box scaled in y every frame */}
      <mesh ref={fill} position={[0, 0.15, 0]}>
        <boxGeometry args={[0.72, 1, 0.72]} />
        <meshStandardMaterial
          ref={fillMat}
          color="#ffb928"
          emissive="#ffb928"
          emissiveIntensity={0.35}
          roughness={0.4}
        />
      </mesh>
      <Html center position={[0, 2.9, 0]} className="orb-html" zIndexRange={[20, 0]}>
        <div ref={label} className="battery-label" style={{ opacity: 0, display: 'none' }}>
          <span ref={pct}>0%</span>
          <small>stored</small>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Terrain + NightStars                                                */
/* ------------------------------------------------------------------ */

function Terrain() {
  const mat = useRef<THREE.MeshStandardMaterial>(null!)

  useFrame(() => {
    mat.current.color.lerpColors(DAY_GROUND, NIGHT_GROUND, world.blend)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]}>
      <circleGeometry args={[70, 64]} />
      <meshStandardMaterial ref={mat} color="#7db26b" roughness={0.95} />
    </mesh>
  )
}

function NightStars() {
  const mat = useRef<THREE.PointsMaterial>(null!)

  const positions = useMemo(() => {
    const n = 700
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(1 - Math.random() * 0.92) // upper dome
      const r = 56
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 3
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 8
    }
    return arr
  }, [])

  useFrame(() => {
    mat.current.opacity = world.blend * 0.9
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        size={0.22}
        color="#e6eefb"
        transparent
        opacity={0}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — theme blending, lights and the scroll camera rig  */
/* ------------------------------------------------------------------ */

const CAM_POS = [
  new THREE.Vector3(0, 3.4, 15.5), // 0 hero — wide establishing shot
  new THREE.Vector3(-9, 4.2, 9), // 1 how it works — over the field
  new THREE.Vector3(-4, 10, 9), // 2 calculator — top view, see count grow
  new THREE.Vector3(10.5, 2.6, 7.5), // 3 day & night — at the house
  new THREE.Vector3(2, 3.2, 11.5), // 4 installs
  new THREE.Vector3(-7.5, 2.6, 7), // 5 warranty — low through the panels
  new THREE.Vector3(3, 4.6, 13), // 6 quote
  new THREE.Vector3(0, 6.8, 18), // 7 footer — pull back wide
]

const CAM_LOOK = [
  new THREE.Vector3(0, 2.6, -4),
  new THREE.Vector3(-5, 0.8, -4),
  new THREE.Vector3(-5.5, 0, -4.5),
  new THREE.Vector3(6.5, 1.6, -2),
  new THREE.Vector3(1, 1.4, -3),
  new THREE.Vector3(-2, 1, -3.5),
  new THREE.Vector3(2, 1.8, -2),
  new THREE.Vector3(0, 3.2, -5),
]

const tmpPos = new THREE.Vector3()
const tmpLook = new THREE.Vector3()

export default function Experience() {
  const scroll = useScroll()
  const scene = useThree((s) => s.scene)
  const dirLight = useRef<THREE.DirectionalLight>(null!)
  const ambient = useRef<THREE.AmbientLight>(null!)
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const lookCurrent = useRef(new THREE.Vector3(0, 2.6, -4))

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    // --- theme: damp blend towards the toggle target (~1s settle) ---
    easing.damp(world, 'blend', world.theme === 'night' ? 1 : 0, 0.32, delta)
    const b = world.blend

    // sky + fog re-light
    const bg = scene.background
    if (bg instanceof THREE.Color) {
      bg.lerpColors(DAY_BG, NIGHT_BG, b)
      if (scene.fog) (scene.fog as THREE.Fog).color.copy(bg)
    }

    // key light follows the draggable sun, dims and cools at night
    dirLight.current.position.copy(world.sunPos)
    dirLight.current.intensity = THREE.MathUtils.lerp(1.9, 0.35, b)
    dirLight.current.color.lerpColors(DAY_LIGHT, NIGHT_LIGHT, b)
    ambient.current.intensity = THREE.MathUtils.lerp(0.5, 0.13, b)
    hemi.current.intensity = THREE.MathUtils.lerp(0.55, 0.1, b)

    // --- camera rig: keyframed flight between the 8 sections ---
    const sec = scroll.offset * (PAGES - 1)
    const i = Math.min(Math.floor(sec), PAGES - 2)
    const t = THREE.MathUtils.smoothstep(sec - i, 0, 1)

    tmpPos.lerpVectors(CAM_POS[i], CAM_POS[i + 1], t)
    tmpPos.x += state.pointer.x * 0.6
    tmpPos.y += -state.pointer.y * 0.35
    easing.damp3(state.camera.position, tmpPos, 0.3, delta)

    tmpLook.lerpVectors(CAM_LOOK[i], CAM_LOOK[i + 1], t)
    easing.damp3(lookCurrent.current, tmpLook, 0.3, delta)
    state.camera.lookAt(lookCurrent.current)

    document.documentElement.style.setProperty('--scroll', scroll.offset.toFixed(4))
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={0.5} />
      <hemisphereLight ref={hemi} args={['#cfe8ff', '#4a6b3f', 0.55]} />
      <directionalLight ref={dirLight} position={[8, 12, -10]} intensity={1.9} />

      <Terrain />
      <NightStars />
      <SunMoon />
      <PanelField />
      <House />
      <Battery />
      <EnergyFlow />

      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={1} luminanceSmoothing={0.5} mipmapBlur />
        <Noise opacity={0.035} />
        <Vignette offset={0.18} darkness={0.55} />
      </EffectComposer>
    </>
  )
}
