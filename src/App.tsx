import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Scroll } from '@react-three/drei'
import Experience from './components/Experience'
import Interface from './components/Interface'
import Cursor from './components/Cursor'
import Loader from './components/Loader'
import { PAGES, scrollToPage } from './scrollBus'
import { world, type Theme } from './store'

const NAV = ['How it works', 'Calculator', 'Day & Night', 'Installs', 'Warranty', 'Quote']
const NAV_PAGE = [1, 2, 3, 4, 5, 6]

export default function App() {
  const [theme, setTheme] = useState<Theme>('day')

  const toggleTheme = () => {
    const next: Theme = theme === 'day' ? 'night' : 'day'
    setTheme(next)
    world.theme = next
    document.documentElement.classList.toggle('night', next === 'night')
  }

  return (
    <>
      <Loader />

      <header className="header">
        <button className="logo" onClick={() => scrollToPage(0)}>
          HELIOS<span className="logo__reg">☀</span>
        </button>
        <nav className="nav">
          {NAV.map((label, i) => (
            <button key={label} onClick={() => scrollToPage(NAV_PAGE[i])}>
              {label}
            </button>
          ))}
        </nav>
        <button
          className={`theme-toggle ${theme === 'night' ? 'theme-toggle--night' : ''}`}
          onClick={toggleTheme}
          aria-label={theme === 'day' ? 'Switch to night' : 'Switch to day'}
          title={theme === 'day' ? 'Switch to night' : 'Switch to day'}
        >
          <span className="theme-toggle__icon theme-toggle__icon--sun">☀</span>
          <span className="theme-toggle__icon theme-toggle__icon--moon">☾</span>
          <span className="theme-toggle__knob" />
        </button>
      </header>

      <div className="progress" aria-hidden="true">
        <div className="progress__bar" />
      </div>

      <Cursor />

      <Canvas camera={{ position: [0, 3.4, 15.5], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={['#cfe8ff']} />
        <fog attach="fog" args={['#cfe8ff', 26, 70]} />
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
