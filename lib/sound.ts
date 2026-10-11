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
    case "up": // bright two-note ding
      tone(660, 0, 0.12, "triangle");
      tone(990, 0.08, 0.18, "triangle");
      break;
    case "down": // low thud
      tone(180, 0, 0.18, "sine", 0.2);
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
