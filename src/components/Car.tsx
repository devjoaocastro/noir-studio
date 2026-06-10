import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, Sparkles } from '@react-three/drei'
import { easing } from '../lib/easing'
import { audio } from '../audio'
import { game, emit, ZONES, WORLD_BOUND, type ZoneId } from '../gameBus'

/* Arcade tuning ----------------------------------------------------- */
const ACCEL = 26
const REVERSE_ACCEL = 14
const BRAKE = 40
const MAX_SPEED = 22
const MAX_BOOST_SPEED = 32
const MAX_REVERSE = -8
const TURN_RATE = 2.3
const GRIP = 9 // lateral velocity damping (1/s)
const DRIFT_GRIP = 1.7
const DRAG = 0.7
const WHEEL_RADIUS = 0.34

function Wheel({
  position,
  steer,
  refSpin,
}: {
  position: [number, number, number]
  steer?: boolean
  refSpin: (g: THREE.Group | null) => void
}) {
  return (
    <group position={position} name={steer ? 'steer-wheel' : 'wheel'}>
      <group ref={refSpin}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.32, 18]} />
          <meshStandardMaterial color="#28323c" roughness={0.9} />
        </mesh>
        {/* hubcap + notch so the spin reads visually */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.17, 0.17, 0.34, 14]} />
          <meshStandardMaterial color="#f3ead8" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.34, 0.1, 0.1]} />
          <meshStandardMaterial color="#ffc93c" roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}

