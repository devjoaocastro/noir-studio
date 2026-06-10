import { useState } from 'react'
import { scrollToPage } from '../scrollBus'
import MagneticCTA from './MagneticCTA'

const UNIT_PRICE = 549

/* ------------------------------------------------------------------ */
/* Pre-order — STATEFUL: quantity stepper updating the total price,    */
/* then a magnetic CTA that opens a prefilled mailto.                  */
/* ------------------------------------------------------------------ */

function PreOrder() {
  const [qty, setQty] = useState(1)
  const total = qty * UNIT_PRICE

  const subject = encodeURIComponent('Pre-order MONOLITH-8')
  const body = encodeURIComponent(
    `Hi SYNTH LAB,\n\nI'd like to pre-order ${qty}× MONOLITH-8 (total €${total.toLocaleString('en-IE')}).\n\nName:\nShipping address:\n`,
  )
  const href = `mailto:orders@synthlab.audio?subject=${subject}&body=${body}`

  return (
    <div className="preorder">
      <div className="preorder__row">
        <span className="preorder__name">MONOLITH-8</span>
        <span className="preorder__unit">€{UNIT_PRICE} / unit</span>
      </div>
      <div className="preorder__row">
        <div className="stepper" role="group" aria-label="quantity">
          <button
            className="stepper__btn"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="decrease quantity"
          >
            −
          </button>
          <span className="stepper__qty">{qty}</span>
          <button
            className="stepper__btn"
            onClick={() => setQty((q) => Math.min(8, q + 1))}
            disabled={qty >= 8}
            aria-label="increase quantity"
          >
            +
          </button>
        </div>
        <span className="preorder__total">
          total <strong>€{total.toLocaleString('en-IE')}</strong>
        </span>
      </div>
      <MagneticCTA href={href} className="cta cta--big">
        Pre-order — €{total.toLocaleString('en-IE')}
      </MagneticCTA>
      <p className="preorder__note">first batch ships Q3 2026 · fully refundable</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Patch-bay footer — hovering a jack socket lights a colored cable    */
/* path to its patched partner.                                        */
/* ------------------------------------------------------------------ */

const JACKS = [
  { label: 'OSC IN', x: 14, y: 12 },
  { label: 'CV 1', x: 38, y: 12 },
  { label: 'GATE', x: 62, y: 12 },
  { label: 'CLK', x: 86, y: 12 },
  { label: 'MAIN OUT', x: 14, y: 36 },
  { label: 'MOD', x: 38, y: 36 },
  { label: 'FX SEND', x: 62, y: 36 },
  { label: 'MIX', x: 86, y: 36 },
]

const PATCHES: { a: number; b: number; color: string }[] = [
  { a: 0, b: 5, color: '#ff5500' },
  { a: 1, b: 4, color: '#4afa6e' },
  { a: 2, b: 7, color: '#e8e2d6' },
  { a: 3, b: 6, color: '#ff5500' },
]

function PatchBay() {
  const [active, setActive] = useState<number | null>(null)
  const patchFor = (jack: number) => PATCHES.findIndex((p) => p.a === jack || p.b === jack)

  return (
    <div className="patchbay" aria-label="patch bay">
      <svg viewBox="0 0 100 48" preserveAspectRatio="none" aria-hidden="true">
        {PATCHES.map((p, i) => {
          const A = JACKS[p.a]
          const B = JACKS[p.b]
          const sag = Math.max(A.y, B.y) + 16
          const lit = active === i
          return (
            <path
              key={i}
              d={`M ${A.x} ${A.y} C ${A.x} ${sag}, ${B.x} ${sag}, ${B.x} ${B.y}`}
              className={`patch${lit ? ' patch--lit' : ''}`}
              style={lit ? { stroke: p.color } : undefined}
            />
          )
        })}
      </svg>
      {JACKS.map((j, i) => {
        const patch = patchFor(i)
        const lit = active !== null && active === patch
        return (
          <button
            key={j.label}
            className={`socket${lit ? ' socket--lit' : ''}`}
            style={{ left: `${j.x}%`, top: `${(j.y / 48) * 100}%` }}
            onMouseEnter={() => setActive(patch)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(patch)}
            onBlur={() => setActive(null)}
          >
            <span
              className="socket__hole"
              style={lit ? { borderColor: PATCHES[patch].color, boxShadow: `0 0 14px ${PATCHES[patch].color}` } : undefined}
            />
            <span className="socket__label">{j.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page interface — 8 full-height scroll sections.                     */
/* ------------------------------------------------------------------ */

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero + playable synth */}
      <section className="section section--hero">
        <p className="kicker">SYNTH LAB · BERLIN · MONOLITH-8</p>
        <h1 className="hero-title">
          An <em>instrument</em>,<br />
          not an appliance.
        </h1>
        <p className="play-hint">▶ click the keys · drag the knobs</p>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">scroll</span>
        </div>
      </section>

      {/* 1 — Philosophy */}
      <section className="section section--right" data-num="01">
        <p className="kicker">01 — Philosophy</p>
        <h2>
          Machines should
          <br />
          <em>talk back</em>.
        </h2>
        <p className="body">
          Software pretends. Hardware argues. The MONOLITH-8 has no menus, no pages, no
          shift-functions — one knob per job, one job per knob. If you can see it, you can grab
          it. If you can grab it, it makes sound.
        </p>
      </section>

      {/* 2 — The engine */}
      <section className="section section--top" data-num="02">
        <p className="kicker">02 — The engine</p>
        <h2>
          Brutally <em>analog</em>.
        </h2>
        <div className="cards">
          <article className="card">
            <span className="card__num">8</span>
            <h3>8-voice analog core</h3>
            <p>
              Discrete VCOs per voice, thermally drifting just enough to sound alive. Polyphony
              you can feel in your chest.
            </p>
          </article>
          <article className="card">
            <span className="card__num">64</span>
            <h3>64-step sequencer</h3>
            <p>
              Per-step probability, ratchets and parameter locks. Program a groove with your eyes
              closed — every step is a physical press.
            </p>
          </article>
          <article className="card">
            <span className="card__num">CV</span>
            <h3>CV everything</h3>
            <p>
              Twelve patch points on the rear bus. Every knob is a destination, every output is a
              source. Your modular already loves it.
            </p>
          </article>
        </div>
      </section>

      {/* 3 — Sound design playground */}
      <section className="section section--right" data-num="03">
        <p className="kicker">03 — Sound design</p>
        <h2>
          Shape the <em>wave</em>,<br />
          watch it bend.
        </h2>
        <p className="body">
          The scope never lies. Drag <strong className="mono-strong">MORPH</strong> to sweep the
          oscillator from pure sine to ripping saw, drag{' '}
          <strong className="mono-strong">CUTOFF</strong> to choke the filter — then hit a key
          and watch the phosphor trace do exactly what you told it to.
        </p>
        <p className="hint">↖ the oscilloscope is live — go on, drag it</p>
      </section>

      {/* 4 — Artists */}
      <section className="section section--top" data-num="04">
        <p className="kicker">04 — Artists</p>
        <h2>
          In serious <em>hands</em>.
        </h2>
        <div className="quotes">
          <blockquote className="quote">
            <p>“I sold three vintage polys after a weekend with it. The filter snarls.”</p>
            <footer>
              <strong>KAS:ST</strong>
              <span>Berlin · techno</span>
            </footer>
          </blockquote>
          <blockquote className="quote">
            <p>“It's the first synth in years that made me miss my train stop.”</p>
            <footer>
              <strong>Lena Hoff</strong>
              <span>Oslo · film scores</span>
            </footer>
          </blockquote>
          <blockquote className="quote">
            <p>“No presets means every show is mine. Terrifying. Perfect.”</p>
            <footer>
              <strong>R. Okafor</strong>
              <span>London · live electronics</span>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* 5 — Specs */}
      <section className="section section--right" data-num="05">
        <p className="kicker">05 — Specifications</p>
        <h2>
          The <em>numbers</em>.
        </h2>
        <table className="specs">
          <tbody>
            <tr>
              <td>voices</td>
              <td>8 × discrete analog</td>
            </tr>
            <tr>
              <td>oscillators</td>
              <td>2 VCO + sub per voice</td>
            </tr>
            <tr>
              <td>filter</td>
              <td>4-pole transistor ladder</td>
            </tr>
            <tr>
              <td>sequencer</td>
              <td>64 steps · 8 tracks</td>
            </tr>
            <tr>
              <td>patch points</td>
              <td>12 × CV/gate (3.5 mm)</td>
            </tr>
            <tr>
              <td>i/o</td>
              <td>stereo 6.3 mm · MIDI in/out/thru</td>
            </tr>
            <tr>
              <td>power</td>
              <td>USB-C PD · 20 W</td>
            </tr>
            <tr>
              <td>weight</td>
              <td>1.8 kg · powder-coated steel</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 6 — Pre-order */}
      <section className="section section--center" data-num="06">
        <p className="kicker">06 — Pre-order</p>
        <h2>
          Claim a <em>serial number</em>.
        </h2>
        <PreOrder />
      </section>

      {/* 7 — Footer / patch-bay */}
      <section className="section section--footer" data-num="07">
        <p className="kicker">07 — Connections</p>
        <PatchBay />
        <div className="footer-cols">
          <div className="footer-col">
            <h4>Documents</h4>
            <a href="mailto:support@synthlab.audio?subject=Manual%20PDF%20request">
              Manual PDF (by request)
            </a>
            <a href="mailto:support@synthlab.audio?subject=Warranty">Warranty</a>
          </div>
          <div className="footer-col">
            <h4>Machine</h4>
            <a href="mailto:firmware@synthlab.audio?subject=Firmware%20channel">Firmware</a>
            <a href="mailto:orders@synthlab.audio?subject=Pre-order%20MONOLITH-8">Orders</a>
          </div>
          <div className="footer-col">
            <h4>Back up</h4>
            <button className="footer-link" onClick={() => scrollToPage(0)}>
              ↑ back to the instrument
            </button>
            <button className="footer-link" onClick={() => scrollToPage(6)}>
              pre-order
            </button>
          </div>
        </div>
        <p className="microtext">© SYNTH LAB 2026 · Berlin · no presets, no excuses</p>
      </section>
    </div>
  )
}
