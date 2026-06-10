import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  DESTINATIONS,
  getActiveDestination,
  onDestinationChange,
  setActiveDestination,
  scrollToPage,
} from '../scrollBus'

/* ------------------------------------------------------------------ */
/* MagneticCta — the button leans toward the cursor and springs back.  */
/* ------------------------------------------------------------------ */

function MagneticCta({
  children,
  type = 'button',
  onClick,
  className = '',
}: {
  children: ReactNode
  type?: 'button' | 'submit'
  onClick?: () => void
  className?: string
}) {
  const ref = useRef<HTMLButtonElement>(null!)

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      className={`cta cta--magnetic ${className}`}
      onMouseMove={(e) => {
        const r = ref.current.getBoundingClientRect()
        const dx = (e.clientX - r.left - r.width / 2) * 0.32
        const dy = (e.clientY - r.top - r.height / 2) * 0.32
        ref.current.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`
      }}
      onMouseLeave={() => {
        ref.current.style.transform = 'translate(0, 0)'
      }}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Expeditions — stateful cards synced with the 3D globe pins via the  */
/* destination bus: click a card → globe rotates; click a pin → the    */
/* card highlights and expands.                                        */
/* ------------------------------------------------------------------ */

function Difficulty({ level }: { level: number }) {
  return (
    <span className="diff" aria-label={`difficulty ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= level ? 'diff__dot diff__dot--on' : 'diff__dot'} />
      ))}
    </span>
  )
}

