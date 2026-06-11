import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, Sparkles, Stars, useCursor, useScroll } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import {
  PAGES,
  DESTINATIONS,
  type Destination,
  getActiveDestination,
  onDestinationChange,
  setActiveDestination,
  setScrollEl,
} from '../scrollBus'

/** Globe radius */
const R = 2.2

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

/** Shared so the compass needle can read the globe's drag rotation. */
const spinRotShared = { value: 0 }

function latLonToVec3(lat: number, lon: number, r: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

/** Spherical interpolation between two unit vectors (great-circle path). */
function slerpUnit(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  const omega = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1))
  if (omega < 1e-5) return out.copy(a)
  const so = Math.sin(omega)
  return out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * omega) / so)
    .addScaledVector(b, Math.sin(t * omega) / so)
}

/** Wrap `target` to the angle nearest `current` (so damping never spins the long way). */
function nearestAngle(current: number, target: number) {
  return current + THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI
}

/* ------------------------------------------------------------------ */
/* Globe shader — procedural lat/lon graticule + a glowing day-night   */
/* terminator that slowly orbits the planet. Entirely procedural: no   */
/* textures, just spherical math in the fragment shader.               */
/* ------------------------------------------------------------------ */

const GLOBE_VERTEX = /* glsl */ `
  varying vec3 vObjNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vObjNormal = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const GLOBE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vObjNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  float gridLine(float deg, float spacing, float width) {
    float d = abs(fract(deg / spacing + 0.5) - 0.5) * spacing;
    return 1.0 - smoothstep(0.0, width, d);
  }

  void main() {
    vec3 n = normalize(vObjNormal);
    float lat = degrees(asin(clamp(n.y, -1.0, 1.0)));
    float lon = degrees(atan(n.z, n.x));

    // procedural graticule: 15-degree lat/lon grid, meridians fading at the poles
    float latLines = gridLine(lat, 15.0, 0.55);
    float lonLines = gridLine(lon, 15.0, 0.55) * smoothstep(88.0, 72.0, abs(lat));
    float grid = max(latLines, lonLines);
    // equator + prime meridian, slightly heavier
    float major = max(gridLine(lat, 180.0, 0.9), gridLine(lon, 180.0, 0.9) * smoothstep(88.0, 72.0, abs(lat)));

    // day-night terminator — the sun slowly orbits the globe
    float a = uTime * 0.07;
    vec3 sunDir = normalize(vec3(cos(a), 0.28, sin(a)));
    vec3 wn = normalize(vWorldNormal);
    float day = dot(wn, sunDir);
    float dayMix = smoothstep(-0.18, 0.45, day);

    vec3 nightCol = vec3(0.020, 0.039, 0.086);
    vec3 dayCol   = vec3(0.075, 0.135, 0.250);
    vec3 bone     = vec3(0.925, 0.898, 0.847);  // #ece5d8
    vec3 orange   = vec3(1.000, 0.420, 0.208);  // #ff6b35

    vec3 col = mix(nightCol, dayCol, dayMix);

    // graticule: bone ink on the day side, faint orange embers at night
    col += bone * grid * (0.085 + 0.21 * dayMix);
    col += orange * grid * (1.0 - dayMix) * 0.10;
    col += bone * major * 0.16;

    // glowing terminator band
    float term = exp(-abs(day) * 9.0);
    col += orange * term * 0.8;

    // atmosphere rim (fresnel)
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(viewDir, wn), 0.0), 2.6);
    col += orange * fresnel * 0.5;
    col += bone * fresnel * 0.12;

    gl_FragColor = vec4(col, 1.0);
  }
`

/* ------------------------------------------------------------------ */
/* Pin — clickable destination marker. Click → globe rotates to center */
/* it AND the DOM expedition card updates (shared destination bus).    */
/* drei <Html> labels ignore depth, so we fade them with the scroll    */
/* and hide back-facing ones manually.                                 */
/* ------------------------------------------------------------------ */

const tmpPinWorld = new THREE.Vector3()
const tmpCenterWorld = new THREE.Vector3()

