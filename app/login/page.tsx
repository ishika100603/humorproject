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
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">Log in</h1>
      <p className="text-gray-600">
        Sign in with your Columbia Google account to see your profile.
      </p>
      <button
        onClick={signIn}
        className="rounded-lg bg-black px-5 py-3 text-white hover:bg-gray-800"
      >
        Continue with Google
      </button>
    </main>
  );
}
