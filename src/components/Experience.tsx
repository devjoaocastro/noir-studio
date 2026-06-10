import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import Car from './Car'
import World from './World'
import Props from './Props'
import Districts from './Districts'
import { game } from '../gameBus'

/**
 * Warm key light that follows the car so the shadow frustum can stay
 * small (crisp long toy shadows) while the world is 200×200.
 */
function LightRig() {
  const light = useRef<THREE.DirectionalLight>(null!)
  const target = useRef<THREE.Object3D>(new THREE.Object3D())

  useFrame(() => {
    const l = light.current
    l.position.set(game.carX + 30, 38, game.carZ + 16)
    target.current.position.set(game.carX, 0, game.carZ)
    target.current.updateMatrixWorld()
    l.target = target.current
  })

  return (
    <>
      <directionalLight
        ref={light}
        castShadow
        intensity={2.1}
        color="#fff2da"
        position={[30, 38, 16]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={5}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
      />
      <primitive object={target.current} />
    </>
  )
}

export default function Experience() {
  return (
    <>
      <fog attach="fog" args={['#9fe0ea', 55, 175]} />
      <ambientLight intensity={0.62} color="#dffaff" />
      <hemisphereLight args={['#cdf2f8', '#1186a6', 0.55]} />
      <LightRig />

      <World />
      <Props />
      <Districts />
      <Car />

      <EffectComposer multisampling={game.isCoarse ? 0 : 4}>
        <Bloom intensity={0.45} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={0.5} />
      </EffectComposer>
    </>
  )
}
