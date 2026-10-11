"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const signIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mosaic">
        <div className="mosaic-field px-6 py-8 text-center">
          <h1 className="condensed text-5xl font-extrabold uppercase leading-none">
            Caption the City
          </h1>
          <p className="mt-3">
            Log in with your Google account to upload photos and vote. Posts are anonymous.
          </p>
          <button
            onClick={signIn}
            className="mt-6 w-full rounded-md bg-teal px-5 py-3 text-lg font-bold text-white hover:bg-ink"
          >
            Continue with Google
          </button>
          <p className="mt-4 text-sm">
            <a href="/" className="underline">
              Back to captions
            </a>
            {"  ·  "}
            <a href="/privacy" className="underline">
              Privacy policy
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
