"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

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

type Group = {
  image_url: string;
  newest: string;
  best: number;
  captions: FeedRow[];
};

export default function CaptionApp() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [sort, setSort] = useState<"hot" | "new" | "top">("hot");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [arrivedIds, setArrivedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("caption_feed");
    if (error) setError(error.message);
    else setRows((data ?? []) as FeedRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    load();
  }, [load]);

  const onCreated = async (ids: number[]) => {
    setArrivedIds(new Set(ids));
    setSort("new");
    await load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // One card per photo, with its captions ranked by score
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const row of rows) {
      const g = map.get(row.image_url) ?? {
        image_url: row.image_url,
        newest: row.created_at,
        best: -Infinity,
        captions: [],
      };
      g.captions.push(row);
      g.best = Math.max(g.best, Number(row.score));
      if (row.created_at > g.newest) g.newest = row.created_at;
      map.set(row.image_url, g);
    }
    const list = [...map.values()];
    list.forEach((g) =>
      g.captions.sort((a, b) => Number(b.score) - Number(a.score) || b.id - a.id)
    );
    // Hot = best score, discounted by age (like Sidechat's Hot tab)
    const hot = (g: Group) => {
      const hours = (Date.now() - new Date(g.newest).getTime()) / 36e5;
      return (g.best + 1) / Math.pow(hours + 2, 1.5);
    };
    list.sort((a, b) =>
      sort === "top"
        ? b.best - a.best || b.newest.localeCompare(a.newest)
        : sort === "hot"
          ? hot(b) - hot(a)
          : b.newest.localeCompare(a.newest)
    );
    return list;
  }, [rows, sort]);

  const vote = async (row: FeedRow, value: 1 | -1) => {
    if (!user) {
      router.push("/login");
      return;
    }
    const supabase = createClient();
    const removing = row.my_vote === value;
    const previous = row.my_vote ?? 0;
    const next = removing ? 0 : value;

    // Update the screen right away, then save to the database
    setRows((rs) =>
      rs.map((r) =>
        r.id !== row.id
          ? r
          : {
              ...r,
              my_vote: next || null,
              score: Number(r.score) - previous + next,
              upvotes: Number(r.upvotes) - (previous === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
              downvotes:
                Number(r.downvotes) - (previous === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
            }
      )
    );

    const { error } = removing
      ? await supabase
          .from("votes")
          .delete()
          .eq("caption_id", row.id)
          .eq("user_id", user.id)
      : await supabase
          .from("votes")
          .upsert(
            { caption_id: row.id, user_id: user.id, value },
            { onConflict: "caption_id,user_id" }
          );

    if (error) {
      setError(error.message);
      load();
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <nav className="mb-4 flex justify-end">
        <a
          href={user ? "/profile" : "/login"}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-teal"
        >
          {user ? "My profile" : "Log in"}
        </a>
      </nav>

      <header className="mosaic mb-8">
        <div className="mosaic-field px-6 py-7 text-center">
          <h1 className="condensed text-5xl font-extrabold uppercase leading-none tracking-tight sm:text-7xl">
            Caption the City
          </h1>
          <p className="mt-3 text-base sm:text-lg">
            Upload a campus photo, get AI captions, and upvote the funniest.
          </p>
          <p className="mt-1 text-sm text-ink/70">Made for Columbia. Posts are anonymous.</p>
        </div>
      </header>

      {user ? (
        <CreateCaptions userId={user.id} onCreated={onCreated} />
      ) : (
        <div className="mb-8 rounded-md border-2 border-dashed border-ink/40 bg-tile-face p-5 text-center">
          <a href="/login" className="font-semibold text-teal underline">
            Log in
          </a>{" "}
          with Google to upload photos and vote.
        </div>
      )}

      <div className="mb-5 inline-flex rounded-md bg-ink p-1" role="tablist">
        {(["hot", "new", "top"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={sort === s}
            onClick={() => setSort(s)}
            className={`condensed rounded px-5 py-1.5 text-base font-bold uppercase transition-colors ${
              sort === s ? "bg-mustard text-ink" : "text-white hover:text-mustard"
            }`}
          >
            {s === "hot" ? "Hot" : s === "new" ? "New" : "Top"}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 font-semibold text-brick">{error}</p>}
      {loading && <p>Loading captions…</p>}
      {!loading && groups.length === 0 && (
        <p className="rounded-md bg-tile-face p-5">
          No captions yet. Upload a campus photo to start the feed.
        </p>
      )}

      <div className="grid gap-8">
        {groups.map((g) => {
          const isNew = g.captions.some((c) => arrivedIds.has(c.id));
          return (
            <article
              key={g.image_url}
              className={`overflow-hidden rounded-md border-2 border-ink bg-tile-face shadow-[6px_6px_0_var(--ink)] ${
                isNew ? "arrive" : ""
              }`}
            >
              <img
                src={g.image_url}
                alt=""
                className="max-h-[480px] w-full border-b-2 border-ink object-cover"
              />
              <ul>
                {g.captions.map((c, i) => (
                  <li
                    key={c.id}
                    className={`flex items-center gap-4 px-4 py-4 ${
                      i > 0 ? "border-t border-grout" : ""
                    }`}
                  >
                    <VoteControl row={c} onVote={vote} />
                    <p
                      className={
                        i === 0 && Number(c.score) > 0
                          ? "text-xl font-semibold"
                          : "text-lg"
                      }
                    >
                      {c.caption}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <footer className="mt-12 text-center text-sm">
        <a href="/privacy" className="underline">
          Privacy policy
        </a>
      </footer>
    </main>
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
        title="Upvote"
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
        title="Downvote"
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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const pickFile = (f: File | null) => {
    setFile(f);
    setStatus("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus("That photo is over 5 MB. Pick a smaller one.");
      return;
    }
    setBusy(true);
    setStatus("Uploading photo…");

    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setStatus(uploadError.message);
      setBusy(false);
      return;
    }

    setStatus("Writing captions…");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, angle }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(json.error ?? "Caption request failed. Try again.");
      return;
    }
    setStatus("");
    pickFile(null);
    setAngle("");
    (e.target as HTMLFormElement).reset();
    onCreated((json.captions ?? []).map((c: { id: number }) => c.id));
  };

  return (
    <form
      onSubmit={generate}
      className="mb-10 rounded-md border-2 border-ink bg-tile-face p-5"
    >
      <h2 className="condensed mb-3 text-2xl font-extrabold uppercase">
        Caption a photo
      </h2>

      <label className="flex cursor-pointer items-center gap-4 rounded-md border-2 border-dashed border-ink/40 p-3 hover:border-teal">
        {preview ? (
          <img src={preview} alt="" className="h-20 w-20 rounded object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded bg-grout text-3xl">
            +
          </span>
        )}
        <span>
          {file ? file.name : "Choose a campus photo (JPG, PNG or WebP, up to 5 MB)"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>

      <input
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="Optional vibe, like “midterm week” or “housing lottery”"
        maxLength={200}
        className="mt-3 w-full rounded-md border-2 border-ink/30 bg-white px-3 py-2 focus:border-teal"
      />

      <button
        disabled={!file || busy}
        className="mt-3 w-full rounded-md bg-teal px-4 py-3 text-lg font-bold text-white hover:bg-ink disabled:opacity-40"
      >
        {busy ? "Writing captions…" : "Generate captions"}
      </button>

      <p className="mt-2 text-sm text-ink/70">
        You get 3 captions. They post to the feed without your name.
      </p>

      {busy && (
        <div className="track mt-4" aria-hidden="true">
          <div className="train" />
        </div>
      )}
      {status && (
        <p className="mt-3 text-sm" role="status">
          {status}
        </p>
      )}
    </form>
  );
}
