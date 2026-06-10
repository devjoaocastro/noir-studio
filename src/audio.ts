/**
 * Lazy WebAudio engine — everything is created on the first init() call,
 * which happens from the START button click (user gesture gates the
 * AudioContext). All sounds are synthesized: no assets to load.
 */

interface Nodes {
  ctx: AudioContext
  master: GainNode
  engineGain: GainNode
  engineOscA: OscillatorNode
  engineOscB: OscillatorNode
  engineFilter: BiquadFilterNode
  driftGain: GainNode
}

const MASTER_LEVEL = 0.55

class GameAudio {
  private nodes: Nodes | null = null
  private muted = false

  init() {
    if (this.nodes) {
      void this.nodes.ctx.resume()
      return
    }
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()

    const master = ctx.createGain()
    master.gain.value = this.muted ? 0 : MASTER_LEVEL
    master.connect(ctx.destination)

    /* Engine hum: two detuned oscillators through a lowpass. */
    const engineGain = ctx.createGain()
    engineGain.gain.value = 0
    const engineFilter = ctx.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 420
    const engineOscA = ctx.createOscillator()
    engineOscA.type = 'sawtooth'
    engineOscA.frequency.value = 55
    const engineOscB = ctx.createOscillator()
    engineOscB.type = 'triangle'
    engineOscB.frequency.value = 110
    engineOscA.connect(engineFilter)
    engineOscB.connect(engineFilter)
    engineFilter.connect(engineGain)
    engineGain.connect(master)
    engineOscA.start()
    engineOscB.start()

    /* Drift hiss: looping white noise through a bandpass. */
    const noiseLen = ctx.sampleRate
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = noiseBuf
    noiseSrc.loop = true
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 950
    noiseFilter.Q.value = 0.8
    const driftGain = ctx.createGain()
    driftGain.gain.value = 0
    noiseSrc.connect(noiseFilter)
    noiseFilter.connect(driftGain)
    driftGain.connect(master)
    noiseSrc.start()

    this.nodes = { ctx, master, engineGain, engineOscA, engineOscB, engineFilter, driftGain }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (!this.nodes) return
    const { master, ctx } = this.nodes
    master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, ctx.currentTime, 0.05)
  }

  /** Called every frame by the car. */
  update(speed01: number, drifting: boolean, boosting: boolean, running: boolean) {
    const n = this.nodes
    if (!n) return
    const t = n.ctx.currentTime
    const rev = speed01 + (boosting ? 0.22 : 0)
    n.engineOscA.frequency.setTargetAtTime(50 + rev * 105, t, 0.08)
    n.engineOscB.frequency.setTargetAtTime(100 + rev * 210, t, 0.08)
    n.engineFilter.frequency.setTargetAtTime(380 + rev * 900, t, 0.1)
    n.engineGain.gain.setTargetAtTime(running ? 0.05 + rev * 0.09 : 0, t, 0.1)
    n.driftGain.gain.setTargetAtTime(drifting && speed01 > 0.15 ? 0.14 : 0, t, 0.06)
  }

  private blip(freq: number, time: number, dur: number, type: OscillatorType, level: number) {
    const n = this.nodes
    if (!n) return
    const osc = n.ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = n.ctx.createGain()
    g.gain.setValueAtTime(0, time)
    g.gain.linearRampToValueAtTime(level, time + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    osc.connect(g)
    g.connect(n.master)
    osc.start(time)
    osc.stop(time + dur + 0.05)
  }

  honk() {
    const n = this.nodes
    if (!n) return
    const t = n.ctx.currentTime
    this.blip(392, t, 0.28, 'square', 0.16)
    this.blip(494, t, 0.28, 'square', 0.13)
  }

  bonk() {
    const n = this.nodes
    if (!n) return
    const t = n.ctx.currentTime
    const osc = n.ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.16)
    const g = n.ctx.createGain()
    g.gain.setValueAtTime(0.3, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(g)
    g.connect(n.master)
    osc.start(t)
    osc.stop(t + 0.25)
    this.blip(1200 + Math.random() * 600, t, 0.07, 'sine', 0.08)
  }

  /** Zone discovery: a ding plus a happy major chord. */
  discover() {
    const n = this.nodes
    if (!n) return
    const t = n.ctx.currentTime
    this.blip(880, t, 0.5, 'sine', 0.22)
    this.blip(523.25, t + 0.12, 0.9, 'sine', 0.14)
    this.blip(659.25, t + 0.18, 0.9, 'sine', 0.14)
    this.blip(783.99, t + 0.24, 1.1, 'sine', 0.14)
    this.blip(1046.5, t + 0.3, 1.2, 'sine', 0.1)
  }
}

export const audio = new GameAudio()
