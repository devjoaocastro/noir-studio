import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Scroll } from '@react-three/drei'
import Experience from './components/Experience'
import Interface from './components/Interface'
import Cursor from './components/Cursor'
import Loader from './components/Loader'
import { PAGES, scrollToPage } from './scrollBus'

const NAV: [string, number][] = [
  ['Exhibition', 1],
  ['Alignment', 2],
  ['Collection', 3],
  ['Visit', 5],
  ['Membership', 6],
]

export default function App() {
  return (
    <>
      <Loader />

      <header className="header">
        <button className="logo" onClick={() => scrollToPage(0)}>
          ARTEFACT<span className="logo__reg">museum</span>
        </button>
        <nav className="nav">
          {NAV.map(([label, page]) => (
            <button key={label} onClick={() => scrollToPage(page)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="progress" aria-hidden="true">
        <div className="progress__bar" />
      </div>

      <Cursor />

      <Canvas camera={{ position: [0, 1.9, 10], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={['#221f1b']} />
        <fog attach="fog" args={['#221f1b', 11, 42]} />
        <Suspense fallback={null}>
          <ScrollControls pages={PAGES} damping={0.22}>
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