function Pin({ index, dest }: { index: number; dest: Destination }) {
  const scroll = useScroll()
  const head = useRef<THREE.Mesh>(null!)
  const label = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [active, setActiveState] = useState(getActiveDestination() === index)
  useCursor(hovered)

  useEffect(() => onDestinationChange((i) => setActiveState(i === index)), [index])

  const position = useMemo(() => latLonToVec3(dest.lat, dest.lon, R), [dest])
  const quaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        position.clone().normalize(),
      ),
    [position],
  )

  useFrame((state) => {
    const pulse = active ? 1.25 + Math.sin(state.clock.elapsedTime * 4) * 0.18 : hovered ? 1.35 : 1
    head.current.scale.setScalar(pulse)

    if (label.current) {
      // visible near the hero (page 0) and expeditions (page 2) sections
      const sec = scroll.offset * (PAGES - 1)
      let vis = Math.max(0, 1 - Math.min(Math.abs(sec), Math.abs(sec - 2)) * 1.7)
      // hide labels on the far side of the globe
      head.current.getWorldPosition(tmpPinWorld)
      head.current.parent!.parent!.getWorldPosition(tmpCenterWorld)
      const facing = tmpPinWorld.sub(tmpCenterWorld).normalize().z
      vis *= THREE.MathUtils.smoothstep(facing, -0.02, 0.3)
      label.current.style.opacity = vis.toFixed(3)
      label.current.style.display = vis < 0.04 ? 'none' : ''
    }
  })

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        setActiveDestination(index)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* invisible hit sphere — the visible head is ~10px on screen, far too
          small a click target; this makes the whole pin area clickable */}
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.32, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* mast */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
        <meshStandardMaterial color="#ece5d8" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* head */}
      <mesh ref={head} position={[0, 0.33, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial
          color={active ? '#ff6b35' : hovered ? '#ffc9ad' : '#ece5d8'}
          toneMapped={false}
        />
      </mesh>
      {/* base ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.09, 0.115, 32]} />
        <meshBasicMaterial
          color="#ff6b35"
          transparent
          opacity={active ? 0.95 : 0.35}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <Html center position={[0, 0.56, 0]} className="pin-html" zIndexRange={[20, 0]}>
        <div
          ref={label}
          className={`pin-label ${active ? 'pin-label--hot' : ''}`}
          style={{ opacity: 0, display: 'none' }}
        >
          <strong>{dest.name}</strong>
          <span>{dest.region}</span>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* PaperPlane — cone nose + flat-box wings, flying a great-circle arc  */
/* from pin to pin as you scroll. Child of the spin group so the route */
/* stays glued to the destinations while you drag.                     */
/* ------------------------------------------------------------------ */

function PaperPlane() {
  const ref = useRef<THREE.Group>(null!)
  const scroll = useScroll()
  const pins = useMemo(() => DESTINATIONS.map((d) => latLonToVec3(d.lat, d.lon, 1)), [])
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), [])

  useFrame(() => {
    const u = THREE.MathUtils.clamp(scroll.offset, 0, 0.999)
    const t = u * (pins.length - 1)
    const seg = Math.min(pins.length - 2, Math.floor(t))
    const f = t - seg
    const lift = (ff: number) => R + 0.22 + Math.sin(Math.PI * ff) * 0.5

    slerpUnit(pins[seg], pins[seg + 1], f, tmp.a).multiplyScalar(lift(f))
    const f2 = Math.min(1, f + 0.04)
    slerpUnit(pins[seg], pins[seg + 1], f2, tmp.b).multiplyScalar(lift(f2))

    ref.current.position.copy(tmp.a)
    ref.current.lookAt(ref.current.parent!.localToWorld(tmp.b.clone()))
  })

  return (
    <group ref={ref}>
      {/* nose cone (cone points +y by default → rotate so tip faces +z) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.14]}>
        <coneGeometry args={[0.045, 0.2, 4]} />
        <meshStandardMaterial color="#ece5d8" metalness={0.2} roughness={0.45} />
      </mesh>
      {/* wings — flat boxes, slightly dihedral */}
      <mesh position={[0.1, -0.01, -0.05]} rotation={[0, 0, 0.22]}>
        <boxGeometry args={[0.24, 0.008, 0.26]} />
        <meshStandardMaterial color="#ece5d8" metalness={0.15} roughness={0.5} />
      </mesh>
      <mesh position={[-0.1, -0.01, -0.05]} rotation={[0, 0, -0.22]}>
        <boxGeometry args={[0.24, 0.008, 0.26]} />
        <meshStandardMaterial color="#ece5d8" metalness={0.15} roughness={0.5} />
      </mesh>
      {/* tail fin */}
      <mesh position={[0, 0.045, -0.14]}>
        <boxGeometry args={[0.008, 0.09, 0.12]} />
        <meshStandardMaterial color="#ff6b35" metalness={0.1} roughness={0.5} />
      </mesh>
      <pointLight color="#ff6b35" intensity={2.2} distance={1.6} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* GlobeSystem — the draggable globe (inertia, damped), its pins, the  */
/* paper plane and the cloud puffs. Drag to spin; click a pin (or a    */
/* DOM card — same bus) and the globe rotates to center it.            */
/* ------------------------------------------------------------------ */

/** Per-section position/scale keyframes for the globe group. */
const GLOBE_KEYS: { p: [number, number, number]; s: number }[] = [
  { p: [0, -0.35, 0], s: 1 }, //       0 hero — center stage
  { p: [3.1, -0.1, -1.6], s: 0.85 }, // 1 manifesto — drift right
  { p: [-3.0, -0.2, -1.2], s: 0.9 }, // 2 expeditions — left, cards right
  { p: [0, -4.7, -2.4], s: 1.5 }, //   3 approach — a horizon below
  { p: [3.4, -0.7, -2.6], s: 0.7 }, // 4 log — small, right
  { p: [-3.4, -0.7, -2.6], s: 0.7 }, // 5 guides — small, left
  { p: [0, 0.5, -5.5], s: 0.9 }, //    6 booking — distant backdrop
  { p: [0, 3.6, -3.0], s: 0.85 }, //   7 footer — overhead like a moon
]

function GlobeSystem() {
  const outer = useRef<THREE.Group>(null!)
  const spin = useRef<THREE.Group>(null!)
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)
  useCursor(hovered, 'grab')

  const drag = useRef({
    active: false,
    lastX: 0,
    lastT: 0,
    vel: 0,
    target: null as number | null,
  })

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: GLOBE_VERTEX,
        fragmentShader: GLOBE_FRAGMENT,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  // global pointer listeners: the drag continues even if the pointer
  // leaves the sphere mid-gesture
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d.active) return
      const now = performance.now()
      const dt = Math.max(8, now - d.lastT) / 1000
      const dx = e.clientX - d.lastX
      d.lastX = e.clientX
      d.lastT = now
      const dRot = dx * 0.0045
      spin.current.rotation.y += dRot
      d.vel = THREE.MathUtils.clamp(dRot / dt, -3.5, 3.5)
    }
    const onUp = () => {
      drag.current.active = false
      unlockSelection()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  // destination bus → rotate the globe so the pin faces the camera
  useEffect(
    () =>
      onDestinationChange((i) => {
        const d = DESTINATIONS[i]
        const p = latLonToVec3(d.lat, d.lon, 1)
        const targetRot = -Math.atan2(p.x, p.z)
        drag.current.target = nearestAngle(spin.current.rotation.y, targetRot)
        drag.current.vel = 0
      }),
    [],
  )

  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    lockSelection()
    const d = drag.current
    d.active = true
    d.target = null
    d.lastX = e.clientX
    d.lastT = performance.now()
    d.vel = 0
  }

  useFrame((state, delta) => {
    const d = drag.current

    // inertia + auto-rotate when idle, damped settle onto a pin target
    if (!d.active) {
      if (d.target != null) {
        spin.current.rotation.y = THREE.MathUtils.damp(spin.current.rotation.y, d.target, 3.5, delta)
        if (Math.abs(spin.current.rotation.y - d.target) < 0.002) d.target = null
      } else {
        spin.current.rotation.y += d.vel * delta + delta * 0.05
        d.vel = THREE.MathUtils.damp(d.vel, 0, 1.4, delta)
      }
    }
    spinRotShared.value = spin.current.rotation.y

    material.uniforms.uTime.value = state.clock.elapsedTime

    // per-section keyframed position/scale, doubly smoothed
    const sec = scroll.offset * (PAGES - 1)
    const i = Math.min(GLOBE_KEYS.length - 2, Math.max(0, Math.floor(sec)))
    const f = THREE.MathUtils.smoothstep(sec - i, 0, 1)
    const a = GLOBE_KEYS[i]
    const b = GLOBE_KEYS[i + 1]
    easing.damp3(
      outer.current.position,
      [
        THREE.MathUtils.lerp(a.p[0], b.p[0], f),
        THREE.MathUtils.lerp(a.p[1], b.p[1], f),
        THREE.MathUtils.lerp(a.p[2], b.p[2], f),
      ],
      0.25,
      delta,
    )
    easing.damp3(outer.current.scale, THREE.MathUtils.lerp(a.s, b.s, f), 0.25, delta)
  })

  return (
    <group ref={outer}>
      <group ref={spin}>
        <mesh
          onPointerDown={startDrag}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[R, 96, 96]} />
          <primitive object={material} attach="material" />
        </mesh>

        {DESTINATIONS.map((dest, i) => (
          <Pin key={dest.id} index={i} dest={dest} />
        ))}

        <PaperPlane />
      </group>

      {/* cloud puffs drifting around the planet */}
      <Sparkles count={90} scale={[R * 2.7, R * 1.5, R * 2.7]} size={6} speed={0.12} opacity={0.45} color="#ffffff" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* CompassRose — torus dial + needle that always swings toward the     */
/* active destination, tracking the globe's drag rotation live.        */
/* ------------------------------------------------------------------ */

function CompassRose() {
  const needle = useRef<THREE.Group>(null!)
  const activeRef = useRef(getActiveDestination())
  const pinDirs = useMemo(() => DESTINATIONS.map((d) => latLonToVec3(d.lat, d.lon, 1)), [])

  useEffect(
    () =>
      onDestinationChange((i) => {
        activeRef.current = i
      }),
    [],
  )

  useFrame((_, delta) => {
    const p = pinDirs[activeRef.current]
    const target = Math.atan2(p.x, p.z) + spinRotShared.value
    const cur = needle.current.rotation.y
    needle.current.rotation.y = THREE.MathUtils.damp(cur, nearestAngle(cur, target), 4, delta)
  })

  return (
    <group position={[-3.2, -1.9, 3.2]} rotation={[1.05, 0, -0.12]} scale={0.55}>
      {/* dial ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.022, 12, 64]} />
        <meshStandardMaterial color="#ece5d8" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* cardinal ticks */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[Math.sin((i * Math.PI) / 2) * 0.62, 0, Math.cos((i * Math.PI) / 2) * 0.62]}
        >
          <boxGeometry args={[0.035, 0.07, 0.035]} />
          <meshBasicMaterial color={i === 0 ? '#ff6b35' : '#ece5d8'} toneMapped={false} />
        </mesh>
      ))}
      {/* needle */}
      <group ref={needle}>
        <mesh position={[0, 0.02, 0.26]}>
          <boxGeometry args={[0.045, 0.018, 0.5]} />
          <meshBasicMaterial color="#ff6b35" toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0.56]}>
          <coneGeometry args={[0.05, 0.12, 4]} />
          <meshBasicMaterial color="#ff6b35" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.02, -0.17]}>
          <boxGeometry args={[0.04, 0.014, 0.34]} />
          <meshStandardMaterial color="#ece5d8" metalness={0.4} roughness={0.4} />
        </mesh>
      </group>
      {/* center cap */}
      <mesh position={[0, 0.03, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#ece5d8" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — camera parallax, lights, globe, compass, post FX  */
/* ------------------------------------------------------------------ */

export default function Experience() {
  const scroll = useScroll()

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    // gentle mouse parallax — the globe stays the star
    easing.damp3(
      state.camera.position,
      [state.pointer.x * 0.55, state.pointer.y * 0.35, 10],
      0.45,
      delta,
    )
    state.camera.lookAt(0, 0, 0)

    document.documentElement.style.setProperty('--scroll', scroll.offset.toFixed(4))
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 8]} intensity={1.1} color="#ece5d8" />
      <pointLight position={[-6, -2, 4]} intensity={8} distance={20} color="#ff6b35" />

      <Stars radius={90} depth={50} count={2400} factor={3.5} saturation={0} fade speed={0.35} />

      <GlobeSystem />
      <CompassRose />

      <EffectComposer>
        <Bloom intensity={0.65} luminanceThreshold={0.28} luminanceSmoothing={0.7} mipmapBlur />
        <Noise opacity={0.04} />
        <Vignette offset={0.15} darkness={0.85} />
      </EffectComposer>
    </>
  )
}
