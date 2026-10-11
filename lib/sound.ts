// Small sound effects made with the Web Audio API (no audio files needed)

type Sound = "up" | "down" | "unvote" | "done" | "error" | "tap";

let ctx: AudioContext | null = null;

function tone(
  freq: number,
  start: number,
  length: number,
  type: OscillatorType = "sine",
  volume = 0.15
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

// A soft, buzzy note that can wobble and sag, for the sad trombone
function wah(freq: number, start: number, length: number, wobble = false) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  filter.type = "lowpass";
  filter.Q.value = 6;
  const t = ctx.currentTime + start;
  osc.frequency.setValueAtTime(freq, t);
  if (wobble) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 6;
    depth.gain.value = 7;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + length + 0.05);
    osc.frequency.linearRampToValueAtTime(freq * 0.94, t + length);
  }
  filter.frequency.setValueAtTime(500, t);
  filter.frequency.linearRampToValueAtTime(1300, t + 0.08);
  filter.frequency.linearRampToValueAtTime(600, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
  gain.gain.setValueAtTime(0.09, t + length * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

export function playSound(sound: Sound) {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("ctc-sound") === "off") return;
  } catch {}
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    return;
  }
  switch (sound) {
    case "up": // happy: quick rising major arpeggio with a sparkle on top
      tone(523, 0, 0.12, "triangle", 0.13);
      tone(659, 0.07, 0.12, "triangle", 0.13);
      tone(784, 0.14, 0.14, "triangle", 0.13);
      tone(1047, 0.21, 0.3, "sine", 0.12);
      tone(1568, 0.26, 0.18, "sine", 0.05);
      break;
    case "down": // disappointed: sad trombone "wah wah wahhh"
      wah(392, 0, 0.26);
      wah(370, 0.28, 0.26);
      wah(349, 0.56, 0.26);
      wah(330, 0.84, 0.7, true);
      break;
    case "unvote":
      tone(440, 0, 0.08, "sine", 0.08);
      break;
    case "done": // subway chime: three falling notes
      tone(784, 0, 0.25, "sine");
      tone(659, 0.22, 0.25, "sine");
      tone(523, 0.44, 0.4, "sine");
      break;
    case "error":
      tone(220, 0, 0.15, "square", 0.06);
      tone(196, 0.16, 0.25, "square", 0.06);
      break;
    case "tap":
      tone(880, 0, 0.05, "sine", 0.05);
      break;
  }
}
