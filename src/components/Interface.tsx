import { useState } from 'react'
import { scrollToPage } from '../scrollBus'
import { resetGame, scoreOf, useGameState, TARGET_COUNT } from '../gameStore'
import MagneticCTA from './MagneticCTA'

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const GAMES = [
  {
    title: 'EMBERFALL',
    pitch: 'A blacksmith roguelike where every weapon you forge reshapes the dungeon.',
    status: 'OUT NOW',
    tone: 'green',
  },
  {
    title: 'HOLLOW TIDE',
    pitch: 'Co-op deep-sea salvage — the ocean remembers what you steal from it.',
    status: '2027',
    tone: 'ember',
  },
  {
    title: 'UNTITLED SMITH GAME',
    pitch: 'You are the anvil. That is all we can say for now.',
    status: 'PROTOTYPING',
    tone: 'steel',
  },
] as const

const PILLARS = [
  {
    name: 'FORGE-1',
    text: 'Our own engine. 2 MB runtime, rollback netcode, hot-reloads a level in 40 ms. Built in-house because nothing else felt like metal.',
  },
  {
    name: 'HANDCRAFTED PIXELS',
    text: 'Every sprite placed by a human hand. No upscalers, no filters — 9 frames of animation can carry more weight than 9,000 polygons.',
  },
  {
    name: 'ZERO CRUNCH',
    text: 'Four-day weeks, shipped on time, twice. Tired smiths bend blades. We are building a studio for the next twenty years, not the next quarter.',
  },
] as const

const DEVLOG = [
  {
    date: '2026-06-02',
    title: 'EMBERFALL 1.4 — the Cinder Update is live',
    text: 'New biome, 27 forgeable relics, and the community-requested left-handed hammer.',
    fresh: true,
  },
  {
    date: '2026-04-18',
    title: 'HOLLOW TIDE vertical slice is playable',
    text: 'Four-player salvage runs working end-to-end on FORGE-1 netcode. The ocean is mean.',
    fresh: false,
  },
  {
    date: '2026-02-27',
    title: 'FORGE-1 gets pixel-perfect rollback',
    text: 'Deterministic replays at 240 ticks. Wrote up the whole approach — engine nerds, enjoy.',
    fresh: false,
  },
  {
    date: '2025-12-12',
    title: 'Untitled Smith Game: first anvil prototype',
    text: 'Greybox build where you ARE the anvil. It should not be fun. It is extremely fun.',
    fresh: false,
  },
] as const

const ROLES = [
  {
    title: 'Senior Gameplay Engineer',
    meta: 'Full-time · Guimarães or remote (EU)',
    blurb: 'Own combat feel on Hollow Tide — from input buffering to hit-stop curves.',
    reqs: [
      '5+ years shipping gameplay code (C/C++ or Rust)',
      'You can argue about coyote time for an hour',
      'Netcode literacy — rollback experience a big plus',
      'Portfolio of things that feel good to press buttons in',
    ],
  },
  {
    title: 'Pixel Artist',
    meta: 'Full-time · Guimarães or remote (EU)',
    blurb: 'Characters and tilesets for Emberfall seasons and the new prototype.',
    reqs: [
      'Mastery of low-count palettes (16–32 colours)',
      'Animation chops: weight, anticipation, follow-through',
      'You have opinions about sub-pixel movement',
      'Bonus: UI pixel work that survives 4K screens',
    ],
  },
  {
    title: 'Technical Animator',
    meta: 'Full-time · remote (EU)',
    blurb: 'Bridge our pixel pipeline and FORGE-1 — tools, rigs, state machines.',
    reqs: [
      'Experience writing animation tooling (Python/Lua/Rust)',
      'Comfortable inside a custom engine, no hand-holding',
      'You profile before you optimize',
      'Shipped at least one game in any role',
    ],
  },
  {
    title: 'Community Smith',
    meta: 'Part-time → full-time · remote',
    blurb: 'Run our Discord, devlogs and playtests. First voice players hear.',
    reqs: [
      'Native-level English; Portuguese a plus',
      'You have moderated a community over 10k',
      'Can turn patch notes into something people read for fun',
      'Genuine love for weird indie games',
    ],
  },
] as const

