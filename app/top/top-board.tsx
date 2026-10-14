"use client";

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
    <svg viewBox="0 0 48 64" className="h-[76px] w-[57px] drop-shadow-sm" role="img" aria-label={`${m.label} place`}>
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

function Note({ row, rank, big }: { row: Row; rank: number; big?: boolean }) {
  const tilt = [-2, 1.5, -1, 2, -1.5][rank % 5];
  return (
    <a
      href="/feed"
      className={`note relative block p-3 transition-transform hover:-translate-y-1 ${big ? "pt-5" : ""}`}
      style={{ background: NOTE_COLORS[rank % NOTE_COLORS.length], transform: `rotate(${tilt}deg)` }}
    >
      {rank < 3 ? (
        <span className="absolute -top-9 left-1/2 -translate-x-1/2">
          <Medal place={rank as 0 | 1 | 2} />
        </span>
      ) : (
        <span className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-ink/40 bg-white text-xs">
          {rank + 1}
        </span>
      )}
      <img src={row.image_url} alt="" className="aspect-square w-full object-cover" />
      <p className={`mt-2 leading-snug ${big ? "text-base" : "text-sm"}`}>{row.caption}</p>
      <p className="mt-1 text-xs text-ink/60">+{Number(row.score)} votes</p>
    </a>
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
          .filter((r) => perImage.get(r.image_url) === 1 && Number(r.score) > 0)
          .sort((a, b) => Number(b.score) - Number(a.score) || a.created_at.localeCompare(b.created_at))
          .slice(0, 20)
      );
    })();
  }, []);

  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  // Show 2nd, 1st, 3rd so the winner stands in the middle
  const order = [1, 0, 2].filter((i) => podium[i]);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 pb-20 pt-6 sm:px-10">
      <header className="flex items-center justify-between">
        <a href="/feed" className="text-sm underline">
          ← Back
        </a>
        <a href="/" className="hand text-sm tracking-[0.15em]">
          At 116 &amp; Broadway
        </a>
      </header>

      <h1 className="hand mt-10 text-center text-[clamp(24px,3vw,36px)] tracking-[0.15em]">Top captions</h1>
      <p className="mt-2 text-center text-sm text-ink/60">Ranked by upvotes, all time.</p>

      {rows === null ? (
        <div className="mt-16 flex justify-center">
          <StickMan label="Counting votes…" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-16 text-center text-sm">No upvotes yet. Go vote.</p>
      ) : (
        <>
          <section className="mx-auto mt-24 grid max-w-[820px] grid-cols-3 items-end gap-4 sm:gap-8">
            {order.map((i) => (
              <div key={podium[i].id} className={i === 0 ? "sm:-translate-y-6" : ""}>
                <Note row={podium[i]} rank={i} big={i === 0} />
              </div>
            ))}
          </section>

          {rest.length > 0 && (
            <>
              <div className="mt-16 flex items-center gap-4 text-xs text-ink/60">
                <span>The rest</span>
                <span className="h-px flex-1 bg-ink/30" />
              </div>
              <section className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {rest.map((r, i) => (
                  <Note key={r.id} row={r} rank={i + 3} />
                ))}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
