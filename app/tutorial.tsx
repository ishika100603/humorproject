"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    title: "Welcome to 116 & Broadway",
    body: "Columbia's campus, captioned by AI and ranked by students. Here is how it works in 30 seconds.",
  },
  {
    title: "Vote on what's funny",
    body: "Tap a sticky note to open it. Thumbs up if it made you laugh, thumbs down if it didn't. Flip between notes with the arrow keys.",
  },
  {
    title: "Earn crowns",
    body: "Every vote earns 1 crown. Vote on 15 different days in a month for a +10 bonus. See where you rank against classmates in the menu.",
  },
  {
    title: "Post a campus photo",
    body: "Use Post a photo at the top right. AI writes a short caption in a few seconds. Your name is never shown.",
  },
  {
    title: "Come back for fresh ones",
    body: "Each visit shows only notes you haven't seen. Want the old ones? Use “Show notes you've seen” at the bottom.",
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
