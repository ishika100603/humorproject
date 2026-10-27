"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NotePerson from "./note-person";
import Menu from "./menu";
import { JOKES } from "@/lib/jokes";





// Magnifying glass cursor for the whole landing page
const MAGNIFIER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='15' cy='15' r='11' fill='%23ffffff99' stroke='%23141414' stroke-width='3'/%3E%3Cpath d='M23 23 L36 36' stroke='%23141414' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E\") 15 15, zoom-in";

export default function Landing() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [joke, setJoke] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
    setJoke(Math.floor(Math.random() * JOKES.length));
  }, []);


  return (
    <div className="landing relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#b9d9eb] text-[#141414]" style={{ cursor: MAGNIFIER }}>
      <header className="relative z-20 mx-5 border-b border-[#141414] pb-3 pt-5 sm:mx-8">
        <div className="flex items-center justify-between gap-4">
          <Menu />
          <div className="flex items-center gap-4">
            <Link
              href={loggedIn ? "/profile" : "/login"}
              className="rounded-full bg-[#141414] px-5 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              {loggedIn ? "My profile" : "Log in / Sign up"}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[3vh] pt-[1vh] text-center">
        <NotePerson />
        <h1 className="hand mt-[2.5vh] text-[clamp(22px,2.6vw,34px)] leading-tight tracking-[0.18em]">
          At 116 &amp; Broadway
        </h1>
        <p className="mt-[2vh] text-[clamp(15px,1.25vw,18px)]">
          <span className="inline-block rounded-md border border-[#141414]/50 px-3 py-1">Vote on AI-made memes. Post your own photo and see what joke the AI makes.</span>
        </p>
        <div className="mt-[3vh] flex flex-wrap justify-center gap-3">
          <Link href="/memes" className="rounded-full bg-[#141414] px-5 py-2 text-sm text-white transition-colors hover:bg-[#1d4f91]">
            Start voting
          </Link>
          <Link
            href={loggedIn ? "/memes?post=1" : "/login"}
            className="rounded-full border border-[#141414] px-5 py-2 text-sm transition-colors hover:bg-white"
          >
            Post a photo
          </Link>
        </div>
        <div className="mt-[6vh] max-w-xl border-t border-[#141414]/20 pt-[2.5vh] text-sm text-[#141414]/80">
          <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[#141414]/50">Joke of the visit</p>
          <p>{JOKES[joke].setup}</p>
          {loggedIn ? (
            shown ? (
              <p className="pop mt-1">{JOKES[joke].punch}</p>
            ) : (
              <button onClick={() => setShown(true)} className="mt-1 text-sm underline">
                Show the punchline
              </button>
            )
          ) : (
            <p className="mt-1 text-sm">
              <span aria-hidden className="mr-2 select-none blur-[5px]">
                {"so the punchline is about this long"}
              </span>
              <Link href="/login" className="underline">Log in to read the punchline</Link>
            </p>
          )}
        </div>
      </main>

    </div>
  );
}
