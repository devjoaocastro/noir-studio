import { useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { scrollToPage } from '../scrollBus'
import { DONATION_MAX, DONATION_MIN, setDonation } from '../lib/donation'

/* ------------------------------------------------------------------ */
/* Magnetic CTA — the anchor leans towards the cursor inside its       */
/* magnetic field, then snaps back on leave.                           */
/* ------------------------------------------------------------------ */

function MagneticCta({
  href,
  className = '',
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const inner = useRef<HTMLAnchorElement>(null!)

  const onMove = (e: MouseEvent<HTMLSpanElement>) => {
    const r = inner.current.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    inner.current.style.transform = `translate(${(dx * 0.3).toFixed(1)}px, ${(dy * 0.32).toFixed(1)}px)`
  }
  const onLeave = () => {
    inner.current.style.transform = 'translate(0px, 0px)'
  }

  return (
    <span className="magnet" onMouseMove={onMove} onMouseLeave={onLeave}>
      <a ref={inner} className={`cta ${className}`} href={href}>
        {children}
      </a>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Donate — STATEFUL section: €5–€500 slider, preset chips, live       */
/* impact line and a magnetic mailto CTA. Every change also feeds the  */
/* 3D coral cluster on the sea floor below.                            */
/* ------------------------------------------------------------------ */

const PRESETS = [10, 25, 100]

function impactLine(amount: number): string {
  if (amount >= 120) {
    const sensors = Math.floor(amount / 120)
    return `€${amount} = ${sensors} reef sensor${sensors > 1 ? 's' : ''} for a year`
  }
  if (amount >= 40) {
    return `€${amount} = ${Math.round(amount * 1.5)} m² of seagrass meadow restored`
  }
  return `€${amount} = ${amount * 2} kg of plastic intercepted at river mouths`
}

function DonateSection() {
  const [amount, setAmount] = useState(60)

  const update = (value: number) => {
    setAmount(value)
    setDonation(value)
  }

  const pct = ((amount - DONATION_MIN) / (DONATION_MAX - DONATION_MIN)) * 100
  const mailto = `mailto:donate@oceanic.foundation?subject=${encodeURIComponent(
    `Donation pledge €${amount}`,
  )}`

  return (
    <section className="section section--center" data-num="06">
      <p className="kicker">06 — Donate</p>
      <h2>
        Fund the <em>descent</em>.
      </h2>

      <div className="donate-panel">
        <div className="donate-panel__amount">
          €<strong>{amount}</strong>
        </div>

        <input
          className="donate-panel__slider"
          type="range"
          min={DONATION_MIN}
          max={DONATION_MAX}
          step={5}
          value={amount}
          aria-label="Donation amount in euros"
          onChange={(e) => update(Number(e.target.value))}
          style={{
            background: `linear-gradient(90deg, var(--cyan) ${pct}%, rgba(234, 246, 244, 0.14) ${pct}%)`,
          }}
        />

        <div className="donate-panel__chips">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`chip ${amount === p ? 'chip--active' : ''}`}
              onClick={() => update(p)}
            >
              €{p}
            </button>
          ))}
        </div>

        <p className="donate-panel__impact">{impactLine(amount)}</p>
        <p className="donate-panel__note">watch the reef beneath you come alive ↓</p>

        <MagneticCta href={mailto} className="cta--donate">
          Donate €{amount}
        </MagneticCta>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Static content data                                                 */
/* ------------------------------------------------------------------ */

const THREATS = [
  { stat: '8M', unit: 'tons / yr', text: 'of plastic enter the ocean every single year' },
  { stat: '50%', unit: 'since 1950', text: 'of the world’s coral reefs are already gone' },
  { stat: '90%', unit: 'depleted', text: 'of large predatory fish removed from the sea' },
]

const SPECIES = [
  {
    name: 'Leatherback Turtle',
    range: 'Tropical & temperate seas',
    status: 'Vulnerable',
    tone: 'vul',
  },
  {
    name: 'Hawksbill Turtle',
    range: 'Coral reef coastlines',
    status: 'Critically Endangered',
    tone: 'cr',
  },
  { name: 'Whale Shark', range: 'Open tropical ocean', status: 'Endangered', tone: 'en' },
  { name: 'Vaquita', range: 'Gulf of California', status: 'Critically Endangered', tone: 'cr' },
]

const FOOTER_COLUMNS = [
  {
    title: 'Programs',
    links: [
      { label: 'Reef Restoration', href: 'mailto:programs@oceanic.foundation?subject=Reef%20Restoration' },
      { label: 'Plastic Interception', href: 'mailto:programs@oceanic.foundation?subject=Plastic%20Interception' },
      { label: 'Deep-Sea Census', href: 'mailto:programs@oceanic.foundation?subject=Deep-Sea%20Census' },
    ],
  },
  {
    title: 'Reports',
    links: [
      { label: 'Annual Report 2025', href: 'mailto:reports@oceanic.foundation?subject=Annual%20Report%202025' },
      { label: 'Impact Audit', href: 'mailto:reports@oceanic.foundation?subject=Impact%20Audit' },
      { label: 'Financial Statements', href: 'mailto:reports@oceanic.foundation?subject=Financial%20Statements' },
    ],
  },
  {
    title: 'Press',
    links: [
      { label: 'Press Kit', href: 'mailto:press@oceanic.foundation?subject=Press%20Kit' },
      { label: 'Interview Requests', href: 'mailto:press@oceanic.foundation?subject=Interview%20Request' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Interface — the 8 scrolled sections                                 */
/* ------------------------------------------------------------------ */

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero, 0 m */}
      <section className="section section--center section--hero">
        <p className="tagline">OCEANIC Foundation · marine conservation NGO · est. 1998</p>
        <h1 className="hero-title">
          The ocean doesn’t need us.
          <br />
          We need <em>the ocean</em>.
        </h1>
        <p className="hero-sub">
          Scroll to descend — from the sunlit surface to the abyssal plain,
          <br />
          4,000 metres of life worth protecting.
        </p>
        <button className="cta" onClick={() => scrollToPage(1)}>
          Begin the descent ↓
        </button>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">dive</span>
        </div>
      </section>

      {/* 1 — Sunlit zone: mission */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — The sunlit zone · 0–200 m</p>
        <h2>
          Where light still
          <br />
          reaches, <em>life riots</em>.
        </h2>
        <p className="body">
          Ninety percent of marine life lives in this thin, bright lid of water. Our mission is
          blunt: keep it alive. We restore reefs, replant seagrass meadows and intercept plastic
          before it sinks out of reach — 23 field stations, 14 countries, one ocean.
        </p>
      </section>

      {/* 2 — Twilight zone: threats */}
      <section className="section section--top" data-num="02">
        <p className="kicker">02 — The twilight zone · 200–1,000 m</p>
        <h2>
          The light fades. <em>The pressure builds.</em>
        </h2>
        <div className="cards cards--threats">
          {THREATS.map((t) => (
            <article className="card" key={t.stat}>
              <strong className="card__stat">{t.stat}</strong>
              <span className="card__unit">{t.unit}</span>
              <p className="card__text">{t.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 3 — ROV lab */}
      <section className="section section--left" data-num="03">
        <p className="kicker">03 — The ROV lab · research programs</p>
        <h2>
          Science at <em>crush depth</em>.
        </h2>
        <p className="body">
          Our remotely operated vehicle NEREID-2 has logged 1,400 dive hours mapping seamounts,
          counting species and recovering ghost nets. Every dataset is open — every dive is
          public.
        </p>
        <p className="hint">→ grab the submarine and drag it through the dark</p>
      </section>

      {/* 4 — Midnight zone: bioluminescence */}
      <section className="section section--right" data-num="04">
        <p className="kicker">04 — The midnight zone · 1,000–3,800 m</p>
        <h2>
          Down here, life
          <br />
          makes its <em>own light</em>.
        </h2>
        <p className="body">
          No sun has ever reached this water. Yet three quarters of the animals here glow —
          signalling, hunting, surviving. Deep-sea mining threatens habitats we have not even
          named yet. We are fighting for a moratorium before the lights go out.
        </p>
      </section>

      {/* 5 — Species we protect */}
      <section className="section section--top" data-num="05">
        <p className="kicker">05 — Species we protect</p>
        <h2>
          Four lives on <em>the line</em>.
        </h2>
        <div className="cards cards--species">
          {SPECIES.map((s) => (
            <article className="card card--species" key={s.name}>
              <span className={`badge badge--${s.tone}`}>{s.status}</span>
              <strong className="card__name">{s.name}</strong>
              <p className="card__text">{s.range}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 6 — Donate (stateful) */}
      <DonateSection />

      {/* 7 — Footer at the sea floor */}
      <section className="section section--center section--footer">
        <div className="sonar" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <p className="kicker">07 — The sea floor · 4,000 m</p>
        <h2>
          You’ve reached <em>the bottom</em>.
        </h2>

        <div className="footer-columns">
          {FOOTER_COLUMNS.map((col) => (
            <div className="footer-col" key={col.title}>
              <h3>{col.title}</h3>
              <ul>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="transparency">
          87% of funds go directly to field programs — audited annually.
        </p>

        <button className="cta cta--ascend" onClick={() => scrollToPage(0)}>
          ↑ back to surface
        </button>

        <footer className="footer">
          <span>© OCEANIC Foundation 2026</span>
          <span>
            <a href="mailto:hello@oceanic.foundation">hello@oceanic.foundation</a>
          </span>
        </footer>
      </section>
    </div>
  )
}
