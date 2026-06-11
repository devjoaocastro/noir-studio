import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, RoundedBox, useCursor, useScroll } from '@react-three/drei'
import { EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import { PAGES, setScrollEl } from '../scrollBus'

const INK = '#16161a'
const SPECTRUM = ['#e0312b', '#f07d1d', '#f2b705', '#3aa655', '#1f8fde', '#3b4bc8', '#7b2fbe']

/* ------------------------------------------------------------------ */
/* DispersionFan — THE custom GLSL shader. A plane deformed in the     */
/* vertex stage into a fan (spread is scroll-reactive via uSpread),    */
/* painted in the fragment stage as 7 soft-edged spectral bands that   */
/* shimmer over time and fade with distance from the prism.            */
/* ------------------------------------------------------------------ */

function makeFanMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSpread: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSpread;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float t = uv.x;
        // open the plane into a fan from the exit face outwards
        p.y *= mix(0.05, 1.0, pow(t, 0.9)) * uSpread;
        // gentle living wave so the light never feels frozen
        p.y += sin(t * 5.0 + uTime * 0.8) * 0.05 * t;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      void main() {
        float t = vUv.x;
        // 7 spectral bands across the fan, red on top → violet below,
        // with soft blended boundaries between neighbours
        float y7 = vUv.y * 7.0;
        float idx = floor(y7);
        float f = fract(y7);
        float blend = smoothstep(0.82, 1.0, f);
        float band = clamp(idx + blend, 0.0, 6.0);
        float hue = mix(0.78, 0.0, (band + 0.5) / 7.0);
        vec3 col = hsv2rgb(vec3(hue, 0.8, 0.92));
        // soft outer edges of the fan
        float edgeY = smoothstep(0.0, 0.05, vUv.y) * (1.0 - smoothstep(0.95, 1.0, vUv.y));
        // intensity falls off as the light travels
        float along = smoothstep(0.0, 0.05, t) * pow(1.0 - t, 1.35);
        // shimmer running away from the prism
        float shimmer = 0.82 + 0.18 * sin(t * 26.0 - uTime * 3.0 + vUv.y * 7.0);
        float alpha = along * edgeY * shimmer * 0.92;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  })
}

/* White beam entering the prism: hot white core, soft graphite halo
   so it stays legible on paper white. */
function makeBeamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float d = abs(vUv.y - 0.5) * 2.0;
        float core = 1.0 - smoothstep(0.0, 0.3, d);
        float halo = 1.0 - smoothstep(0.0, 1.0, d);
        vec3 ink = vec3(0.086, 0.086, 0.10);
        vec3 col = mix(ink, vec3(1.0), core);
        float run = 0.9 + 0.1 * sin(vUv.x * 36.0 - uTime * 5.0);
        float along = smoothstep(0.0, 0.12, vUv.x);
        float alpha = (core * 0.9 + halo * 0.24) * along * run;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  })
}

/* ------------------------------------------------------------------ */
/* PrismRig — the DRAGGABLE glass triangular prism. Grab it and spin   */
/* it around its axis: the dispersion fan is a child of the spinning   */
/* group, so the rainbow re-aims with every drag, with inertia.        */
/* ------------------------------------------------------------------ */

