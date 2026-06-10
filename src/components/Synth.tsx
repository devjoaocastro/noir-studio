import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, RoundedBox, useCursor, useScroll } from '@react-three/drei'
import { easing } from '../lib/easing'
import { PAGES } from '../scrollBus'
import { NOTE_NAMES, getCutoff, notePulse, playNote, setCutoff } from '../lib/audio'

/* Panel geometry (synth-group local units) ------------------------- */

export const SYNTH_POS: [number, number, number] = [0, 0.9, 0]
export const SYNTH_TILT = 0.5

const PANEL_W = 7
const PANEL_T = 0.5
const PANEL_D = 3.4
const TOP_Y = PANEL_T / 2

const KEY_W = 0.56
const KEY_H = 0.22
const KEY_D = 1.0
const KEY_Z = 0.92
const KEY_Y = TOP_Y + KEY_H / 2 + 0.02

const keyX = (i: number) => -2.45 + i * 0.7

/* ------------------------------------------------------------------ */
/* Key — a white box that depresses and PLAYS A REAL TONE on click.    */
/* ------------------------------------------------------------------ */

function Key({ index }: { index: number }) {
  const mesh = useRef<THREE.Mesh>(null!)
  const mat = useRef<THREE.MeshStandardMaterial>(null!)
  const [hovered, setHovered] = useState(false)
  const pressed = useRef(0)
  useCursor(hovered)

  useFrame((_, delta) => {
    pressed.current = Math.max(0, pressed.current - delta * 5)
    mesh.current.position.y = KEY_Y - pressed.current * 0.1
    const glow = pressed.current * 0.9 + (hovered ? 0.12 : 0)
    mat.current.emissive.setRGB(1, 0.33, 0)
    mat.current.emissiveIntensity = glow
  })

  return (
    <mesh
      ref={mesh}
      position={[keyX(index), KEY_Y, KEY_Z]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onPointerDown={(e) => {
        e.stopPropagation()
        pressed.current = 1
        playNote(index)
      }}
    >
      <boxGeometry args={[KEY_W, KEY_H, KEY_D]} />
      <meshStandardMaterial ref={mat} color="#f7f3ea" roughness={0.45} metalness={0.05} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Knob — DRAGGABLE cylinder: vertical drag rotates the cap and feeds  */
/* a 0..1 value (waveform morph / filter cutoff).                      */
/* ------------------------------------------------------------------ */

function Knob({
  x,
  z,
  color,
  label,
  value,
  onChange,
}: {
  x: number
  z: number
  color: string
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const cap = useRef<THREE.Group>(null!)
  const labelEl = useRef<HTMLDivElement>(null)
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)
  const drag = useRef<{ y: number; v: number } | null>(null)
  useCursor(hovered, 'ns-resize')

  useFrame((_, delta) => {
    // 270° sweep, 7-o'clock to 5-o'clock
    const target = THREE.MathUtils.lerp(2.36, -2.36, value)
    easing.damp(cap.current.rotation, 'y', target, 0.12, delta)
    const s = hovered || drag.current ? 1.12 : 1
    easing.damp3(cap.current.scale, s, 0.15, delta)

    // HTML labels ignore fog/depth — only show them while the hero (page 0)
    // or the playground close-up (page 3) is on screen, fading with the scroll.
    if (labelEl.current) {
      const sec = scroll.offset * (PAGES - 1)
      const visibility = Math.max(0, 1 - Math.abs(sec - 0) * 1.5, 1 - Math.abs(sec - 3) * 1.5)
      labelEl.current.style.opacity = visibility.toFixed(3)
      labelEl.current.style.display = visibility < 0.04 ? 'none' : ''
    }
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as unknown as Element).setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, v: value }
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    e.stopPropagation()
    const dv = (drag.current.y - e.clientY) / 140
    onChange(THREE.MathUtils.clamp(drag.current.v + dv, 0, 1))
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    drag.current = null
    ;(e.target as unknown as Element).releasePointerCapture(e.pointerId)
  }

  return (
    <group position={[x, TOP_Y, z]}>
      {/* base ring */}
      <mesh position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.42, 0.44, 0.05, 32]} />
        <meshStandardMaterial color="#1c1c20" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* draggable cap */}
      <group ref={cap} position={[0, 0.19, 0]}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => setHovered(false)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <cylinderGeometry args={[0.32, 0.34, 0.26, 32]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.2} />
        </mesh>
        {/* indicator notch */}
        <mesh position={[0, 0.135, -0.21]}>
          <boxGeometry args={[0.05, 0.02, 0.2]} />
          <meshBasicMaterial color="#f7f3ea" toneMapped={false} />
        </mesh>
      </group>
      {/* floating label */}
      <Html center position={[0, 0.85, 0]} className="knob-html" zIndexRange={[20, 0]}>
        <div ref={labelEl} className="knob-label" style={{ opacity: 0, display: 'none' }}>
          <strong>{label}</strong>
          <span>drag ↕</span>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Oscilloscope — custom GLSL ShaderMaterial drawing an animated       */
/* waveform that MORPHS sine→saw via the uMorph uniform (MORPH knob).  */
/* ------------------------------------------------------------------ */

const SCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SCREEN_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uMorph;
  uniform float uPulse;

  float wave(float x) {
    float ph = x * 2.5 - uTime * 0.9;
    float sine = sin(ph * 6.28318);
    float saw = 2.0 * fract(ph) - 1.0;
    return mix(sine, saw, uMorph);
  }

  void main() {
    vec3 green = vec3(0.29, 0.98, 0.43);
    vec3 col = vec3(0.012, 0.05, 0.025); // phosphor background

    // graticule
    vec2 g = abs(fract(vUv * vec2(12.0, 6.0)) - 0.5);
    float grid = smoothstep(0.45, 0.5, max(g.x, g.y));
    col += grid * vec3(0.05, 0.18, 0.09);

    // waveform trace with glow
    float amp = 0.24 + uPulse * 0.13;
    float y = 0.5 + wave(vUv.x) * amp;
    float d = abs(vUv.y - y);
    float core = smoothstep(0.02, 0.0, d);
    float glow = smoothstep(0.18, 0.0, d);
    col += core * green * 1.8;
    col += glow * green * (0.35 + uPulse * 0.75);

    // scanlines + vignette
    col *= 0.9 + 0.1 * sin(vUv.y * 220.0 + uTime * 14.0);
    col *= smoothstep(1.08, 0.42, length(vUv - 0.5));

    gl_FragColor = vec4(col, 1.0);
  }
`

function Oscilloscope({ morph }: { morph: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uMorph: { value: 0 },
          uPulse: { value: 0 },
        },
        vertexShader: SCREEN_VERT,
        fragmentShader: SCREEN_FRAG,
      }),
    [],
  )

  useFrame((state, delta) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uMorph.value = THREE.MathUtils.damp(
      material.uniforms.uMorph.value,
      morph,
      6,
      delta,
    )
    material.uniforms.uPulse.value = notePulse()
  })

  return (
    <group position={[-1.55, TOP_Y, -0.72]}>
      {/* bezel */}
      <RoundedBox args={[2.85, 0.1, 1.6]} radius={0.04} smoothness={4} position={[0, 0.02, 0]}>
        <meshStandardMaterial color="#1c1c20" roughness={0.55} metalness={0.3} />
      </RoundedBox>
      {/* phosphor screen */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.35]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Cable spaghetti — catenary lines between panel jacks + speaker.     */
/* ------------------------------------------------------------------ */

function catenary(a: THREE.Vector3, b: THREE.Vector3, sag: number, segs = 28) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const p = new THREE.Vector3().lerpVectors(a, b, t)
    p.y -= Math.sin(Math.PI * t) * sag
    pts.push(p)
  }
  return pts
}

const JACK_XS = [-3.05, -0.15, 0.65, 3.05]
const JACK_Z = -1.48

function Jacks() {
  return (
    <group>
      {JACK_XS.map((x) => (
        <group key={x} position={[x, TOP_Y, JACK_Z]}>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.08, 16]} />
            <meshStandardMaterial color="#26262b" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.085, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 12]} />
            <meshBasicMaterial color="#0a0a0c" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function PanelCables() {
  const cables = useMemo(() => {
    const j = (i: number) => new THREE.Vector3(JACK_XS[i], TOP_Y + 0.08, JACK_Z)
    return [
      { pts: catenary(j(0), j(2), 1.0), color: '#ff5500' },
      { pts: catenary(j(1), j(3), 0.7), color: '#4afa6e' },
      { pts: catenary(j(0), j(3), 1.5), color: '#e8e2d6' },
    ]
  }, [])

  return (
    <group>
      {cables.map((c, i) => (
        <Line key={i} points={c.pts} color={c.color} lineWidth={2.5} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Speaker — floating cube that PULSES when notes play.                */
/* ------------------------------------------------------------------ */

const SPEAKER_POS = new THREE.Vector3(4.5, 1.7, -1.2)

function Speaker() {
  const group = useRef<THREE.Group>(null!)
  const grill = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const p = notePulse()
    group.current.scale.setScalar(1 + p * 0.22)
    group.current.position.y = SPEAKER_POS.y + Math.sin(t * 1.1) * 0.12
    group.current.rotation.y = Math.sin(t * 0.4) * 0.3 - 0.5
    grill.current.color.setRGB(1, 0.33 + p * 0.5, p * 0.35)
  })

  return (
    <group ref={group} position={SPEAKER_POS.toArray()}>
      <RoundedBox args={[1.15, 1.15, 1.15]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color="#1c1c20" roughness={0.5} metalness={0.35} />
      </RoundedBox>
      {/* grill cone */}
      <mesh position={[0, 0, 0.59]}>
        <cylinderGeometry args={[0.38, 0.38, 0.04, 32]} />
        <meshBasicMaterial ref={grill} color="#ff5500" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.025, 12, 40]} />
        <meshStandardMaterial color="#e8e2d6" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  )
}

/* Speaker feed cable, world space: panel jack → floating cube.        */

function SpeakerCable() {
  const pts = useMemo(() => {
    const jackLocal = new THREE.Vector3(JACK_XS[3], TOP_Y + 0.08, JACK_Z)
    jackLocal.applyEuler(new THREE.Euler(SYNTH_TILT, 0, 0))
    jackLocal.add(new THREE.Vector3(...SYNTH_POS))
    return catenary(jackLocal, SPEAKER_POS.clone().add(new THREE.Vector3(-0.2, -0.5, 0.2)), 0.9)
  }, [])

  return <Line points={pts} color="#ff5500" lineWidth={2.5} />
}

/* ------------------------------------------------------------------ */
/* Synth root — cream panel, 8 keys, 2 knobs, scope, jacks, cables.    */
/* ------------------------------------------------------------------ */

export default function Synth() {
  const [morph, setMorph] = useState(0)
  const [cutoff, setCutoffState] = useState(getCutoff())

  return (
    <group>
      <group position={SYNTH_POS} rotation={[SYNTH_TILT, 0, 0]}>
        {/* cream panel body */}
        <RoundedBox args={[PANEL_W, PANEL_T, PANEL_D]} radius={0.07} smoothness={4}>
          <meshStandardMaterial color="#e8e2d6" roughness={0.55} metalness={0.05} />
        </RoundedBox>
        {/* signal-orange accent strip on the front edge */}
        <mesh position={[0, 0, PANEL_D / 2 + 0.005]}>
          <boxGeometry args={[PANEL_W - 0.3, 0.1, 0.02]} />
          <meshBasicMaterial color="#ff5500" toneMapped={false} />
        </mesh>

        {NOTE_NAMES.map((_, i) => (
          <Key key={i} index={i} />
        ))}

        <Knob x={1.7} z={-0.72} color="#ff5500" label="MORPH" value={morph} onChange={setMorph} />
        <Knob
          x={2.75}
          z={-0.72}
          color="#26262b"
          label="CUTOFF"
          value={cutoff}
          onChange={(v) => {
            setCutoffState(v)
            setCutoff(v)
          }}
        />

        <Oscilloscope morph={morph} />
        <Jacks />
        <PanelCables />
      </group>

      <Speaker />
      <SpeakerCable />

      {/* fake contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.4]}>
        <circleGeometry args={[4.4, 48]} />
        <meshBasicMaterial color="#0b0b0d" transparent opacity={0.55} />
      </mesh>
    </group>
  )
}
