import { useState } from 'react'
import { scrollToPage } from '../scrollBus'
import MagneticButton from './MagneticButton'

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const SERVICES = [
  {
    id: 'direction',
    label: 'Direction',
    title: 'Stories built shot by shot.',
    body: 'Treatment, casting, blocking, performance. We direct fiction, commercials and music film with one obsession: the frame must earn its darkness. Nothing decorative survives the storyboard.',
    items: ['Treatment & storyboards', 'Casting & performance direction', 'On-set direction & blocking', 'Second unit & pickups'],
  },
  {
    id: 'post',
    label: 'Post',
    title: 'The cut is the final rewrite.',
    body: 'Editorial, VFX supervision and conform under one roof. Our editors sit three meters from the colorists, which is exactly how far a bad cut travels before someone stops it.',
    items: ['Editorial & assembly', 'VFX supervision & compositing', 'Conform & mastering', 'Deliverables for every festival spec'],
  },
  {
    id: 'color',
    label: 'Color',
    title: 'Black is a color. We prove it.',
    body: 'Grading suites calibrated for the dark end of the curve. We protect shadow detail the way other houses protect highlights — because that is where our films live.',
    items: ['Look development & LUTs', 'DI grading (HDR & SDR)', 'On-set color management', 'Print emulation passes'],
  },
  {
    id: 'sound',
    label: 'Sound',
    title: 'What you hear in the dark.',
    body: 'Design, foley and final mix. Silence is our loudest instrument: we build mixes that breathe, then take the air away exactly when the picture demands it.',
    items: ['Sound design & foley', 'ADR & dialogue editing', 'Original score supervision', '5.1 / Atmos final mix'],
  },
]

const FILMS = [
  { title: 'VANTABLACK', year: '2026', kind: 'Feature', laurel: 'Official Selection — Locarno Film Festival' },
  { title: 'A LONGA NOITE', year: '2025', kind: 'Feature', laurel: 'Best Cinematography — IndieLisboa' },
  { title: 'SODIUM', year: '2025', kind: 'Short', laurel: 'Grand Prix — Curtas Vila do Conde' },
  { title: 'THE PROJECTIONIST', year: '2024', kind: 'Documentary', laurel: 'Special Mention — DocLisboa' },
]

const PROCESS = [
  { t: 'Pitch', d: 'You bring the impossible. We listen in the dark and say yes too quickly.' },
  { t: 'Develop', d: 'Treatment, lookbook, budget. The film exists on paper before a single lamp is rented.' },
  { t: 'Shoot', d: 'Small crew, long nights. We light with shadows first and fill second.' },
  { t: 'Post', d: 'Cut, grade, mix — all in-house, all three meters apart.' },
  { t: 'Premiere', d: 'A dark room, a loud mix, and your name in silver on black.' },
]

const CREDITS: Array<[string, string]> = [
  ['Directed by', 'Vera Antunes'],
  ['Director of Photography', 'Milo Sequeira'],
  ['Executive Producer', 'Rita Caldeira'],
  ['Production Designer', 'Tomás Brandão'],
  ['Editor', 'Inês Varela'],
  ['Colorist', 'Duarte Lobo'],
  ['Sound Designer', 'Marta Espírito Santo'],
  ['Composer', 'Élio Carmo'],
  ['Gaffer', 'Paulo "Lumens" Mendes'],
  ['Key Grip', 'Sofia Trindade'],
  ['First AC', 'Nuno Bastos'],
  ['Script Supervisor', 'Helena Cruz'],
  ['Foley Artist', 'Bruno Paixão'],
  ['Still Photographer', 'Catarina Mota'],
]

/* ------------------------------------------------------------------ */