function PrismRig({ x, y }: { x: number; y: number }) {
  const float = useRef<THREE.Group>(null!)
  const spin = useRef<THREE.Group>(null!)
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)
  const dragging = useRef(false)
  const lastX = useRef(0)
  const vel = useRef(0)
  useCursor(hovered, 'grab')

  const prismGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1.45, 1.45, 1.25, 3, 1)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(prismGeo), [prismGeo])
  const fanGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(6.6, 2.7, 48, 24)
    g.translate(3.3, 0, 0)
    return g
  }, [])
  const beamGeo = useMemo(() => new THREE.PlaneGeometry(4.6, 0.55, 1, 1), [])

  const fanMat = useMemo(makeFanMaterial, [])
  const beamMat = useMemo(makeBeamMaterial, [])

  useEffect(
    () => () => {
      prismGeo.dispose()
      edgesGeo.dispose()
      fanGeo.dispose()
      beamGeo.dispose()
      fanMat.dispose()
      beamMat.dispose()
    },
    [prismGeo, edgesGeo, fanGeo, beamGeo, fanMat, beamMat],
  )

  // drag-to-rotate: pointerdown on the prism, move anywhere on screen
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - lastX.current
      lastX.current = e.clientX
      spin.current.rotation.z -= dx * 0.006
      vel.current = -dx * 0.006
    }
    const up = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = 'grab'
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    // the whole rig breathes
    float.current.position.set(x, y - 0.55 + Math.sin(t * 0.9) * 0.07, 0)
    // inertia after the user lets go + the slowest idle drift
    if (!dragging.current) {
      spin.current.rotation.z += vel.current + delta * 0.03
      vel.current = THREE.MathUtils.damp(vel.current, 0, 2.0, delta)
    }
    fanMat.uniforms.uTime.value = t
    // subtle scroll-reactive spread of the dispersion fan
    fanMat.uniforms.uSpread.value = 0.85 + scroll.offset * 1.6
    beamMat.uniforms.uTime.value = t
  })

  return (
    <group ref={float} position={[x, y - 0.55, 0]}>
      {/* white light in (fixed — only the prism + rainbow rotate) */}
      <mesh geometry={beamGeo} material={beamMat} position={[-3.45, 0.2, 0.05]} rotation={[0, 0, -0.07]} />

      <group ref={spin} rotation={[0, 0, Math.PI / 6]}>
        {/* glass prism */}
        <mesh
          geometry={prismGeo}
          onPointerDown={(e) => {
            e.stopPropagation()
            dragging.current = true
            lastX.current = e.clientX
            vel.current = 0
            document.body.style.cursor = 'grabbing'
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
          <meshPhysicalMaterial
            color="#ffffff"
            transmission={0.92}
            thickness={1.4}
            roughness={0.06}
            ior={1.5}
            clearcoat={1}
            clearcoatRoughness={0.12}
            flatShading
            transparent
          />
        </mesh>
        {/* ink edges — Swiss technical-drawing touch */}
        <lineSegments geometry={edgesGeo}>
          <lineBasicMaterial color={INK} transparent opacity={0.4} />
        </lineSegments>
        {/* the rainbow out — child of the spin group so it re-aims on drag */}
        <mesh geometry={fanGeo} material={fanMat} position={[0.5, 0.05, 0.04]} rotation={[0, 0, -0.14]} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Shards — floating glass fragments drifting through every section,   */
/* a few of them caught mid-tint by the spectrum.                      */
/* ------------------------------------------------------------------ */

type Shard = {
  pos: [number, number, number]
  scale: number
  speed: number
  seed: number
  tint: string
}

function Shards({ vw, vh }: { vw: number; vh: number }) {
  const group = useRef<THREE.Group>(null!)

  const shards = useMemo<Shard[]>(() => {
    const rng = (a: number, b: number) => a + Math.random() * (b - a)
    const arr: Shard[] = []
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const page = (i / 13) * (PAGES - 1)
      arr.push({
        // hug the page margins (shallow z keeps the projection from pulling
        // them inwards over the text columns)
        pos: [side * vw * rng(0.42, 0.5), -page * vh + rng(-1.4, 1.4), rng(-2.0, -1.0)],
        scale: rng(0.16, 0.42),
        speed: rng(0.2, 0.55),
        seed: rng(0, Math.PI * 2),
        tint: i % 4 === 0 ? SPECTRUM[i % 7] : '#ffffff',
      })
    }
    return arr
  }, [vw, vh])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current.children.forEach((c, i) => {
      const s = shards[i]
      c.rotation.x = t * s.speed + s.seed
      c.rotation.y = t * s.speed * 0.7 + s.seed
      c.position.y = s.pos[1] + Math.sin(t * 0.6 + s.seed) * 0.22
    })
  })

  return (
    <group ref={group}>
      {shards.map((s, i) => (
        <mesh key={i} position={s.pos} scale={s.scale}>
          <octahedronGeometry args={[1, 0]} />
          <meshPhysicalMaterial
            color={s.tint}
            transmission={0.9}
            thickness={0.7}
            roughness={0.12}
            ior={1.45}
            flatShading
            transparent
          />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* TriRing — a thin wireframe triangle slowly turning beside the       */
/* manifesto (a torus with 3 tubular segments IS a triangle).          */
/* ------------------------------------------------------------------ */

function TriRing({ position }: { position: [number, number, number] }) {
  const mesh = useRef<THREE.Mesh>(null!)

  useFrame((state, delta) => {
    mesh.current.rotation.z -= delta * 0.15
    mesh.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.35
  })

  return (
    <mesh ref={mesh} position={position}>
      <torusGeometry args={[1.9, 0.016, 6, 3]} />
      <meshBasicMaterial color={INK} transparent opacity={0.5} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* SpectrumBars — 7 floating colour bars beside the schedule, swaying  */
/* like a stacked timetable.                                           */
/* ------------------------------------------------------------------ */

function SpectrumBars({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current.children.forEach((c, i) => {
      c.position.x = i * 0.07 + Math.sin(t * 0.9 + i * 0.5) * 0.16
    })
  })

  return (
    <group ref={group} position={position} rotation={[0, 0, -0.16]}>
      {SPECTRUM.map((c, i) => (
        <mesh key={c} position={[i * 0.07, (3 - i) * 0.26, 0]}>
          <planeGeometry args={[2.3, 0.16]} />
          <meshBasicMaterial color={c} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* SpeakerFrame — 3D portrait frames with initials typography.         */
/* drei <Html> labels ignore fog/depth, so they fade with the scroll   */
/* and only exist while the Speakers section is on screen.             */
/* ------------------------------------------------------------------ */

function SpeakerFrame({
  position,
  initials,
  color,
}: {
  position: [number, number, number]
  initials: string
  color: string
}) {
  const group = useRef<THREE.Group>(null!)
  const label = useRef<HTMLDivElement>(null)
  const scroll = useScroll()
  const gl = useThree((s) => s.gl)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  const seed = useMemo(() => Math.random() * Math.PI * 2, [])
  // drei Html's default portal target inside ScrollControls is the SCROLLING
  // element, which drags labels off-screen by scrollTop. Portal into the
  // non-scrolling canvas wrapper instead.
  const htmlPortal = useMemo(
    () => ({ current: gl.domElement.parentNode as HTMLElement }),
    [gl.domElement],
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    group.current.position.y = position[1] + Math.sin(t * 0.8 + seed) * 0.09
    group.current.rotation.y = Math.sin(t * 0.5 + seed) * 0.14
    easing.damp3(group.current.scale, hovered ? 1.14 : 1, 0.16, delta)

    // HTML labels ignore fog/depth — only show them while the Speakers
    // section (page 3) is on screen, fading in/out with the scroll.
    if (label.current) {
      const sec = scroll.offset * (PAGES - 1)
      const visibility = Math.max(0, 1 - Math.abs(sec - 3) * 1.7)
      label.current.style.opacity = visibility.toFixed(3)
      label.current.style.display = visibility < 0.04 ? 'none' : ''
    }
  })

  return (
    <group
      ref={group}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* ink mat behind the card */}
      <RoundedBox args={[1.26, 1.56, 0.05]} radius={0.03} smoothness={3} position={[0, 0, -0.04]}>
        <meshStandardMaterial color={INK} roughness={0.7} />
      </RoundedBox>
      {/* paper card */}
      <RoundedBox args={[1.14, 1.44, 0.08]} radius={0.03} smoothness={3}>
        <meshStandardMaterial color="#fffdf8" roughness={0.55} />
      </RoundedBox>
      {/* spectral strip — "their" colour */}
      <mesh position={[0, -0.6, 0.06]}>
        <planeGeometry args={[1.14, 0.13]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* initials typography */}
      <Html
        center
        position={[0, 0.06, 0.1]}
        className="frame-html"
        zIndexRange={[20, 0]}
        portal={htmlPortal}
      >
        <div
          ref={label}
          className={`frame-label ${hovered ? 'frame-label--hot' : ''}`}
          style={{ opacity: 0, display: 'none', ['--sp' as string]: color }}
        >
          {initials}
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* StageArch — wireframe stage arch for the venue section.             */
/* ------------------------------------------------------------------ */

function StageArch({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null!)

  useFrame((state) => {
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.3 - 0.2
  })

  return (
    <group ref={group} position={position}>
      <mesh>
        <torusGeometry args={[2.1, 0.05, 6, 48, Math.PI]} />
        <meshBasicMaterial color={INK} wireframe transparent opacity={0.4} />
      </mesh>
      <mesh position={[-2.1, -1.2, 0]}>
        <boxGeometry args={[0.12, 2.4, 0.12]} />
        <meshBasicMaterial color={INK} wireframe transparent opacity={0.4} />
      </mesh>
      <mesh position={[2.1, -1.2, 0]}>
        <boxGeometry args={[0.12, 2.4, 0.12]} />
        <meshBasicMaterial color={INK} wireframe transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, -2.42, 0]}>
        <cylinderGeometry args={[2.9, 2.9, 0.08, 24]} />
        <meshBasicMaterial color={INK} wireframe transparent opacity={0.16} />
      </mesh>
      {/* a single spectral marker at the apex */}
      <mesh position={[0, 2.28, 0]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshBasicMaterial color="#1f8fde" />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* TicketTotems — three small spinning prisms, one per tier.           */
/* ------------------------------------------------------------------ */

const TIER_COLORS = ['#3aa655', '#1f8fde', '#7b2fbe']

function TicketTotems({ position, vw }: { position: [number, number, number]; vw: number }) {
  const group = useRef<THREE.Group>(null!)
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 3, 1)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    group.current.children.forEach((c, i) => {
      c.rotation.z += delta * (0.4 + i * 0.14)
      c.position.y = Math.sin(t * 0.8 + i * 1.7) * 0.12
    })
  })

  return (
    <group ref={group} position={position}>
      {TIER_COLORS.map((c, i) => (
        // deep + small: background accents that never sit on the headline
        <mesh key={c} geometry={geo} position={[(i - 1) * vw * 0.34, 0.4, -6.5]}>
          <meshStandardMaterial color={c} roughness={0.35} metalness={0.15} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — camera rig travelling down the paper, lights,     */
/* every section's 3D furniture, and gentle post FX.                   */
/* ------------------------------------------------------------------ */

const FRAME_SPEAKERS = [
  { initials: 'MV', color: '#e0312b' },
  { initials: 'JP', color: '#f07d1d' },
  { initials: 'AT', color: '#f2b705' },
  { initials: 'RB', color: '#3aa655' },
  { initials: 'LO', color: '#1f8fde' },
  { initials: 'TI', color: '#3b4bc8' },
  { initials: 'PR', color: '#7b2fbe' },
  { initials: 'SL', color: '#c52b8e' },
]

export default function Experience() {
  const scroll = useScroll()
  const vh = useThree((s) => s.viewport.height)
  const vw = useThree((s) => s.viewport.width)

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    const o = scroll.offset
    const y = -o * vh * (PAGES - 1)
    // travel down the paper + gentle mouse parallax
    easing.damp3(state.camera.position, [state.pointer.x * 0.55, y - state.pointer.y * 0.3, 10], 0.26, delta)
    state.camera.lookAt(0, y, 0)
    // feed the DOM progress bar
    document.documentElement.style.setProperty('--scroll', o.toFixed(4))
  })

  const Y = (i: number) => -i * vh

  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight position={[5, 8, 6]} intensity={1.3} />
      <directionalLight position={[-6, -3, 4]} intensity={0.35} color="#dfe6ff" />

      {/* 0 — hero: the draggable prism */}
      <PrismRig x={vw * 0.08} y={Y(0)} />

      {/* glass fragments throughout the journey */}
      <Shards vw={vw} vh={vh} />

      {/* 1 — manifesto */}
      <TriRing position={[vw * 0.27, Y(1) + 0.2, -1.2]} />

      {/* 2 — schedule */}
      <SpectrumBars position={[vw * 0.36, Y(2) - 1.1, -2]} />

      {/* 3 — speakers: 3D frames with initials, four per side */}
      {FRAME_SPEAKERS.map((s, i) => {
        const side = i < 4 ? -1 : 1
        const row = i % 4
        const stagger = row % 2 === 0 ? 0 : side * vw * 0.06
        return (
          <SpeakerFrame
            key={s.initials}
            position={[side * vw * 0.5 + stagger, Y(3) + 2.4 - row * 1.75, -2.2]}
            initials={s.initials}
            color={s.color}
          />
        )
      })}

      {/* 5 — venue: wireframe stage arch */}
      <StageArch position={[vw * 0.26, Y(5) + 0.55, -0.8]} />

      {/* 6 — tickets: a totem per tier */}
      <TicketTotems position={[0, Y(6) + 3.1, 0]} vw={vw} />

      <EffectComposer>
        <Noise opacity={0.05} />
        <Vignette offset={0.32} darkness={0.22} />
      </EffectComposer>
    </>
  )
}
