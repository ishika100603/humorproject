"use client";

import { useEffect, useState } from "react";
import { Figure, GooglyEyes } from "./note-person";

const NOTE_COLORS = ["#f6eebc", "#f3e9b0", "#f8f1c8", "#efe4a6"];

// The sticky-note person throws the notes into the air, then shrinks
// into the bottom corner and keeps watching the cursor.
export default function Mascot({ onThrow, onHelp }: { onThrow: () => void; onHelp: () => void }) {
  const [stage, setStage] = useState<"hidden" | "center" | "throw" | "corner">("hidden");

  useEffect(() => {
    // The big toss plays once per visit. After that he just waits in the corner.
    let played = false;
    try {
      played = sessionStorage.getItem("mascot-intro-done") === "1";
      sessionStorage.setItem("mascot-intro-done", "1");
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || played) {
      setStage("corner");
      onThrow();
      return;
    }
    setStage("center");
    const a = setTimeout(() => setStage("throw"), 250);
    const b = setTimeout(onThrow, 650);
    const c = setTimeout(() => setStage("corner"), 1250);
    return () => [a, b, c].forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const corner = stage === "corner";
  if (stage === "hidden") return null;

  return (
    <>
      {/* Notes flying up out of his hands */}
      {stage === "throw" && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-40" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = -90 + (i - 5.5) * 13;
            const dist = 280 + (i % 3) * 90;
            return (
              <span
                key={i}
                className="toss absolute h-7 w-8 ring-1 ring-[#141414]/40"
                style={
                  {
                    background: NOTE_COLORS[i % 4],
                    "--tx": `${Math.cos((angle * Math.PI) / 180) * dist}px`,
                    "--ty": `${Math.sin((angle * Math.PI) / 180) * dist}px`,
                    "--rot": `${(i % 2 ? 1 : -1) * (120 + i * 20)}deg`,
                    animationDelay: `${i * 25}ms`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      )}

      <button
        onClick={corner ? onHelp : undefined}
        aria-label="How it works"
        title={corner ? "How it works" : undefined}
        className={`mascot fixed z-40 ${corner ? "mascot-corner" : "mascot-center"} ${stage === "throw" ? "mascot-jump" : ""}`}
      >
        <div className="relative h-full w-full">
          <Figure />
          <div className="absolute left-1/2 top-[25%] h-[15%] w-[30%] -translate-x-1/2">
            <GooglyEyes />
          </div>
        </div>
      </button>
    </>
  );
}