const HIGH_SCORES: [string, number][] = [
  ['KAI', 92400],
  ['ZED', 78150],
  ['MGS', 64500],
  ['RUI', 51200],
  ['LDA', 33800],
]

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

function Marquee({ text }: { text: string }) {
  const chunk = Array(6).fill(text).join('  ')
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        <span>{chunk}</span>
        <span>{chunk}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function PlaygroundHUD() {
  const game = useGameState()
  const score = scoreOf(game)
  const done = score === TARGET_COUNT

  return (
    <div className="hud">
      <div className="hud__score" role="status">
        FORGED: {score}/{TARGET_COUNT}
      </div>
      <div className="hud__pips" aria-hidden="true">
        {game.forged.map((f, i) => (
          <span key={i} className={`hud__pip ${f ? 'hud__pip--lit' : ''}`} />
        ))}
      </div>
      {done && (
        <div className="toast" role="alert">
          <span className="toast__kicker">ACHIEVEMENT UNLOCKED</span>
          <strong className="toast__title">APPRENTICE SMITH</strong>
          <button className="cta cta--small" onClick={resetGame}>
            ↻ Forge again
          </button>
        </div>
      )}
    </div>
  )
}

function Careers() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="careers">
      {ROLES.map((role, i) => {
        const isOpen = open === i
        return (
          <div key={role.title} className={`role ${isOpen ? 'role--open' : ''}`}>
            <button
              className="role__head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span className="role__title">{role.title}</span>
              <span className="role__meta">{role.meta}</span>
              <span className="role__chev" aria-hidden="true">
                {isOpen ? '−' : '+'}
              </span>
            </button>
            <div className="role__body" hidden={!isOpen}>
              <p className="role__blurb">{role.blurb}</p>
              <ul className="role__reqs">
                {role.reqs.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <a
                className="cta cta--small"
                href={`mailto:jobs@forge.games?subject=${encodeURIComponent(`Application — ${role.title}`)}`}
              >
                Apply →
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ArcadeFooter() {
  const game = useGameState()
  const score = scoreOf(game)
  const yourScore = score * 11111
  // a real arcade board is sorted — slot YOU in by score, not at the top
  const rows: [string, number, boolean][] = [
    ...(score > 0 ? ([['YOU', yourScore, true]] as [string, number, boolean][]) : []),
    ...HIGH_SCORES.map(([n, s]) => [n, s, false] as [string, number, boolean]),
  ].sort((a, b) => b[1] - a[1])

  return (
    <div className="arcade">
      <div className="arcade__marquee">
        <span className="arcade__logo">FORGE</span>
      </div>

      <div className="arcade__screen">
        <p className="arcade__heading">HIGH SCORES</p>
        <table className="scores">
          <tbody>
            {rows.map(([name, pts, you], i) => (
              <tr key={`${name}-${i}`} className={you ? 'scores__you' : ''}>
                <td>{i + 1}.</td>
                <td>{name}</td>
                <td>{pts.toLocaleString('en-US').padStart(7, ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="coin-slot" onClick={resetGame}>
          INSERT COIN ↻ PLAY AGAIN
        </button>
      </div>

      <div className="arcade__columns">
        <div>
          <p className="arcade__col-title">CONTACT</p>
          <a href="mailto:press@forge.games">Press kit</a>
          <a href="mailto:hello@forge.games">Say hello</a>
        </div>
        <div>
          <p className="arcade__col-title">COMMUNITY</p>
          <a href="https://discord.com" target="_blank" rel="noreferrer">
            Discord
          </a>
          <a href="https://x.com" target="_blank" rel="noreferrer">
            X
          </a>
        </div>
        <div>
          <p className="arcade__col-title">WORK</p>
          <button className="arcade__link" onClick={() => scrollToPage(6)}>
            Open roles
          </button>
          <a href="mailto:jobs@forge.games">jobs@forge.games</a>
        </div>
      </div>

      <p className="arcade__legal">© FORGE Games 2026 · Guimarães</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Interface root                                                      */
/* ------------------------------------------------------------------ */

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero */}
      <section className="section section--center section--hero">
        <p className="badge badge--pixel">INDIE GAME STUDIO · GUIMARÃES</p>
        <h1 className="hero-title">
          We forge worlds
          <br />
          you can <em>break</em>.
        </h1>
        <p className="hero-sub">
          FORGE is a small smithy of game makers. Our own engine, handcrafted pixels,
          and exactly zero crunch. Click the anvil — go on.
        </p>
        <button className="cta" onClick={() => scrollToPage(1)}>
          Enter the smithy ↓
        </button>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">scroll</span>
        </div>
      </section>

      {/* 1 — Manifesto */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — Manifesto</p>
        <h2>
          Small team.
          <br />
          Heavy <em>hammer</em>.
        </h2>
        <p className="body">
          Eleven people in a granite house in Guimarães. We believe a game is forged, not
          assembled: heated by ideas, hit a thousand times, quenched only when it rings true.
          We ship few things, and we ship them sharp.
        </p>
      </section>

      {/* 2 — Games */}
      <section className="section section--top" data-num="02">
        <p className="kicker">02 — Games</p>
        <h2>
          Made of <em>ember</em> and stubbornness.
        </h2>
        <div className="cards">
          {GAMES.map((g) => (
            <article key={g.title} className="card">
              <span className={`badge badge--${g.tone}`}>{g.status}</span>
              <h3 className="card__title">{g.title}</h3>
              <p className="card__pitch">{g.pitch}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 3 — The Playground */}
      <section className="section section--top" data-num="03">
        <p className="kicker">03 — The Playground</p>
        <h2>
          Break <em>five</em>, become a smith.
        </h2>
        <p className="hint">→ click the floating cubes</p>
        <PlaygroundHUD />
      </section>

      {/* 4 — Tech & Craft */}
      <section className="section section--top" data-num="04">
        <p className="kicker">04 — Tech &amp; Craft</p>
        <h2>
          Three <em>pillars</em>, no shortcuts.
        </h2>
        <p className="hint">→ drag the FORGE-PAD to spin it</p>
        <div className="cards cards--pillars">
          {PILLARS.map((p) => (
            <article key={p.name} className="card card--pillar">
              <h3 className="card__title card__title--small">{p.name}</h3>
              <p className="card__pitch">{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 5 — Devlog */}
      <section className="section section--left" data-num="05">
        <p className="kicker">05 — Devlog</p>
        <h2>
          From the <em>furnace</em>.
        </h2>
        <ul className="devlog">
          {DEVLOG.map((d) => (
            <li key={d.date} className="devlog__entry">
              <span className="devlog__date">{d.date}</span>
              <div className="devlog__main">
                <p className="devlog__title">
                  {d.title}
                  {d.fresh && <span className="badge badge--green badge--inline">NEW</span>}
                </p>
                <p className="devlog__text">{d.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 6 — Careers */}
      <section className="section section--left" data-num="06">
        <p className="kicker">06 — Careers</p>
        <h2>
          The forge needs <em>hands</em>.
        </h2>
        <Careers />
        <MagneticCTA href="mailto:jobs@forge.games?subject=Join%20the%20smithy">
          Join the smithy →
        </MagneticCTA>
      </section>

      {/* 7 — Footer (arcade cabinet) */}
      <section className="section section--center section--footer" data-num="07">
        <Marquee text="FORGE — INSERT COIN — FORGE — PRESS START —" />
        <ArcadeFooter />
      </section>
    </div>
  )
}