export default function Car() {
  const root = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null!)
  const exhaustRef = useRef<THREE.Group>(null!)
  const skidRef = useRef<THREE.Group>(null!)

  const spinGroups = useRef<(THREE.Group | null)[]>([null, null, null, null])
  const steerGroups = useRef<THREE.Group[]>([])

  const lTargetL = useMemo(() => new THREE.Object3D(), [])
  const lTargetR = useMemo(() => new THREE.Object3D(), [])

  /* physics state (kept in refs, never re-rendered) */
  const phys = useRef({
    x: game.carX,
    z: game.carZ,
    heading: game.carAngle,
    vF: 0,
    vL: 0,
    steerVisual: 0,
  })

  const camPos = useMemo(() => new THREE.Vector3(0, 6, 26), [])
  const lookSmooth = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const tmpLook = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const p = phys.current
    const i = game.input
    const running = game.started && !game.paused

    let throttle = 0
    let steer = 0
    if (running) {
      throttle = (i.forward ? 1 : 0) - (i.back ? 1 : 0)
      steer = (i.left ? 1 : 0) - (i.right ? 1 : 0)
    }

    /* Fixed substeps: simulation speed stays correct down to ~4 fps. */
    const rawDt = Math.min(delta, 0.25)
    const steps = Math.max(1, Math.ceil(rawDt / 0.05))
    const dt = rawDt / steps

    let boosting = false
    let drifting = false
    let speed01 = 0

    for (let s = 0; s < steps; s++) {
      /* --- longitudinal --------------------------------------------- */
      boosting = running && i.boost && game.boostJuice > 0.02 && p.vF > 1
      const maxSpeed = boosting ? MAX_BOOST_SPEED : MAX_SPEED
      if (throttle > 0) {
        p.vF += ACCEL * (boosting ? 1.6 : 1) * dt
      } else if (throttle < 0) {
        if (p.vF > 0.8) p.vF -= BRAKE * dt
        else p.vF -= REVERSE_ACCEL * dt
      }
      p.vF = THREE.MathUtils.clamp(p.vF, MAX_REVERSE, maxSpeed)
      /* rolling resistance + handbrake */
      p.vF *= Math.exp(-DRAG * dt)
      if (i.drift && running) p.vF *= Math.exp(-0.9 * dt)
      if (Math.abs(p.vF) < 0.03 && throttle === 0) p.vF = 0

      /* boost juice */
      if (boosting) game.boostJuice = Math.max(0, game.boostJuice - 0.38 * dt)
      else game.boostJuice = Math.min(1, game.boostJuice + 0.16 * dt)

      /* --- steering --------------------------------------------------- */
      speed01 = THREE.MathUtils.clamp(Math.abs(p.vF) / MAX_BOOST_SPEED, 0, 1)
      const steerFactor =
        THREE.MathUtils.clamp(Math.abs(p.vF) / 6, 0, 1) * (1 - 0.32 * speed01)
      const steerDir = p.vF >= 0 ? 1 : -1
      p.heading += steer * steerDir * TURN_RATE * steerFactor * dt

      drifting = running && i.drift && Math.abs(p.vF) > 5
      /* drifting bleeds forward speed into lateral slide */
      if (drifting && steer !== 0) p.vL += steer * -1 * Math.abs(p.vF) * 0.9 * dt

      /* --- lateral grip ----------------------------------------------- */
      p.vL *= Math.exp(-(drifting ? DRIFT_GRIP : GRIP) * dt)

      /* --- integrate --------------------------------------------------- */
      const sfx = Math.sin(p.heading)
      const sfz = Math.cos(p.heading)
      p.x += (sfx * p.vF + Math.cos(p.heading) * p.vL) * dt
      p.z += (sfz * p.vF + -Math.sin(p.heading) * p.vL) * dt

      /* soft world bounds */
      const b = WORLD_BOUND
      if (Math.abs(p.x) > b) {
        p.x = THREE.MathUtils.clamp(p.x, -b, b)
        p.vF *= 0.6
        p.vL *= -0.4
        game.shake = Math.min(1, game.shake + 0.2)
      }
      if (Math.abs(p.z) > b) {
        p.z = THREE.MathUtils.clamp(p.z, -b, b)
        p.vF *= 0.6
        p.vL *= -0.4
        game.shake = Math.min(1, game.shake + 0.2)
      }
    }

    const fx = Math.sin(p.heading)
    const fz = Math.cos(p.heading)

    /* --- write transforms -------------------------------------------- */
    root.current.position.set(p.x, 0, p.z)
    root.current.rotation.y = p.heading + (drifting ? p.vL * -0.02 : 0)

    /* body lean + suspension bounce */
    easing.damp(body.current.rotation, 'z', steer * speed01 * -0.14, 0.12, rawDt)
    easing.damp(body.current.rotation, 'x', (throttle > 0 ? -1 : throttle < 0 ? 0.6 : 0) * speed01 * 0.07, 0.18, rawDt)
    body.current.position.y = Math.abs(p.vF) > 0.5 ? Math.sin(state.clock.elapsedTime * 22) * 0.012 * (0.4 + speed01) : 0

    /* wheels: spin + visual steer */
    const spin = (p.vF / WHEEL_RADIUS) * rawDt
    for (const g of spinGroups.current) if (g) g.rotation.x += spin
    easing.damp(p, 'steerVisual', steer * 0.42, 0.1, rawDt)
    for (const g of steerGroups.current) g.rotation.y = p.steerVisual

    /* particles on/off */
    exhaustRef.current.visible = running && throttle > 0 && p.vF > -0.5
    skidRef.current.visible = drifting

    /* --- chase camera ------------------------------------------------- */
    const cam = state.camera as THREE.PerspectiveCamera
    const dist = game.isCoarse ? 9.6 : 8.6
    const height = game.isCoarse ? 5.2 : 3.8
    camPos.set(p.x - fx * dist, height, p.z - fz * dist)
    easing.damp3(cam.position, camPos, 0.3, rawDt)
    tmpLook.set(p.x + fx * 4.5, 1.1, p.z + fz * 4.5)
    easing.damp3(lookSmooth, tmpLook, 0.22, rawDt)

    /* impact shake */
    if (game.shake > 0.003) {
      cam.position.x += (Math.random() - 0.5) * game.shake * 0.45
      cam.position.y += (Math.random() - 0.5) * game.shake * 0.3
      game.shake *= Math.exp(-5 * rawDt)
    } else game.shake = 0
    cam.lookAt(lookSmooth)

    /* FOV: 50 → 62 with speed, extra kick while boosting */
    const targetFov = 50 + speed01 * 10 + (boosting ? 5 : 0)
    easing.damp(cam, 'fov', targetFov, 0.25, rawDt)
    cam.updateProjectionMatrix()

    /* --- publish to bus ------------------------------------------------ */
    game.carX = p.x
    game.carZ = p.z
    game.carAngle = p.heading
    game.speedKmh = Math.abs(p.vF) * 3.6
    game.speed01 = speed01
    game.boosting = boosting
    game.drifting = drifting

    audio.update(speed01, drifting, boosting, running)

    /* --- zone triggers -------------------------------------------------- */
    let inZone: ZoneId | null = null
    for (const z of ZONES) {
      const dx = p.x - z.x
      const dz = p.z - z.z
      if (dx * dx + dz * dz < z.radius * z.radius) {
        inZone = z.id
        break
      }
    }
    if (inZone !== game.activeZone) {
      const prev = game.activeZone
      game.activeZone = inZone
      if (prev) emit('zone-exit', prev)
      if (inZone) {
        emit('zone-enter', inZone)
        if (!game.visited.has(inZone)) {
          game.visited.add(inZone)
          game.points += 500
          audio.discover()
          emit('zone-discover', inZone)
          emit('popup', { text: '+500', big: true })
        }
      }
    }
  })

  const setSpin = (idx: number) => (g: THREE.Group | null) => {
    spinGroups.current[idx] = g
  }
  const setSteer = (g: THREE.Group | null) => {
    if (g && !steerGroups.current.includes(g)) steerGroups.current.push(g)
  }

  return (
    <group
      ref={root}
      position={[0, 0, 14]}
      rotation={[0, Math.PI, 0]}
      onClick={(e) => {
        e.stopPropagation()
        audio.honk()
        emit('honk', undefined)
      }}
    >
      <group ref={body}>
        {/* chassis */}
        <RoundedBox args={[1.7, 0.6, 3.1]} radius={0.2} smoothness={4} position={[0, 0.55, 0]} castShadow>
          <meshStandardMaterial color="#ff6b57" roughness={0.55} />
        </RoundedBox>
        {/* cabin */}
        <RoundedBox args={[1.34, 0.56, 1.5]} radius={0.18} smoothness={4} position={[0, 1.04, -0.18]} castShadow>
          <meshStandardMaterial color="#f3ead8" roughness={0.5} />
        </RoundedBox>
        {/* windshield */}
        <RoundedBox args={[1.1, 0.34, 0.12]} radius={0.05} smoothness={2} position={[0, 1.06, 0.62]}>
          <meshStandardMaterial color="#19414e" roughness={0.2} metalness={0.4} />
        </RoundedBox>
        {/* front bumper stripe */}
        <RoundedBox args={[1.74, 0.16, 0.5]} radius={0.07} smoothness={2} position={[0, 0.42, 1.34]}>
          <meshStandardMaterial color="#f3ead8" roughness={0.6} />
        </RoundedBox>
        {/* headlights */}
        <mesh position={[-0.55, 0.62, 1.56]}>
          <sphereGeometry args={[0.14, 14, 14]} />
          <meshStandardMaterial color="#fff8e0" emissive="#ffe9a8" emissiveIntensity={2.4} />
        </mesh>
        <mesh position={[0.55, 0.62, 1.56]}>
          <sphereGeometry args={[0.14, 14, 14]} />
          <meshStandardMaterial color="#fff8e0" emissive="#ffe9a8" emissiveIntensity={2.4} />
        </mesh>
        {/* taillights */}
        <mesh position={[-0.55, 0.6, -1.56]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#ff3b2f" emissive="#ff3b2f" emissiveIntensity={1.6} />
        </mesh>
        <mesh position={[0.55, 0.6, -1.56]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#ff3b2f" emissive="#ff3b2f" emissiveIntensity={1.6} />
        </mesh>
        {/* headlight beams */}
        <primitive object={lTargetL} position={[-0.5, 0, 12]} />
        <primitive object={lTargetR} position={[0.5, 0, 12]} />
        <spotLight
          position={[-0.55, 0.62, 1.5]}
          target={lTargetL}
          angle={0.46}
          penumbra={0.6}
          intensity={28}
          distance={26}
          color="#ffeebb"
        />
        <spotLight
          position={[0.55, 0.62, 1.5]}
          target={lTargetR}
          angle={0.46}
          penumbra={0.6}
          intensity={28}
          distance={26}
          color="#ffeebb"
        />
      </group>

      {/* wheels: FL, FR (steer) + RL, RR */}
      <group ref={setSteer} position={[-0.82, WHEEL_RADIUS, 1.02]}>
        <Wheel position={[0, 0, 0]} steer refSpin={setSpin(0)} />
      </group>
      <group ref={setSteer} position={[0.82, WHEEL_RADIUS, 1.02]}>
        <Wheel position={[0, 0, 0]} steer refSpin={setSpin(1)} />
      </group>
      <Wheel position={[-0.82, WHEEL_RADIUS, -1.02]} refSpin={setSpin(2)} />
      <Wheel position={[0.82, WHEEL_RADIUS, -1.02]} refSpin={setSpin(3)} />

      {/* exhaust puffs */}
      <group ref={exhaustRef} position={[0.42, 0.34, -1.75]}>
        <Sparkles count={14} scale={[0.7, 0.7, 1.4]} size={5} speed={1.4} opacity={0.5} color="#dff3f7" />
      </group>
      {/* drift skid sparks at the rear wheels */}
      <group ref={skidRef} position={[0, 0.12, -1.05]}>
        <Sparkles count={26} scale={[2.1, 0.5, 1.2]} size={7} speed={2.2} opacity={0.85} color="#ffc93c" />
      </group>
    </group>
  )
}
