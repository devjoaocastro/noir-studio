import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Scroll } from '@react-three/drei'
import Experience from './components/Experience'
import Interface from './components/Interface'
import Cursor from './components/Cursor'
import Loader from './components/Loader'
import DepthMeter from './components/DepthMeter'
import { PAGES, scrollToPage } from './scrollBus'

const NAV = ['Mission', 'Threats', 'ROV Lab', 'Species', 'Donate']
const NAV_PAGE = [1, 2, 3, 5, 6]

export default function App() {
  return (
    <>
      <Loader />

      <header className="header">
        <button className="logo" onClick={() => scrollToPage(0)}>
          OCEANIC<span className="logo__sub">foundation</span>
        </button>
        <nav className="nav">
          {NAV.map((label, i) => (
            <button key={label} onClick={() => scrollToPage(NAV_PAGE[i])}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="progress" aria-hidden="true">
        <div className="progress__bar" />
      </div>

      <DepthMeter />
      <Cursor />

      <Canvas camera={{ position: [0, 2, 10], fov: 46 }} dpr={[1, 2]}>
        <color attach="background" args={['#0a4f5e']} />
        <fog attach="fog" args={['#0a4f5e', 7, 44]} />
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
