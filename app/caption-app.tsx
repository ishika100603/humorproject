"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/sound";
import { ANNOUNCEMENTS, greeting } from "@/lib/jokes";
import Tutorial from "./tutorial";

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

// The feed order is frozen when the page loads (or when you switch tabs),
// so cards never jump around while you are voting.
type Slot = { url: string; ids: number[] };
type Sort = "hot" | "new" | "top";

function buildOrder(rows: FeedRow[], sort: Sort): Slot[] {
  const groups = new Map<string, FeedRow[]>();
  for (const r of rows) groups.set(r.image_url, [...(groups.get(r.image_url) ?? []), r]);
  const list = [...groups.entries()].map(([url, rs]) => {
    rs.sort((a, b) => Number(b.score) - Number(a.score) || b.id - a.id);
    const newest = rs.reduce((m, r) => (r.created_at > m ? r.created_at : m), "");
    const best = Math.max(...rs.map((r) => Number(r.score)));
    const hours = (Date.now() - new Date(newest).getTime()) / 36e5;
    const hot = (best + 1) / Math.pow(hours + 2, 1.5);
    return { url, ids: rs.map((r) => r.id), newest, best, hot };
  });
  list.sort((a, b) =>
    sort === "top"
      ? b.best - a.best || b.newest.localeCompare(a.newest)
      : sort === "hot"
        ? b.hot - a.hot
        : b.newest.localeCompare(a.newest)
  );
  return list.map(({ url, ids }) => ({ url, ids }));
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
  const [order, setOrder] = useState<Slot[]>([]);
  const [sort, setSort] = useState<Sort>("hot");
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
        setOrder(buildOrder(data, "hot"));
        loadLeaders(data);
      }
      setLoading(false);
    })();

    try {
      setSoundOn(localStorage.getItem("ctc-sound") !== "off");
      if (!localStorage.getItem("ctc-tutorial-done")) setTutorial(true);
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
            const id = Number((e.target as HTMLElement).dataset.captionId);
            if (id) pendingSeen.current.add(id);
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
  const changeSort = (s: Sort) => {
    playSound("tap");
    setSort(s);
    setOrder(buildOrder(rows, s));
  };

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
    // Put the new photo first and keep everything else where it was
    const newUrl = data.find((r) => ids.includes(r.id))?.image_url;
    setOrder((prev) => {
      const fresh = buildOrder(data, sort);
      const known = new Set(prev.map((s) => s.url));
      const mine = fresh.filter((s) => s.url === newUrl);
      const others = fresh.filter((s) => !known.has(s.url) && s.url !== newUrl);
      const kept = prev
        .filter((s) => s.url !== newUrl)
        .map((s) => {
          const all = fresh.find((f) => f.url === s.url)?.ids ?? s.ids;
          return { url: s.url, ids: [...s.ids, ...all.filter((id) => !s.ids.includes(id))] };
        });
      return [...mine, ...kept, ...others];
    });
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
      const data = await fetchFeed();
      if (data) setRows(data);
    } else {
      loadLeaders();
    }
  };

  // ---------- what to show ----------
  const isNew = (slot: Slot) =>
    slot.ids.some((id) => !seenAtLoad.has(id) || arrivedIds.has(id));
  const newSlots = order.filter(isNew);
  const seenSlots = order.filter((s) => !isNew(s));
  const visible = showSeen ? order : newSlots;
  const announcement = ANNOUNCEMENTS[tick % ANNOUNCEMENTS.length];

  return (
    <>
      {tutorial && <Tutorial onClose={closeTutorial} />}

      <main className="mx-auto grid w-full max-w-[1680px] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(340px,420px)_1fr] lg:px-10">
        {/* Left column: sign, humor, posting, leaderboard */}
        <aside className="grid content-start gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pb-4 lg:pr-2">
          <header className="mosaic">
            <div className="mosaic-field px-5 py-6 text-center">
              <h1 className="condensed text-5xl font-extrabold uppercase leading-none tracking-tight">
                Caption the City
              </h1>
              <p className="mt-2">Upload a campus photo, get AI captions, and upvote the funniest.</p>
              <p className="mt-1 text-sm text-ink/70">Made for Columbia. Posts are anonymous.</p>
            </div>
          </header>

          <section
            aria-label="Service announcement"
            className="rounded-md border-2 border-ink bg-ink px-4 py-3 text-white"
          >
            <p className="condensed text-sm font-bold uppercase text-mustard">Service announcement</p>
            <p key={tick} className="fade-in mt-1 min-h-[3rem] leading-snug" aria-live="polite">
              {announcement}
            </p>
          </section>

          {user ? (
            <CreateCaptions userId={user.id} onCreated={onCreated} />
          ) : (
            <div className="rounded-md border-2 border-dashed border-ink/40 bg-tile-face p-5 text-center">
              <a href="/login" className="font-semibold text-teal underline">
                Log in
              </a>{" "}
              with Google to post photos and vote.
            </div>
          )}

          <Leaderboard leaders={leaders} today={leadersToday} />

          <p className="text-center text-sm">
            <a href="/privacy" className="underline">
              Privacy policy
            </a>
          </p>
        </aside>

        {/* Right column: the feed */}
        <section aria-label="Caption feed" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md bg-ink p-1" role="tablist" aria-label="Sort captions">
              {(["hot", "new", "top"] as const).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={sort === s}
                  onClick={() => changeSort(s)}
                  className={`condensed rounded px-5 py-1.5 text-base font-bold uppercase transition-colors ${
                    sort === s ? "bg-mustard text-ink" : "text-white hover:text-mustard"
                  }`}
                >
                  {s === "hot" ? "Hot" : s === "new" ? "New" : "Top"}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setTutorial(true)}
                className="rounded-md border-2 border-ink bg-tile-face px-3 py-1.5 text-sm font-semibold hover:bg-ink hover:text-white"
              >
                ? How it works
              </button>
              <button
                onClick={toggleSound}
                aria-pressed={soundOn}
                className="rounded-md border-2 border-ink bg-tile-face px-3 py-1.5 text-sm font-semibold hover:bg-ink hover:text-white"
              >
                {soundOn ? "Sound on" : "Sound off"}
              </button>
              <a
                href={user ? "/profile" : "/login"}
                className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-teal"
              >
                {user ? "My profile" : "Log in"}
              </a>
            </div>
          </div>

          <p className="mb-5 min-h-[1.5rem] text-ink/80">{hello}</p>

          {error && (
            <p className="mb-4 rounded-md border-2 border-brick bg-white p-3 font-semibold text-brick" role="alert">
              {error}
            </p>
          )}
          {loading && <p>Loading captions…</p>}

          <div className="grid items-start gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((slot) => (
              <PhotoCard
                key={slot.url}
                slot={slot}
                rowById={rowById}
                isArrived={slot.ids.some((id) => arrivedIds.has(id))}
                onVote={vote}
                trackSeen={trackSeen}
              />
            ))}

            {!loading && (
              <CaughtUp
                hasNew={newSlots.length > 0}
                showSeen={showSeen}
                seenCount={seenSlots.length}
                countdown={countdown}
                loggedIn={!!user}
                onToggleSeen={() => {
                  playSound("tap");
                  setShowSeen(!showSeen);
                }}
              />
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function PhotoCard({
  slot,
  rowById,
  isArrived,
  onVote,
  trackSeen,
}: {
  slot: Slot;
  rowById: Map<number, FeedRow>;
  isArrived: boolean;
  onVote: (row: FeedRow, value: 1 | -1) => void;
  trackSeen: (el: HTMLElement | null) => void;
}) {
  const captions = slot.ids.map((id) => rowById.get(id)).filter(Boolean) as FeedRow[];
  if (captions.length === 0) return null;
  return (
    <article
      className={`overflow-hidden rounded-md border-2 border-ink bg-tile-face shadow-[6px_6px_0_var(--ink)] ${
        isArrived ? "arrive" : ""
      }`}
    >
      <img src={slot.url} alt="" loading="lazy" className="aspect-[4/3] w-full border-b-2 border-ink object-cover" />
      <ul>
        {captions.map((c, i) => (
          <li
            key={c.id}
            ref={trackSeen}
            data-caption-id={c.id}
            className={`flex items-center gap-4 px-4 py-4 ${i > 0 ? "border-t border-grout" : ""}`}
          >
            <VoteControl row={c} onVote={onVote} />
            <p className="text-lg leading-snug">{c.caption}</p>
          </li>
        ))}
      </ul>
    </article>
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
        className={`pop condensed my-0.5 text-lg font-extrabold ${
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
  loggedIn,
  onToggleSeen,
}: {
  hasNew: boolean;
  showSeen: boolean;
  seenCount: number;
  countdown: string;
  loggedIn: boolean;
  onToggleSeen: () => void;
}) {
  return (
    <div className="col-span-full rounded-md border-2 border-dashed border-ink/50 bg-tile-face p-6 text-center">
      {showSeen ? (
        <p className="text-lg font-semibold">That's everything, including captions you've seen.</p>
      ) : (
        <>
          <p className="condensed text-3xl font-extrabold uppercase">
            {hasNew ? "You're all caught up" : "No new captions since your last visit"}
          </p>
          <p className="mx-auto mt-2 max-w-xl">
            New captions show up whenever someone posts a photo. Today's leaderboard resets at
            midnight, in <strong>{countdown}</strong>.{" "}
            {loggedIn ? "Post a photo to start the next set." : "Log in to post the next set."}
          </p>
        </>
      )}
      {seenCount > 0 && (
        <button
          onClick={onToggleSeen}
          className="mt-4 rounded-md border-2 border-ink px-4 py-2 font-semibold hover:bg-ink hover:text-white"
        >
          {showSeen ? "Hide captions you've seen" : `Show captions you've seen (${seenCount} photos)`}
        </button>
      )}
    </div>
  );
}

function Leaderboard({ leaders, today }: { leaders: Leader[]; today: boolean }) {
  return (
    <section className="rounded-md border-2 border-ink bg-tile-face p-5">
      <h2 className="condensed text-2xl font-extrabold uppercase">
        {today ? "Today's leaderboard" : "Leaderboard"}
      </h2>
      {leaders.length === 0 ? (
        <p className="mt-2 text-sm">
          No votes yet {today ? "today" : ""}. Your upvote could put a caption at number 1.
        </p>
      ) : (
        <ol className="mt-3 grid gap-3">
          {leaders.map((l, i) => (
            <li key={l.id} className="flex items-start gap-3">
              <span
                className={`condensed flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-extrabold ${
                  i === 0 ? "bg-mustard text-ink" : "bg-ink text-white"
                }`}
              >
                {i + 1}
              </span>
              <p className="flex-1 text-sm leading-snug">{l.caption}</p>
              <span className="condensed text-lg font-extrabold text-teal">+{Number(l.score)}</span>
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

    setStage("Writing captions");
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
    <form ref={formRef} onSubmit={generate} className="rounded-md border-2 border-ink bg-tile-face p-5">
      <h2 className="condensed mb-3 text-2xl font-extrabold uppercase">Caption a photo</h2>

      <label
        className={`flex items-center gap-4 rounded-md border-2 border-dashed border-ink/40 p-3 ${
          working ? "opacity-50" : "cursor-pointer hover:border-teal"
        }`}
      >
        {preview ? (
          <img src={preview} alt="" className="h-20 w-20 rounded object-cover" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-grout text-3xl">+</span>
        )}
        <span className="min-w-0 break-words">
          {file ? file.name : "Choose a campus photo (JPG, PNG or WebP, up to 5 MB)"}
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
        className="mt-3 w-full rounded-md border-2 border-ink/30 bg-white px-3 py-2 focus:border-teal"
      />

      {working ? (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">{stage}…</span>
            <span className="condensed text-2xl font-extrabold">{pct}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-ink bg-white">
            <div className="h-full bg-teal transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
          <div className="track mt-3" aria-hidden="true">
            <div className="train" />
          </div>
          <p className="mt-3 text-sm">
            Usually takes about 10 seconds. You can keep scrolling the feed while you wait, or stop it.
          </p>
          <button
            type="button"
            onClick={cancel}
            className="mt-3 w-full rounded-md border-2 border-ink px-4 py-2 font-semibold hover:bg-ink hover:text-white"
          >
            Stop generating
          </button>
        </div>
      ) : (
        <button
          disabled={!file}
          className="mt-3 w-full rounded-md bg-teal px-4 py-3 text-lg font-bold text-white hover:bg-ink disabled:opacity-40"
        >
          {phase === "error" ? "Try again" : "Generate captions"}
        </button>
      )}

      {!working && !message && (
        <p className="mt-2 text-sm text-ink/70">You get 3 captions. They post to the feed without your name.</p>
      )}
      {message && (
        <p
          className={`mt-3 text-sm ${phase === "error" ? "rounded-md border-2 border-brick bg-white p-3 text-brick" : ""}`}
          role={phase === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  );
}
