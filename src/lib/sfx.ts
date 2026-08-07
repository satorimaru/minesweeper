/**
 * Synthesized game SFX via Web Audio API — no asset files, works offline/PWA.
 * Call unlock() from a user gesture so iOS/Safari will play later.
 */

const MUTE_KEY = "mc_sfx_muted";

type Tone = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slide?: number;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function getMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function isMuted(): boolean {
  return getMuted();
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (master) {
    master.gain.value = muted ? 0 : 0.55;
  }
}

export function toggleMute(): boolean {
  const next = !getMuted();
  setMuted(next);
  return next;
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = getMuted() ? 0 : 0.55;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Must run inside a click/touch handler once (iPhone autoplay policy). */
export function unlock(): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume();
  }
  unlocked = true;
  // Tiny silent blip primes some mobile engines
  if (!getMuted()) {
    playTones([{ freq: 40, dur: 0.01, gain: 0.0001 }]);
  }
}

function playTones(tones: Tone[]): void {
  const c = ensureCtx();
  if (!c || !master || getMuted()) return;
  if (c.state === "suspended") void c.resume();

  const t0 = c.currentTime;
  for (const tone of tones) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = tone.type ?? "sine";
    const start = t0 + (tone.delay ?? 0);
    const peak = tone.gain ?? 0.18;
    const f0 = tone.freq;
    const f1 = tone.slide ?? tone.freq;

    osc.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + tone.dur);
    }

    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);

    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(start + tone.dur + 0.02);
  }
}

function playNoise(dur: number, gain = 0.2, filterFreq = 400): void {
  const c = ensureCtx();
  if (!c || !master || getMuted()) return;
  if (c.state === "suspended") void c.resume();

  const len = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  unlock,
  isMuted,
  setMuted,
  toggleMute,

  ui() {
    playTones([{ freq: 520, dur: 0.05, type: "triangle", gain: 0.1 }]);
  },

  flag() {
    playTones([
      { freq: 280, dur: 0.06, type: "square", gain: 0.08 },
      { freq: 420, dur: 0.07, type: "triangle", gain: 0.1, delay: 0.03 },
    ]);
  },

  unflag() {
    playTones([{ freq: 360, dur: 0.05, type: "triangle", gain: 0.07, slide: 220 }]);
  },

  /** Soft pop for a single open; pitch climbs with combo. */
  open(combo = 1) {
    const base = 380 + Math.min(combo, 12) * 28;
    playTones([
      { freq: base, dur: 0.06, type: "sine", gain: 0.12 },
      { freq: base * 1.5, dur: 0.05, type: "triangle", gain: 0.06, delay: 0.02 },
    ]);
  },

  /** Cascading flood / multi-open. */
  cascade(opened: number) {
    const n = Math.min(opened, 8);
    const tones: Tone[] = [];
    for (let i = 0; i < n; i++) {
      tones.push({
        freq: 320 + i * 45,
        dur: 0.05,
        type: "sine",
        gain: 0.07,
        delay: i * 0.028,
      });
    }
    playTones(tones);
  },

  combo(level: number) {
    const L = Math.min(level, 10);
    playTones([
      { freq: 500 + L * 40, dur: 0.08, type: "square", gain: 0.1 },
      { freq: 650 + L * 40, dur: 0.1, type: "triangle", gain: 0.12, delay: 0.05 },
      { freq: 800 + L * 30, dur: 0.12, type: "sine", gain: 0.1, delay: 0.1 },
    ]);
  },

  power() {
    playTones([
      { freq: 660, dur: 0.08, type: "sine", gain: 0.12 },
      { freq: 880, dur: 0.1, type: "triangle", gain: 0.12, delay: 0.06 },
      { freq: 1175, dur: 0.14, type: "sine", gain: 0.1, delay: 0.12 },
    ]);
  },

  nuke() {
    playNoise(0.35, 0.28, 180);
    playTones([
      { freq: 120, dur: 0.25, type: "sawtooth", gain: 0.15, slide: 60 },
      { freq: 90, dur: 0.3, type: "square", gain: 0.08, delay: 0.05, slide: 40 },
    ]);
  },

  freeze() {
    playTones([
      { freq: 900, dur: 0.12, type: "sine", gain: 0.1, slide: 1400 },
      { freq: 1200, dur: 0.15, type: "triangle", gain: 0.08, delay: 0.08, slide: 1800 },
      { freq: 1600, dur: 0.18, type: "sine", gain: 0.06, delay: 0.14 },
    ]);
  },

  mine() {
    playNoise(0.4, 0.35, 250);
    playTones([
      { freq: 180, dur: 0.2, type: "sawtooth", gain: 0.18, slide: 55 },
      { freq: 90, dur: 0.28, type: "square", gain: 0.12, delay: 0.04, slide: 40 },
    ]);
  },

  shield() {
    playTones([
      { freq: 700, dur: 0.08, type: "triangle", gain: 0.12 },
      { freq: 1050, dur: 0.12, type: "sine", gain: 0.1, delay: 0.05 },
    ]);
  },

  win() {
    const notes = [523, 659, 784, 1047];
    playTones(
      notes.map((freq, i) => ({
        freq,
        dur: 0.22,
        type: "triangle" as OscillatorType,
        gain: 0.14,
        delay: i * 0.12,
      })),
    );
    playTones([
      { freq: 1319, dur: 0.35, type: "sine", gain: 0.1, delay: 0.5 },
    ]);
  },

  lose() {
    playTones([
      { freq: 320, dur: 0.2, type: "sawtooth", gain: 0.12, slide: 180 },
      { freq: 240, dur: 0.25, type: "square", gain: 0.1, delay: 0.15, slide: 120 },
      { freq: 140, dur: 0.4, type: "triangle", gain: 0.12, delay: 0.3, slide: 70 },
    ]);
    playNoise(0.25, 0.15, 300);
  },

  ready() {
    unlocked = unlocked || true;
    playTones([
      { freq: 440, dur: 0.08, type: "sine", gain: 0.1 },
      { freq: 660, dur: 0.12, type: "triangle", gain: 0.1, delay: 0.08 },
    ]);
  },
};
