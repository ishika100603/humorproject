"use client";

import { useEffect, useState } from "react";
import type { ToastDetail } from "@/lib/toast";
import { JudgeCat, RefereeCat } from "./art";

type Item = ToastDetail & { id: number };

export default function Toasts() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      const id = Date.now() + Math.random();
      setItems((list) => [...list.slice(-2), { ...detail, id }]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), detail.kind === "error" ? 8000 : 3800);
    };
    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] grid w-[min(380px,calc(100vw-2rem))] gap-3" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-[#1d2a3a] bg-white p-3 pr-4 ${
            t.kind === "error" ? "toast-shake" : ""
          }`}
        >
          <div className="h-20 w-20 shrink-0">{t.kind === "error" ? <RefereeCat /> : <JudgeCat />}</div>
          <div className="min-w-0 flex-1">
            <p className={`text-base font-medium ${t.kind === "error" ? "text-[#c62d24]" : "text-[#1d2a3a]"}`}>{t.title}</p>
            {t.message && <p className="mt-0.5 text-sm leading-snug text-[#1d2a3a]">{t.message}</p>}
          </div>
          <button
            onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
            className="self-start text-base leading-none text-[#1d2a3a]/60 hover:text-[#1d2a3a]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
