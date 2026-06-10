import { useState } from 'react'
import MagneticButton from './MagneticButton'
import { scrollToPage } from '../scrollBus'

/* ------------------------------------------------------------------ */
/* PLAN YOUR VISIT — stateful ticket desk: type selector + quantity    */
/* steppers + live total + reservation success state.                  */
/* ------------------------------------------------------------------ */

const TICKETS = [
  { id: 'adult', label: 'Adult', price: 12, note: 'general admission' },
  { id: 'reduced', label: 'Reduced', price: 6, note: 'students · seniors · artists' },
  { id: 'night', label: 'Night pass', price: 15, note: 'fridays until midnight' },
] as const

type TicketId = (typeof TICKETS)[number]['id']

function TicketDesk() {
  const [qty, setQty] = useState<Record<TicketId, number>>({ adult: 1, reduced: 0, night: 0 })
  const [reserved, setReserved] = useState(false)

  const total = TICKETS.reduce((sum, t) => sum + t.price * qty[t.id], 0)
  const count = TICKETS.reduce((sum, t) => sum + qty[t.id], 0)

  const change = (id: TicketId, delta: number) => {
    setReserved(false)
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(9, q[id] + delta)) }))
  }

  if (reserved) {
    return (
      <div className="desk desk--success" role="status">
        <p className="desk__check">✓</p>
        <p className="desk__success-title">See you among the impossible</p>
        <p className="desk__success-sub">
          {count} ticket{count === 1 ? '' : 's'} held at the desk — €{total} on arrival.
        </p>
        <button className="desk__again" onClick={() => setReserved(false)}>
          Change reservation
        </button>
      </div>
    )
  }

  return (
    <div className="desk">
      {TICKETS.map((t) => (
        <div key={t.id} className={`desk__row ${qty[t.id] > 0 ? 'desk__row--on' : ''}`}>
          <button
            className="desk__pick"
            onClick={() => change(t.id, qty[t.id] === 0 ? 1 : 0)}
            aria-pressed={qty[t.id] > 0}
          >
            <strong>{t.label}</strong>
            <small>{t.note}</small>
          </button>
          <span className="desk__price">€{t.price}</span>
          <span className="stepper">
            <button onClick={() => change(t.id, -1)} aria-label={`Fewer ${t.label} tickets`}>
              −
            </button>
            <b>{qty[t.id]}</b>
            <button onClick={() => change(t.id, +1)} aria-label={`More ${t.label} tickets`}>
              +
            </button>
          </span>
        </div>
      ))}

      <div className="desk__total">
        <span>Total</span>
        <strong>€{total}</strong>
      </div>

      <MagneticButton
        className="cta cta--solid desk__reserve"
        onClick={() => {
          if (count > 0) setReserved(true)
        }}
      >
        {count > 0 ? 'Reserve' : 'Pick a ticket first'}
      </MagneticButton>

      <p className="desk__mail">
        groups &amp; school visits — <a href="mailto:visit@artefact.museum">visit@artefact.museum</a>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const CARDS = [
  { title: 'Penrose Triad', year: 'n.d.', medium: 'non-euclidean steel', inv: 'INV. ART-001' },
  { title: 'Klein Vessel', year: 'n.d.', medium: 'single-sided glass', inv: 'INV. ART-002' },
  { title: 'Möbius Loop', year: 'n.d.', medium: 'orientation-free silk', inv: 'INV. ART-003' },
  { title: 'Singularity I', year: 'n.d.', medium: 'collapsed light', inv: 'INV. ART-004' },
]

const TIERS = [
  { name: 'Friend', price: '€40 / yr', line: 'Unlimited entry, and one guest a year who will not believe you.' },
  { name: 'Fellow', price: '€120 / yr', line: 'Previews, the vault on Thursdays, two guests of any dimension.' },
  { name: 'Patron', price: '€600 / yr', line: 'Your name on the wall and a key to the night museum.' },
]

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero */}
      <section className="section section--center section--hero">
        <p className="tagline">A museum of impossible objects · Lisbon</p>
        <h1 className="hero-title">
          Objects that
          <br />
          shouldn't <em>exist</em>.
        </h1>
        <p className="hours">
          Open Tue–Sun · 10:00–18:00 · <em>last entry 17:15</em>
        </p>
        <MagneticButton className="cta" onClick={() => scrollToPage(1)}>
          Enter the exhibition ↓
        </MagneticButton>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">walk</span>
        </div>
      </section>

      {/* 1 — Current exhibition */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — Current exhibition</p>
        <h2>
          Impossible Forms
          <br />— <em>Wing II</em>.
        </h2>
        <p className="body">
          Twelve artefacts recovered from geometries that mathematics politely declines to
          discuss. Each vitrine is climate-controlled, light-controlled, and — where
          necessary — logic-controlled.
        </p>
        <p className="microcred">Curated by Dr. Helena Vasques · on view until further notice</p>
      </section>

      {/* 2 — The Alignment Room */}
      <section className="section section--top section--center" data-num="02">
        <p className="kicker">02 — The Alignment Room</p>
        <h2>
          Turn it until it <em>lies</em>.
        </h2>
        <p className="hint">→ drag the artefact — find the angle where the triangle closes</p>
      </section>

      {/* 3 — Collection highlights */}
      <section className="section section--top" data-num="03">
        <p className="kicker">03 — Collection highlights</p>
        <h2>
          Four <em>impossibilities</em>.
        </h2>
        <div className="cards">
          {CARDS.map((c) => (
            <article key={c.inv} className="card">
              <h3>{c.title}</h3>
              <p className="card__year">{c.year}</p>
              <p className="card__medium">{c.medium}</p>
              <p className="card__inv">{c.inv}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 4 — The Möbius Hall */}
      <section className="section section--left" data-num="04">
        <p className="kicker">04 — The Möbius Hall</p>
        <h2>
          One side.
          <br />
          No <em>end</em>.
        </h2>
        <p className="body">
          Follow the stripe. It crosses the whole surface, comes home upside-down, and keeps
          going. Visitors who attempt to find the other side are kindly reminded there isn't
          one.
        </p>
      </section>

      {/* 5 — Plan your visit */}
      <section className="section section--left" data-num="05">
        <p className="kicker">05 — Plan your visit</p>
        <h2>
          <em>Tickets</em>.
        </h2>
        <TicketDesk />
      </section>

      {/* 6 — Membership */}
      <section className="section section--center" data-num="06">
        <p className="kicker">06 — Membership</p>
        <h2>
          Stay <em>impossible</em>.
        </h2>
        <div className="tiers">
          {TIERS.map((t) => (
            <article key={t.name} className={`tier ${t.name === 'Patron' ? 'tier--patron' : ''}`}>
              <h3>{t.name}</h3>
              <p className="tier__price">{t.price}</p>
              <p className="tier__line">{t.line}</p>
            </article>
          ))}
        </div>
        <MagneticButton className="cta tiers__cta" href="mailto:membership@artefact.museum?subject=Membership">
          Become a member
        </MagneticButton>
      </section>

      {/* 7 — Footer: wall text */}
      <section className="section section--left section--footer" data-num="07">
        <p className="kicker">07 — Wall text</p>
        <p className="walltext">
          A museum, as a rule, keeps what the world has managed to make. This one keeps what
          the world has not. The objects in these rooms are neither tricks nor models; they
          are patient arguments against the obvious, held at eighteen degrees and sixty
          lux. We ask only that you look at them the way they look at you — from an angle
          that shouldn't work, for longer than is reasonable, and with the growing suspicion
          that the impossible is simply the possible, insufficiently visited.
        </p>

        <div className="practical">
          <div>
            <h4>Find us</h4>
            <p>
              ARTEFACT Museum
              <br />
              Rua das Janelas Verdes 94
              <br />
              1200-691 Lisboa
            </p>
          </div>
          <div>
            <h4>Hours</h4>
            <p>
              Tue–Sun · 10:00–18:00
              <br />
              Night museum · Fri until 24:00
              <br />
              Closed Mondays &amp; paradox days
            </p>
          </div>
          <div>
            <h4>Contact</h4>
            <p>
              <a href="tel:+351213912800">+351 213 912 800</a>
              <br />
              <a href="mailto:visit@artefact.museum">visit@artefact.museum</a>
            </p>
          </div>
        </div>

        <p className="supporters">
          Supported by the Fundação Espelho, the Van Orth Trust for Unlikely Geometry &amp;
          the Círculo do Impossível.
        </p>
        <p className="access">
          Step-free access throughout. Tactile replicas of every impossible object are
          available at the desk — they behave, we promise.
        </p>

        <footer className="footer">
          <span>© ARTEFACT Museum 2026</span>
          <button className="footer__top" onClick={() => scrollToPage(0)}>
            Back to the entrance ↑
          </button>
        </footer>
      </section>
    </div>
  )
}
