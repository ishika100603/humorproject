// Original background loop: sneaky, tiptoeing lounge jazz in D minor.
// Walking bass, brushed drums, soft Rhodes chords and a sparse vibraphone line.
// Everything is synthesized with the Web Audio API, so there are no audio files.

const BPM = 104;
const SPB = 60 / BPM; // seconds per beat
const BARS = 8;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// One chord per bar
const CHORDS = [
  [53, 57, 60, 64], // Dm9
  [53, 57, 60, 64], // Dm9
  [57, 58, 62, 65], // Gm9
  [55, 61, 64, 70], // A7b9
  [53, 57, 60, 64], // Dm9
  [57, 58, 62, 65], // Bbmaj7
  [52, 62, 67, 70], // Em7b5
  [55, 61, 64, 67], // A7
];

// Walking bass, four quarter notes per bar
const BASS = [
  [38, 41, 45, 43],
  [38, 40, 41, 42],
  [43, 46, 50, 49],
  [45, 49, 52, 44],
  [38, 41, 45, 46],
  [46, 45, 43, 41],
  [40, 43, 46, 44],
  [45, 43, 40, 37],
];

// Vibraphone: [bar, eighth (0-7), midi, length in eighths]
const MELODY: [number, number, number, number][] = [
  [0, 3, 69, 1], [0, 4, 72, 1], [0, 6, 74, 2],
  [1, 2, 72, 1], [1, 3, 69, 2],
  [2, 3, 70, 1], [2, 4, 74, 1], [2, 6, 77, 2],
  [3, 2, 76, 1], [3, 3, 73, 1], [3, 5, 69, 3],
  [4, 3, 69, 1], [4, 4, 72, 1], [4, 6, 74, 1], [4, 7, 76, 1],
  [5, 0, 77, 2], [5, 3, 74, 2],
  [6, 2, 70, 1], [6, 3, 67, 1], [6, 4, 70, 1],
  [7, 1, 73, 2], [7, 4, 69, 4],
];

// Swung eighths: the off-beat lands two thirds of the way through the beat
const eighthAt = (barStart: number, eighth: number) =>
  barStart + Math.floor(eighth / 2) * SPB + (eighth % 2 ? SPB * 0.66 : 0);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextBar = 0;
let nextBarTime = 0;

function note(freq: number, t: number, len: number, type: OscillatorType, vol: number, cutoff = 4000, detune = 0) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(filter).connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + len + 0.05);
}

function hit(t: number, len: number, vol: number, type: BiquadFilterType, freq: number) {
  if (!ctx || !master || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + len + 0.02);
}

function scheduleBar(bar: number, t: number) {
  // Rhodes chord: on beat 1 and a push on the "and" of 2
  for (const when of [t, eighthAt(t, 3)]) {
    CHORDS[bar].forEach((m, i) => note(hz(m), when, 0.9, "sine", 0.05, 2200, i % 2 ? 6 : -6));
  }
  // Plucky upright bass
  BASS[bar].forEach((m, beat) => note(hz(m), t + beat * SPB, SPB * 0.85, "triangle", 0.22, 700));
  // Brushes: ride on swung eighths, snare swish on 2 and 4, soft kick on 1
  for (let e = 0; e < 8; e++) hit(eighthAt(t, e), 0.05, e % 2 ? 0.05 : 0.08, "highpass", 7000);
  hit(t + SPB, 0.14, 0.09, "bandpass", 1800);
  hit(t + 3 * SPB, 0.14, 0.09, "bandpass", 1800);
  note(60, t, 0.18, "sine", 0.25, 200);
  // Vibraphone line, a little soft
  MELODY.filter(([b]) => b === bar).forEach(([, e, m, len]) => {
    const when = eighthAt(t, e);
    note(hz(m), when, Math.max(0.25, (len * SPB) / 2 + 0.25), "sine", 0.07, 6000);
    note(hz(m) * 4, when, 0.15, "sine", 0.012, 8000); // the metallic "tink"
  });
}

export function startMusic() {
  if (timer) return;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  ctx.resume();
  const now = ctx.currentTime;
  master!.gain.cancelScheduledValues(now);
  master!.gain.setValueAtTime(0.0001, now);
  master!.gain.exponentialRampToValueAtTime(0.35, now + 1.5); // gentle fade in
  nextBar = 0;
  nextBarTime = now + 0.1;
  timer = setInterval(() => {
    if (!ctx) return;
    while (nextBarTime < ctx.currentTime + 0.6) {
      scheduleBar(nextBar, nextBarTime);
      nextBarTime += 4 * SPB;
      nextBar = (nextBar + 1) % BARS;
    }
  }, 150);
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  if (ctx && master) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  }
}

export function isMusicPlaying() {
  return timer !== null;
}
