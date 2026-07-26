let ctx: AudioContext | null = null
let musicGain: GainNode | null = null
let musicPlaying = false
let musicTimeoutId: ReturnType<typeof setTimeout> | null = null
let currentTrack: string = 'none'
let masterVolume = 0.5

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function createMusicChain(): GainNode {
  const ac = getCtx()
  musicGain = ac.createGain()
  musicGain.gain.setValueAtTime(masterVolume * 0.9, ac.currentTime)
  musicGain.connect(ac.destination)
  return musicGain
}

function stopScheduling() {
  musicPlaying = false
  if (musicTimeoutId) {
    clearTimeout(musicTimeoutId)
    musicTimeoutId = null
  }
}

function fadeOutMusic(ms: number) {
  if (musicGain && ctx) {
    musicGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000)
    const old = musicGain
    setTimeout(() => { old.disconnect() }, ms + 50)
  }
  musicGain = null
}

function note(ac: AudioContext, dest: AudioNode, freq: number, start: number, dur: number, wave: OscillatorType = 'square', vol = 0.06) {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = wave
  osc.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(vol, start)
  g.gain.setValueAtTime(vol * 0.8, start + dur * 0.7)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(g).connect(dest)
  osc.start(start)
  osc.stop(start + dur)
}

function noise(ac: AudioContext, dest: AudioNode, start: number, dur: number, vol = 0.03) {
  const bufSize = ac.sampleRate * dur
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  const g = ac.createGain()
  g.gain.setValueAtTime(vol, start)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  src.connect(g).connect(dest)
  src.start(start)
  src.stop(start + dur)
}

// ─── SFX ───

export function playHover(): void {
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(600, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.06)
    g.gain.setValueAtTime(0.08, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08)
    osc.connect(g).connect(ac.destination)
    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + 0.08)
  } catch { /* silent */ }
}

export function playClick(): void {
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(880, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ac.currentTime + 0.1)
    g.gain.setValueAtTime(0.12, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12)
    osc.connect(g).connect(ac.destination)
    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + 0.12)
  } catch { /* silent */ }
}

// ─── MENU MUSIC (Route theme) ───

const MENU_MELODY: Array<[number, number, OscillatorType]> = [
  [523, 0.5, 'square'], [587, 0.5, 'square'], [659, 0.5, 'square'], [698, 0.5, 'square'],
  [784, 1.0, 'square'], [659, 0.5, 'square'], [784, 1.5, 'square'],
  [880, 0.5, 'triangle'], [784, 0.5, 'square'], [659, 0.5, 'square'], [587, 0.5, 'square'],
  [523, 1.0, 'square'], [440, 0.5, 'square'], [523, 1.5, 'square'],
  [587, 0.5, 'triangle'], [523, 0.5, 'square'], [440, 0.5, 'square'], [392, 0.5, 'square'],
  [440, 1.0, 'square'], [523, 0.5, 'square'], [440, 1.5, 'square'],
  [392, 0.5, 'triangle'], [349, 0.5, 'square'], [392, 0.5, 'square'], [440, 0.5, 'square'],
  [523, 1.0, 'square'], [440, 0.5, 'square'], [392, 1.5, 'square'],
]

const MENU_BASS: Array<[number, number]> = [
  [131, 2], [165, 2], [196, 2], [165, 2], [131, 2], [110, 2],
  [131, 2], [147, 2], [131, 2], [110, 2], [98, 2], [110, 2], [131, 2], [110, 2],
]

function scheduleMenuLoop() {
  if (!musicPlaying || !ctx || !musicGain || currentTrack !== 'menu') return
  const ac = ctx
  const now = ac.currentTime + 0.05
  const dest = musicGain
  let t = 0
  for (const [f, d, w] of MENU_MELODY) { note(ac, dest, f, now + t, d * 0.4, w, 0.055); t += d * (60 / 140) }
  let bt = 0
  for (const [f, d] of MENU_BASS) { note(ac, dest, f, now + bt, d * (60 / 140) * 0.7, 'triangle', 0.06); bt += d * (60 / 140) }
  musicTimeoutId = setTimeout(scheduleMenuLoop, Math.max(t, bt) * 1000 - 100)
}

export function startMenuMusic(): void {
  if (currentTrack === 'menu' && musicPlaying) return
  stopScheduling()
  fadeOutMusic(300)
  currentTrack = 'menu'
  musicPlaying = true
  createMusicChain()
  scheduleMenuLoop()
}

// ─── BATTLE MUSIC (GBA-style) ───

const BATTLE_BPM = 174
const B = 60 / BATTLE_BPM

const BATTLE_MELODY: Array<[number, number, OscillatorType]> = [
  // Aggressive ascending riff
  [330, 0.25, 'square'], [392, 0.25, 'square'], [494, 0.25, 'square'], [587, 0.25, 'square'],
  [659, 0.5, 'square'], [587, 0.25, 'square'], [494, 0.25, 'square'],
  [659, 0.5, 'square'], [784, 0.5, 'square'],
  [659, 0.25, 'square'], [587, 0.25, 'square'], [494, 0.25, 'square'], [440, 0.25, 'square'],
  [494, 0.5, 'square'], [440, 0.25, 'square'], [392, 0.25, 'square'],
  [440, 0.5, 'square'], [587, 0.5, 'square'],
  [659, 0.25, 'square'], [784, 0.25, 'square'], [880, 0.25, 'square'], [784, 0.25, 'square'],
  [659, 0.5, 'square'], [587, 0.5, 'square'],
  [494, 0.5, 'triangle'], [440, 0.5, 'triangle'],
  [392, 0.25, 'square'], [440, 0.25, 'square'], [494, 0.25, 'square'], [587, 0.25, 'square'],
  [659, 0.5, 'square'], [494, 0.5, 'square'],
  [440, 0.5, 'square'], [392, 0.5, 'square'], [330, 1.0, 'square'],
]

