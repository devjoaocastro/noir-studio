import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Scroll } from '@react-three/drei'
import Experience from './components/Experience'
import Interface from './components/Interface'
import Cursor from './components/Cursor'
import Loader from './components/Loader'
import { PAGES, scrollToPage } from './scrollBus'
import { setMuted } from './lib/audio'

const NAV = ['Philosophy', 'Engine', 'Sound', 'Artists', 'Specs', 'Pre-order']
const NAV_PAGE = [1, 2, 3, 4, 5, 6]

export default function App() {
  const [muted, setMutedState] = useState(false)

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  return (
    <>
      <Loader />

      <header className="header">
        <button className="logo" onClick={() => scrollToPage(0)}>
          SYNTH LAB<span className="logo__unit">M-8</span>
        </button>
        <nav className="nav">
          {NAV.map((label, i) => (
            <button key={label} onClick={() => scrollToPage(NAV_PAGE[i])}>
              {label}
            </button>
          ))}
        </nav>
        <button
          className={`mute ${muted ? 'mute--off' : ''}`}
          onClick={toggleMute}
          aria-label={muted ? 'unmute sound' : 'mute sound'}
        >
          <span className="mute__dot" />
          {muted ? 'SOUND OFF' : 'SOUND ON'}
        </button>
      </header>

      <div className="progress" aria-hidden="true">
        <div className="progress__bar" />
      </div>

      <Cursor />

      <Canvas camera={{ position: [0, 2.5, 7.6], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={['#141417']} />
        <fog attach="fog" args={['#141417', 18, 42]} />
        <Suspense fallback={null}>
          <ScrollControls pages={PAGES} damping={0.2}>
            <Experience />
            <Scroll html style={{ width: '100%' }}>
              <Interface />
            </Scroll>
          </ScrollControls>
        </Suspense>
      </Canvas>
    </>
  )
}
