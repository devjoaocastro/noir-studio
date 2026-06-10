import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { scrollToPage } from '../scrollBus'
import { ROOMS, getActiveRoom, rotateCarouselTo, subscribeRoom } from '../roomBus'
import MagneticButton from './MagneticButton'

/* ------------------------------------------------------------------ */
/* RoomCard — DOM mirror of the 3D carousel, kept in sync via roomBus  */
/* ------------------------------------------------------------------ */

function RoomCard() {
  const [index, setIndex] = useState(getActiveRoom())

  useEffect(() => subscribeRoom(setIndex), [])

  const room = ROOMS[index]

  return (
    <aside className="room-card" key={room.id}>
      <div className="room-card__head">
        <button
          className="room-card__arrow"
          aria-label="Previous room"
          onClick={() => rotateCarouselTo((index + ROOMS.length - 1) % ROOMS.length)}
        >
          ←
        </button>
        <div className="room-card__title">
          <h3>{room.name}</h3>
          <p className="room-card__price">
            €{room.price}
            <span> / night</span>
          </p>
        </div>
        <button
          className="room-card__arrow"
          aria-label="Next room"
          onClick={() => rotateCarouselTo((index + 1) % ROOMS.length)}
        >
          →
        </button>
      </div>
      <p className="room-card__blurb">{room.blurb}</p>
      <ul className="room-card__amenities">
        {room.amenities.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <div className="room-card__dots" aria-hidden="true">
        {ROOMS.map((r, i) => (
          <button
            key={r.id}
            className={i === index ? 'is-on' : ''}
            onClick={() => rotateCarouselTo(i)}
            aria-label={r.name}
          />
        ))}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* BookingWidget — stateful date-range + guests + room + live total    */
/* ------------------------------------------------------------------ */

const DAY = 86400000

function fmt(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function BookingWidget() {
  const [checkInOffset, setCheckInOffset] = useState(14) // days from today
  const [nights, setNights] = useState(2)
  const [guests, setGuests] = useState(2)
  const [roomIndex, setRoomIndex] = useState(getActiveRoom())
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => subscribeRoom(setRoomIndex), [])

  const room = ROOMS[roomIndex]
  const total = nights * room.price

  const checkIn = useMemo(() => new Date(Date.now() + checkInOffset * DAY), [checkInOffset])
  const checkOut = useMemo(
    () => new Date(Date.now() + (checkInOffset + nights) * DAY),
    [checkInOffset, nights],
  )

  const mailto = useMemo(() => {
    const subject = encodeURIComponent(
      `Reservation — ${room.name}, ${fmt(checkIn)} → ${fmt(checkOut)} (${nights} night${nights > 1 ? 's' : ''}, ${guests} guest${guests > 1 ? 's' : ''}, €${total})`,
    )
    return `mailto:stay@velvet.lisbon?subject=${subject}`
  }, [room, checkIn, checkOut, nights, guests, total])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setConfirmed(true)
  }

  const bump = (fn: () => void) => () => {
    setConfirmed(false)
    fn()
  }

  return (
    <form className="booking" onSubmit={onSubmit}>
      <div className="booking__grid">
        <div className="booking__field">
          <span className="booking__label">Check-in</span>
          <div className="booking__stepper">
            <button
              type="button"
              aria-label="Earlier check-in"
              onClick={bump(() => setCheckInOffset((v) => Math.max(1, v - 1)))}
            >
              −
            </button>
            <strong>{fmt(checkIn)}</strong>
            <button
              type="button"
              aria-label="Later check-in"
              onClick={bump(() => setCheckInOffset((v) => Math.min(364, v + 1)))}
            >
              +
            </button>
          </div>
        </div>

        <div className="booking__field">
          <span className="booking__label">Check-out · {nights} night{nights > 1 ? 's' : ''}</span>
          <div className="booking__stepper">
            <button
              type="button"
              aria-label="Fewer nights"
              onClick={bump(() => setNights((v) => Math.max(1, v - 1)))}
            >
              −
            </button>
            <strong>{fmt(checkOut)}</strong>
            <button
              type="button"
              aria-label="More nights"
              onClick={bump(() => setNights((v) => Math.min(21, v + 1)))}
            >
              +
            </button>
          </div>
        </div>

        <div className="booking__field">
          <span className="booking__label">Guests</span>
          <div className="booking__stepper">
            <button
              type="button"
              aria-label="Fewer guests"
              onClick={bump(() => setGuests((v) => Math.max(1, v - 1)))}
            >
              −
            </button>
            <strong>
              {guests} guest{guests > 1 ? 's' : ''}
            </strong>
            <button
              type="button"
              aria-label="More guests"
              onClick={bump(() => setGuests((v) => Math.min(4, v + 1)))}
            >
              +
            </button>
          </div>
        </div>

        <div className="booking__field">
          <span className="booking__label">Room</span>
          <div className="booking__rooms">
            {ROOMS.map((r, i) => (
              <button
                key={r.id}
                type="button"
                className={i === roomIndex ? 'is-on' : ''}
                onClick={bump(() => {
                  setRoomIndex(i)
                  rotateCarouselTo(i)
                })}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="booking__total">
        <span>
          {nights} night{nights > 1 ? 's' : ''} × €{room.price}
        </span>
        <strong>€{total}</strong>
      </div>

      {confirmed ? (
        <p className="booking__done" role="status">
          Awaiting your arrival ✓
          <a href={mailto}>Send the details to stay@velvet.lisbon →</a>
        </p>
      ) : (
        <div className="booking__actions">
          <MagneticButton as="button" type="submit" className="cta cta--fill">
            Reserve
          </MagneticButton>
          <a className="booking__mail" href={mailto}>
            or email stay@velvet.lisbon
          </a>
        </div>
      )}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Interface — the 8 scroll pages                                      */
/* ------------------------------------------------------------------ */

const RITUALS = [
  { name: 'O Vapor', time: '45 min', note: 'Eucalyptus steam, cold plunge, silence.' },
  { name: 'A Pedra', time: '75 min', note: 'Hot basalt stones and rose-oil massage.' },
  { name: 'O Crepúsculo', time: '120 min', note: 'The full dusk ritual, ending on the roof.' },
]

const SPOTS = [
  { name: 'Miradouro de Santa Catarina', min: 3, kind: 'sunset terrace' },
  { name: 'Mercado da Ribeira', min: 8, kind: 'market hall' },
  { name: 'Ascensor da Bica', min: 5, kind: 'funicular' },
  { name: 'Praça Luís de Camões', min: 6, kind: 'square' },
]

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero */}
      <section className="section section--center section--hero">
        <p className="tagline">A petit hotel · Lisbon hillside · est. 2026</p>
        <h1 className="hero-title">
          Stay where the city
          <br />
          <em>blushes</em>.
        </h1>
        <p className="hero-sub">
          Three rooms, one table, a bath house — folded into a townhouse above the
          rooftops of Bica. Click the key. Stay a while.
        </p>
        <MagneticButton as="button" className="cta" onClick={() => scrollToPage(2)}>
          Browse the rooms ↓
        </MagneticButton>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">scroll</span>
        </div>
      </section>

      {/* 1 — The House */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — The House</p>
        <h2>
          A townhouse with
          <br />
          <em>velvet</em> manners.
        </h2>
        <p className="body">
          Built in 1877 for a silk merchant who never came home, restored in 2026 for
          people who never want to leave. Nine windows, one cat, and a curtain that
          only opens for guests.
        </p>
      </section>

      {/* 2 — Rooms (3D carousel + synced DOM card) */}
      <section className="section section--rooms" data-num="02">
        <div className="rooms-head">
          <p className="kicker">02 — Rooms</p>
          <h2>
            Three rooms, <em>no two alike</em>.
          </h2>
          <p className="hint">↔ drag to browse rooms</p>
        </div>
        <RoomCard />
      </section>

      {/* 3 — The Table */}
      <section className="section section--right" data-num="03">
        <p className="kicker">03 — The Table</p>
        <h2>
          One table,
          <br />
          <em>twelve chairs</em>.
        </h2>
        <p className="body">
          A seven-course tasting menu that follows the market, not a script. Wines
          from slopes you can almost see. Guests eat together — that's the point.
        </p>
        <p className="hours">
          Dinner · Wed – Sun · 19:30 — one seating
          <br />
          Breakfast · every day · 08:00 – 11:00
        </p>
      </section>

      {/* 4 — The Bath House */}
      <section className="section section--left" data-num="04">
        <p className="kicker">04 — The Bath House</p>
        <h2>
          Steam, stone,
          <br />
          and <em>slow time</em>.
        </h2>
        <ul className="rituals">
          {RITUALS.map((r) => (
            <li key={r.name}>
              <strong>{r.name}</strong>
              <span className="rituals__time">{r.time}</span>
              <span className="rituals__note">{r.note}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 5 — Neighbourhood */}
      <section className="section section--right" data-num="05">
        <p className="kicker">05 — Neighbourhood</p>
        <h2>
          Everything worth loving is
          <br />
          a <em>short walk</em> downhill.
        </h2>
        <ul className="spots">
          {SPOTS.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>
              <span>
                {s.kind} · {s.min} min on foot
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 6 — Book */}
      <section className="section section--center section--book" data-num="06">
        <p className="kicker">06 — Book</p>
        <h2>
          The curtain is <em>held</em> for you.
        </h2>
        <BookingWidget />
      </section>

      {/* 7 — Footer: hotel key card */}
      <section className="section section--center section--footer" data-num="07">
        <div className="keycard">
          <div className="keycard__stripe" aria-hidden="true" />
          <div className="keycard__body">
            <div className="keycard__brand">
              <span className="keycard__logo">VELVET</span>
              <span className="keycard__stars" aria-label="Five stars">
                ★★★★★
              </span>
            </div>
            <p className="keycard__motto">Petit but mighty.</p>

            <address className="keycard__address">
              Calçada do Combro 99 · Lisboa
            </address>

            <div className="keycard__contacts">
              <a href="tel:+351210000099">+351 210 000 099</a>
              <a href="mailto:stay@velvet.lisbon">stay@velvet.lisbon</a>
            </div>

            <nav className="keycard__columns">
              <div>
                <h4>Press</h4>
                <a href="mailto:press@velvet.lisbon">press@velvet.lisbon</a>
                <a href="https://maps.google.com/?q=Cal%C3%A7ada+do+Combro+99+Lisboa" target="_blank" rel="noreferrer">
                  Find us on the hill
                </a>
              </div>
              <div>
                <h4>Gift cards</h4>
                <a href="mailto:gifts@velvet.lisbon">gifts@velvet.lisbon</a>
                <a href="tel:+351210000099">Order by phone</a>
              </div>
              <div>
                <h4>Private hire</h4>
                <a href="mailto:events@velvet.lisbon">events@velvet.lisbon</a>
                <a href="mailto:stay@velvet.lisbon?subject=Whole-house%20takeover">Whole-house takeover</a>
              </div>
            </nav>

            <p className="keycard__legal">© VELVET Hotel 2026 · room 00 is the city itself</p>
          </div>
        </div>
      </section>
    </div>
  )
}