function ExpeditionCards() {
  const [active, setActive] = useState(getActiveDestination())
  useEffect(() => onDestinationChange(setActive), [])

  return (
    <div className="ex-cards">
      {DESTINATIONS.map((d, i) => (
        <button
          key={d.id}
          className={`ex-card ${i === active ? 'ex-card--active' : ''}`}
          onClick={() => setActiveDestination(i)}
        >
          <span className="ex-card__top">
            <span className="ex-card__num">{String(i + 1).padStart(2, '0')}</span>
            <span className="ex-card__name">{d.name}</span>
            <span className="ex-card__region">{d.region}</span>
          </span>
          <span className="ex-card__meta">
            <span>{d.dates}</span>
            <span className="ex-card__price">{d.price}</span>
            <Difficulty level={d.difficulty} />
          </span>
          {i === active && <span className="ex-card__blurb">{d.blurb}</span>}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Booking form — preventDefault + success state                       */
/* ------------------------------------------------------------------ */

function BookingForm() {
  const [sent, setSent] = useState(false)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSent(true)
  }

  if (sent) {
    return (
      <div className="form-success" role="status">
        <strong>Expedition request logged ✓</strong>
        <p>A route planner will reach you within 48 hours. Pack nothing yet.</p>
      </div>
    )
  }

  return (
    <form className="book-form" onSubmit={submit}>
      <label>
        Name
        <input name="name" type="text" required placeholder="Amelia Earhart" autoComplete="name" />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          placeholder="you@somewhere.earth"
          autoComplete="email"
        />
      </label>
      <label>
        Destination
        <select name="destination" defaultValue={DESTINATIONS[0].id}>
          {DESTINATIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.dates}
            </option>
          ))}
        </select>
      </label>
      <MagneticCta type="submit">Request a spot →</MagneticCta>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Interface — 8 full-height sections scrolled over the 3D scene       */
/* ------------------------------------------------------------------ */

const BARCODE = [3, 1, 2, 1, 4, 1, 1, 3, 2, 1, 5, 1, 2, 2, 1, 4, 1, 1, 3, 1, 2, 5, 1, 2, 1, 3, 1, 1, 4, 2]

const LOG_ENTRIES = [
  {
    date: '14 Apr 2025',
    place: 'Svalbard',
    text: 'The sun never set, so neither did we. At 2 a.m. the glacier turned the colour of apricots and Tomas finally stopped checking the ice.',
  },
  {
    date: '02 Jul 2025',
    place: 'Atacama',
    text: 'Counted forty shooting stars before midnight, then gave up counting. The desert is the loudest silence any of us had ever heard.',
  },
  {
    date: '23 Sep 2024',
    place: 'Faroe Islands',
    text: 'The ferryman refused payment — said the weather had already charged us enough. Eleven minutes later, sun. Eleven more, hail.',
  },
  {
    date: '08 Dec 2024',
    place: 'Patagonia',
    text: 'Wind at 90 km/h on Paso John Gardner. We crossed it bent double, laughing. Inés says the wind only respects people who lean in.',
  },
]

const GUIDES = [
  { name: 'Inés Marques', line: 'Eleven seasons on Patagonian ice — laughs at weather forecasts, trusts the clouds.' },
  { name: 'Tomas Eriksen', line: 'Svalbard-born. Reads pack ice the way other people read newspapers.' },
  { name: 'Aiko Tanaka', line: 'Hokkaido powder specialist. Fluent in four languages and in silence.' },
]

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero */}
      <section className="section section--center section--hero">
        <p className="tagline">ATLAS Expeditions · est. Lisboa 2011</p>
        <h1 className="hero-title">
          Go where the
          <br />
          map <em>ends</em>.
        </h1>
        <p className="hero-sub">
          Small-group expeditions to the five edges of the world.
          <br />
          Eight travellers. Local guides. No trace.
        </p>
        <MagneticCta onClick={() => scrollToPage(2)}>See the expeditions ↓</MagneticCta>
        <p className="hero-hint">drag the globe · click a pin</p>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">scroll</span>
        </div>
      </section>

      {/* 1 — Manifesto */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — Manifesto</p>
        <h2>
          Tourism follows roads.
          <br />
          We follow <em>meridians</em>.
        </h2>
        <p className="body">
          Somewhere between the airport lounge and the all-inclusive buffet, travel forgot what it
          was for. We take eight people at a time to places that still set their own terms — and we
          arrive as guests, not customers. The itinerary bends to the weather, the wildlife and the
          people who live there. That is not a flaw in the plan. It is the plan.
        </p>
      </section>

      {/* 2 — Expeditions (stateful, synced with the globe pins) */}
      <section className="section section--expeditions" data-num="02">
        <p className="kicker">02 — Expeditions</p>
        <h2 className="ex-heading">
          Five <em>edges</em> of the world.
        </h2>
        <p className="hint">↓ pick one — the globe will find it</p>
        <ExpeditionCards />
      </section>

      {/* 3 — The approach */}
      <section className="section section--center section--top" data-num="03">
        <p className="kicker">03 — The approach</p>
        <h2>
          How we <em>travel</em>.
        </h2>
        <div className="pillars">
          <div className="pillar">
            <span className="pillar__num">≤ 8</span>
            <strong>Small groups</strong>
            <p>
              Never more than eight travellers. Small enough to be invited in, quiet enough to see
              what large groups scare away.
            </p>
          </div>
          <div className="pillar">
            <span className="pillar__num">100%</span>
            <strong>Local guides</strong>
            <p>
              Every expedition is led by people born to the terrain — hired directly, paid properly,
              named on every itinerary.
            </p>
          </div>
          <div className="pillar">
            <span className="pillar__num">0</span>
            <strong>Leave no trace</strong>
            <p>
              We carry out everything we carry in, camp on durable ground, and leave each route
              exactly as the next traveller deserves to find it.
            </p>
          </div>
        </div>
      </section>

      {/* 4 — Expedition log */}
      <section className="section section--left section--top" data-num="04">
        <p className="kicker">04 — Expedition log</p>
        <h2>
          Field <em>notes</em>.
        </h2>
        <div className="log">
          {LOG_ENTRIES.map((entry) => (
            <article className="log-entry" key={entry.date}>
              <time>
                {entry.date} · {entry.place}
              </time>
              <p>“{entry.text}”</p>
            </article>
          ))}
        </div>
      </section>

      {/* 5 — Guides */}
      <section className="section section--left section--top" data-num="05">
        <p className="kicker">05 — Guides</p>
        <h2>
          The people who <em>know</em>.
        </h2>
        <ul className="guides">
          {GUIDES.map((g) => (
            <li key={g.name}>
              <strong>{g.name}</strong>
              <span>{g.line}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 6 — Booking */}
      <section className="section section--center" data-num="06">
        <p className="kicker">06 — Book</p>
        <h2>
          Claim a <em>window seat</em>.
        </h2>
        <p className="body body--center">
          Departures are capped at eight. Tell us who you are and where the map should end.
        </p>
        <BookingForm />
      </section>

      {/* 7 — Footer: boarding pass */}
      <section className="section section--center section--footer">
        <div className="ticket">
          <div className="ticket__main">
            <p className="ticket__label">Boarding pass · ATLAS air charter</p>
            <p className="ticket__route">
              LIS <span className="ticket__arrow">→</span> ANYWHERE
            </p>
            <div className="ticket__row">
              <div>
                <span>Passenger</span>
                <strong>YOU</strong>
              </div>
              <div>
                <span>Gate</span>
                <strong>EDGE</strong>
              </div>
              <div>
                <span>Seat</span>
                <strong>WINDOW</strong>
              </div>
              <div>
                <span>Boarding</span>
                <strong>NOW</strong>
              </div>
            </div>
          </div>
          <div className="ticket__stub">
            <div className="barcode" aria-hidden="true">
              {BARCODE.map((w, i) => (
                <i key={i} style={{ width: w }} />
              ))}
            </div>
            <span className="ticket__code">ATL·2026·∞</span>
          </div>
        </div>

        <div className="footer-cols">
          <div>
            <h3>Expeditions</h3>
            {DESTINATIONS.map((d, i) => (
              <button
                key={d.id}
                onClick={() => {
                  setActiveDestination(i)
                  scrollToPage(2)
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
          <div>
            <h3>Company</h3>
            <button onClick={() => scrollToPage(1)}>Manifesto</button>
            <button onClick={() => scrollToPage(3)}>The approach</button>
            <button onClick={() => scrollToPage(4)}>Expedition log</button>
            <button onClick={() => scrollToPage(5)}>Guides</button>
          </div>
          <div>
            <h3>Contact</h3>
            <a href="mailto:hello@atlas.travel">hello@atlas.travel</a>
            <a href="tel:+351210555010">+351 210 555 010</a>
            <a href="https://www.instagram.com/atlasexpeditions" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href="https://www.youtube.com/@atlasexpeditions" target="_blank" rel="noreferrer">
              YouTube
            </a>
          </div>
        </div>

        <p className="footer-legal">
          © ATLAS Expeditions 2026 · Lisboa, Portugal · IATA-bonded &amp; fully insured
        </p>
      </section>
    </div>
  )
}
