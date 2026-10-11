"use client";

import { useEffect, useMemo, useState } from "react";
import { ANNOUNCEMENTS } from "@/lib/jokes";
import { playSound } from "@/lib/sound";

const NOTE_W = 200;
const NOTE_H = 150;
const NOTE_COLORS = ["#fbe9a6", "#fde3a1", "#f9efb8", "#fbe0b0"];

// A magnifying glass for the cursor while it is over the pile
const MAGNIFIER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='15' cy='15' r='11' fill='%23ffffff88' stroke='%23141414' stroke-width='3'/%3E%3Cpath d='M23 23 L36 36' stroke='%23141414' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E\") 15 15, zoom-in";

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function Person() {
  return (
    <svg viewBox="0 0 400 320" className="h-full w-full" aria-hidden="true">
      <path d="M40 300 H360" stroke="#141414" strokeWidth="5" strokeLinecap="round" />
      <path d="M90 300 Q80 170 200 165 Q320 170 310 300 Z" fill="#141414" />
      <ellipse cx="200" cy="120" rx="62" ry="70" fill="#fbfaf3" stroke="#141414" strokeWidth="5" />
      <path d="M150 70 l8 -24 l10 16 l8 -22 l10 18 l10 -24 l8 20 l12 -18 l6 22 l12 -14 l-2 26 Q200 56 150 70 Z" fill="#141414" />
      <path d="M232 250 h52 q8 0 8 10 v28 q0 12 -12 12 h-36 q-12 0 -12 -12 z" fill="#fbfaf3" stroke="#141414" strokeWidth="5" />
      <ellipse cx="258" cy="252" rx="24" ry="6" fill="#141414" />
      <path d="M232 262 q-22 4 -18 20 q4 12 20 8" fill="none" stroke="#141414" strokeWidth="5" />
    </svg>
  );
}

export default function StickyNotes() {
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
  const scaleGrid = cols === 1 ? 1.35 : 1.15;
  const cellW = NOTE_W * scaleGrid + 24;
  const cellH = NOTE_H * scaleGrid + 24;
  const rows = Math.ceil(notes.length / cols);
  const pileH = Math.min(560, Math.max(380, width * 0.42));
  const height = grid ? rows * cellH + 140 : pileH;

  // Pile positions cover the person's head and sweater
  const pile = useMemo(
    () =>
      notes.map((_, i) => ({
        x: 50 + (rand(i + 1) - 0.5) * 18,
        y: 28 + rand(i + 7) * 52,
        r: (rand(i + 3) - 0.5) * 30,
      })),
    [notes]
  );

  const arrange = () => {
    if (grid) return;
    playSound("tap");
    setGrid(true);
  };

  return (
    <section
      aria-labelledby="keep-calm"
      className="relative w-full overflow-hidden border-t-[3px] border-[#141414] bg-[#fbfaf3] px-5 py-14 text-[#141414] sm:px-8"
    >
      <h2 id="keep-calm" className="sr-only">
        Keep calm and read the jokes
      </h2>
      <p aria-hidden="true" className="absolute left-[8%] top-12 text-3xl font-extrabold tracking-[0.2em] sm:left-[22%] sm:text-4xl">
        KEEP
      </p>
      <p
        aria-hidden="true"
        className={`absolute right-[8%] text-3xl font-extrabold tracking-[0.2em] transition-opacity duration-500 sm:right-[30%] sm:text-4xl ${grid ? "opacity-0" : "opacity-100"}`}
        style={{ top: pileH - 10 }}
      >
        CALM
      </p>

      <div
        className="relative mx-auto max-w-6xl transition-[height] duration-700 ease-out"
        style={{ height, cursor: grid ? "auto" : MAGNIFIER }}
        onClick={arrange}
        role={grid ? undefined : "button"}
        tabIndex={grid ? -1 : 0}
        aria-label={grid ? undefined : "Spread out the sticky notes"}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && arrange()}
      >
        <div
          className={`absolute left-1/2 top-[8%] h-[80%] max-h-[440px] w-[min(86%,520px)] -translate-x-1/2 transition-opacity duration-500 ${
            grid ? "opacity-0" : "opacity-100"
          }`}
        >
          <Person />
        </div>

        {notes.map((text, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const gridLeft = `calc(50% + ${(col - (cols - 1) / 2) * cellW}px)`;
          const gridTop = 90 + row * cellH + cellH / 2;
          const p = pile[i];
          const big = !grid && hover === i;
          const scale = grid ? scaleGrid : big ? 0.62 : 0.3;
          return (
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="absolute flex items-center justify-center p-4 text-center font-semibold leading-snug shadow-[2px_3px_0_rgba(20,20,20,0.25)] ring-2 ring-[#141414]"
              style={{
                width: NOTE_W,
                height: NOTE_H,
                left: grid ? gridLeft : `${p.x}%`,
                top: grid ? gridTop : `${p.y}%`,
                background: NOTE_COLORS[i % NOTE_COLORS.length],
                transform: `translate(-50%, -50%) rotate(${grid ? (rand(i + 11) - 0.5) * 6 : p.r}deg) scale(${scale})`,
                zIndex: big ? 30 : 10 + i,
                transition: `left 650ms cubic-bezier(.2,1.1,.3,1) ${grid ? i * 35 : 0}ms, top 650ms cubic-bezier(.2,1.1,.3,1) ${grid ? i * 35 : 0}ms, transform 450ms ease ${grid ? i * 35 : 0}ms`,
              }}
            >
              <span className={grid || big ? "opacity-100" : "opacity-70"}>{text}</span>
            </div>
          );
        })}

        <p
          className={`absolute inset-x-0 text-center text-sm transition-opacity duration-300 ${grid ? "top-6 opacity-100" : "bottom-0 opacity-100"}`}
        >
          {grid ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                playSound("tap");
                setGrid(false);
              }}
              className="rounded-full border-2 border-[#141414] px-4 py-1.5 font-semibold hover:bg-[#141414] hover:text-[#fbfaf3]"
            >
              Pile them back on
            </button>
          ) : (
            "Hover to read a note. Click to spread them all out."
          )}
        </p>
      </div>
    </section>
  );
}
