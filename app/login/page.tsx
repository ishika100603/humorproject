"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ANNOUNCEMENTS } from "@/lib/jokes";

const CONTACT = "ia2630@columbia.edu";

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 6000);
    return () => clearInterval(t);
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setBusy(false);
      setError(`Google sign-in didn't start (${error.message}). Try again, or email ${CONTACT}.`);
    }
  };

  return (
    <main className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Left: the station sign and a rotating joke */}
      <section className="flex flex-col justify-center gap-8 px-6 py-12 lg:px-16">
        <div className="mosaic">
          <div className="mosaic-field px-6 py-10 text-center">
            <h1 className="condensed text-6xl font-extrabold uppercase leading-none tracking-tight xl:text-8xl">
              Caption the City
            </h1>
            <p className="mt-4 text-lg">Columbia's campus, captioned by AI and ranked by you.</p>
          </div>
        </div>
        <div className="rounded-md border-2 border-ink bg-ink px-5 py-4 text-white">
          <p className="condensed text-sm font-bold uppercase text-mustard">Service announcement</p>
          <p key={i} className="fade-in mt-1 text-lg leading-snug">
            {ANNOUNCEMENTS[i % ANNOUNCEMENTS.length]}
          </p>
        </div>
      </section>

      {/* Right: sign in */}
      <section className="flex items-center justify-center bg-tile-face/80 px-6 py-12 lg:border-l-2 lg:border-ink">
        <div className="w-full max-w-sm">
          <h2 className="condensed text-4xl font-extrabold uppercase">Log in</h2>
          <p className="mt-2 text-lg">to post photos, vote on captions and make the leaderboard.</p>

          <button
            onClick={signIn}
            disabled={busy}
            className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-4 text-base font-medium text-[#1f1f1f] shadow-sm transition hover:bg-[#f8f9fa] hover:shadow disabled:opacity-60"
          >
            <GoogleG />
            {busy ? "Opening Google…" : "Sign in with Google"}
          </button>

          <ul className="mt-6 grid gap-2 text-sm text-ink/80">
            <li>Any Google account works, including Columbia, Barnard and Gmail.</li>
            <li>We only get your name and email. Your posts never show your name.</li>
          </ul>

          {error && (
            <p className="mt-4 rounded-md border-2 border-brick bg-white p-3 text-sm text-brick" role="alert">
              {error}
            </p>
          )}

          <p className="mt-10 text-sm">
            <a href="/" className="underline">
              Browse captions without logging in
            </a>
            <span className="mx-2" aria-hidden="true">|</span>
            <a href="/privacy" className="underline">
              Privacy policy
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
