"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/sound";
import { toast } from "@/lib/toast";
import { UPDATES } from "@/lib/updates";
import Tutorial from "./tutorial";
import StickMan from "./stickman";
import Menu from "./menu";
import Mascot from "./mascot";
import Crown from "./crown";

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
type MyPoints = { points: number; votes: number; days_this_month: number; bonus_months: number };
type Peer = { rank: number; name: string; points: number; is_me: boolean | null; is_star?: boolean | null };
type Star = {
  star_names: string | null;
  star_votes: number | null;
  leader_name: string | null;
  leader_votes: number | null;
  my_votes: number | null;
};

const BONUS_DAYS = 15;

// One sticky note per photo. The order is by date, so voting never moves notes.
type Slot = { url: string; ids: number[]; newest: string };

const NOTE_COLORS = ["#f6eebc", "#f3e9b0", "#f8f1c8", "#efe4a6"];

// "5 minutes ago", "3 hours ago", "2 days ago"
function timeAgo(ms: number) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} ${min === 1 ? "minute" : "minutes"} ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

// Before Oct 12 every photo got 3 captions automatically; those old ones stay hidden.
// Newer photos can have 1 to 3 captions because the poster chose that.
const MULTI_CAPTION_SINCE = "2026-10-12T00:00:00Z";
export function showInFeed(slot: { ids: number[]; newest: string }) {
  return slot.ids.length === 1 || slot.newest >= MULTI_CAPTION_SINCE;
}

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
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  // Caption job status, so it can keep running after the popup is closed
  const [job, setJob] = useState<{ phase: string; pct: number }>({ phase: "idle", pct: 0 });
  const onJob = useCallback(
    (phase: string, pct: number) =>
      setJob((j) => (j.phase === phase && j.pct === pct ? j : { phase, pct })),
    []
  );
  const [tossed, setTossed] = useState(false);
  const [mine, setMine] = useState<MyPoints | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [star, setStar] = useState<Star | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const bonusSeen = useRef<number | null>(null);

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

  const loadPoints = useCallback(async (u: User | null) => {
    const supabase = createClient();
    const board = await supabase.rpc("points_board");
    if (!board.error && board.data) setPeers(board.data as Peer[]);
    const st = await supabase.rpc("star_of_week");
    if (!st.error && st.data) setStar((st.data as Star[])[0] ?? null);
    if (!u) return;
    const me = await supabase.rpc("my_points");
    const row = (me.data as MyPoints[] | null)?.[0];
    if (me.error || !row) return;
    const next = {
      points: Number(row.points),
      votes: Number(row.votes),
      days_this_month: Number(row.days_this_month),
      bonus_months: Number(row.bonus_months),
    };
    // Celebrate the month bonus the moment it is earned
    if (bonusSeen.current !== null && next.bonus_months > bonusSeen.current) {
      playSound("done");
      toast("success", "Bonus! +10 crowns", `You voted on ${BONUS_DAYS} different days this month.`);
    }
    bonusSeen.current = next.bonus_months;
    setMine(next);
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
      loadPoints(user);

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
      const params = new URLSearchParams(window.location.search);
      if (params.has("post")) setPostOpen(true);
      // The tutorial pops up only right after logging in (?welcome=1), never on a plain visit
      const welcome = params.has("welcome") || params.has("tour");
      if (welcome) setTutorial(true);
      if (welcome || params.has("post")) window.history.replaceState(null, "", window.location.pathname);
    } catch {}
  }, [fetchFeed, loadLeaders, loadPoints]);

  // Esc works as Back for the Post a photo popup
  useEffect(() => {
    if (!postOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPostOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [postOpen]);

  // Menu links on the feed itself open these without a page reload
  useEffect(() => {
    const onAction = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      if (action === "post") {
        if (user) setPostOpen(true);
        else router.push("/login");
      }
      if (action === "tour") setTutorial(true);
    };
    window.addEventListener("feed-action", onAction);
    return () => window.removeEventListener("feed-action", onAction);
  }, [user, router]);

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

  // ---------- new memes notification ----------
  const [freshCount, setFreshCount] = useState(0);
  const knownIds = useRef<Set<number>>(new Set());
  useEffect(() => {
    rows.forEach((r) => knownIds.current.add(r.id));
  }, [rows]);

  // Every 30 seconds, look for captions posted since the feed loaded
  useEffect(() => {
    const check = async () => {
      if (document.hidden || knownIds.current.size === 0) return;
      const { data } = await createClient()
        .from("captions")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(30);
      const fresh = (data ?? []).filter((r: { id: number }) => !knownIds.current.has(r.id));
      if (fresh.length) setFreshCount(fresh.length);
    };
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  // Coming back after a while: say how many were posted since the last visit
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current || loading || seenAtLoad.size === 0) return;
    greeted.current = true;
    const unseen = buildSlots(rows).filter((s) => showInFeed(s) && s.ids.some((id) => !seenAtLoad.has(id))).length;
    if (unseen > 0) setFreshCount(unseen);
  }, [loading, rows, seenAtLoad]);

  const showFresh = async () => {
    setFreshCount(0);
    const data = await fetchFeed();
    if (data) {
      const added = data.filter((r) => !knownIds.current.has(r.id)).map((r) => r.id);
      setRows(data);
      if (added.length) setArrivedIds((prev) => new Set([...prev, ...added]));
    }
    setShowSeen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onCreated = async (ids: number[]) => {
    ids.forEach((id) => knownIds.current.add(id));
    const data = await fetchFeed();
    if (!data) return;
    setRows(data);
    setArrivedIds((prev) => new Set([...prev, ...ids]));
    ids.forEach((id) => pendingSeen.current.add(id));
    setPostOpen(false);
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
    const delta = previous === 0 && next !== 0 ? 1 : previous !== 0 && next === 0 ? -1 : 0;
    if (delta) setMine((m) => (m ? { ...m, points: m.points + delta, votes: m.votes + delta } : m));

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
      loadPoints(user);
    }
  };

  // ---------- what to show ----------
  const unsorted = useMemo(() => buildSlots(rows).filter(showInFeed), [rows]);

  // Notes are ordered by likes, but the order is a snapshot: it is taken when the
  // feed loads and again when you close a note, never while you are voting.
  const [likeOrder, setLikeOrder] = useState<Map<string, number> | null>(null);
  const scoreOf = useCallback(
    (slot: Slot) => slot.ids.reduce((sum, id) => sum + Number(rowById.get(id)?.score ?? 0), 0),
    [rowById]
  );
  const resort = useCallback(
    () => setLikeOrder(new Map(unsorted.map((slot) => [slot.url, scoreOf(slot)]))),
    [unsorted, scoreOf]
  );
  useEffect(() => {
    if (likeOrder === null && !loading && unsorted.length) resort();
  }, [likeOrder, loading, unsorted.length, resort]);
  const slots = useMemo(() => {
    const rank = (slot: Slot) => likeOrder?.get(slot.url) ?? Number.MAX_SAFE_INTEGER; // brand-new notes go first
    return [...unsorted].sort(
      (a, b) =>
        weekStart(b.newest).getTime() - weekStart(a.newest).getTime() ||
        rank(b) - rank(a) ||
        b.newest.localeCompare(a.newest)
    );
  }, [unsorted, likeOrder]);

  const isNew = (slot: Slot) => slot.ids.some((id) => !seenAtLoad.has(id) || arrivedIds.has(id));
  const newSlots = slots.filter(isNew);
  const seenSlots = slots.filter((s) => !isNew(s));
  const visible = showSeen ? slots : newSlots;

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

  const openNote = (index: number) => {
    playSound("tap");
    setOpenIndex(index);
    visible[index]?.ids.forEach((id) => pendingSeen.current.add(id));
  };

  return (
    <>
      {tutorial && <Tutorial onClose={closeTutorial} />}
      {boardOpen && (
        <SidePanel onClose={() => setBoardOpen(false)} title="Leaderboard">
          <StarPanel star={star} loggedIn={!!user} daysLeft={now === null ? 7 : daysUntilMonday(now)} />
          <Rankboard peers={peers} />
          <Link href="/top" className="flex items-center justify-between rounded-md border border-ink/20 px-3 py-2 text-sm hover:bg-white">
            Top captions <span aria-hidden>→</span>
          </Link>
        </SidePanel>
      )}
      {freshCount > 0 && (
        <NewMemesNotice
          count={freshCount}
          onShow={showFresh}
          onDismiss={() => setFreshCount(0)}
        />
      )}

      <header className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <Menu open={menuOpen} onOpenChange={setMenuOpen}>
            <Fold title={<><Crown className="h-3.5 w-3.5" /> Your crowns{user ? `: ${mine?.points ?? 0}` : ""}</>}>
              <CrownsPanel mine={mine} loggedIn={!!user} />
            </Fold>
            <Fold title="About">
              <div className="grid gap-2 text-xs leading-relaxed text-ink/80">
                <p>At 116 &amp; Broadway is a Columbia meme board. People post photos and AI writes the captions.</p>
                <p><b className="font-medium">Vote:</b> tap a note, then 👍 if it&apos;s funny or 👎 if not.</p>
                <p><b className="font-medium">Crowns:</b> every vote earns 1. The top voter each week is Star of the week.</p>
                <p><b className="font-medium">Post:</b> upload any photo and AI writes the caption. Your name isn&apos;t shown.</p>
              </div>
            </Fold>
          </Menu>
          <Link href="/memes" className="hand text-base tracking-[0.15em]">
            At 116 &amp; Broadway
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Leaderboard" onClick={() => setBoardOpen(true)}>
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
          </IconButton>
          <IconButton label={soundOn ? "Turn sound effects off" : "Turn sound effects on"} pressed={soundOn} onClick={toggleSound}>
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            {soundOn ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <path d="M17 9l5 6M22 9l-5 6" />}
          </IconButton>
          {user && <UpdatesBell />}
          {user ? (
            <button
              onClick={() => setMenuOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm hover:bg-white"
              title="Your crowns"
              aria-label={`Your crowns: ${mine?.points ?? 0}`}
            >
              <Crown />
              <span key={mine?.points} className="pop inline-block">{mine?.points ?? 0}</span>
            </button>
          ) : null}
          {user ? (
            <Link href="/profile" aria-label="Profile" title="Profile" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="#141414" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </Link>
          ) : (
            <Link href="/login" className="rounded-full px-3 py-1.5 text-sm underline hover:bg-white">
              Log in
            </Link>
          )}
          <button
            onClick={() => (user ? setPostOpen(true) : router.push("/login"))}
            className="ml-1 rounded-full bg-ink px-4 py-1.5 text-sm text-white hover:bg-teal"
          >
            Post a photo
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1680px] px-4 pb-16 pt-4 sm:px-6 lg:px-10">
        <section aria-label="Caption feed" className="min-w-0">
          <div className="mb-4" />

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

          <div className={visible.length > 0 ? "min-h-[calc(100dvh-170px)]" : ""}>
          {weeks.map((w, wi) => (
            <div key={w.key} className={wi > 0 ? "mt-10" : ""}>
              <div className="mb-5 flex items-center gap-3 text-xs text-ink/60">
                <span className="shrink-0">{w.label}</span>
                <span className="h-px flex-1 bg-ink/30" />
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {w.items.map(({ slot, index }) => (
                  <NoteCard
                    key={slot.url}
                    tossed={tossed}
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

          </div>

          {!loading && (
            <CaughtUp
              immediate={visible.length === 0}
              hasNew={newSlots.length > 0}
              showSeen={showSeen}
              seenCount={seenSlots.length}
              countdown={countdown}
              mondayIn={now === null ? 7 : daysUntilMonday(now)}
              lastPost={
                now === null || slots.length === 0 ? "" : timeAgo(now - new Date(slots[0].newest).getTime())
              }
              loggedIn={!!user}
              onToggleSeen={() => {
                playSound("tap");
                setShowSeen(!showSeen);
              }}
            />
          )}
        </section>
      </main>

      <Mascot onThrow={() => setTossed(true)} onHelp={() => setTutorial(true)} />

      {user && (
        <div
          className={`lightbox fixed inset-0 z-50 items-center justify-center bg-[#b9d9eb]/90 p-4 backdrop-blur-sm ${postOpen ? "flex" : "hidden"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Post a photo"
          aria-hidden={!postOpen}
          onClick={() => setPostOpen(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setPostOpen(false); }}
            className="absolute left-5 top-5 text-sm underline sm:left-8 sm:top-6"
          >
            ← Back
          </button>
          <div className="note-open w-[min(340px,100%)]" onClick={(e) => e.stopPropagation()}>
            <CreateCaptions
              userId={user.id}
              onCreated={onCreated}
              onBack={() => setPostOpen(false)}
              onStatus={onJob}
              active={postOpen}
            />
          </div>
        </div>
      )}

      {/* Still writing in the background: a small pill to check on it */}
      {user && !postOpen && (job.phase === "working" || job.phase === "error") && (
        <button
          onClick={() => setPostOpen(true)}
          className={`pop fixed bottom-5 left-16 z-40 flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm shadow-sm ${
            job.phase === "error" ? "border-brick text-brick" : "border-ink/30"
          }`}
        >
          {job.phase === "working" ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-teal" />
              Writing your caption… {job.pct}%
            </>
          ) : (
            "Caption didn't go through. Tap to retry"
          )}
        </button>
      )}

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
          onClose={() => {
            setOpenIndex(null);
            resort(); // done voting: now re-order by likes
          }}
        />
      )}
    </>
  );
}

function NoteCard({
  tossed,
  slot,
  index,
  rowById,
  isArrived,
  onOpen,
  trackSeen,
}: {
  tossed: boolean;
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
      className={`note group flex flex-col p-3 text-left transition-transform hover:-translate-y-1 hover:rotate-0 ${isArrived ? "arrive" : ""} ${
        tossed ? "drop-in" : "opacity-0"
      }`}
      style={{
        background: NOTE_COLORS[index % NOTE_COLORS.length],
        transform: `rotate(${tilt}deg)`,
        animationDelay: `${Math.min(index, 20) * 45}ms`,
      }}
      aria-label={`Open note: ${best.caption}`}
    >
      <img src={slot.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
      <p className="mt-2 text-sm leading-snug">{best.caption}</p>
      <p className="mt-auto pt-2 text-xs text-ink/60">
        {total > 0 ? `+${total}` : total} · {new Date(slot.newest).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        {captions.length > 1 && ` · ${captions.length} captions`}
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
  const arrow = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/50 bg-white/60 text-xl hover:bg-white disabled:opacity-20";

  return (
    <div
      className="lightbox fixed inset-0 z-50 flex items-center justify-center gap-3 bg-[#b9d9eb]/90 px-4 py-8 backdrop-blur-sm sm:gap-6"
      role="dialog"
      aria-modal="true"
      aria-label="Caption note"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute left-5 top-5 text-sm underline sm:left-8 sm:top-6"
      >
        ← Back
      </button>
      <button className={arrow} disabled={prev === null} onClick={(e) => { e.stopPropagation(); if (prev !== null) onMove(prev); }} aria-label="Previous note">
        ←
      </button>

      <div
        key={slot.url}
        className={`note note-open min-w-[200px] p-4 ${captions.length > 1 ? "w-[min(280px,calc(100vw-8rem),calc(100dvh-24rem))]" : "w-[min(300px,calc(100vw-8rem),calc(100dvh-15rem))]"}`}
        style={{ background: NOTE_COLORS[index % NOTE_COLORS.length] }}
        onClick={(e) => e.stopPropagation()}
      >
        <img src={slot.url} alt="" className="aspect-square w-full object-cover" />
        <ul className="mt-3 grid gap-2">
          {captions.map((c) => (
            <li key={c.id} className="grid gap-1">
              <p className="text-sm leading-snug">{c.caption}</p>
              <VoteControl row={c} onVote={onVote} />
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-2 text-xs text-ink/50">
          <span>
            {index + 1} / {slots.length}
          </span>
          <span>Esc to close</span>
        </div>
      </div>

      <button className={arrow} disabled={next === null} onClick={(e) => { e.stopPropagation(); if (next !== null) onMove(next); }} aria-label="Next note">
        →
      </button>
    </div>
  );
}

function Thumb({ down = false, filled = false }: { down?: boolean; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={down ? { transform: "scaleY(-1)" } : undefined}
      aria-hidden="true"
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
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
  const [burst, setBurst] = useState<{ id: number; text: string } | null>(null);
  const cast = (value: 1 | -1) => {
    const prev = row.my_vote ?? 0;
    const text = prev === 0 ? "+1" : prev === value ? "-1" : "";
    if (text) setBurst({ id: Date.now(), text });
    onVote(row, value);
  };
  const btn = "flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-90";
  return (
    <div className="relative flex shrink-0 items-center gap-1">
      {burst && (
        <span key={burst.id} className="crown-burst pointer-events-none absolute -top-5 left-6 flex items-center gap-0.5 text-xs text-teal">
          <Crown className="h-3.5 w-3.5" />
          {burst.text}
        </span>
      )}
      <button
        onClick={() => cast(1)}
        aria-label="Funny"
        title="Funny"
        aria-pressed={row.my_vote === 1}
        className={`${btn} ${row.my_vote === 1 ? "thumb-pop text-teal" : "text-ink/50 hover:text-teal"}`}
      >
        <Thumb filled={row.my_vote === 1} />
      </button>
      <span
        key={score}
        className={`pop w-6 text-center text-sm ${score > 0 ? "text-teal" : score < 0 ? "text-brick" : "text-ink/60"}`}
      >
        {score}
      </span>
      <button
        onClick={() => cast(-1)}
        aria-label="Not funny"
        title="Not funny"
        aria-pressed={row.my_vote === -1}
        className={`${btn} ${row.my_vote === -1 ? "thumb-pop text-brick" : "text-ink/50 hover:text-brick"}`}
      >
        <Thumb down filled={row.my_vote === -1} />
      </button>
    </div>
  );
}

// New app updates since your last visit: a bell in the bottom right you open once
function UpdatesBell() {
  const KEY = "ctc-updates-seen";
  const [fresh, setFresh] = useState<typeof UPDATES>([]);
  const [open, setOpen] = useState(false);
  const top = `${UPDATES[0]?.date}|${UPDATES[0]?.text}`;
  useEffect(() => {
    try {
      const seen = localStorage.getItem(KEY);
      if (seen === null) {
        localStorage.setItem(KEY, top); // first visit: nothing is "new" yet
        return;
      }
      const i = UPDATES.findIndex((u) => `${u.date}|${u.text}` === seen);
      setFresh(i === -1 ? UPDATES.slice(0, 3) : UPDATES.slice(0, i));
    } catch {}
  }, [top]);
  const close = () => {
    try {
      localStorage.setItem(KEY, top);
    } catch {}
    setFresh([]);
    setOpen(false);
  };
  return <BellView fresh={fresh} open={open} setOpen={setOpen} close={close} />;
}

function BellView({
  fresh,
  open,
  setOpen,
  close,
}: {
  fresh: typeof UPDATES;
  open: boolean;
  setOpen: (v: boolean) => void;
  close: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  if (fresh.length === 0) return null;
  return (
    <div className="relative">
      {open && (
        <div role="dialog" aria-label="What's new" className="panel-in absolute right-0 top-11 z-40 w-64 rounded-lg border border-ink/15 bg-white p-4 shadow-md">
          <p className="text-sm font-medium">New since your last visit</p>
          <ul className="mt-2 grid gap-1.5 text-xs leading-snug">
            {fresh.map((u, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-11 shrink-0 text-ink/50">{u.date}</span>
                <span>{u.text}</span>
              </li>
            ))}
          </ul>
          <button onClick={close} className="mt-3 rounded-full bg-ink px-3 py-1 text-xs text-white hover:bg-teal">
            Got it
          </button>
        </div>
      )}
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={`${fresh.length} new ${fresh.length === 1 ? "update" : "updates"}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="#141414" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brick px-1 text-[10px] text-white">
          {fresh.length}
        </span>
      </button>
    </div>
  );
}

// Small round icon button for the header
function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="#141414" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

// "i" that shows an explanation on hover or keyboard focus
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="What is this?"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-ink/50 font-serif text-[10px] italic leading-none text-ink/70 hover:bg-ink hover:text-white"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-md border border-ink/15 bg-white px-3 py-2 text-xs normal-case leading-snug tracking-normal text-ink opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

// Menu section that opens from its title with a pull-down arrow
function Fold({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group border-t border-ink/10 pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">{title}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

// Panel that slides in from the right, with Back in the top-left
function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="lightbox absolute inset-0 bg-[#141414]/20" onClick={onClose} />
      <aside className="panel-in absolute inset-y-0 right-0 flex w-[min(340px,88vw)] flex-col gap-7 overflow-y-auto bg-[#eef6fb] px-7 py-6">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-sm underline">
            ← Back
          </button>
          <span className="hand ml-auto text-sm tracking-[0.15em]">{title}</span>
        </div>
        {children}
      </aside>
    </div>
  );
}

// Notification in the top right when new memes are posted
function NewMemesNotice({ count, onShow, onDismiss }: { count: number; onShow: () => void; onDismiss: () => void }) {
  return (
    <div role="status" className="panel-in fixed right-5 top-20 z-40 flex w-[min(300px,calc(100vw-40px))] items-start gap-3 rounded-lg border border-ink/15 bg-white p-4 shadow-md">
      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-teal" />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {count} new {count === 1 ? "meme" : "memes"}
        </p>
        <p className="text-xs text-ink/60">Fresh captions just got posted.</p>
        <button onClick={onShow} className="mt-2 rounded-full bg-ink px-3 py-1 text-xs text-white hover:bg-teal">
          Show me
        </button>
      </div>
      <button onClick={onDismiss} aria-label="Dismiss" className="text-ink/40 hover:text-ink">
        ×
      </button>
    </div>
  );
}

function CrownsPanel({ mine, loggedIn }: { mine: MyPoints | null; loggedIn: boolean }) {
  const days = mine?.days_this_month ?? 0;
  const pct = Math.min(100, (days / BONUS_DAYS) * 100);
  return (
    <section>
      {loggedIn ? (
        <>
          <p className="text-2xl">{mine?.points ?? 0}</p>
          <p className="mt-1 text-xs text-ink/70">1 per vote. Vote on {BONUS_DAYS} days this month for +10.</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-ink/60">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white">
              <div className="h-full bg-teal transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            {days >= BONUS_DAYS ? "done" : `${days}/${BONUS_DAYS}`}
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm">
          <Link href="/login" className="underline">Log in</Link> and every vote earns one.
        </p>
      )}
    </section>
  );
}

function StarPanel({ star, loggedIn, daysLeft }: { star: Star | null; loggedIn: boolean; daysLeft: number }) {
  const leader = star?.leader_name;
  const mineVotes = Number(star?.my_votes ?? 0);
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-xs text-ink/60">
        ★ Star of the week
        <InfoTip text="Whoever votes the most from Monday to Sunday wins. They get a gold star by their name for a week and 5 bonus crowns." />
      </h2>
      {star?.star_names ? (
        <p className="mt-1 text-sm">
          <span className="text-base">{star.star_names}</span>
          <span className="text-ink/60"> · {Number(star.star_votes)} votes last week</span>
        </p>
      ) : (
        <p className="mt-1 text-sm">No one yet.</p>
      )}
      <p className="mt-2 text-xs text-ink/70">
        {leader ? `This week: ${leader}, ${Number(star?.leader_votes)} votes.` : "No votes yet this week."}
        {loggedIn ? ` You have ${mineVotes}.` : ""} {daysLeft} {daysLeft === 1 ? "day" : "days"} left.
      </p>
    </section>
  );
}

function Rankboard({ peers }: { peers: Peer[] }) {
  return (
    <section>
      <h2 className="text-xs text-ink/60">Rankboard</h2>
      {peers.length === 0 ? (
        <p className="mt-1 text-sm">No one yet.</p>
      ) : (
        <ol className="mt-2 grid gap-1">
          {peers.slice(0, 10).map((p, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 rounded px-1.5 py-0.5 text-sm ${p.is_me ? "bg-white" : ""}`}
            >
              <span className="w-5 shrink-0 text-ink/60">{Number(p.rank)}</span>
              <span className="flex-1 truncate">
                {p.name}
                {p.is_star ? <span className="ml-1 text-[#c9a227]" title="Star of the week">★</span> : null}
                {p.is_me ? <span className="text-ink/50"> (you)</span> : null}
              </span>
              <span className="flex items-center gap-1">
                <Crown className="h-3.5 w-3.5" />
                {Number(p.points)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CaughtUp({
  immediate,
  hasNew,
  showSeen,
  seenCount,
  mondayIn,
  lastPost,
  loggedIn,
  onToggleSeen,
}: {
  immediate: boolean;
  hasNew: boolean;
  showSeen: boolean;
  seenCount: number;
  countdown: string;
  mondayIn: number;
  lastPost: string;
  loggedIn: boolean;
  onToggleSeen: () => void;
}) {
  // Only appears once you scroll down to it
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(immediate);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (immediate) return setSeen(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [immediate]);

  return (
    <div ref={ref} className={`mt-12 flex justify-center transition-all duration-700 ${seen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
      <div className="note w-[min(420px,100%)] rotate-1 p-6 text-center" style={{ background: NOTE_COLORS[2] }}>
        <p className="hand text-xl tracking-[0.1em]">
          {showSeen ? "That's every note" : hasNew ? "You're all caught up" : "Nothing new since your last visit"}
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          {lastPost && <>Last new note: {lastPost}. </>}
          New ones show up whenever someone posts a photo. Star of the week is picked in {mondayIn}{" "}
          {mondayIn === 1 ? "day" : "days"}.
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

// Three short jokes to read while the caption is written. Hover or tap for the punchline.
const WAIT_JOKES = [
  ["I asked AI to make me funnier.", "It said it's a language model, not a miracle worker."],
  ["My screen time report says 9 hours a day.", "Finally, a full-time job I actually show up to."],
  ["Procrastinators of the world, unite!", "…tomorrow."],
];

function WaitJokes() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative mt-3 flex justify-center"
      onMouseMove={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className="rounded-full border border-ink/30 bg-white/70 px-3 py-1 text-xs hover:bg-white"
      >
        While you wait: 3 jokes
      </button>
      {open && (
        <ul
          role="tooltip"
          className="pop absolute top-full z-10 mt-2 grid w-[min(300px,80vw)] divide-y divide-ink/10 rounded-md border border-ink/20 bg-white p-3 text-left text-xs leading-snug shadow-md"
        >
          {WAIT_JOKES.map(([setup, punch], i) => (
            <li key={i} className="py-1.5 first:pt-0 last:pb-0">
              {setup} <span className="text-teal">{punch}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateCaptions({
  userId,
  onCreated,
  onBack,
  onStatus,
  active,
}: {
  userId: string;
  onCreated: (ids: number[]) => void;
  onBack: () => void;
  onStatus: (phase: string, pct: number) => void;
  active: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [angle, setAngle] = useState("");
  const [count, setCount] = useState(1);
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

  // Drag a photo onto the box, or paste one with Ctrl+V / Cmd+V
  const [dragging, setDragging] = useState(false);
  const takeImage = (files: FileList | null | undefined) => {
    const img = Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
    if (img) {
      pickFile(img);
      playSound("tap");
    } else if (files && files.length) {
      setMessage("That isn't a photo. Try a JPG, PNG or WebP.");
    }
  };
  useEffect(() => {
    if (!active || phase === "working") return;
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length) {
        e.preventDefault();
        takeImage(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, phase]);

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
        body: JSON.stringify({ path, angle, count }),
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
      fail(
        json.error
          ? `${json.error} Still stuck? Email ${CONTACT}.`
          : "The caption AI took too long. Try again in a minute."
      );
      return;
    }

    stopTimer();
    setProgress(100);
    setStage("Done");
    playSound("done");
    toast("success", "Approved!", "Your caption is up.");
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
    setMessage("Stopped. If the AI already finished, it may still post.");
    playSound("unvote");
  };

  const working = phase === "working";
  const pct = Math.round(progress);
  useEffect(() => {
    onStatus(phase, pct);
  }, [phase, pct, onStatus]);

  return (
    <form ref={formRef} onSubmit={generate} className="note p-4" style={{ background: "#f8f1c8" }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm">Caption a photo</h2>

      </div>

      <label
        className={`flex items-center gap-3 rounded-md border border-dashed p-2 text-sm transition-colors ${
          dragging ? "border-teal bg-white" : "border-transparent"
        } ${working ? "opacity-50" : "cursor-pointer hover:border-ink/30"}`}
        onDragOver={(e) => {
          if (working) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!working) takeImage(e.dataTransfer.files);
        }}
      >
        {preview ? (
          <img src={preview} alt="" className={`${working ? "h-10 w-10" : "h-16 w-16"} rounded object-cover`} />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-ink/40 text-lg">+</span>
        )}
        <span className="min-w-0 break-words">
          {file ? (
            file.name
          ) : dragging ? (
            "Drop it here"
          ) : (
            <>
              Choose, drag in, or paste a photo
              <span className="block text-xs text-ink/50">Up to 5 MB. Ctrl+V or ⌘V to paste.</span>
            </>
          )}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          disabled={working}
          className="sr-only"
        />
      </label>

      {!working && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-ink/70">How many captions?</span>
          <div role="radiogroup" aria-label="How many captions" className="flex overflow-hidden rounded-full border border-ink/30">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={count === n}
                onClick={() => setCount(n)}
                className={`w-9 py-1 text-sm ${count === n ? "bg-ink text-white" : "hover:bg-white"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      {!working && (
        <input
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          placeholder="Optional hint, like “midterm week”"
          maxLength={200}
          className="mt-3 w-full rounded-md border border-ink/20 bg-white/70 px-3 py-2 text-sm focus:border-teal"
        />
      )}

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
          <p className="mt-2 text-center text-xs text-ink/60">Takes about 10 seconds. You can leave this open or go back.</p>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-md bg-ink px-4 py-2 text-sm text-white hover:bg-teal"
            >
              Back to the feed
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-ink/40 px-3 py-2 text-sm hover:border-ink"
            >
              Stop
            </button>
          </div>
          <WaitJokes />
        </div>
      ) : (
        <button
          disabled={!file}
          className="mt-3 w-full rounded-md bg-ink px-4 py-2.5 text-sm text-white hover:bg-teal disabled:opacity-30"
        >
          {phase === "error" ? "Try again" : count === 1 ? "Generate caption" : `Generate ${count} captions`}
        </button>
      )}

      {!working && !message && (
        <p className="mt-2 text-sm text-ink/70">
          {count === 1 ? "One caption" : `${count} captions`}, posted without your name.
        </p>
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
