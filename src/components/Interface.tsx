import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { scrollToPage } from '../scrollBus'

const ACCENT_DEFAULT = '#e0312b'

/* ------------------------------------------------------------------ */
/* MagneticLink — the CTA leans towards the cursor and springs back.   */
/* ------------------------------------------------------------------ */

function MagneticLink({
  href,
  className = '',
  style,
  children,
}: {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const ref = useRef<HTMLAnchorElement>(null!)

  return (
    <a
      ref={ref}
      href={href}
      className={`magnet ${className}`}
      style={style}
      onMouseMove={(e) => {
        const r = ref.current.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        ref.current.style.transform = `translate(${(dx * 0.32).toFixed(1)}px, ${(dy * 0.42).toFixed(1)}px)`
      }}
      onMouseLeave={() => {
        ref.current.style.transform = ''
      }}
    >
      {children}
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* Schedule — STATEFUL TABS, Day 1/2/3, sliding panel.                 */
/* ------------------------------------------------------------------ */

type Talk = { time: string; title: string; speaker: string }

const DAYS: { label: string; date: string; talks: Talk[] }[] = [
  {
    label: 'Day 1',
    date: 'Oct 8 — Refraction',
    talks: [
      { time: '09:30', title: 'The first refraction — opening keynote', speaker: 'Mara Vidal' },
      { time: '11:00', title: 'Creative coding beyond the canvas', speaker: 'Jonas Pleva' },
      { time: '14:00', title: 'Motion identities that breathe', speaker: 'Aiko Tanabe' },
      { time: '16:00', title: 'Design engineering: the missing role', speaker: 'Rui Bessa' },
      { time: '17:30', title: 'Panel — where craft meets compiler', speaker: 'Day-one speakers' },
    ],
  },
  {
    label: 'Day 2',
    date: 'Oct 9 — Dispersion',
    talks: [
      { time: '09:30', title: 'Interfaces everyone can feel', speaker: 'Lena Okafor' },
      { time: '11:00', title: 'WebGL at 120 fps on a phone', speaker: 'Tomás Iglesias' },
      { time: '14:00', title: 'Designing with models, not mockups', speaker: 'Priya Raman' },
      { time: '16:00', title: 'Building brand worlds', speaker: 'Sofia Lindqvist' },
      { time: '17:30', title: 'Spectrum sessions — 7 lightning talks', speaker: 'Community stage' },
    ],
  },
  {
    label: 'Day 3',
    date: 'Oct 10 — Recomposition',
    talks: [
      { time: '09:30', title: 'Systems of seven: scaling colour', speaker: 'Mara Vidal' },
      { time: '11:00', title: 'Shaders for designers', speaker: 'Tomás Iglesias' },
      { time: '14:00', title: 'The accessible spectrum', speaker: 'Lena Okafor' },
      { time: '16:00', title: 'Prisms, not pipelines', speaker: 'Priya Raman' },
      { time: '17:30', title: 'Closing — recomposing white light', speaker: 'The PRISM team' },
    ],
  },
]

function Schedule() {
  const [day, setDay] = useState(0)

  return (
    <div className="schedule">
      <div className="tabs" role="tablist" aria-label="Conference days">
        {DAYS.map((d, i) => (
          <button
            key={d.label}
            role="tab"
            aria-selected={i === day}
            className={`tab ${i === day ? 'tab--active' : ''}`}
            onClick={() => setDay(i)}
          >
            <span>{d.label}</span>
            <small>{d.date}</small>
          </button>
        ))}
      </div>
      {/* key={day} retriggers the slide animation on every switch */}
      <div className="sched-panel" key={day} role="tabpanel">
        {DAYS[day].talks.map((t) => (
          <div className="talk" key={t.title}>
            <span className="talk__time">{t.time}</span>
            <span className="talk__title">{t.title}</span>
            <span className="talk__speaker">{t.speaker}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Speakers — hovering a name tints the whole page accent.             */
/* ------------------------------------------------------------------ */

const SPEAKERS = [
  { name: 'Mara Vidal', role: 'Type & systems', initials: 'MV', color: '#e0312b' },
  { name: 'Jonas Pleva', role: 'Creative coding', initials: 'JP', color: '#f07d1d' },
  { name: 'Aiko Tanabe', role: 'Motion identity', initials: 'AT', color: '#f2b705' },
  { name: 'Rui Bessa', role: 'Design engineering', initials: 'RB', color: '#3aa655' },
  { name: 'Lena Okafor', role: 'Accessibility', initials: 'LO', color: '#1f8fde' },
  { name: 'Tomás Iglesias', role: 'WebGL & shaders', initials: 'TI', color: '#3b4bc8' },
  { name: 'Priya Raman', role: 'AI interfaces', initials: 'PR', color: '#7b2fbe' },
  { name: 'Sofia Lindqvist', role: 'Brand worlds', initials: 'SL', color: '#c52b8e' },
]

function setAccent(color: string) {
  document.documentElement.style.setProperty('--accent', color)
}

function Speakers() {
  return (
    <ul className="speakers">
      {SPEAKERS.map((s) => (
        <li
          key={s.name}
          className="speaker"
          style={{ '--sp': s.color } as CSSProperties}
          onMouseEnter={() => setAccent(s.color)}
          onMouseLeave={() => setAccent(ACCENT_DEFAULT)}
        >
          <span className="speaker__init" aria-hidden="true">
            {s.initials}
          </span>
          <strong className="speaker__name">{s.name}</strong>
          <span className="speaker__role">{s.role}</span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Workshops — seats-left counters, stateful per card.                 */
/* ------------------------------------------------------------------ */

function WorkshopCard({
  title,
  host,
  time,
  total,
  color,
}: {
  title: string
  host: string
  time: string
  total: number
  color: string
}) {
  const [seats, setSeats] = useState(total)

  return (
    <article className="ws-card" style={{ '--ws': color } as CSSProperties}>
      <h3>{title}</h3>
      <p className="ws-card__meta">
        {host} · {time}
      </p>
      <p className={`ws-card__seats ${seats <= 3 ? 'ws-card__seats--low' : ''}`}>
        <strong>{seats}</strong> {seats === 1 ? 'seat' : 'seats'} left
      </p>
      {seats > 0 ? (
        <button className="ws-card__btn" onClick={() => setSeats((s) => Math.max(0, s - 1))}>
          Hold a seat
        </button>
      ) : (
        <a className="ws-card__btn ws-card__btn--wait" href="mailto:tickets@prism.conf?subject=Workshop%20waitlist">
          Sold out — join waitlist
        </a>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Tickets — three tiers, per-tier accent, magnetic CTA.               */
/* ------------------------------------------------------------------ */

const TIERS = [
  {
    name: 'Student',
    price: '€90',
    color: '#3aa655',
    note: 'valid student ID at check-in',
    features: ['All talks, Oct 8–10', 'Livestream access', 'Community meetups', 'Talk recordings'],
    featured: false,
  },
  {
    name: 'Spectrum Pass',
    price: '€280',
    color: '#1f8fde',
    note: 'the full three days',
    features: [
      'All talks, Oct 8–10',
      'Workshop lottery access',
      'Lunch & bottomless coffee',
      'Talk recordings, forever',
      'Rooftop closing party',
    ],
    featured: true,
  },
  {
    name: 'Patron',
    price: '€620',
    color: '#7b2fbe',
    note: 'funds two student passes',
    features: [
      'Everything in Spectrum',
      'Reserved front-row seats',
      'Speakers dinner, Oct 9',
      'Guaranteed workshop seat',
      'Your name on the light wall',
    ],
    featured: false,
  },
]

function Tickets() {
  return (
    <div className="tiers">
      {TIERS.map((t) => (
        <article key={t.name} className={`tier ${t.featured ? 'tier--featured' : ''}`} style={{ '--tier': t.color } as CSSProperties}>
          {t.featured && <span className="tier__flag">Most refracted</span>}
          <h3 className="tier__name">{t.name}</h3>
          <p className="tier__price">
            {t.price}
            <span> / 3 days</span>
          </p>
          <ul className="tier__features">
            {t.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="tier__note">{t.note}</p>
          <MagneticLink
            href={`mailto:tickets@prism.conf?subject=PRISM%202026%20—%20${encodeURIComponent(t.name)}`}
            className="tier__cta"
          >
            Get tickets →
          </MagneticLink>
        </article>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Footer columns                                                      */
/* ------------------------------------------------------------------ */

const FOOTER_LINKS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Practical',
    links: [
      { label: 'Venue on the map', href: 'https://maps.google.com/?q=Alf%C3%A2ndega+do+Porto' },
      { label: 'Metro do Porto', href: 'https://www.metrodoporto.pt' },
      { label: 'Trains — CP', href: 'https://www.cp.pt' },
      { label: 'Visit Porto', href: 'https://visitporto.travel' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'hello@prism.conf', href: 'mailto:hello@prism.conf' },
      { label: 'Call for speakers', href: 'mailto:speakers@prism.conf' },
      { label: 'Volunteer with us', href: 'mailto:volunteers@prism.conf' },
      { label: 'Sponsor the light', href: 'mailto:sponsors@prism.conf' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Code of conduct', href: 'https://berlincodeofconduct.org' },
      { label: 'Privacy', href: 'mailto:privacy@prism.conf' },
      { label: 'Press kit', href: 'mailto:press@prism.conf' },
      { label: 'Ticket support', href: 'mailto:tickets@prism.conf' },
    ],
  },
]

const PROGRAMME_NAV = [
  { label: 'Schedule', page: 2 },
  { label: 'Speakers', page: 3 },
  { label: 'Workshops', page: 4 },
  { label: 'Tickets', page: 6 },
]

/* ------------------------------------------------------------------ */
/* Interface — the 8 scrolled sections.                                */
/* ------------------------------------------------------------------ */

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero */}
      <section className="section section--hero">
        <p className="kicker">PRISM 2026 — a design &amp; code conference</p>
        <h1 className="hero-title">
          Three days
          <br />
          through the
          <br />
          <em>spectrum.</em>
        </h1>
        <p className="hero-sub">
          Alfândega do Porto · October 8–10 2026.
          <br />
          One white idea in, seven disciplines out.
        </p>
        <button className="cta" onClick={() => scrollToPage(6)}>
          Get tickets ↓
        </button>
        <p className="drag-hint">
          <span className="drag-hint__icon">↻</span> drag the prism — the light follows
        </p>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">scroll</span>
        </div>
      </section>

      {/* 1 — Manifesto */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — Manifesto</p>
        <h2>
          One input.
          <br />
          <em>Seven outputs.</em>
        </h2>
        <p className="body">
          A prism doesn't add anything to light — it reveals what was always inside it. PRISM does
          the same to the work: type, motion, code, systems, sound, access, story. Three days in
          Porto where designers compile and engineers kern, and nobody apologises for either.
        </p>
      </section>

      {/* 2 — Schedule (stateful tabs) */}
      <section className="section section--top" data-num="02">
        <p className="kicker">02 — Schedule</p>
        <h2>
          The <em>programme</em>.
        </h2>
        <Schedule />
      </section>

      {/* 3 — Speakers */}
      <section className="section section--top" data-num="03">
        <p className="kicker">03 — Speakers</p>
        <h2>
          Eight <em>wavelengths</em>.
        </h2>
        <p className="hint">→ hover a name to tint the page</p>
        <Speakers />
      </section>

      {/* 4 — Workshops */}
      <section className="section section--top" data-num="04">
        <p className="kicker">04 — Workshops</p>
        <h2>
          Hands on the <em>glass</em>.
        </h2>
        <div className="workshops">
          <WorkshopCard
            title="Shader sketching with GLSL"
            host="Tomás Iglesias"
            time="Oct 8 · 10:00–13:00"
            total={7}
            color="#3b4bc8"
          />
          <WorkshopCard
            title="Variable fonts in motion"
            host="Mara Vidal"
            time="Oct 9 · 10:00–13:00"
            total={12}
            color="#e0312b"
          />
          <WorkshopCard
            title="Design systems that breathe"
            host="Rui Bessa"
            time="Oct 10 · 10:00–13:00"
            total={4}
            color="#3aa655"
          />
        </div>
      </section>

      {/* 5 — Venue */}
      <section className="section section--left" data-num="05">
        <p className="kicker">05 — Venue</p>
        <h2>
          Alfândega <em>do Porto</em>.
        </h2>
        <p className="body">
          A 19th-century customs house on the Douro riverbank — granite halls, iron columns and
          enough daylight to split. Rua Nova da Alfândega, Porto.
        </p>
        <ul className="venue-lines">
          <li>
            <strong>Metro</strong> São Bento (line D) + 12&nbsp;min riverside walk
          </li>
          <li>
            <strong>Tram 1</strong> stops at the front door — Alfândega
          </li>
          <li>
            <strong>Bus 500</strong> from Praça da Liberdade, every 20&nbsp;min
          </li>
          <li>
            <strong>Airport</strong> metro E to Trindade, change to D — ±45&nbsp;min
          </li>
        </ul>
      </section>

      {/* 6 — Tickets */}
      <section className="section section--top" data-num="06">
        <p className="kicker">06 — Tickets</p>
        <h2>
          Pick your <em>wavelength</em>.
        </h2>
        <Tickets />
      </section>

      {/* 7 — Footer */}
      <section className="section section--footer">
        <div className="spectrum-bar" aria-hidden="true" />
        <div className="footer-grid">
          <div className="footer-col">
            <h4>Programme</h4>
            {PROGRAMME_NAV.map((l) => (
              <button key={l.label} className="footer-link" onClick={() => scrollToPage(l.page)}>
                {l.label}
              </button>
            ))}
          </div>
          {FOOTER_LINKS.map((col) => (
            <div className="footer-col" key={col.title}>
              <h4>{col.title}</h4>
              {col.links.map((l) => (
                <a
                  key={l.label}
                  className="footer-link"
                  href={l.href}
                  {...(l.href.startsWith('https') ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <p className="coc-line">
          All attendees agree to our code of conduct. Be kind — light bends, people shouldn't have to.
        </p>
        <div className="footer-meta">
          <span className="past-editions">Past editions — 2023 · 2024 · 2025</span>
          <span>© PRISM Conference 2026 · Porto</span>
        </div>
      </section>
    </div>
  )
}
