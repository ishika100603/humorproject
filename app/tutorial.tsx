"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    title: "Welcome to 116 & Broadway",
    body: "AI writes the captions. You decide which ones are funny. Takes 30 seconds to learn.",
  },
  {
    title: "Vote",
    body: "Open a note. Thumbs up if it got you, thumbs down if it didn't. Arrow keys flip between notes.",
  },
  {
    title: "Earn crowns",
    body: "1 crown per vote. Whoever votes the most in a week becomes Star of the week. Check the menu to see who's winning.",
  },
  {
    title: "Post any photo",
    body: "Your lunch, your roommate's plant, a pigeon with ambition. AI writes the caption. Your name stays off it.",
  },
  {
    title: "Come back later",
    body: "You only see notes you haven't seen. The old ones wait at the bottom.",
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="mosaic w-full max-w-md">
        <div className="mosaic-field p-6">
          <p className="text-sm text-ink/60">
            Step {step + 1} of {STEPS.length}. Use ← → keys, or Esc to skip.
          </p>
          <h2 id="tutorial-title" className="mt-1 text-lg font-medium leading-tight">
            {s.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed">{s.body}</p>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button onClick={onClose} className="text-sm underline">
              Skip tutorial
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="rounded-md border border-ink px-4 py-2 font-normal"
                >
                  Back
                </button>
              )}
              <button
                autoFocus
                onClick={() => (last ? onClose() : setStep(step + 1))}
                className="rounded-md bg-teal px-5 py-2 font-medium text-white hover:bg-ink"
              >
                {last ? "Start captioning" : "Next"}
              </button>
            </div>
          </div>

          <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i === step ? "bg-teal" : "bg-grout"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
