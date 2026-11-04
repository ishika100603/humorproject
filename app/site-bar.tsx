"use client";

import Link from "next/link";

// The same top bar as the meme feed, for every page except the landing page
export default function SiteBar() {
  const icon = "flex h-9 w-9 items-center justify-center rounded-full hover:bg-white";
  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 bg-tile/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-10">
      <Link href="/memes" className="hand text-base tracking-[0.15em]">
        At 116 &amp; Broadway
      </Link>
      <nav className="flex items-center gap-2">
        <Link href="/top" aria-label="Leaderboard and top captions" title="Top captions" className={icon}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="#141414" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
          </svg>
        </Link>
        <Link href="/profile" aria-label="Profile" title="Profile" className={icon}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="#141414" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </Link>
        <Link href="/memes?post=1" className="ml-1 rounded-full bg-ink px-4 py-1.5 text-sm text-white hover:bg-teal">
          Post a photo
        </Link>
      </nav>
    </header>
  );
}
