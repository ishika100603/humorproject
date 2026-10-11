"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ANNOUNCEMENTS } from "@/lib/jokes";
import { playSound } from "@/lib/sound";

const NOTE_W = 200;
const NOTE_H = 150;
const NOTE_COLORS = ["#f6eebc", "#f3e9b0", "#f8f1c8", "#efe4a6"];
const INK = "#141414";

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// Googly eyes that follow the cursor, with a little lag so they wobble
export function GooglyEyes() {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 220);
      target.current = { x: (dx / d) * reach, y: (dy / d) * reach };
    };
    let raf = 0;
    let cur = { x: 0, y: 0 };
    let vel = { x: 0, y: 0 };
    const step = () => {
      // springy follow
      vel = { x: (vel.x + (target.current.x - cur.x) * 0.12) * 0.78, y: (vel.y + (target.current.y - cur.y) * 0.12) * 0.78 };
      cur = { x: cur.x + vel.x, y: cur.y + vel.y };
      setLook(cur);
      raf = requestAnimationFrame(step);
    };
    window.addEventListener("pointermove", move);
    raf = requestAnimationFrame(step);
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  const eye = (cx: number) => (
    <g>
      <circle cx={cx} cy="40" r="30" fill="#fff" stroke={INK} strokeWidth="2.6" />
      <circle cx={cx + look.x * 15} cy={40 + look.y * 15} r="13" fill={INK} />
      <circle cx={cx + look.x * 15 - 4} cy={40 + look.y * 15 - 5} r="3.5" fill="#fff" />
    </g>
  );

  return (
    <div ref={ref} className="h-full w-full" aria-hidden="true">
      <svg viewBox="0 0 150 80" className="h-full w-full overflow-visible" filter="url(#sketch)">
        {eye(38)}
        {eye(112)}
      </svg>
    </div>
  );
}

// A person buried in sticky notes, holding a mug. Black line drawing.
function Figure() {
  return (
    <svg viewBox="0 0 400 360" className="h-full w-full" aria-hidden="true" filter="url(#sketch)">
      <path d="M30 318 H370" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M70 318 Q52 200 200 186 Q348 200 330 318 Z" fill={INK} />
      <ellipse cx="200" cy="120" rx="66" ry="72" fill="#fdfdfb" stroke={INK} strokeWidth="3" />
      <path d="M262 112 q14 -2 14 14 q-2 14 -16 12" fill="#fdfdfb" stroke={INK} strokeWidth="3" />
      <path d="M142 74 l6 -26 l12 18 l6 -26 l12 20 l10 -26 l10 22 l12 -22 l8 24 l14 -14 l0 26 Q200 56 142 74 Z" fill={INK} />
      <path d="M220 262 h64 q10 0 10 12 v34 q0 14 -14 14 h-46 q-14 0 -14 -14 z" fill="#fdfdfb" stroke={INK} strokeWidth="3" />
      <ellipse cx="252" cy="264" rx="30" ry="7" fill={INK} />
      <path d="M220 276 q-26 4 -22 22 q4 14 22 10" fill="#fdfdfb" stroke={INK} strokeWidth="3" />
    </svg>
  );
}

export default function NotePerson() {
  const [grid, setGrid] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const f = () => setWidth(window.innerWidth);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  const notes = ANNOUNCEMENTS;
  const cols = width < 640 ? 1 : width < 1024 ? 2 : width < 1400 ? 3 : 4;
  const scaleGrid = cols === 1 ? 1.35 : 1.1;
  const cellW = NOTE_W * scaleGrid + 22;
  const cellH = NOTE_H * scaleGrid + 22;
  const rows = Math.ceil(notes.length / cols);
  const figW = Math.min(340, width * 0.62);
  const figH = figW * 0.9;
  const height = grid ? rows * cellH + 80 : figH;
  const small = Math.max(0.14, (figW / 520) * 0.3);

  // Notes stuck over the face and sweater, leaving the eyes visible
  const pile = useMemo(
    () =>
      notes.map((_, i) => {
        const onHead = i < 4;
        return {
          x: onHead ? 38 + rand(i + 1) * 24 : 24 + rand(i + 1) * 52,
          y: onHead ? (i % 2 ? 41 : 20) + rand(i + 9) * 6 : 56 + rand(i + 7) * 26,
          r: (rand(i + 3) - 0.5) * 28,
        };
      }),
    [notes]
  );

  const arrange = () => {
    if (grid) return;
    playSound("tap");
    setGrid(true);
  };

  return (
    <div className="relative w-full">
      <div
        className="relative mx-auto transition-[height] duration-700 ease-out"
        style={{ height, width: grid ? "100%" : figW, maxWidth: 1200 }}
        onClick={arrange}
        role={grid ? undefined : "button"}
        tabIndex={grid ? -1 : 0}
        aria-label={grid ? undefined : "Spread out the joke notes"}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && arrange()}
      >
        <div className={`absolute inset-0 transition-opacity duration-500 ${grid ? "opacity-0" : "opacity-100"}`}>
          <Figure />
          <div className="absolute left-1/2 top-[25%] z-[60] h-[15%] w-[30%] -translate-x-1/2">
            <GooglyEyes />
          </div>
        </div>

        {notes.map((text, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const p = pile[i];
          const big = !grid && hover === i;
          const scale = grid ? scaleGrid : big ? 0.62 : small;
          return (
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="absolute flex items-center justify-center p-4 text-center font-normal leading-snug text-[#141414] ring-1 ring-[#141414]"
              style={{
                width: NOTE_W,
                height: NOTE_H,
                left: grid ? `calc(50% + ${(col - (cols - 1) / 2) * cellW}px)` : `${p.x}%`,
                top: grid ? 40 + row * cellH + cellH / 2 : `${p.y}%`,
                background: NOTE_COLORS[i % NOTE_COLORS.length],
                transform: `translate(-50%, -50%) rotate(${grid ? (rand(i + 11) - 0.5) * 6 : p.r}deg) scale(${scale})`,
                zIndex: big ? 70 : 10 + i,
                transition: `left 650ms cubic-bezier(.2,1.1,.3,1) ${grid ? i * 35 : 0}ms, top 650ms cubic-bezier(.2,1.1,.3,1) ${grid ? i * 35 : 0}ms, transform 450ms ease ${grid ? i * 35 : 0}ms`,
              }}
            >
              <span className={grid || big ? "opacity-100" : "opacity-60"}>{text}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-sm">
        {grid ? (
          <button
            onClick={() => {
              playSound("tap");
              setGrid(false);
            }}
            className="rounded-full border border-[#141414] px-4 py-1.5 font-normal hover:bg-[#141414] hover:text-white"
          >
            Stick them back on
          </button>
        ) : (
          "Hover a note to read it. Click or tap to spread them all out."
        )}
      </p>
    </div>
  );
}
