"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    title: "Welcome to 116 & Broadway",
    body: "People post photos, AI writes a caption, and you vote on whether it's funny.",
  },
  {
    title: "Vote",
    body: "Open a note and hit thumbs up or thumbs down. Use the arrow keys to go to the next one.",
  },
  {
    title: "Crowns",
    body: "You get 1 crown per vote. Whoever votes the most in a week is Star of the week.",
  },
  {
    title: "Post a photo",
    body: "Upload any photo and AI writes the caption. Your name isn't shown.",
  },
  {
    title: "Next time",
    body: "You'll only see notes you haven't seen yet. Older ones are at the bottom.",
  },
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
          <div className="flex gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-ink" : "bg-ink/20"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="rounded-full px-3 py-1.5 text-sm hover:bg-ink/5">
                Back
              </button>
            )}
            <button
              autoFocus
              onClick={() => (last ? onClose() : setStep(step + 1))}
              className="rounded-full bg-ink px-4 py-1.5 text-sm text-white hover:bg-teal"
            >
              {last ? "Let's go" : "Next"}
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] text-ink/40">
          ← → to move · Esc to{" "}
          <button onClick={onClose} className="underline hover:text-ink">
            skip
          </button>
        </p>
      </div>
    </div>
  );
}
