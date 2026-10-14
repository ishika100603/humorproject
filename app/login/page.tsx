"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ANNOUNCEMENTS } from "@/lib/jokes";
import { toast } from "@/lib/toast";
import { LogBox } from "../art";
import { GooglyEyes } from "../note-person";

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

// Turn Supabase's error text into plain advice
function friendly(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login"))
    return "Wrong email or password. If you signed up with Google, use Continue with Google. Or tap Forgot password.";
  if (m.includes("already registered"))
    return "You already have an account with this email. If you used Google before, tap Continue with Google. Otherwise, log in.";
  if (m.includes("password should be")) return "Passwords need at least 6 characters.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox for the link we sent.";
  if (m.includes("rate limit")) return "Too many tries in a row. Wait a minute and try again.";
  return `${msg}. Try again, or email ${CONTACT} if it keeps happening.`;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"" | "google" | "email">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [logState, setLogState] = useState<"hover" | "dropping">("hover");
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 6000);
    return () => clearInterval(t);
  }, []);

  const google = async () => {
    setBusy("google");
    setError("");
    setLogState("dropping");
    await new Promise((r) => setTimeout(r, 600));
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setLogState("hover");
      setBusy("");
      { setError(friendly(error.message)); toast("error", "Foul!", friendly(error.message)); }
    }
  };

  // Emails a reset link. It lands on the profile page, where a new password can be set.
  const forgot = async () => {
    setError("");
    setNotice("");
    if (!email) {
      setError("Type your email above first, then tap Forgot password.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) {
      setError(friendly(error.message));
      return;
    }
    setNotice(`Sent. Open the link in your email to ${email}, then pick a new password.`);
  };

  const withEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("email");
    setError("");
    setNotice("");
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy("");
        { setError(friendly(error.message)); toast("error", "Foul!", friendly(error.message)); }
        return;
      }
      setLogState("dropping");
      toast("success", "Approved!", "You're logged in.");
      setTimeout(() => {
        router.push("/feed");
        router.refresh();
      }, 800);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy("");
    if (error) {
      { setError(friendly(error.message)); toast("error", "Foul!", friendly(error.message)); }
      return;
    }
    if (data.session) {
      setLogState("dropping");
      toast("success", "Approved!", "Account created. Add your name next.");
      // New accounts go to the profile page to add a name
      router.push("/profile");
      router.refresh();
    } else {
      setNotice(`Almost done. We sent a confirmation link to ${email}. Open it, then log in here.`);
      setMode("login");
    }
  };

  return (
    <main className="grid min-h-[100dvh] w-full lg:h-[100dvh] lg:grid-cols-2 lg:overflow-hidden">
      <section className="relative flex flex-col items-center justify-center px-6 pb-4 pt-12 lg:px-16 lg:pt-6">
        <a href="/" className="absolute left-6 top-6 text-sm underline lg:left-10">
          ← Back
        </a>
        <div className="h-[min(18vw,26vh)] w-[min(34vw,48vh)] min-h-[90px] min-w-[170px]">
          <GooglyEyes />
        </div>
        <p className="hand mt-[3vh] text-[clamp(16px,1.6vw,22px)] tracking-[0.2em]">At 116 &amp; Broadway</p>
        <p key={i} className="fade-in mt-2 max-w-sm text-center text-sm text-ink/60">
          {ANNOUNCEMENTS[i % ANNOUNCEMENTS.length]}
        </p>
      </section>

      <section className="relative flex items-center justify-center bg-tile-face/80 px-8 py-[6vh] lg:py-[8vh] lg:border-l lg:border-ink/40 lg:px-[6vw]">
        <div className="w-full max-w-[340px]">
          <div className="mb-[1.5vh] hidden h-[min(64px,8vh)] w-[min(128px,16vh)] [@media(min-height:640px)]:block">
            <LogBox state={logState} />
          </div>
          <h2 className="text-xl font-medium">
            {mode === "login" ? "Log in" : "Create an account"}
          </h2>
          <p className="mt-1 text-sm text-ink/60">to vote and post photos.</p>

          <button
            onClick={google}
            disabled={!!busy}
            className="mt-[3vh] flex h-10 w-full items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-4 text-sm font-medium text-[#1f1f1f] shadow-sm transition hover:bg-[#f8f9fa] hover:shadow disabled:opacity-60"
          >
            <GoogleG />
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="my-[2.5vh] flex items-center gap-3 text-xs text-ink/50" aria-hidden="true">
            <span className="h-px flex-1 bg-ink/30" />
            or email
            <span className="h-px flex-1 bg-ink/30" />
          </div>

          <form onSubmit={withEmail} className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-ink/70">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-md border border-ink/30 bg-white px-3 py-1.5 focus:border-teal"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-ink/70">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : ""}
                className="rounded-md border border-ink/30 bg-white px-3 py-1.5 focus:border-teal"
              />
            </label>
            <button
              disabled={!!busy}
              className="mt-1 h-10 rounded-md bg-ink px-4 text-sm text-white hover:bg-teal disabled:opacity-60"
            >
              {busy === "email" ? "One sec…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <p className="mt-[2.5vh] text-xs">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setNotice("");
              }}
              className="font-normal text-teal underline"
            >
              {mode === "login" ? "Create an account" : "Log in"}
            </button>
            {mode === "login" && (
              <>
                <span className="text-ink/40"> · </span>
                <button type="button" onClick={forgot} className="font-normal text-teal underline">
                  Forgot password?
                </button>
              </>
            )}
          </p>

          {notice && (
            <p className="mt-3 text-xs text-teal" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="mt-3 text-xs text-brick" role="alert">
              {error}
            </p>
          )}

        </div>
        <p className="absolute inset-x-0 bottom-[3vh] text-center text-xs text-ink/60">
          <a href="/feed" className="underline">Just browsing</a>
        </p>
      </section>
    </main>
  );
}
