"use client";

import { useEffect, useState } from "react";

// Three-line menu button that opens a slim panel from the left
export default function Menu({
  children,
  open: openProp,
  onOpenChange,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-full hover:bg-white/60"
      >
        <span className="h-px w-5 bg-[#141414]" />
        <span className="h-px w-5 bg-[#141414]" />
        <span className="h-px w-5 bg-[#141414]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="lightbox absolute inset-0 bg-[#141414]/20" onClick={() => setOpen(false)} />
          <nav className="menu-in absolute inset-y-0 left-0 flex w-[min(320px,85vw)] flex-col gap-8 overflow-y-auto bg-[#eef6fb] px-7 py-6 text-[#141414]">
            <div className="flex items-center justify-between">
              <span className="hand text-base tracking-[0.15em]">At 116 &amp; Broadway</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-xl leading-none text-[#141414]/60 hover:text-[#141414]">
                ×
              </button>
            </div>
            <ul className="grid gap-3 text-base">
              <li><a href="/" className="hover:underline">Home</a></li>
              <li><a href="/feed" className="hover:underline">Vote on captions</a></li>
              <li><a href="/feed?post=1" className="hover:underline">Post a photo</a></li>
              <li><a href="/feed?tour=1" className="hover:underline">How it works</a></li>
              <li><a href="/profile" className="hover:underline">My profile</a></li>
              <li><a href="/privacy" className="hover:underline">Privacy</a></li>
            </ul>
            {children}
          </nav>
        </div>
      )}
    </>
  );
}
