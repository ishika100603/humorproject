"use client";

import { useState } from "react";

const STEPS = [
  {
    title: "Welcome to Caption the City",
    body: "Columbia's campus, captioned by AI and ranked by students. Here is how it works in 30 seconds.",
  },
  {
    title: "Post a campus photo",
    body: "Upload a photo in the box on the left. AI writes 3 captions for it in a few seconds. Your name is never shown.",
  },
  {
    title: "Vote on what's funny",
    body: "Tap ▲ if a caption made you laugh and ▼ if it didn't. Votes decide today's leaderboard.",
  },
  {
    title: "Come back for fresh ones",
    body: "Each visit shows only captions you haven't seen. Want the old ones? Use “Show captions you've seen.”",
  },
];

export default function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

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
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 id="tutorial-title" className="condensed mt-1 text-3xl font-extrabold uppercase leading-tight">
            {s.title}
          </h2>
          <p className="mt-3 text-lg leading-relaxed">{s.body}</p>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button onClick={onClose} className="text-sm underline">
              Skip tutorial
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="rounded-md border-2 border-ink px-4 py-2 font-semibold"
                >
                  Back
                </button>
              )}
              <button
                autoFocus
                onClick={() => (last ? onClose() : setStep(step + 1))}
                className="rounded-md bg-teal px-5 py-2 font-bold text-white hover:bg-ink"
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
