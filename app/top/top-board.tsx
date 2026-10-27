"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StickMan from "../stickman";

type Row = { id: number; image_url: string; caption: string; score: number; created_at: string };

const MEDALS = [
  { label: "1st", fill: "#d9b23a", ribbon: "#1d4f91" },
  { label: "2nd", fill: "#b9bec4", ribbon: "#1d4f91" },
  { label: "3rd", fill: "#c07a43", ribbon: "#1d4f91" },
];
const NOTE_COLORS = ["#f6eebc", "#f3e9b0", "#f8f1c8", "#efe4a6"];

// A hand-drawn medal on a ribbon, pinned to the top of a note
function Medal({ place }: { place: 0 | 1 | 2 }) {
  const m = MEDALS[place];
  return (
    <svg viewBox="0 0 48 64" className="h-full w-auto drop-shadow-sm" role="img" aria-label={`${m.label} place`}>
      <g stroke="#141414" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M14 2 L22 28 L28 26 L20 2 Z" fill={m.ribbon} />
        <path d="M34 2 L26 28 L20 26 L28 2 Z" fill={m.ribbon} />
        <circle cx="24" cy="42" r="15" fill={m.fill} />
        <circle cx="24" cy="42" r="11" fill="none" strokeWidth="1" opacity="0.6" />
      </g>
      <text x="24" y="46.5" textAnchor="middle" fontSize="11" fontWeight="600" fill="#141414">
        {m.label}
      </text>
    </svg>
  );
}

function Note({ row, rank, size }: { row: Row; rank: number; size: "first" | "podium" | "small" }) {
  const tilt = [-2, 1.5, -1, 2, -1.5][rank % 5];
  const width = { first: "w-[min(230px,27vh,30vw)]", podium: "w-[min(200px,23vh,26vw)]", small: "w-[min(120px,12vh,13vw)]" }[size];
  const n = Number(row.score);
  return (
    <Link
      href="/"
      className={`note relative block shrink-0 transition-transform hover:-translate-y-1 ${width} ${size === "small" ? "p-1.5" : "p-2.5"}`}
      style={{ background: NOTE_COLORS[rank % NOTE_COLORS.length], transform: `rotate(${tilt}deg)` }}
    >
      {rank < 3 ? (
        <span className="absolute -top-[5.5vh] left-1/2 h-[7vh] max-h-[76px] -translate-x-1/2">
          <Medal place={rank as 0 | 1 | 2} />
        </span>
      ) : (
        <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-ink/40 bg-white text-[11px]">
          {rank + 1}
        </span>
      )}
      <img src={row.image_url} alt="" className="aspect-square w-full object-cover" />
      <p className={`mt-1.5 line-clamp-2 leading-snug ${size === "small" ? "text-[10px]" : "text-[13px]"}`}>{row.caption}</p>
      <p className={`text-ink/60 ${size === "small" ? "text-[9px]" : "mt-0.5 text-[11px]"}`}>
        {n > 0 ? "+" : ""}
        {n} {Math.abs(n) === 1 ? "vote" : "votes"}
      </p>
    </Link>
  );
}

export default function TopBoard() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await createClient().rpc("caption_feed");
      const all = (data ?? []) as Row[];
      // Only photos with a single caption, the same notes the feed shows
      const perImage = new Map<string, number>();
      all.forEach((r) => perImage.set(r.image_url, (perImage.get(r.image_url) ?? 0) + 1));
      setRows(
        all
          .filter((r) => perImage.get(r.image_url) === 1)
          .sort((a, b) => Number(b.score) - Number(a.score) || a.created_at.localeCompare(b.created_at))
          .slice(0, 9)
      );
    })();
  }, []);

  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  // Show 2nd, 1st, 3rd so the winner stands in the middle
  const order = [1, 0, 2].filter((i) => podium[i]);

  return (
    <main className="flex h-[100dvh] w-full flex-col overflow-hidden px-5 pt-5 sm:px-10">
      <header className="flex shrink-0 items-center justify-between">
        <Link href="/" className="text-sm underline">
          ← Back
        </Link>
        <Link href="/" className="hand text-sm tracking-[0.15em]">
          At 116 &amp; Broadway
        </Link>
      </header>

      <h1 className="hand mt-[2vh] shrink-0 text-center text-[clamp(22px,4.5vh,36px)] tracking-[0.15em]">
        Top captions
      </h1>
      <p className="shrink-0 text-center text-xs text-ink/60">Ranked by upvotes, all time.</p>

      {rows === null ? (
        <div className="flex flex-1 items-center justify-center">
          <StickMan label="Counting votes…" />
        </div>
      ) : rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-sm">Nothing posted yet.</p>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-evenly">
          <section className="flex items-end justify-center gap-[3vw] pt-[6vh]">
            {order.map((i) => (
              <div key={podium[i].id} className={i === 0 ? "-translate-y-[3vh]" : ""}>
                <Note row={podium[i]} rank={i} size={i === 0 ? "first" : "podium"} />
              </div>
            ))}
          </section>

          {rest.length > 0 && (
            <section className="flex w-full max-w-[900px] items-start justify-center gap-[2vw] border-t border-ink/20 pt-[2.5vh]">
              {rest.map((r, i) => (
                <Note key={r.id} row={r} rank={i + 3} size="small" />
              ))}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
