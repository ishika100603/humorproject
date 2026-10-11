"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/sound";
import { toast } from "@/lib/toast";
import { ANNOUNCEMENTS, greeting } from "@/lib/jokes";
import { UPDATES } from "@/lib/updates";
import Tutorial from "./tutorial";
import StickMan from "./stickman";

const CONTACT = "ia2630@columbia.edu";

type FeedRow = {
  id: number;
  image_url: string;
  caption: string;
  prompt: string | null;
  created_at: string;
  score: number;
  upvotes: number;
  downvotes: number;
  my_vote: number | null;
};

type Leader = { id: number; caption: string; image_url: string; score: number };

// One sticky note per photo. The order is by date, so voting never moves notes.
type Slot = { url: string; ids: number[]; newest: string };

const NOTE_COLORS = ["#f6eebc", "#f3e9b0", "#f8f1c8", "#efe4a6"];

function buildSlots(rows: FeedRow[]): Slot[] {
  const groups = new Map<string, FeedRow[]>();
  for (const r of rows) groups.set(r.image_url, [...(groups.get(r.image_url) ?? []), r]);
  return [...groups.entries()]
    .map(([url, rs]) => ({
      url,
      ids: rs.sort((a, b) => a.id - b.id).map((r) => r.id),
      newest: rs.reduce((m, r) => (r.created_at > m ? r.created_at : m), ""),
    }))
    .sort((a, b) => b.newest.localeCompare(a.newest));
}

// New York calendar date (as a UTC midnight Date) for a timestamp
function nyDay(iso: string | Date) {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso));
  return new Date(`${s}T00:00:00Z`);
}