export default function Interface() {
  const [tab, setTab] = useState(0)
  const active = SERVICES[tab]

  return (
    <div className="interface">
      {/* 0 — Hero */}
      <section className="section section--center section--hero">
        <p className="tagline">Film production studio · Lisboa</p>
        <h1 className="hero-title">
          We shoot
          <br />
          in the <em>dark</em>.
        </h1>
        <p className="hero-sub">
          NOIR makes films for the shadow end of the curve.
          <br />
          Direction · Post · Color · Sound
        </p>
        <button className="cta" onClick={() => scrollToPage(1)}>
          Roll the reel ↓
        </button>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">scroll</span>
        </div>
      </section>

      {/* 1 — Showreel manifesto */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — Showreel</p>
        <h2>
          Light is what
          <br />
          you <em>remove</em>.
        </h2>
        <p className="body">
          Every frame we ship starts black. Then we allow exactly enough light back in to tell the
          truth — and not one stop more. That discipline is the whole studio: it is in our grades,
          our mixes and our contracts.
        </p>
        <p className="hint">→ click the clapperboard. action.</p>
      </section>

      {/* 2 — Services (stateful tabs) */}
      <section className="section section--left" data-num="02">
        <p className="kicker">02 — Services</p>
        <h2>
          Four rooms,
          <br />
          one <em>negative</em>.
        </h2>
        <div className="tabs">
          <div className="tabs__nav" role="tablist" aria-label="Services">
            {SERVICES.map((s, i) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={i === tab}
                className={i === tab ? 'is-active' : ''}
                onClick={() => setTab(i)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="tabs__panel" role="tabpanel" key={active.id}>
            <h3>{active.title}</h3>
            <p>{active.body}</p>
            <ul>
              {active.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 3 — The scrub room (draggable reel) */}
      <section className="section section--top" data-num="03">
        <p className="kicker">03 — The Scrub Room</p>
        <h2>
          Relight the <em>scene</em>.
        </h2>
        <p className="hint">← drag the reel →</p>
        <p className="body body--thin">
          Spin the film reel and the key light walks around the miniature. This is how we block
          every scene before the trucks roll: in the dark, by hand.
        </p>
      </section>

      {/* 4 — Selected films */}
      <section className="section section--top" data-num="04">
        <p className="kicker">04 — Selected Films</p>
        <h2>
          Shot here. <em>Seen</em> everywhere.
        </h2>
        <ul className="films">
          {FILMS.map((f) => (
            <li key={f.title}>
              <em>{f.title}</em>
              <span className="films__meta">
                {f.year} · {f.kind}
              </span>
              <span className="films__laurel">❧ {f.laurel} ❧</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 5 — Process */}
      <section className="section section--top" data-num="05">
        <p className="kicker">05 — Process</p>
        <h2>
          Five steps into the <em>dark</em>.
        </h2>
        <ol className="timeline">
          {PROCESS.map((p, i) => (
            <li key={p.t}>
              <span className="timeline__num">0{i + 1}</span>
              <strong>{p.t}</strong>
              <p>{p.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 6 — Contact */}
      <section className="section section--center" data-num="06">
        <p className="kicker">06 — Contact</p>
        <h2>
          Pitch us the <em>impossible</em>.
        </h2>
        <p className="body body--center">
          One paragraph. No deck required. If it scares us a little, you will hear back the same
          night.
        </p>
        <MagneticButton className="cta cta--big" href="mailto:pitch@noir.film?subject=The%20impossible%20pitch">
          pitch@noir.film
        </MagneticButton>
        <a className="contact-tel" href="tel:+351210940000">
          +351 210 940 000
        </a>
      </section>

      {/* 7 — Footer: end credits */}
      <section className="section section--center section--footer">
        <p className="footer-end">FIN</p>
        <div className="credits" data-cursor>
          <div className="credits__roll" aria-hidden="false">
            {[...CREDITS, ...CREDITS].map(([role, name], i) => (
              <div className="credits__row" key={`${role}-${i}`}>
                <span>{role}</span>
                <strong>{name}</strong>
              </div>
            ))}
          </div>
        </div>
        <p className="credits-hint">hover to pause the credits</p>
        <div className="footer-base">
          <span>© NOIR Films Lda {new Date().getFullYear()} · Lisboa</span>
          <nav className="footer-links">
            <a href="https://www.instagram.com" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href="https://vimeo.com" target="_blank" rel="noreferrer">
              Vimeo
            </a>
            <a href="mailto:pitch@noir.film">pitch@noir.film</a>
            <a href="tel:+351210940000">+351 210 940 000</a>
          </nav>
        </div>
      </section>
    </div>
  )
}