const BATTLE_BASS: Array<[number, number]> = [
  [165, 0.25], [165, 0.25], [165, 0.25], [165, 0.25],
  [196, 0.25], [196, 0.25], [196, 0.25], [196, 0.25],
  [220, 0.25], [220, 0.25], [220, 0.25], [220, 0.25],
  [196, 0.25], [196, 0.25], [196, 0.25], [196, 0.25],
  [165, 0.25], [165, 0.25], [165, 0.25], [165, 0.25],
  [147, 0.25], [147, 0.25], [147, 0.25], [147, 0.25],
  [131, 0.25], [131, 0.25], [131, 0.25], [131, 0.25],
  [147, 0.25], [147, 0.25], [147, 0.25], [147, 0.25],
]

function scheduleBattleLoop() {
  if (!musicPlaying || !ctx || !musicGain || currentTrack !== 'battle') return
  const ac = ctx
  const now = ac.currentTime + 0.05
  const dest = musicGain
  let t = 0
  for (const [f, d, w] of BATTLE_MELODY) { note(ac, dest, f, now + t, d * B * 0.8, w, 0.065); t += d * B }
  let bt = 0
  for (const [f, d] of BATTLE_BASS) {
    note(ac, dest, f, now + bt, d * B * 0.6, 'sawtooth', 0.05)
    bt += d * B
  }
  // Hi-hat noise layer
  let ht = 0
  for (const [, d] of BATTLE_BASS) {
    noise(ac, dest, now + ht, B * 0.08, 0.015)
    ht += d * B
  }
  musicTimeoutId = setTimeout(scheduleBattleLoop, Math.max(t, bt) * 1000 - 80)
}

export function startBattleMusic(): void {
  if (currentTrack === 'battle' && musicPlaying) return
  stopScheduling()
  fadeOutMusic(200)
  currentTrack = 'battle'
  musicPlaying = true
  createMusicChain()
  scheduleBattleLoop()
}

// ─── VICTORY FANFARE ───

export function playVictoryFanfare(): void {
  stopScheduling()
  fadeOutMusic(100)
  currentTrack = 'none'

  const ac = getCtx()
  const dest = ac.destination
  const now = ac.currentTime + 0.05

  // Triumphant ascending fanfare
  const fanfare: Array<[number, number, OscillatorType, number]> = [
    [523, 0.15, 'square', 0.10],    // C5
    [659, 0.15, 'square', 0.10],    // E5
    [784, 0.15, 'square', 0.10],    // G5
    [1047, 0.4, 'square', 0.12],    // C6 (hold)
    [988, 0.15, 'square', 0.08],    // B5
    [1047, 0.5, 'triangle', 0.12],  // C6 (long)
    [784, 0.15, 'square', 0.08],    // G5
    [1047, 0.6, 'square', 0.10],    // C6 (final long)
  ]

  let t = 0
  for (const [f, d, w, v] of fanfare) {
    note(ac, dest, f, now + t, d, w, v)
    t += d + 0.02
  }

  // Bass harmony
  note(ac, dest, 262, now, t, 'triangle', 0.07)
  note(ac, dest, 392, now + 0.45, t - 0.45, 'triangle', 0.06)
}

// ─── DEFEAT MUSIC ───

export function playDefeatMusic(): void {
  stopScheduling()
  fadeOutMusic(100)
  currentTrack = 'none'

  const ac = getCtx()
  const dest = ac.destination
  const now = ac.currentTime + 0.1

  // Sad descending melody in minor key
  const sadMelody: Array<[number, number, OscillatorType]> = [
    [494, 0.6, 'square'],    // B4
    [440, 0.6, 'square'],    // A4
    [392, 0.6, 'square'],    // G4
    [370, 0.8, 'square'],    // F#4
    [330, 0.6, 'square'],    // E4
    [294, 0.6, 'square'],    // D4
    [262, 0.6, 'triangle'],  // C4
    [247, 1.2, 'triangle'],  // B3 (hold)
    [220, 0.6, 'square'],    // A3
    [196, 0.6, 'square'],    // G3
    [165, 1.5, 'triangle'],  // E3 (final long, fade)
  ]

  let t = 0
  for (const [f, d, w] of sadMelody) {
    note(ac, dest, f, now + t, d, w, 0.08)
    t += d + 0.05
  }

  // Slow bass notes
  note(ac, dest, 131, now, 2.0, 'triangle', 0.06)
  note(ac, dest, 110, now + 2.0, 2.0, 'triangle', 0.05)
  note(ac, dest, 98, now + 4.0, 3.0, 'triangle', 0.04)
}

// ─── STOP ───

export function stopMusic(): void {
  stopScheduling()
  fadeOutMusic(300)
  currentTrack = 'none'
}

export function setVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v))
  if (musicGain && ctx) {
    musicGain.gain.setValueAtTime(masterVolume * 0.9, ctx.currentTime)
  }
}

export function getVolume(): number {
  return masterVolume
}
