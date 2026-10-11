"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NotePerson from "./note-person";


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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
  }, []);


  return (
    <div className="landing relative flex min-h-screen w-full flex-col overflow-hidden bg-[#b9d9eb] text-[#141414]" style={{ cursor: MAGNIFIER }}>
      <header className="relative z-20 mx-5 border-b border-[#141414] pb-3 pt-5 sm:mx-8">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="rounded-full border border-[#141414] px-3 py-0.5 text-xs font-medium tracking-wide">
            116
          </a>
          <nav className="hidden gap-6 text-sm font-normal md:flex">
            <a href="/feed" className="hover:underline">Feed</a>
            <a href="/feed?tour=1" className="hover:underline">How it works</a>
            <a href="/privacy" className="hover:underline">Privacy</a>
          </nav>
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

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-8 text-center">
        <NotePerson />
        <h1 className="hand mt-6 text-[clamp(22px,2.6vw,34px)] leading-tight tracking-[0.18em]">
          At 116 &amp; Broadway
        </h1>
        <p className="mt-3 max-w-xl text-base font-medium sm:text-base">
          Post a campus photo. AI writes the caption. Columbia votes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/feed" className="rounded-full bg-[#141414] px-5 py-2 text-sm text-white transition-colors hover:bg-[#1d4f91]">
            Start voting
          </a>
          <a
            href={loggedIn ? "/feed" : "/login"}
            className="rounded-full border border-[#141414] px-5 py-2 text-sm transition-colors hover:bg-white"
          >
            Post a photo
          </a>
        </div>
      </main>

    </div>
  );
}
