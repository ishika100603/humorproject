"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NotePerson from "./note-person";
import Menu from "./menu";
import Crown from "./crown";
import { JOKES } from "@/lib/jokes";


function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () =>
      setT(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).format(new Date())
      );
    f();
    const i = setInterval(f, 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="tabular-nums">{t}</span>;
}



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
            <p className="hidden text-right text-[11px] leading-tight sm:block">
              116th St &amp; Broadway, NY
              <br />
              <Clock />
            </p>
            <a
              href={loggedIn ? "/profile" : "/login"}
              className="rounded-full bg-[#141414] px-5 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              {loggedIn ? "My profile" : "Log in / Sign up"}
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[6vh] pt-[2vh] text-center">
        <NotePerson />
        <h1 className="hand mt-[2.5vh] text-[clamp(22px,2.6vw,34px)] leading-tight tracking-[0.18em]">
          At 116 &amp; Broadway
        </h1>
        <div className="mt-[2vh] max-w-xl text-base">
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
              <a href="/login" className="underline">Log in to read the punchline</a>
            </p>
          )}
        </div>
        <div className="mt-[3vh] flex flex-wrap justify-center gap-3">
          <a href="/feed" className="rounded-full bg-[#141414] px-5 py-2 text-sm text-white transition-colors hover:bg-[#1d4f91]">
            Start voting
          </a>
          <a
            href={loggedIn ? "/feed?post=1" : "/login"}
            className="rounded-full border border-[#141414] px-5 py-2 text-sm transition-colors hover:bg-white"
          >
            Post a photo
          </a>
        </div>
        <p className="mt-[2.5vh] flex items-center gap-1.5 text-xs text-[#141414]/70">
          <Crown className="h-3.5 w-3.5" /> Vote on AI captions. Post your own photos.
        </p>
      </main>

    </div>
  );
}
