"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS: [string, string, string?][] = [
  ["/", "Home"],
  ["/feed", "Vote on captions"],
  ["/feed?post=1", "Post a photo", "post"],
  ["/top", "Top captions"],
  ["/feed?tour=1", "How it works", "tour"],
  ["/profile", "My profile"],
];

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
            <div className="flex items-center gap-3">
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-sm underline">
                ← Back
              </button>
              <span className="hand ml-auto text-sm tracking-[0.15em]">At 116 &amp; Broadway</span>
            </div>
            <ul className="grid gap-3 text-base">
              {LINKS.map(([href, label, action]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="hover:underline"
                    onClick={(e) => {
                      setOpen(false);
                      // Already on the feed: open the popup without reloading
                      if (action && window.location.pathname === "/feed") {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent("feed-action", { detail: action }));
                      }
                    }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            {children}
          </nav>
        </div>
      )}
    </>
  );
}
