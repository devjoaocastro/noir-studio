import { useEffect, useState, type FormEvent } from 'react'
import { scrollToPage } from '../scrollBus'
import { world } from '../store'
import Magnetic from './Magnetic'

/* ------------------------------------------------------------------ */
/* Calculator — STATEFUL: the slider live-updates the recommendation   */
/* AND scales the 3D panel field through the `world` state bus.        */
/* ------------------------------------------------------------------ */

function Calculator() {
  const [bill, setBill] = useState(world.bill)

  const onChange = (v: number) => {
    setBill(v)
    world.bill = v // bridge → 3D panel field count
  }

  const panels = Math.max(4, Math.round(bill / 25))
  const savings = Math.round(bill * 12 * 0.72)
  const co2 = (panels * 0.34).toFixed(1)

  return (
    <div className="calc">
      <label className="calc__row" htmlFor="bill">
        <span>Your monthly bill</span>
        <strong>€{bill}</strong>
      </label>
      <input
        id="bill"
        className="calc__slider"
        type="range"
        min={50}
        max={400}
        step={5}
        value={bill}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Monthly electricity bill in euros"
      />
      <div className="calc__scale" aria-hidden="true">
        <span>€50</span>
        <span>€400</span>
      </div>
      <div className="calc__out">
        <div>
          <strong>{panels}</strong>
          <span>panels recommended</span>
        </div>
        <div>
          <strong>€{savings.toLocaleString('en-US')}</strong>
          <span>est. savings / yr</span>
        </div>
        <div>
          <strong>{co2} t</strong>
          <span>CO₂ avoided / yr</span>
        </div>
      </div>
      <p className="calc__hint">↑ watch the field grow behind these numbers</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Accordion — stateful warranty & service items                       */
/* ------------------------------------------------------------------ */

const WARRANTY = [
  {
    q: '25-year panel performance guarantee',
    a: 'Our panels are guaranteed to deliver at least 87% of their rated output after 25 years. If a panel underperforms, we replace it — parts, labour and scaffolding included.',
  },
  {
    q: '10-year inverter & battery cover',
    a: 'Inverters and batteries carry a full 10-year warranty. Remote diagnostics flag most faults before you ever notice them, and swaps happen within 5 working days.',
  },
  {
    q: '5-year workmanship warranty',
    a: 'Every roof penetration, cable run and mount is covered for 5 years. If anything we touched leaks, lifts or rattles, we fix it at zero cost — no small print.',
  },
  {
    q: 'Lifetime monitoring & service plan',
    a: 'The HELIOS app tracks production per panel, forever, for free. Optional service plan adds an annual on-site inspection and panel cleaning for €89/yr.',
  },
]

function Accordion() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="accordion">
      {WARRANTY.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.q} className={`accordion__item ${isOpen ? 'is-open' : ''}`}>
            <button
              className="accordion__head"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <em>{isOpen ? '−' : '+'}</em>
            </button>
            <div className="accordion__body" style={{ maxHeight: isOpen ? 220 : 0 }}>
              <p>{item.a}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Quote form — postcode + email, success state on submit              */
/* ------------------------------------------------------------------ */

function QuoteForm() {
  const [sent, setSent] = useState(false)
  const [postcode, setPostcode] = useState('')
  const [email, setEmail] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  if (sent) {
    return (
      <div className="quote__done" role="status">
        <strong>Sunshine audit booked ☀</strong>
        <p>
          We will email a full production estimate for your roof within 24 hours. No visit
          needed — satellites do the measuring.
        </p>
      </div>
    )
  }

  return (
    <form className="quote" onSubmit={onSubmit}>
      <div className="quote__fields">
        <input
          type="text"
          placeholder="Postcode (e.g. 2750-642)"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          required
          aria-label="Postcode"
        />
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-label="Email"
        />
      </div>
      <Magnetic strength={0.35}>
        <button className="cta cta--solid" type="submit">
          Book my free sun audit ☀
        </button>
      </Magnetic>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* SunDial footer — semicircular hour arc + live clock                 */
/* ------------------------------------------------------------------ */

function SunDial() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // map 06:00–18:00 → -90°..+90°; clamp outside daylight
  const minutes = now.getHours() * 60 + now.getMinutes()
  const needle = Math.max(-90, Math.min(90, ((minutes - 720) / 360) * 90))
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

  return (
    <div className="sundial-wrap">
      <div className="sundial" aria-hidden="true">
        {hours.map((h) => (
          <span
            key={h}
            className={`sundial__tick ${h % 6 === 0 ? 'sundial__tick--major' : ''}`}
            style={{ transform: `rotate(${(h - 12) * 15}deg)` }}
          />
        ))}
        <span className="sundial__needle" style={{ transform: `rotate(${needle}deg)` }} />
        <span className="sundial__label sundial__label--l">6h</span>
        <span className="sundial__label sundial__label--c">12h</span>
        <span className="sundial__label sundial__label--r">18h</span>
      </div>
      <p className="sundial__clock">
        <strong>{now.toLocaleTimeString('en-GB')}</strong>
        <span>Solar noon at 13:42 in Lisbon</span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The 8 scrolled sections                                             */
/* ------------------------------------------------------------------ */

const INSTALLS = [
  { place: 'Cascais', size: '6.4 kWp', detail: '18 panels · battery 10 kWh', payback: '5.2 yrs' },
  { place: 'Évora', size: '12 kWp', detail: '32 panels · battery 15 kWh', payback: '4.1 yrs' },
  { place: 'Braga', size: '4.2 kWp', detail: '12 panels · no battery', payback: '6.3 yrs' },
]

const STEPS = [
  {
    n: '01',
    t: 'Satellite survey',
    d: 'Send your postcode — we measure roof pitch, azimuth and shading from satellite imagery. No ladders, no visits.',
  },
  {
    n: '02',
    t: 'One-day install',
    d: 'A two-person crew mounts, wires and certifies the whole system in a single day. Coffee optional but appreciated.',
  },
  {
    n: '03',
    t: 'Generate & bank',
    d: 'Panels track production live in the app. Surplus charges your battery first, then sells to the grid automatically.',
  },
]

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero */}
      <section className="section section--center section--hero">
        <p className="tagline">Residential solar · Portugal</p>
        <h1 className="hero-title">
          Own your <em>sunlight</em>.
        </h1>
        <p className="hero-sub">
          Panels, battery and brains — installed in a day,
          <br />
          paying you back from the first sunrise.
        </p>
        <Magnetic strength={0.3}>
          <button className="cta" onClick={() => scrollToPage(1)}>
            See how it works ↓
          </button>
        </Magnetic>
        <p className="drag-hint">☀ try dragging the sun across the sky</p>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">scroll</span>
        </div>
      </section>

      {/* 1 — How it works */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — How it works</p>
        <h2>
          Three steps to <em>energy freedom</em>.
        </h2>
        <div className="steps">
          {STEPS.map((s) => (
            <article key={s.n} className="step">
              <span className="step__n">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 2 — Calculator (stateful, drives the 3D field) */}
      <section className="section section--right" data-num="02">
        <p className="kicker">02 — The calculator</p>
        <h2>
          Size your <em>system</em>.
        </h2>
        <Calculator />
      </section>

      {/* 3 — Day & Night */}
      <section className="section section--left" data-num="03">
        <p className="kicker">03 — Day &amp; night</p>
        <h2>
          The sun clocks off.
          <br />
          <em>Your battery doesn't.</em>
        </h2>
        <p className="body">
          Daylight fills the battery tower you see growing beside the house. After sunset it
          quietly powers everything — watch the windows light up.
        </p>
        <p className="hint">→ flip the day / night toggle in the header</p>
      </section>

      {/* 4 — Installs */}
      <section className="section section--right" data-num="04">
        <p className="kicker">04 — Recent installs</p>
        <h2>
          Roofs already <em>earning</em>.
        </h2>
        <ul className="installs">
          {INSTALLS.map((c) => (
            <li key={c.place}>
              <em>{c.place}</em>
              <span className="installs__size">{c.size}</span>
              <span className="installs__detail">{c.detail}</span>
              <span className="installs__payback">payback {c.payback}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 5 — Warranty (stateful accordion) */}
      <section className="section section--left" data-num="05">
        <p className="kicker">05 — Warranty &amp; service</p>
        <h2>
          Covered. <em>Properly.</em>
        </h2>
        <Accordion />
      </section>

      {/* 6 — Quote (form + magnetic CTA) */}
      <section className="section section--center" data-num="06">
        <p className="kicker">06 — Your quote</p>
        <h2>
          Your roof is <em>hired</em>.
        </h2>
        <p className="body body--center">
          Postcode + email. We reply with panel count, production estimate and a fixed price
          — valid for 60 days.
        </p>
        <QuoteForm />
      </section>

      {/* 7 — Footer */}
      <section className="section section--footer">
        <SunDial />

        <div className="footer-cols">
          <div className="footer-col">
            <h4>Company</h4>
            <button onClick={() => scrollToPage(1)}>How it works</button>
            <button onClick={() => scrollToPage(2)}>Calculator</button>
            <button onClick={() => scrollToPage(4)}>Recent installs</button>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <a href="tel:+351210000842">+351 210 000 842</a>
            <a href="mailto:hello@helios-energia.pt">hello@helios-energia.pt</a>
            <button onClick={() => scrollToPage(5)}>Warranty &amp; service</button>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="mailto:legal@helios-energia.pt?subject=Privacy%20policy">Privacy policy</a>
            <a href="mailto:legal@helios-energia.pt?subject=Terms">Terms of service</a>
            <a href="mailto:legal@helios-energia.pt?subject=Complaints">Complaints book</a>
          </div>
        </div>

        <div className="footer-base">
          <p className="footer-cert">
            DGEG licensed installer — registo n.º PT-DGEG-04821 · Certified electricians,
            IEC 61215 panels
          </p>
          <p className="footer-copy">© HELIOS Energia 2026 — made under the Portuguese sun</p>
        </div>
      </section>
    </div>
  )
}
