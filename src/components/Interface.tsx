import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { scrollToPage } from '../scrollBus'
import { DEFAULT_TINT, TIERS, setTier, setTint, type Tier } from '../lib/aura'

/* ------------------------------------------------------------------ */
/* MagneticCta — the button leans towards the cursor and springs back. */
/* ------------------------------------------------------------------ */

function MagneticCta({ href, children }: { href: string; children: string }) {
  const ref = useRef<HTMLAnchorElement>(null!)

  const onMove = (e: ReactPointerEvent<HTMLAnchorElement>) => {
    const r = ref.current.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    ref.current.style.transform = `translate(${(dx * 0.28).toFixed(1)}px, ${(dy * 0.34).toFixed(1)}px)`
  }

  const onLeave = () => {
    ref.current.style.transform = 'translate(0px, 0px)'
  }

  return (
    <a ref={ref} className="cta cta--magnetic" href={href} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* Pyramid — STATEFUL: clicking a tier updates the description panel   */
/* AND the 3D aura (particle colour/speed/shape + fog tint).           */
/* ------------------------------------------------------------------ */

const TIER_ORDER: Tier[] = ['top', 'heart', 'base']

const TIER_COPY: Record<Tier, { title: string; body: string }> = {
  top: {
    title: 'The first ten minutes',
    body: 'Calabrian bergamot cut with pink pepper — a cold flash of citrus and spice that opens the skin like a window at dawn. It is loud only once, then it steps aside.',
  },
  heart: {
    title: 'Hours two through six',
    body: 'Orris butter and ripe fig: powdered violet root against green milk-sap. This is the perfume people lean in to find — it never travels further than an embrace.',
  },
  base: {
    title: 'Until tomorrow',
    body: 'Fossilised amber and Atlas cedar, fused at skin temperature. The accord that remains on a scarf for weeks — the reason we say worn, not sprayed.',
  },
}

function Pyramid() {
  const [active, setActive] = useState<Tier>('top')

  const select = (tier: Tier) => {
    setActive(tier)
    setTier(tier) // → 3D aura morphs (colour, speed, particle scale, fog)
  }

  return (
    <div className="pyramid">
      <div className="pyramid__tiers" role="tablist" aria-label="Scent pyramid">
        {TIER_ORDER.map((tier, i) => (
          <button
            key={tier}
            role="tab"
            aria-selected={active === tier}
            className={`tier tier--${i} ${active === tier ? 'tier--active' : ''}`}
            onClick={() => select(tier)}
          >
            <strong>{TIERS[tier].label}</strong>
            <span>{TIERS[tier].notes}</span>
          </button>
        ))}
      </div>
      <div className="pyramid__panel" role="tabpanel">
        <p className="pyramid__eyebrow">{TIERS[active].label} — {TIERS[active].notes}</p>
        <h3>{TIER_COPY[active].title}</h3>
        <p>{TIER_COPY[active].body}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Collection — hovering an eau re-tints the liquid gold in the flacon */
/* ------------------------------------------------------------------ */

const EAUX = [
  { no: 'Nº1', name: 'Amber', tint: '#e6c36a', mood: 'fossil resin · warm skin' },
  { no: 'Nº2', name: 'Vert', tint: '#a3b06a', mood: 'fig leaf · crushed stem' },
  { no: 'Nº3', name: 'Noir', tint: '#6b5639', mood: 'smoked cedar · night air' },
]

function Collection() {
  return (
    <ul className="eaux">
      {EAUX.map((eau) => (
        <li key={eau.no}>
          <button
            className="eau"
            onMouseEnter={() => setTint(eau.tint)}
            onMouseLeave={() => setTint(DEFAULT_TINT)}
            onFocus={() => setTint(eau.tint)}
            onBlur={() => setTint(DEFAULT_TINT)}
            onClick={() => scrollToPage(6)}
          >
            <span className="eau__swatch" style={{ background: eau.tint }} aria-hidden="true" />
            <span className="eau__no">{eau.no}</span>
            <span className="eau__name">AURUM {eau.no} <em>{eau.name}</em></span>
            <span className="eau__mood">{eau.mood}</span>
            <span className="eau__price">€185 · 50&thinsp;ml</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Interface — eight spreads of porcelain whitespace                   */
/* ------------------------------------------------------------------ */

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero */}
      <section className="section section--center section--hero">
        <p className="tagline">Niche fragrance house · Lisboa · est. 1987</p>
        <h1 className="hero-title">
          Worn, not <em>sprayed</em>.
        </h1>
        <p className="hero-sub">
          One extrait. Three eaux. Liquid gold macerated for four hundred days.
        </p>
        <p className="drag-hint">✦ drag the flacon to turn it — the stopper lifts</p>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">scroll</span>
        </div>
      </section>

      {/* 1 — The Maison */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — The Maison</p>
        <h2>
          A house of <em>one</em> idea.
        </h2>
        <p className="body body--story">
          <em>
            In 1987 a goldsmith in Chiado stopped setting stones and began setting scent —
            convinced that a perfume, like a ring, should be made to be worn for decades,
            polished by skin, inherited rather than finished. Everything we bottle still
            answers to that single conviction.
          </em>
        </p>
      </section>

      {/* 2 — The Pyramid (STATEFUL) */}
      <section className="section section--right" data-num="02">
        <p className="kicker">02 — The Pyramid</p>
        <h2>
          Read the <em>structure</em>.
        </h2>
        <p className="hint">→ select a tier; the aura around the flacon answers</p>
        <Pyramid />
      </section>

      {/* 3 — The Eau */}
      <section className="section section--center" data-num="03">
        <p className="kicker">03 — The Eau</p>
        <h2>
          Extrait de parfum. <em>28%</em>.
        </h2>
        <p className="body">
          Most houses stop at 15. We macerate to twenty-eight percent pure absolute —
          the concentration where a fragrance stops projecting and starts belonging.
          No alcohol burn, no first-hour shout: a slow, private signature.
        </p>
        <div className="stats">
          <div>
            <strong>28%</strong>
            <span>absolute</span>
          </div>
          <div>
            <strong>400</strong>
            <span>days macerated</span>
          </div>
          <div>
            <strong>12h+</strong>
            <span>on skin</span>
          </div>
        </div>
      </section>

      {/* 4 — Rituals */}
      <section className="section section--right" data-num="04">
        <p className="kicker">04 — Rituals</p>
        <h2>
          How it is <em>worn</em>.
        </h2>
        <ol className="rituals">
          <li>
            <span>I</span>
            <div>
              <strong>One drop, never a spray.</strong>
              <p>Touch the stopper to the inner wrist. The glass rod measures exactly what an evening needs.</p>
            </div>
          </li>
          <li>
            <span>II</span>
            <div>
              <strong>Warm, do not rub.</strong>
              <p>Press wrist to wrist for three seconds. Friction breaks the top notes; warmth opens them.</p>
            </div>
          </li>
          <li>
            <span>III</span>
            <div>
              <strong>Let it close the door.</strong>
              <p>Apply before dressing, not after. Extrait is meant to rise through fabric, hours later, as a rumour.</p>
            </div>
          </li>
        </ol>
      </section>

      {/* 5 — The Collection */}
      <section className="section section--top" data-num="05">
        <p className="kicker">05 — The Collection</p>
        <h2>
          Three <em>eaux</em>.
        </h2>
        <p className="hint">→ hover an eau; the gold in the flacon changes its mind</p>
        <Collection />
      </section>

      {/* 6 — Atelier */}
      <section className="section section--left" data-num="06">
        <p className="kicker">06 — Atelier</p>
        <h2>
          By <em>appointment</em>.
        </h2>
        <p className="body">
          The atelier in Chiado receives four visitors a day. An hour at the organ,
          the three eaux on your skin — not on paper — and a bottle engraved while you wait.
        </p>
        <MagneticCta href="mailto:atelier@aurum.pt?subject=Appointment%20request%20—%20Atelier%20Chiado">
          Request appointment
        </MagneticCta>
        <p className="atelier-mail">
          or write to <a href="mailto:atelier@aurum.pt">atelier@aurum.pt</a>
        </p>
      </section>

      {/* 7 — Footer */}
      <section className="section section--center section--footer" data-num="07">
        <div className="seal" aria-hidden="true">
          <div className="seal__ring" />
          <div className="seal__inner">A</div>
        </div>
        <p className="footer-address">
          Rua Garrett 112, Chiado — 1200-205 Lisboa
          <br />
          Tuesday to Saturday, 11:00 — 19:00
        </p>
        <nav className="footer-cols">
          <a href="mailto:stockists@aurum.pt">Stockists</a>
          <a href="mailto:press@aurum.pt">Press</a>
          <a href="mailto:care@aurum.pt">Care</a>
        </nav>
        <p className="footer-craft">Crafted in Portugal · 100% recycled glass</p>
        <p className="footer-legal">© AURUM Parfums 1987–2026</p>
      </section>
    </div>
  )
}
