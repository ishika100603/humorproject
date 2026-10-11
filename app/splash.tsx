"use client";

import { useEffect, useState } from "react";
import { JudgeCat } from "./art";

// Shown once per browser session while the site loads
export default function Splash() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");
  const [pct, setPct] = useState(8);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("splash-seen") === "1";
      sessionStorage.setItem("splash-seen", "1");
    } catch {}
    if (seen) {
      setPhase("gone");
      return;
    }
    const tick = setInterval(() => setPct((p) => Math.min(96, p + (100 - p) * 0.18)), 90);
    const done = () => {
      clearInterval(tick);
      setPct(100);
      setTimeout(() => setPhase("leaving"), 350);
      setTimeout(() => setPhase("gone"), 900);
    };
    const min = new Promise((r) => setTimeout(r, 1300));
    const loaded =
      document.readyState === "complete" ? Promise.resolve() : new Promise((r) => window.addEventListener("load", r, { once: true }));
    Promise.all([min, loaded]).then(done);
    return () => clearInterval(tick);
  }, []);

  if (phase === "gone") return null;
  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#b9d9eb] transition-opacity duration-500 ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-label="Loading"
    >
      <div className="h-44 w-44 sm:h-56 sm:w-56">
        <JudgeCat tapping />
      </div>
      <p className="mt-4 text-base font-medium text-[#141414]">Order in the feed.</p>
      <p className="mt-1 text-[#141414]/80">Bringing today&apos;s jokes to the bench… {Math.round(pct)}%</p>
      <div className="mt-4 h-2.5 w-56 overflow-hidden rounded-full border border-[#141414] bg-white">
        <div className="h-full bg-[#141414] transition-[width] duration-100" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