// Monday of the week, used to group notes
function weekStart(iso: string | Date) {
  const d = nyDay(iso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

function weekLabel(start: Date, now: number) {
  const thisWeek = weekStart(new Date(now)).getTime();
  const diff = Math.round((thisWeek - start.getTime()) / (7 * 864e5));
  const date = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (diff === 0) return `This week, from ${date}`;
  if (diff === 1) return `Last week, from ${date}`;
  return `Week of ${date}`;
}

function msUntilMidnightET() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000;
  return 24 * 3600 * 1000 - elapsed;
}

function formatCountdown(ms: number) {
  const mins = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function daysUntilMonday(now: number) {
  const d = nyDay(new Date(now)).getUTCDay();
  const n = (8 - d) % 7;
  return n === 0 ? 7 : n;
}

function readLocalSeen(key: string): number[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

export default function CaptionApp() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seenAtLoad, setSeenAtLoad] = useState<Set<number>>(new Set());
  const [showSeen, setShowSeen] = useState(false);
  const [arrivedIds, setArrivedIds] = useState<Set<number>>(new Set());
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leadersToday, setLeadersToday] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [tutorial, setTutorial] = useState(false);
  const [tick, setTick] = useState(0);
  const [countdown, setCountdown] = useState("");
  const [hello, setHello] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const userRef = useRef<User | null>(null);
  const pendingSeen = useRef<Set<number>>(new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const seenKey = (u: User | null) => `ctc-seen-${u?.id ?? "guest"}`;

  // ---------- loading ----------
  const loadLeaders = useCallback(async (fallbackRows?: FeedRow[]) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("daily_leaderboard");
    if (!error && data) {
      setLeaders(data as Leader[]);
      setLeadersToday(true);
    } else if (fallbackRows) {
      setLeaders(
        [...fallbackRows]
          .filter((r) => Number(r.score) > 0)
          .sort((a, b) => Number(b.score) - Number(a.score))
          .slice(0, 5)
          .map((r) => ({ id: r.id, caption: r.caption, image_url: r.image_url, score: Number(r.score) }))
      );
      setLeadersToday(false);
    }
  }, []);

  const fetchFeed = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("caption_feed");
    if (error) {
      setError(`Couldn't load captions (${error.message}). Refresh to try again, or email ${CONTACT}.`);
      toast("error", "Feed didn't load", `Refresh to try again, or email ${CONTACT}.`);
      return null;
    }
    return (data ?? []) as FeedRow[];
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      userRef.current = user;

      // Which captions has this person already seen on earlier visits?
      let seen: number[] = readLocalSeen(seenKey(user));
      if (user) {
        const { data, error } = await supabase.from("seen_captions").select("caption_id");
        if (!error && data) seen = [...new Set([...seen, ...data.map((d) => d.caption_id)])];
      }
      setSeenAtLoad(new Set(seen));

      const data = await fetchFeed();
      if (data) {
        setRows(data);
        loadLeaders(data);
      }
      setLoading(false);
    })();

    try {
      setSoundOn(localStorage.getItem("ctc-sound") !== "off");
      const tour = new URLSearchParams(window.location.search).has("tour");
      if (tour || !localStorage.getItem("ctc-tutorial-done")) setTutorial(true);
    } catch {}
  }, [fetchFeed, loadLeaders]);

  // ---------- seen tracking ----------
  const flushSeen = useCallback(async () => {
    const ids = [...pendingSeen.current];
    if (ids.length === 0) return;
    pendingSeen.current.clear();
    const u = userRef.current;
    try {
      const key = seenKey(u);
      const merged = [...new Set([...readLocalSeen(key), ...ids])].slice(-5000);
      localStorage.setItem(key, JSON.stringify(merged));
    } catch {}
    if (u) {
      const supabase = createClient();
      await supabase
        .from("seen_captions")
        .upsert(
          ids.map((caption_id) => ({ caption_id, user_id: u.id })),
          { onConflict: "user_id,caption_id", ignoreDuplicates: true }
        );
    }
  }, []);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const ids = ((e.target as HTMLElement).dataset.captionIds ?? "").split(",").map(Number);
            ids.forEach((id) => id && pendingSeen.current.add(id));
          }
        }
      },
      { threshold: 0.6 }
    );
    const interval = setInterval(flushSeen, 4000);
    const onHide = () => document.visibilityState === "hidden" && flushSeen();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      observer.current?.disconnect();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      flushSeen();
    };
  }, [flushSeen]);

  const trackSeen = useCallback((el: HTMLElement | null) => {
    if (el) observer.current?.observe(el);
  }, []);

  // ---------- rotating humor + countdown ----------
  useEffect(() => {
    const update = () => {
      setCountdown(formatCountdown(msUntilMidnightET()));
      setHello(greeting());
      setNow(Date.now());
    };
    update();
    const a = setInterval(() => setTick((t) => t + 1), 7000);
    const b = setInterval(update, 30000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  // ---------- actions ----------
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem("ctc-sound", next ? "on" : "off");
    } catch {}
    if (next) playSound("tap");
  };

  const closeTutorial = () => {
    setTutorial(false);
    try {
      localStorage.setItem("ctc-tutorial-done", "1");
    } catch {}
  };

  const onCreated = async (ids: number[]) => {
    const data = await fetchFeed();
    if (!data) return;
    setRows(data);
    setArrivedIds((prev) => new Set([...prev, ...ids]));
    ids.forEach((id) => pendingSeen.current.add(id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const vote = async (row: FeedRow, value: 1 | -1) => {
    if (!user) {
      router.push("/login");
      return;
    }
    const removing = row.my_vote === value;
    const previous = row.my_vote ?? 0;
    const next = removing ? 0 : value;
    playSound(removing ? "unvote" : value === 1 ? "up" : "down");

    // Counts update right away; the card stays where it is
    setRows((rs) =>
      rs.map((r) =>
        r.id !== row.id
          ? r
          : {
              ...r,
              my_vote: next || null,
              score: Number(r.score) - previous + next,
              upvotes: Number(r.upvotes) - (previous === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
              downvotes: Number(r.downvotes) - (previous === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
            }
      )
    );

    const supabase = createClient();
    const { error } = removing
      ? await supabase.from("votes").delete().eq("caption_id", row.id).eq("user_id", user.id)
      : await supabase
          .from("votes")
          .upsert({ caption_id: row.id, user_id: user.id, value }, { onConflict: "caption_id,user_id" });

    if (error) {
      playSound("error");
      setError(`Your vote didn't save (${error.message}). Try again, or email ${CONTACT} if it keeps happening.`);
      toast("error", "Vote didn't count", `Try again, or email ${CONTACT} if it keeps happening.`);
      const data = await fetchFeed();
      if (data) setRows(data);
    } else {
      loadLeaders();
    }
  };

  // ---------- what to show ----------
  const slots = useMemo(() => buildSlots(rows), [rows]);
  const isNew = (slot: Slot) => slot.ids.some((id) => !seenAtLoad.has(id) || arrivedIds.has(id));
  const newSlots = slots.filter(isNew);
  const seenSlots = slots.filter((s) => !isNew(s));
  const visible = showSeen ? slots : newSlots;
  const announcement = ANNOUNCEMENTS[tick % ANNOUNCEMENTS.length];

  // Group the visible notes by week, newest week first
  const weeks = useMemo(() => {
    if (now === null) return [];
    const out: { key: number; label: string; items: { slot: Slot; index: number }[] }[] = [];
    visible.forEach((slot, index) => {
      const ws = weekStart(slot.newest);
      const last = out[out.length - 1];
      if (last && last.key === ws.getTime()) last.items.push({ slot, index });
      else out.push({ key: ws.getTime(), label: weekLabel(ws, now), items: [{ slot, index }] });
    });
    return out;
  }, [visible, now]);

  // Meme of the week: best caption posted since Monday
  const meme = useMemo(() => {
    if (now === null) return undefined;
    const monday = weekStart(new Date(now)).getTime();
    return rows
      .filter((r) => nyDay(r.created_at).getTime() >= monday && Number(r.score) > 0)
      .sort((a, b) => Number(b.score) - Number(a.score))[0];
  }, [rows, now]);

  const openNote = (index: number) => {
    playSound("tap");
    setOpenIndex(index);
    visible[index]?.ids.forEach((id) => pendingSeen.current.add(id));
  };

  return (
    <>
      {tutorial && <Tutorial onClose={closeTutorial} />}

      <header className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 border-b border-ink/30 px-4 py-4 sm:px-6 lg:px-10">
        <a href="/" className="hand text-lg tracking-[0.15em]">
          At 116 &amp; Broadway
        </a>
        <div className="flex items-center gap-2">
          <button onClick={() => setTutorial(true)} className="rounded-full px-3 py-1 text-sm hover:bg-white">
            How it works
          </button>
          <button onClick={toggleSound} aria-pressed={soundOn} className="rounded-full px-3 py-1 text-sm hover:bg-white">
            {soundOn ? "Sound on" : "Sound off"}
          </button>
          <a href={user ? "/profile" : "/login"} className="rounded-full bg-ink px-4 py-1.5 text-sm text-white hover:bg-teal">
            {user ? "My profile" : "Log in"}
          </a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1680px] gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[300px_1fr] lg:px-10">
        <aside className="grid content-start gap-8 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
          {user ? (
            <CreateCaptions userId={user.id} onCreated={onCreated} />
          ) : (
            <p className="text-sm">
              <a href="/login" className="underline">
                Log in
              </a>{" "}
              to post a photo and vote.
            </p>
          )}

          {meme && (
            <section>
              <h2 className="text-xs text-ink/60">Meme of the week</h2>
              <div className="note mt-2 -rotate-1 p-4" style={{ background: NOTE_COLORS[0] }}>
                <p className="leading-snug">{meme.caption}</p>
                <p className="mt-2 text-xs text-ink/60">+{Number(meme.score)} so far. Crowned every Monday.</p>
              </div>
            </section>
          )}

          <Leaderboard leaders={leaders} today={leadersToday} />

          <section>
            <h2 className="text-xs text-ink/60">What&apos;s new</h2>
            <ul className="mt-2 grid gap-2 text-sm">
              {UPDATES.map((u, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-12 shrink-0 text-ink/60">{u.date}</span>
                  <span className="leading-snug">{u.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-ink/60">
            <span key={tick} className="fade-in inline-block">{announcement}</span>
            <br />
            <a href="/privacy" className="underline">
              Privacy policy
            </a>
          </p>
        </aside>

        <section aria-label="Caption feed" className="min-w-0">
          <p className="mb-6 min-h-[1.5rem] text-sm text-ink/70">{hello}</p>

          {error && (
            <p className="mb-4 rounded-md border border-brick bg-white p-3 text-sm text-brick" role="alert">
              {error}
            </p>
          )}

          {loading && (
            <div className="py-16">
              <StickMan label="Fetching today's notes…" />
            </div>
          )}

          {weeks.map((w, wi) => (
            <div key={w.key} className={wi > 0 ? "mt-10" : ""}>
              <div className="mb-5 flex items-center gap-3 text-xs text-ink/60">
                <span className="shrink-0">{w.label}</span>
                <span className="h-px flex-1 bg-ink/30" />
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                {w.items.map(({ slot, index }) => (
                  <NoteCard
                    key={slot.url}
                    slot={slot}
                    index={index}
                    rowById={rowById}
                    isArrived={slot.ids.some((id) => arrivedIds.has(id))}
                    onOpen={openNote}
                    trackSeen={trackSeen}
                  />
                ))}
              </div>
            </div>
          ))}

          {!loading && (
            <CaughtUp
              hasNew={newSlots.length > 0}
              showSeen={showSeen}
              seenCount={seenSlots.length}
              countdown={countdown}
              mondayIn={now === null ? 7 : daysUntilMonday(now)}
              loggedIn={!!user}
              onToggleSeen={() => {
                playSound("tap");
                setShowSeen(!showSeen);
              }}
            />
          )}
        </section>
      </main>

      {openIndex !== null && visible[openIndex] && (
        <Lightbox
          slots={visible}
          index={openIndex}
          rowById={rowById}
          onVote={vote}
          onMove={(i) => {
            playSound("tap");
            setOpenIndex(i);
            visible[i]?.ids.forEach((id) => pendingSeen.current.add(id));
          }}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

function NoteCard({
  slot,
  index,
  rowById,
  isArrived,
  onOpen,
  trackSeen,
}: {
  slot: Slot;
  index: number;
  rowById: Map<number, FeedRow>;
  isArrived: boolean;
  onOpen: (index: number) => void;
  trackSeen: (el: HTMLElement | null) => void;
}) {
  const captions = slot.ids.map((id) => rowById.get(id)).filter(Boolean) as FeedRow[];
  if (captions.length === 0) return null;
  const best = [...captions].sort((a, b) => Number(b.score) - Number(a.score))[0];
  const total = captions.reduce((n, c) => n + Number(c.score), 0);
  const tilt = ((index * 37) % 5) - 2;
  return (
    <button
      ref={trackSeen}
      data-caption-ids={slot.ids.join(",")}
      onClick={() => onOpen(index)}
      className={`note group flex flex-col p-3 text-left transition-transform hover:-translate-y-1 hover:rotate-0 ${isArrived ? "arrive" : ""}`}
      style={{ background: NOTE_COLORS[index % NOTE_COLORS.length], transform: `rotate(${tilt}deg)` }}
      aria-label={`Open note: ${best.caption}`}
    >
      <img src={slot.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
      <p className="mt-2 line-clamp-3 text-sm leading-snug">{best.caption}</p>
      <p className="mt-auto pt-2 text-xs text-ink/60">
        {total > 0 ? `+${total}` : total} · {new Date(slot.newest).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </p>
    </button>
  );
}

function Lightbox({
  slots,
  index,
  rowById,
  onVote,
  onMove,
  onClose,
}: {
  slots: Slot[];
  index: number;
  rowById: Map<number, FeedRow>;
  onVote: (row: FeedRow, value: 1 | -1) => void;
  onMove: (index: number) => void;
  onClose: () => void;
}) {
  const slot = slots[index];
  const prev = index > 0 ? index - 1 : null;
  const next = index < slots.length - 1 ? index + 1 : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prev !== null) onMove(prev);
      if (e.key === "ArrowRight" && next !== null) onMove(next);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [prev, next, onMove, onClose]);

  const captions = slot.ids.map((id) => rowById.get(id)).filter(Boolean) as FeedRow[];
  const arrow = "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink/50 bg-white/60 text-xl hover:bg-white disabled:opacity-20";

  return (
    <div
      className="lightbox fixed inset-0 z-50 flex items-center justify-center gap-4 bg-[#b9d9eb]/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Caption note"
      onClick={onClose}
    >
      <button className={arrow} disabled={prev === null} onClick={(e) => { e.stopPropagation(); if (prev !== null) onMove(prev); }} aria-label="Previous note">
        ←
      </button>

      <div
        key={slot.url}
        className="note note-open w-[min(520px,100%)] p-5"
        style={{ background: NOTE_COLORS[index % NOTE_COLORS.length] }}
        onClick={(e) => e.stopPropagation()}
      >
        <img src={slot.url} alt="" className="max-h-[55vh] w-full object-contain" />
        <ul className="mt-3 grid gap-2">
          {captions.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <VoteControl row={c} onVote={onVote} />
              <p className="text-base leading-snug">{c.caption}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between text-xs text-ink/60">
          <span>
            {index + 1} of {slots.length}. Use the arrow keys to flip through.
          </span>
          <button onClick={onClose} className="underline">
            Close
          </button>
        </div>
      </div>

      <button className={arrow} disabled={next === null} onClick={(e) => { e.stopPropagation(); if (next !== null) onMove(next); }} aria-label="Next note">
        →
      </button>
    </div>
  );
}

function VoteControl({
  row,
  onVote,
}: {
  row: FeedRow;
  onVote: (row: FeedRow, value: 1 | -1) => void;
}) {
  const score = Number(row.score);
  return (
    <div className="flex w-10 shrink-0 flex-col items-center">
      <button
        onClick={() => onVote(row, 1)}
        aria-label="Upvote"
        title="Funny"
        aria-pressed={row.my_vote === 1}
        className={`flex h-8 w-8 items-center justify-center rounded transition-transform active:scale-90 ${
          row.my_vote === 1 ? "bg-teal text-white" : "text-ink/40 hover:text-teal"
        }`}
      >
        ▲
      </button>
      <span
        key={score}
        className={`pop my-0.5 text-base font-medium ${
          score > 0 ? "text-teal" : score < 0 ? "text-brick" : ""
        }`}
      >
        {score}
      </span>
      <button
        onClick={() => onVote(row, -1)}
        aria-label="Downvote"
        title="Not funny"
        aria-pressed={row.my_vote === -1}
        className={`flex h-8 w-8 items-center justify-center rounded transition-transform active:scale-90 ${
          row.my_vote === -1 ? "bg-brick text-white" : "text-ink/40 hover:text-brick"
        }`}
      >
        ▼
      </button>
    </div>
  );
}

function CaughtUp({
  hasNew,
  showSeen,
  seenCount,
  countdown,
  mondayIn,
  loggedIn,
  onToggleSeen,
}: {
  hasNew: boolean;
  showSeen: boolean;
  seenCount: number;
  countdown: string;
  mondayIn: number;
  loggedIn: boolean;
  onToggleSeen: () => void;
}) {
  return (
    <div className="mt-12 flex justify-center">
      <div className="note w-[min(420px,100%)] rotate-1 p-6 text-center" style={{ background: NOTE_COLORS[2] }}>
        <p className="hand text-xl tracking-[0.1em]">
          {showSeen ? "That's every note" : hasNew ? "You're all caught up" : "Nothing new since your last visit"}
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          New notes appear whenever someone posts a photo. Today&apos;s leaderboard resets in {countdown}. The next meme
          of the week is crowned in {mondayIn} {mondayIn === 1 ? "day" : "days"}.
          {loggedIn ? " Post a photo to start the next set." : " Log in to post the next set."}
        </p>
        {seenCount > 0 && (
          <button onClick={onToggleSeen} className="mt-3 text-sm underline">
            {showSeen ? "Hide notes you've seen" : `Show notes you've seen (${seenCount})`}
          </button>
        )}
      </div>
    </div>
  );
}

function Leaderboard({ leaders, today }: { leaders: Leader[]; today: boolean }) {
  return (
    <section>
      <h2 className="text-xs text-ink/60">{today ? "Today's leaderboard" : "Leaderboard"}</h2>
      {leaders.length === 0 ? (
        <p className="mt-2 text-sm">No votes yet{today ? " today" : ""}. Your upvote could put a caption at number 1.</p>
      ) : (
        <ol className="mt-2 grid gap-2">
          {leaders.map((l, i) => (
            <li key={l.id} className="flex items-start gap-3 text-sm">
              <span className="w-4 shrink-0 text-ink/60">{i + 1}</span>
              <p className="flex-1 leading-snug">{l.caption}</p>
              <span className="text-teal">+{Number(l.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CreateCaptions({
  userId,
  onCreated,
}: {
  userId: string;
  onCreated: (ids: number[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [angle, setAngle] = useState("");
  const [phase, setPhase] = useState<"idle" | "working" | "error" | "stopped">("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [message, setMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const pickFile = (f: File | null) => {
    setFile(f);
    setMessage("");
    if (phase !== "working") setPhase("idle");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  // Progress creeps toward a target so the percentage keeps moving
  const animateTo = (target: number, speed: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress((p) => (p >= target - 0.5 ? p : p + (target - p) * speed));
    }, 200);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => stopTimer, []);

  const fail = (text: string) => {
    stopTimer();
    setPhase("error");
    setMessage(text);
    playSound("error");
    toast("error", "Foul!", text);
  };

  const generate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhase("error");
      setMessage("That photo is over 5 MB. Pick a smaller one.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("working");
    setMessage("");
    setProgress(2);
    setStage("Uploading photo");
    animateTo(25, 0.15);

    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, file, { contentType: file.type });
    if (controller.signal.aborted) return;
    if (uploadError) {
      fail(`The photo didn't upload (${uploadError.message}). Try again, or email ${CONTACT} and we'll sort it out.`);
      return;
    }

    setStage("Writing the caption");
    setProgress((p) => Math.max(p, 25));
    animateTo(95, 0.05);

    let res: Response;
    try {
      res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, angle }),
        signal: controller.signal,
      });
    } catch {
      if (!controller.signal.aborted) {
        fail(`Lost connection while writing captions. Check your internet and try again, or email ${CONTACT}.`);
      }
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (controller.signal.aborted) return;
    if (!res.ok) {
      fail(`${json.error ?? "Caption request failed."} If this keeps happening, email ${CONTACT} and we'll fix it.`);
      return;
    }

    stopTimer();
    setProgress(100);
    setStage("Done");
    playSound("done");
    toast("success", "Approved!", "Your caption is in the feed.");
    setTimeout(() => {
      setPhase("idle");
      setProgress(0);
      pickFile(null);
      setAngle("");
      formRef.current?.reset();
      onCreated((json.captions ?? []).map((c: { id: number }) => c.id));
    }, 600);
  };

  const cancel = () => {
    abortRef.current?.abort();
    stopTimer();
    setPhase("stopped");
    setProgress(0);
    setMessage("Stopped. Nothing new will show up from this photo unless the AI had already finished.");
    playSound("unvote");
  };

  const working = phase === "working";
  const pct = Math.round(progress);

  return (
    <form ref={formRef} onSubmit={generate} className="note p-4" style={{ background: "#f8f1c8" }}>
      <h2 className="mb-3 text-sm">Caption a photo</h2>

      <label
        className={`flex items-center gap-3 text-sm ${
          working ? "opacity-50" : "cursor-pointer hover:border-teal"
        }`}
      >
        {preview ? (
          <img src={preview} alt="" className="h-16 w-16 rounded object-cover" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-ink/40 text-lg">+</span>
        )}
        <span className="min-w-0 break-words">
          {file ? file.name : "Choose a campus photo (up to 5 MB)"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          disabled={working}
          className="sr-only"
        />
      </label>

      <input
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="Optional vibe, like “midterm week” or “housing lottery”"
        maxLength={200}
        disabled={working}
        className="mt-3 w-full rounded-md border border-ink/20 bg-white/70 px-3 py-2 text-sm focus:border-teal"
      />

      {working ? (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="flex items-baseline justify-between">
            <span className="font-normal">{stage}…</span>
            <span className="text-base font-medium">{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2">
            <StickMan />
          </div>
          <p className="mt-3 text-sm">
            Usually takes about 10 seconds. You can keep scrolling the feed while you wait, or stop it.
          </p>
          <button
            type="button"
            onClick={cancel}
            className="mt-3 w-full rounded-md border border-ink px-4 py-2 font-normal hover:bg-ink hover:text-white"
          >
            Stop generating
          </button>
        </div>
      ) : (
        <button
          disabled={!file}
          className="mt-3 w-full rounded-md bg-ink px-4 py-2.5 text-sm text-white hover:bg-teal disabled:opacity-30"
        >
          {phase === "error" ? "Try again" : "Generate caption"}
        </button>
      )}

      {!working && !message && (
        <p className="mt-2 text-sm text-ink/70">AI writes one caption. It posts to the feed without your name.</p>
      )}
      {message && (
        <p
          className={`mt-3 text-sm ${phase === "error" ? "rounded-md border border-brick bg-white p-3 text-brick" : ""}`}
          role={phase === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  );
}
