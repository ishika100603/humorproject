"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { title: "Vote", body: "Tap a note. 👍 if it's funny, 👎 if not." },
  { title: "Earn crowns", body: "Every vote is 1 crown. Top voter each week is Star of the week." },
  { title: "Post", body: "Upload any photo. AI writes the caption." },
];

export default function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  // Arrow keys move through the steps, Enter goes forward, Esc skips
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (step === STEPS.length - 1) onClose();
        else setStep(step + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (step > 0) setStep(step - 1);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  return (
    <div
      className="lightbox fixed inset-0 z-50 flex items-center justify-center bg-[#b9d9eb]/85 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-ink/20 bg-white px-7 py-6 shadow-sm">
        <p className="text-xs text-ink/50">
          {step + 1} of {STEPS.length}
        </p>
        <h2 id="tutorial-title" className="hand mt-2 text-xl tracking-[0.08em]">
          {s.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">{s.body}</p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-sm text-ink/60 underline hover:text-ink">
            Skip
          </button>
          <div className="flex gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-ink" : "bg-ink/20"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(step - 1)}
              disabled={step === 0}
              aria-label="Previous"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/25 text-lg leading-none hover:bg-ink/5 disabled:opacity-25"
            >
              ‹
            </button>
            <button
              autoFocus
              onClick={() => (last ? onClose() : setStep(step + 1))}
              aria-label={last ? "Start" : "Next"}
              className="flex h-9 min-w-9 items-center justify-center rounded-full bg-ink px-3 text-lg leading-none text-white hover:bg-teal"
            >
              {last ? <span className="text-sm">Start</span> : "›"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
