import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { game, on, ZONES, WORLD_BOUND, type ZoneId } from '../gameBus'
import { audio } from '../audio'
import { PROJECTS } from '../components/Districts'

const ZONE_ORDER: ZoneId[] = ['portfolio', 'services', 'about', 'contact']

const OBJECTIVES: Record<ZoneId, string> = {
  portfolio: 'Find the Portfolio district ↑',
  services: 'Head east to Services →',
  about: 'Cruise west to About ←',
  contact: 'Last stop: Contact ↓',
}

/* ------------------------------------------------------------------ */
/* Intro overlay                                                       */
/* ------------------------------------------------------------------ */

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="intro">
      <div className="intro__card">
        <div className="intro__badge">A DRIVABLE PORTFOLIO</div>
        <h1 className="intro__logo">
          VROOM<span>®</span>
        </h1>
        <p className="intro__tag">A tiny toy city. Four districts. One coral car.</p>
        <div className="intro__controls">
          <span className="key-chip">WASD / setas</span> para conduzir ·{' '}
          <span className="key-chip">Espaço</span> drift · <span className="key-chip">Shift</span> boost ·{' '}
          <span className="key-chip">H</span> honk
        </div>
        <button className="start-btn" onClick={onStart}>
          START ENGINE
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Floating point popups                                               */
/* ------------------------------------------------------------------ */

interface Popup {
  id: number
  text: string
  big: boolean
  x: number
}

