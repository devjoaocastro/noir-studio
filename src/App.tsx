import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './components/Experience'
import HUD from './hud/HUD'
import { game, emit } from './gameBus'
import { audio } from './audio'

const KEY_MAP: Record<string, keyof typeof game.input> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'drift',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
}

export default function App() {
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = KEY_MAP[e.code]
      if (k) {
        game.input[k] = true
        if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
        return
      }
      if (e.code === 'KeyH') {
        audio.honk()
        emit('honk', undefined)
      }
      if (e.code === 'Escape') emit('close-panel', undefined)
    }
    const up = (e: KeyboardEvent) => {
      const k = KEY_MAP[e.code]
      if (k) game.input[k] = false
    }
    const blur = () => {
      const i = game.input
      i.forward = i.back = i.left = i.right = i.drift = i.boost = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 7, 28], fov: 50 }}
        dpr={[1, game.isCoarse ? 1.7 : 2]}
      >
        <color attach="background" args={['#9fe0ea']} />
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </Canvas>
      <HUD
        started={started}
        onStart={() => {
          audio.init()
          game.started = true
          setStarted(true)
        }}
      />
    </>
  )
}
