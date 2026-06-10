/**
 * MONOLITH-8 voice engine — pure WebAudio, no audio files.
 *
 * The AudioContext is created lazily on the first key press (autoplay
 * policies), every note runs through a shared lowpass BiquadFilter (the
 * CUTOFF knob) and a master gain (the header mute toggle).
 */

export const NOTE_NAMES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'] as const

/** One octave, C major. */
const NOTE_FREQS = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25]

let ctx: AudioContext | null = null
let filter: BiquadFilterNode | null = null
let master: GainNode | null = null

let muted = false
let cutoff01 = 0.7
let lastNoteAt = -Infinity

const MASTER_LEVEL = 0.5

/** Exponential map 0..1 → 110 Hz .. 12 kHz. */
function cutoffHz(v: number) {
  return 110 * Math.pow(12000 / 110, Math.min(1, Math.max(0, v)))
}

function ensureContext(): AudioContext {
  if (!ctx) {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()

    filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoffHz(cutoff01)
    filter.Q.value = 2.0

    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER_LEVEL

    filter.connect(master)
    master.connect(ctx.destination)
  }
  // If the browser blocked audio, the first user gesture (a key click) resumes it.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Play one of the 8 keys: dual detuned oscillators, fast attack, soft release. */
export function playNote(index: number) {
  const ac = ensureContext()
  const freq = NOTE_FREQS[Math.min(NOTE_FREQS.length - 1, Math.max(0, index))]
  const t = ac.currentTime

  const env = ac.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.3, t + 0.008) // quick attack
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.65) // release tail

  const oscA = ac.createOscillator()
  oscA.type = 'sawtooth'
  oscA.frequency.value = freq

  const oscB = ac.createOscillator()
  oscB.type = 'square'
  oscB.frequency.value = freq
  oscB.detune.value = 7 // slight analog drift

  const mixB = ac.createGain()
  mixB.gain.value = 0.35

  oscA.connect(env)
  oscB.connect(mixB)
  mixB.connect(env)
  env.connect(filter!)

  oscA.start(t)
  oscB.start(t)
  oscA.stop(t + 0.7)
  oscB.stop(t + 0.7)

  lastNoteAt = performance.now()
}

/** CUTOFF knob (0..1) → filter frequency. */
export function setCutoff(v: number) {
  cutoff01 = Math.min(1, Math.max(0, v))
  if (filter && ctx) filter.frequency.setTargetAtTime(cutoffHz(cutoff01), ctx.currentTime, 0.03)
}

export function getCutoff() {
  return cutoff01
}

export function setMuted(m: boolean) {
  muted = m
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, ctx.currentTime, 0.02)
}

export function isMuted() {
  return muted
}

/** 0..1 envelope of recent note activity — drives the speaker pulse & screen glow. */
export function notePulse(): number {
  const dt = (performance.now() - lastNoteAt) / 1000
  return Math.max(0, Math.exp(-dt * 4.5))
}