function Popups() {
  const [popups, setPopups] = useState<Popup[]>([])
  const idRef = useRef(0)

  useEffect(
    () =>
      on('popup', ({ text, big }) => {
        const id = ++idRef.current
        setPopups((p) => [...p, { id, text, big: !!big, x: (Math.random() - 0.5) * 160 }])
        window.setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), 1400)
      }),
    [],
  )

  return (
    <div className="popups" aria-hidden="true">
      {popups.map((p) => (
        <div key={p.id} className={`popup ${p.big ? 'popup--big' : ''}`} style={{ marginLeft: p.x }}>
          {p.text}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Confetti burst on first zone visit                                  */
/* ------------------------------------------------------------------ */

const CONFETTI_COLORS = ['#ff6b57', '#ffc93c', '#7ef0c8', '#ff8fb2', '#ffffff', '#9b8cff']

function Confetti() {
  const [bursts, setBursts] = useState<number[]>([])
  const idRef = useRef(0)

  useEffect(
    () =>
      on('zone-discover', () => {
        const id = ++idRef.current
        setBursts((b) => [...b, id])
        window.setTimeout(() => setBursts((b) => b.filter((q) => q !== id)), 2000)
      }),
    [],
  )

  return (
    <div className="confetti-layer" aria-hidden="true">
      {bursts.map((id) => (
        <div key={id} className="confetti-burst">
          {Array.from({ length: 56 }, (_, i) => {
            const a = (i / 56) * Math.PI * 2 + Math.random() * 0.5
            const d = 130 + Math.random() * 220
            return (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  ['--cx' as string]: `${Math.cos(a) * d}px`,
                  ['--cy' as string]: `${Math.sin(a) * d - 140}px`,
                  ['--cr' as string]: `${Math.random() * 720 - 360}deg`,
                  animationDelay: `${Math.random() * 0.12}s`,
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Magnetic button (contact panel)                                     */
/* ------------------------------------------------------------------ */

function MagneticLink({ href, children }: { href: string; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null)
  return (
    <a
      ref={ref}
      className="magnetic-btn"
      href={href}
      onMouseMove={(e) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        el.style.transform = `translate(${dx * 0.28}px, ${dy * 0.34}px)`
      }}
      onMouseLeave={() => {
        if (ref.current) ref.current.style.transform = ''
      }}
    >
      {children}
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* District panels                                                     */
/* ------------------------------------------------------------------ */

function PanelBody({ zone }: { zone: ZoneId }) {
  if (zone === 'portfolio') {
    return (
      <>
        <p className="panel__lead">
          Six worlds we shipped — billboards you just drove past. Every one is a live site. Go visit. It is portfolios
          all the way down.
        </p>
        <ul className="panel__projects">
          {PROJECTS.map((p, i) => (
            <li key={p.name}>
              <a href={p.url} target="_blank" rel="noreferrer">
                <span className="proj-num">0{i + 1}</span>
                <span className="proj-name">{p.name}</span>
                <span className="proj-blurb">{p.blurb}</span>
                <span className="proj-arrow">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </>
    )
  }
  if (zone === 'services') {
    return (
      <>
        <p className="panel__lead">Four glowing pylons, four things we do disturbingly well.</p>
        <ul className="panel__services">
          <li>
            <strong>Immersive Web</strong>
            <span>Sites that feel like places, not pages. WebGL, motion, sound.</span>
          </li>
          <li>
            <strong>3D Worlds</strong>
            <span>Stylized toy cities, planets and oceans — built from primitives, shipped fast.</span>
          </li>
          <li>
            <strong>Game-sites</strong>
            <span>Portfolios you drive, scroll-shooters, playable product tours. Like this one.</span>
          </li>
          <li>
            <strong>Art Direction</strong>
            <span>One saturated hue, chunky shapes, juicy feedback. We sweat the squish.</span>
          </li>
        </ul>
      </>
    )
  }
  if (zone === 'about') {
    return (
      <>
        <p className="panel__lead">
          Hi, the big friendly rock is our office. VROOM is a two-person studio that believes the web got too flat —
          so we build it back up, one toy world at a time. No templates, no stock, no boring.
        </p>
        <div className="panel__stats">
          <div>
            <em>23</em>
            <span>worlds shipped</span>
          </div>
          <div>
            <em>1</em>
            <span>shark</span>
          </div>
          <div>
            <em>∞</em>
            <span>coffee</span>
          </div>
        </div>
      </>
    )
  }
  return (
    <>
      <p className="panel__lead">
        The mailbox flag is up — that means we are taking projects. Honk twice or just write.
      </p>
      <MagneticLink href="mailto:hello@vroom.studio">hello@vroom.studio</MagneticLink>
      <div className="panel__contacts">
        <a href="tel:+351210000942">+351 210 000 942</a>
        <a href="https://x.com/vroomstudio" target="_blank" rel="noreferrer">
          X / Twitter
        </a>
        <a href="https://instagram.com/vroom.studio" target="_blank" rel="noreferrer">
          Instagram
        </a>
        <a href="https://dribbble.com/vroomstudio" target="_blank" rel="noreferrer">
          Dribbble
        </a>
      </div>
    </>
  )
}

const PANEL_TITLES: Record<ZoneId, { title: string; sub: string }> = {
  portfolio: { title: 'Portfolio', sub: 'DISTRICT 1 / 4 — THE BILLBOARDS' },
  services: { title: 'Services', sub: 'DISTRICT 2 / 4 — THE PYLONS' },
  about: { title: 'About', sub: 'DISTRICT 3 / 4 — THE FRIENDLY ROCK' },
  contact: { title: 'Contact', sub: 'DISTRICT 4 / 4 — THE MAILBOX' },
}

/* ------------------------------------------------------------------ */
/* Live widgets (rAF-driven, no React re-render)                       */
/* ------------------------------------------------------------------ */

function LiveWidgets() {
  const speedNum = useRef<HTMLSpanElement>(null)
  const speedBar = useRef<HTMLDivElement>(null)
  const boostBar = useRef<HTMLDivElement>(null)
  const carDot = useRef<HTMLDivElement>(null)
  const speedlines = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (speedNum.current) speedNum.current.textContent = String(Math.round(game.speedKmh))
      if (speedBar.current) speedBar.current.style.width = `${Math.min(100, (game.speedKmh / 118) * 100)}%`
      if (boostBar.current) boostBar.current.style.width = `${game.boostJuice * 100}%`
      if (carDot.current) {
        const left = ((game.carX + WORLD_BOUND) / (WORLD_BOUND * 2)) * 100
        const top = ((game.carZ + WORLD_BOUND) / (WORLD_BOUND * 2)) * 100
        const rot = Math.atan2(Math.sin(game.carAngle), -Math.cos(game.carAngle))
        carDot.current.style.left = `${left}%`
        carDot.current.style.top = `${top}%`
        carDot.current.style.transform = `translate(-50%, -50%) rotate(${rot}rad)`
      }
      if (speedlines.current) speedlines.current.classList.toggle('is-on', game.boosting)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <div ref={speedlines} className="speedlines" aria-hidden="true" />

      {/* minimap */}
      <div className="minimap" aria-hidden="true">
        <div className="minimap__road minimap__road--v" />
        <div className="minimap__road minimap__road--h" />
        {ZONES.map((z) => (
          <div
            key={z.id}
            className="minimap__zone"
            style={{
              left: `${((z.x + WORLD_BOUND) / (WORLD_BOUND * 2)) * 100}%`,
              top: `${((z.z + WORLD_BOUND) / (WORLD_BOUND * 2)) * 100}%`,
              background: z.color,
            }}
          />
        ))}
        <div ref={carDot} className="minimap__car" />
      </div>

      {/* speedometer */}
      <div className="speedo" aria-hidden="true">
        <div className="speedo__readout">
          <span ref={speedNum} className="speedo__num">
            0
          </span>
          <span className="speedo__unit">km/h</span>
        </div>
        <div className="speedo__track">
          <div ref={speedBar} className="speedo__bar" />
        </div>
        <div className="speedo__boost-label">BOOST</div>
        <div className="speedo__track speedo__track--boost">
          <div ref={boostBar} className="speedo__bar speedo__bar--boost" />
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Touch controls                                                      */
/* ------------------------------------------------------------------ */

function TouchControls() {
  const bind = (key: keyof typeof game.input) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      game.input[key] = true
    },
    onPointerUp: () => {
      game.input[key] = false
    },
    onPointerCancel: () => {
      game.input[key] = false
    },
  })
  return (
    <div className="touch-controls">
      <div className="touch-cluster touch-cluster--steer">
        <button className="touch-btn" aria-label="Steer left" {...bind('left')}>
          ◀
        </button>
        <button className="touch-btn" aria-label="Steer right" {...bind('right')}>
          ▶
        </button>
      </div>
      <div className="touch-cluster touch-cluster--pedals">
        <button className="touch-btn touch-btn--small" aria-label="Boost" {...bind('boost')}>
          ⚡
        </button>
        <button className="touch-btn touch-btn--brake" aria-label="Brake" {...bind('back')}>
          ▼
        </button>
        <button className="touch-btn touch-btn--gas" aria-label="Gas" {...bind('forward')}>
          ▲
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* HUD root                                                            */
/* ------------------------------------------------------------------ */

export default function HUD({ started, onStart }: { started: boolean; onStart: () => void }) {
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [openZone, setOpenZone] = useState<ZoneId | null>(null)
  const [visitedCount, setVisitedCount] = useState(0)
  const [points, setPoints] = useState(0)
  const [nextZone, setNextZone] = useState<ZoneId | null>('portfolio')

  useEffect(() => {
    const offs = [
      on('zone-enter', (z) => setOpenZone(z)),
      on('zone-exit', () => setOpenZone(null)),
      on('zone-discover', () => {
        setVisitedCount(game.visited.size)
        setNextZone(ZONE_ORDER.find((z) => !game.visited.has(z)) ?? null)
        setPoints(game.points)
      }),
      on('popup', () => setPoints(game.points)),
      on('close-panel', () => setOpenZone(null)),
    ]
    return () => offs.forEach((off) => off())
  }, [])

  const togglePause = () => {
    game.paused = !game.paused
    setPaused(game.paused)
  }
  const toggleMute = () => {
    const m = !game.muted
    game.muted = m
    audio.setMuted(m)
    setMuted(m)
  }

  const objective = !started
    ? ''
    : nextZone
      ? OBJECTIVES[nextZone]
      : 'World 100% explored ⭐'

  return (
    <div className="hud">
      {!started && <Intro onStart={onStart} />}

      {started && (
        <>
          <div className="hud-topleft">
            <button className="round-btn" onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'}>
              {paused ? '▶' : 'II'}
            </button>
            <button className="round-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>

          <div className="objective">
            <div className="objective__label">OBJECTIVE</div>
            <div className="objective__text">{objective}</div>
            <div className="objective__meta">
              <span className="objective__chip">EXPLORED {visitedCount}/4</span>
              <span className="objective__chip objective__chip--pts">★ {points}</span>
            </div>
          </div>

          <LiveWidgets />
          {game.isCoarse && <TouchControls />}
          <Popups />
          <Confetti />

          {paused && (
            <div className="pause-veil">
              <div className="pause-veil__text">PAUSED</div>
            </div>
          )}
        </>
      )}

      <aside
        className={`panel ${openZone ? 'is-open' : ''}`}
        data-zone={openZone ?? undefined}
        data-testid="panel"
        aria-hidden={!openZone}
      >
        {openZone && (
          <>
            <div className="panel__head">
              <div>
                <div className="panel__sub">{PANEL_TITLES[openZone].sub}</div>
                <h2 className="panel__title">{PANEL_TITLES[openZone].title}</h2>
              </div>
              <button className="round-btn panel__close" onClick={() => setOpenZone(null)} aria-label="Close panel">
                ✕
              </button>
            </div>
            <div className="panel__body">
              <PanelBody zone={openZone} />
            </div>
            <div className="panel__foot">drive away or press ESC to close</div>
          </>
        )}
      </aside>
    </div>
  )
}
