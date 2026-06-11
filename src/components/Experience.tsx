import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox, Sparkles, useCursor, useScroll } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import { PAGES, setScrollEl } from '../scrollBus'
import { ROOMS, setActiveRoom, setCarouselRotator } from '../roomBus'

/* ------------------------------------------------------------------ */
/* CityBokeh — Lisbon at dusk: instanced emissive dots scattered on    */
/* the hillside below, in brass / rose / linen warmth.                 */
/* ------------------------------------------------------------------ */

const BOKEH_COUNT = 340

function CityBokeh() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const dots = useMemo(() => {
    const rng = (a: number, b: number) => a + Math.random() * (b - a)
    return Array.from({ length: BOKEH_COUNT }, () => ({
      x: rng(-26, 26),
      y: rng(-7.5, -0.5) + Math.pow(Math.random(), 2) * 3,
      z: rng(-30, -14),
      s: rng(0.04, 0.16),
      tw: rng(0.4, 2.2),
      ph: rng(0, Math.PI * 2),
    }))
  }, [])

  useEffect(() => {
    const c = new THREE.Color()
    const palette = ['#e8b46a', '#c97b8e', '#f1ebe2', '#d99a6c']
    dots.forEach((_, i) => {
      c.set(palette[i % palette.length])
      c.multiplyScalar(0.7 + Math.random() * 0.5)
      mesh.current.setColorAt(i, c)
    })
    mesh.current.instanceColor!.needsUpdate = true
  }, [dots])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    dots.forEach((d, i) => {
      const tw = 0.75 + Math.sin(t * d.tw + d.ph) * 0.25
      dummy.position.set(d.x, d.y, d.z)
      dummy.scale.setScalar(d.s * tw)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BOKEH_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/* Curtain — full-width velvet plane with a custom GLSL ShaderMaterial */
/* Vertex: travelling fold waves + a parting displacement (uOpen)      */
/* that bunches each half toward the wings.                            */
/* Fragment: velvet body with a moving brass-rose sheen along folds.   */
/* ------------------------------------------------------------------ */

const CURTAIN_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uOpen;
  varying vec2 vUv;
  varying float vWave;
  varying float vBunch;

  void main() {
    vUv = uv;
    vec3 p = position;

    float halfW = 8.0;
    float nx = clamp(abs(p.x) / halfW, 0.0, 1.0);

    // parting: as uOpen rises, every point slides toward its wing and
    // the fabric bunches (fold frequency rises where it compresses)
    float parted = pow(nx, mix(1.0, 0.16, uOpen));
    float bunch = uOpen * (1.0 - nx);
    p.x = sign(p.x) * parted * halfW;

    // travelling velvet folds — deeper near the hem, denser when bunched
    float freq = mix(2.2, 6.5, bunch);
    float wave =
      sin(p.x * freq + uTime * 0.7) * 0.55 +
      sin(p.x * freq * 2.3 - uTime * 0.45 + uv.y * 3.0) * 0.25;
    float hem = mix(0.35, 1.0, 1.0 - uv.y);
    p.z += wave * 0.34 * hem * (0.45 + bunch * 0.9);

    // hem sways gently
    p.x += sin(uTime * 0.5 + uv.y * 2.0) * 0.05 * (1.0 - uv.y);

    vWave = wave;
    vBunch = bunch;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const CURTAIN_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  varying vec2 vUv;
  varying float vWave;
  varying float vBunch;

  void main() {
    vec3 velvet = vec3(0.165, 0.075, 0.19);   // midnight velvet
    vec3 rose   = vec3(0.788, 0.482, 0.557);  // rose dusk
    vec3 brass  = vec3(0.788, 0.639, 0.416);  // brass

    // fold sheen: highlights ride the crests of the wave
    float sheen = smoothstep(0.25, 0.95, vWave * 0.5 + 0.5);
    vec3 col = mix(velvet, rose * 0.55, sheen * 0.65);

    // brass rim light grazing from above
    float rim = pow(vUv.y, 3.0) * 0.55;
    col += brass * rim * (0.35 + sheen * 0.5);

    // darker, heavier hem
    col *= mix(0.55, 1.05, vUv.y);

    // bunched fabric catches more light
    col += rose * vBunch * 0.12;

    // slow breathing shimmer
    col *= 0.95 + 0.05 * sin(uTime * 0.8 + vUv.x * 8.0);

    gl_FragColor = vec4(col, uFade);
  }
`

function Curtain() {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const mesh = useRef<THREE.Mesh>(null!)
  const scroll = useScroll()

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpen: { value: 0 },
      uFade: { value: 0 },
    }),
    [],
  )

  useFrame((state, delta) => {
    const s = scroll.offset * (PAGES - 1)
    uniforms.uTime.value = state.clock.elapsedTime
    const open = THREE.MathUtils.smoothstep(s, 1.35, 2.05)
    const fade =
      THREE.MathUtils.smoothstep(s, 0.55, 1.05) * (1 - THREE.MathUtils.smoothstep(s, 2.55, 3.15))
    easing.damp(uniforms.uOpen, 'value', open, 0.25, delta)
    easing.damp(uniforms.uFade, 'value', fade, 0.2, delta)
    mesh.current.visible = uniforms.uFade.value > 0.01
  })

  return (
    <mesh ref={mesh} position={[0, 0.4, 4.4]}>
      <planeGeometry args={[16, 9.5, 160, 36]} />
      <shaderMaterial
        ref={mat}
        vertexShader={CURTAIN_VERT}
        fragmentShader={CURTAIN_FRAG}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* RoomDiorama — an open-faced miniature hotel room: floor, walls,     */
/* bed, glowing lamp and a dusk-lit window.                            */
/* ------------------------------------------------------------------ */

function RoomDiorama({ accent, tall }: { accent: string; tall?: boolean }) {
  const h = tall ? 2.5 : 1.9
  return (
    <group>
      {/* shell */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[2.5, 0.1, 1.9]} />
        <meshStandardMaterial color="#241a2e" roughness={0.85} />
      </mesh>
      <mesh position={[0, h / 2, -0.9]}>
        <boxGeometry args={[2.5, h, 0.08]} />
        <meshStandardMaterial color="#2c2038" roughness={0.9} />
      </mesh>
      <mesh position={[-1.21, h / 2, 0]}>
        <boxGeometry args={[0.08, h, 1.9]} />
        <meshStandardMaterial color="#271c33" roughness={0.9} />
      </mesh>
      <mesh position={[1.21, h / 2, 0]}>
        <boxGeometry args={[0.08, h, 1.9]} />
        <meshStandardMaterial color="#271c33" roughness={0.9} />
      </mesh>
      <mesh position={[0, h + 0.02, 0]}>
        <boxGeometry args={[2.5, 0.08, 1.9]} />
        <meshStandardMaterial color="#241a2e" roughness={0.9} />
      </mesh>

      {/* dusk window on the back wall */}
      <mesh position={[0.55, h * 0.55, -0.85]}>
        <planeGeometry args={[0.7, tall ? 1.3 : 0.9]} />
        <meshBasicMaterial color="#e89a7a" toneMapped={false} />
      </mesh>
      <mesh position={[0.55, h * 0.55, -0.84]}>
        <planeGeometry args={[0.06, tall ? 1.3 : 0.9]} />
        <meshStandardMaterial color="#1a1224" />
      </mesh>

      {/* bed */}
      <RoundedBox args={[1.3, 0.32, 1.0]} radius={0.06} smoothness={3} position={[-0.45, 0.22, 0.15]}>
        <meshStandardMaterial color={accent} roughness={0.65} />
      </RoundedBox>
      <RoundedBox args={[1.26, 0.12, 0.34]} radius={0.05} smoothness={3} position={[-0.45, 0.44, -0.18]}>
        <meshStandardMaterial color="#f1ebe2" roughness={0.6} />
      </RoundedBox>
      <mesh position={[-0.45, 0.55, -0.42]}>
        <boxGeometry args={[1.34, 0.7, 0.07]} />
        <meshStandardMaterial color="#3a2a48" roughness={0.8} />
      </mesh>

      {/* bedside lamp — the warm soul of the room */}
      <mesh position={[0.55, 0.32, 0.35]}>
        <cylinderGeometry args={[0.035, 0.05, 0.42, 10]} />
        <meshStandardMaterial color="#c9a36a" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0.55, 0.6, 0.35]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </mesh>
      <pointLight position={[0.55, 0.62, 0.4]} intensity={2.2} distance={3.2} color="#ffc98a" />

      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.25, 0.011, 0.45]}>
        <circleGeometry args={[0.42, 24]} />
        <meshStandardMaterial color={accent} roughness={0.95} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* RoomCarousel — the DRAGGABLE platter: three dioramas at 120°,       */
/* horizontal drag spins it with inertia, snaps to the nearest room    */
/* and publishes the front-facing room to the DOM via roomBus.         */
/* ------------------------------------------------------------------ */

const STEP = (Math.PI * 2) / 3

function RoomCarousel() {
  const platter = useRef<THREE.Group>(null!)
  const wrap = useRef<THREE.Group>(null!)
  const labels = useRef<(HTMLDivElement | null)[]>([])
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)

  const drag = useRef({
    active: false,
    startX: 0,
    startRot: 0,
    rot: 0,
    vel: 0,
    target: 0,
    snapping: true,
    lastIndex: 0,
  })

  useCursor(hovered, 'grab')

  useEffect(() => {
    // DOM card arrows → spin the platter
    setCarouselRotator((index: number) => {
      const d = drag.current
      // choose the closest equivalent angle for a short spin
      const want = -index * STEP
      const twoPi = Math.PI * 2
      let t = want
      while (t < d.rot - Math.PI) t += twoPi
      while (t > d.rot + Math.PI) t -= twoPi
      d.target = t
      d.snapping = true
    })
    return () => setCarouselRotator(null)
  }, [])

  useFrame((state, delta) => {
    const d = drag.current
    const s = scroll.offset * (PAGES - 1)

    // the carousel takes the stage around the Rooms section (page 2)
    const vis = Math.max(0, 1 - Math.abs(s - 2) * 0.95)
    const scale = THREE.MathUtils.smoothstep(vis, 0.05, 0.85)
    easing.damp3(wrap.current.scale, Math.max(0.001, scale), 0.25, delta)
    wrap.current.visible = scale > 0.002
    wrap.current.position.y = -1.15 + (1 - scale) * -1.4

    if (!d.active) {
      if (d.snapping) {
        d.rot = THREE.MathUtils.damp(d.rot, d.target, 6, delta)
      } else {
        // inertia, then snap to nearest room
        d.rot += d.vel * delta
        d.vel = THREE.MathUtils.damp(d.vel, 0, 4, delta)
        if (Math.abs(d.vel) < 0.35) {
          d.target = Math.round(d.rot / STEP) * STEP
          d.snapping = true
        }
      }
    }
    platter.current.rotation.y = d.rot

    // publish the front-facing room
    const idx = ((Math.round(-d.rot / STEP) % 3) + 3) % 3
    if (idx !== d.lastIndex) {
      d.lastIndex = idx
      setActiveRoom(idx)
    }

    // gentle idle float
    wrap.current.position.x = state.pointer.x * 0.12
    wrap.current.rotation.x = -0.06 + state.pointer.y * -0.02

    // drei <Html> labels ignore fog/scale — fade them with the section
    labels.current.forEach((el, i) => {
      if (!el) return
      const rel = ((i * STEP + d.rot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
      const facing = Math.cos(rel) * 0.5 + 0.5 // 1 when facing camera
      const o = vis * Math.max(0, facing * 2 - 1)
      el.style.opacity = o.toFixed(3)
      el.style.display = o < 0.04 ? 'none' : ''
    })
  })

  const endDrag = () => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (Math.abs(d.vel) < 0.35) {
      d.target = Math.round(d.rot / STEP) * STEP
      d.snapping = true
    }
  }

  // safety net: never leave the platter stuck in "dragging" if the
  // pointer is released outside the carousel hit area
  useEffect(() => {
    const up = () => endDrag()
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDown = (e: any) => {
    e.stopPropagation()
    const d = drag.current
    d.active = true
    d.snapping = false
    d.startX = e.clientX
    d.startRot = d.rot
    d.vel = 0
    document.body.style.cursor = 'grabbing'
    // body has user-select:none; clear any pre-existing selection too
    document.body.style.userSelect = 'none'
    window.getSelection?.()?.removeAllRanges?.()
    // R3F-managed capture: move/up keep flowing to this mesh even when
    // the pointer leaves its silhouette mid-drag
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onMove = (e: any) => {
    const d = drag.current
    if (!d.active) return
    e.stopPropagation()
    const dx = e.clientX - d.startX
    const next = d.startRot + dx * 0.011
    d.vel = THREE.MathUtils.clamp((next - d.rot) * 60, -9, 9)
    d.rot = next
  }

  const onUp = (e: any) => {
    if (!drag.current.active) return
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    endDrag()
    document.body.style.cursor = hovered ? 'grab' : ''
  }

  const accents = ['#c97b8e', '#c9a36a', '#8e6aa8']

  return (
    <group ref={wrap} position={[0, -1.15, 0]}>
      {/* invisible drag skirt so grabs land anywhere on the stage */}
      <mesh
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        position={[0, 1.2, 0]}
        visible={false}
      >
        <cylinderGeometry args={[3.6, 3.6, 3.4, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={platter}>
        {/* brass-rimmed velvet platter */}
        <mesh position={[0, -0.14, 0]}>
          <cylinderGeometry args={[3.1, 3.25, 0.18, 64]} />
          <meshStandardMaterial color="#211531" roughness={0.7} metalness={0.2} />
        </mesh>
        <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.12, 0.025, 12, 90]} />
          <meshStandardMaterial color="#c9a36a" metalness={0.9} roughness={0.25} />
        </mesh>

        {ROOMS.map((room, i) => {
          const a = i * STEP
          return (
            <group
              key={room.id}
              position={[Math.sin(a) * 1.95, 0, Math.cos(a) * 1.95]}
              rotation={[0, a, 0]}
            >
              <RoomDiorama accent={accents[i]} tall={i === 2} />
              <Html center position={[0, i === 2 ? 3.1 : 2.5, 0]} className="room-html" zIndexRange={[20, 0]}>
                <div
                  ref={(el) => {
                    labels.current[i] = el
                  }}
                  className="room-tag"
                  style={{ opacity: 0, display: 'none' }}
                >
                  <strong>{room.name}</strong>
                  <span>€{room.price} / night</span>
                </div>
              </Html>
            </group>
          )
        })}
      </group>

      {/* stage spotlight */}
      <pointLight position={[0, 4.4, 2.4]} intensity={26} distance={12} color="#e8c2a0" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* BrassKey — dangles from a chain, swings like a pendulum, and spins  */
/* when clicked.                                                       */
/* ------------------------------------------------------------------ */

function BrassKey() {
  const hang = useRef<THREE.Group>(null!)
  const key = useRef<THREE.Group>(null!)
  const wrap = useRef<THREE.Group>(null!)
  const spinVel = useRef(0)
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const s = scroll.offset * (PAGES - 1)

    // pendulum swing, livelier on hover
    const amp = hovered ? 0.34 : 0.2
    hang.current.rotation.z = Math.sin(t * 1.35) * amp + Math.sin(t * 2.1) * 0.04

    // click-spin with decay
    key.current.rotation.y += spinVel.current * delta
    spinVel.current = THREE.MathUtils.damp(spinVel.current, 0, 1.6, delta)

    // present at the hero, bows out as the story begins
    const vis = Math.max(0, 1 - Math.max(0, s - 0.35) * 1.5)
    easing.damp3(wrap.current.scale, Math.max(0.001, vis), 0.25, delta)
    wrap.current.visible = vis > 0.002
  })

  return (
    <group ref={wrap} position={[3.4, 2.6, 4.5]}>
      <group ref={hang}>
        {/* chain */}
        <mesh position={[0, -0.85, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 1.7, 6]} />
          <meshStandardMaterial color="#c9a36a" metalness={0.9} roughness={0.35} />
        </mesh>
        <group
          ref={key}
          position={[0, -1.95, 0]}
          onClick={(e) => {
            e.stopPropagation()
            spinVel.current += 14
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => setHovered(false)}
        >
          {/* bow */}
          <mesh position={[0, 0.32, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.22, 0.05, 12, 32]} />
            <meshStandardMaterial color="#c9a36a" metalness={0.95} roughness={0.22} />
          </mesh>
          {/* shaft */}
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.78, 10]} />
            <meshStandardMaterial color="#c9a36a" metalness={0.95} roughness={0.22} />
          </mesh>
          {/* teeth */}
          <mesh position={[0.1, -0.46, 0]}>
            <boxGeometry args={[0.16, 0.07, 0.06]} />
            <meshStandardMaterial color="#c9a36a" metalness={0.95} roughness={0.22} />
          </mesh>
          <mesh position={[0.08, -0.32, 0]}>
            <boxGeometry args={[0.12, 0.06, 0.06]} />
            <meshStandardMaterial color="#c9a36a" metalness={0.95} roughness={0.22} />
          </mesh>
          {/* room-number fob glint */}
          <mesh position={[0, 0.32, 0.001]}>
            <circleGeometry args={[0.1, 20]} />
            <meshBasicMaterial color={hovered ? '#ffe3ad' : '#e8c285'} toneMapped={false} />
          </mesh>
        </group>
      </group>
      <pointLight position={[0, -1.6, 0.8]} intensity={hovered ? 7 : 3} distance={5} color="#e8c285" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Moon — a soft rose moon that climbs as you descend the page         */
/* ------------------------------------------------------------------ */

function Moon() {
  const moon = useRef<THREE.Mesh>(null!)
  const scroll = useScroll()

  useFrame(() => {
    const o = scroll.offset
    moon.current.position.y = 2.5 + o * 5.5
    moon.current.position.x = 8 - o * 4
  })

  return (
    <mesh ref={moon} position={[8, 2.5, -24]}>
      <sphereGeometry args={[1.7, 40, 40]} />
      <meshBasicMaterial color="#e8b4c0" toneMapped={false} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — dusk lights, camera drift, post FX                */
/* ------------------------------------------------------------------ */

export default function Experience() {
  const scroll = useScroll()

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    const o = scroll.offset
    const s = o * (PAGES - 1)

    // slow descent down the hillside with mouse parallax
    easing.damp3(
      state.camera.position,
      [state.pointer.x * 0.7, 0.6 - s * 0.12 - state.pointer.y * 0.3, 10 - Math.sin(s * 0.5) * 0.6],
      0.35,
      delta,
    )
    state.camera.lookAt(state.pointer.x * 0.5, 0.1 - s * 0.1, 0)

    document.documentElement.style.setProperty('--scroll', o.toFixed(4))
  })

  return (
    <>
      <ambientLight intensity={0.35} color="#5a4468" />
      <directionalLight position={[-6, 8, 6]} intensity={0.8} color="#c97b8e" />
      <directionalLight position={[8, 3, -4]} intensity={0.4} color="#c9a36a" />

      {/* warm dust motes drifting through the dusk */}
      <Sparkles count={140} scale={[18, 10, 12]} size={2.6} speed={0.25} opacity={0.5} color="#e8c285" />
      <Sparkles count={60} scale={[10, 6, 8]} size={4} speed={0.16} opacity={0.35} color="#c97b8e" />

      <CityBokeh />
      <Moon />
      <BrassKey />
      <Curtain />
      <RoomCarousel />

      <EffectComposer>
        <Bloom intensity={0.85} luminanceThreshold={0.32} luminanceSmoothing={0.75} mipmapBlur />
        <Noise opacity={0.05} />
        <Vignette offset={0.18} darkness={0.85} />
      </EffectComposer>
    </>
  )
}
