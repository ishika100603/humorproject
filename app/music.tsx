"use client";

import { useEffect, useState } from "react";
import { isMusicPlaying, startMusic, stopMusic } from "@/lib/music";

const KEY = "bg-music";

// Background music on every page. On by default, but browsers only allow
// sound after the first click or key press, so it starts then.
export default function Music() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    let saved = "on";
    try {
      saved = localStorage.getItem(KEY) ?? "on";
    } catch {}
    setOn(saved === "on");
    if (saved !== "on") return;
    const begin = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-music-toggle]")) return;
      startMusic();
      window.removeEventListener("pointerdown", begin);
      window.removeEventListener("keydown", begin);
    };
    window.addEventListener("pointerdown", begin);
    window.addEventListener("keydown", begin);
    return () => {
      window.removeEventListener("pointerdown", begin);
      window.removeEventListener("keydown", begin);
    };
  }, []);

  const toggle = () => {
    // Set to "on" but not started yet (no click so far): start it instead of switching off
    if (on && !isMusicPlaying()) {
      startMusic();
      return;
    }
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {}
    if (next) startMusic();
    else stopMusic();
  };

  return (
    <button
      data-music-toggle
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Turn music off" : "Turn music on"}
      title={on ? "Music on" : "Music off"}
      className="fixed bottom-5 left-5 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-ink/30 bg-white/80 hover:bg-white"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#141414" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18V5l11-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="16" r="3" />
        {!on && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}
