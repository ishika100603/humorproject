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
  const [sort, setSort] = useState<"top" | "new">("top");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    list.sort((a, b) =>
      sort === "top"
        ? b.best - a.best || b.newest.localeCompare(a.newest)
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
    <main className="mx-auto w-full max-w-2xl p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Caption the City</h1>
          <p className="mt-1 text-gray-500">
            AI captions for life at Columbia and in NYC. Vote for the funniest.
          </p>
        </div>
        <a
          href={user ? "/profile" : "/login"}
          className="shrink-0 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 hover:text-black"
        >
          {user ? "My profile" : "Log in"}
        </a>
      </header>

      {user ? (
        <CreateCaptions userId={user.id} onCreated={load} />
      ) : (
        <div className="mb-8 rounded-xl border border-dashed p-5 text-center">
          <a href="/login" className="font-medium underline">
            Log in
          </a>{" "}
          to upload a photo, get AI captions, and vote.
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {(["top", "new"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              sort === s ? "bg-black text-white" : "border hover:bg-gray-50 hover:text-black"
            }`}
          >
            {s === "top" ? "Top" : "New"}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <p>Loading captions…</p>}

      <div className="grid gap-6">
        {groups.map((g) => (
          <article key={g.image_url} className="overflow-hidden rounded-xl border">
            <img src={g.image_url} alt="" className="max-h-[480px] w-full object-cover" />
            <ul className="divide-y">
              {g.captions.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-4">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => vote(c, 1)}
                      aria-label="Upvote"
                      className={`text-xl leading-none ${
                        c.my_vote === 1 ? "text-orange-500" : "text-gray-400 hover:text-orange-500"
                      }`}
                    >
                      ▲
                    </button>
                    <span className="text-sm font-semibold">{Number(c.score)}</span>
                    <button
                      onClick={() => vote(c, -1)}
                      aria-label="Downvote"
                      className={`text-xl leading-none ${
                        c.my_vote === -1 ? "text-blue-500" : "text-gray-400 hover:text-blue-500"
                      }`}
                    >
                      ▼
                    </button>
                  </div>
                  <p className="text-lg">{c.caption}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}

function CreateCaptions({
  userId,
  onCreated,
}: {
  userId: string;
  onCreated: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus("Please pick a photo under 5 MB.");
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
    if (!res.ok) {
      setStatus(json.error ?? "Something went wrong.");
    } else {
      setStatus("Done! Your captions are in the feed.");
      setFile(null);
      setAngle("");
      (e.target as HTMLFormElement).reset();
      onCreated();
    }
    setBusy(false);
  };

  return (
    <form onSubmit={generate} className="mb-8 grid gap-3 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Caption a photo</h2>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      <input
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="Optional: a vibe, e.g. 'finals week' or 'first time on the subway'"
        maxLength={200}
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <button
        disabled={!file || busy}
        className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-40"
      >
        {busy ? "Working…" : "Generate captions"}
      </button>
      {status && <p className="text-sm">{status}</p>}
    </form>
  );
}
