"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CaptionApp from "./caption-app";
import Landing from "./landing";

// Visitors see the landing page. Once logged in, the home page is the meme feed.
export default function HomeSwitch() {
  const [state, setState] = useState<"checking" | "in" | "out">("checking");
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setState(data.user ? "in" : "out"));
  }, []);
  if (state === "checking") return null;
  return state === "in" ? <CaptionApp /> : <Landing />;
}
