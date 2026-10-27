import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy | At 116 & Broadway",
};

const SECTIONS = [
  {
    title: "What we collect",
    items: [
      "Your email, and your Google account ID if you log in with Google. Passwords are stored encrypted by our login provider.",
      "Your first and last name and profile photo, the photos you upload, and your votes.",
    ],
  },
  {
    title: "How it's used",
    items: [
      "To log you in and keep your votes and crowns tied to you.",
      "Uploaded photos are sent to Google's Gemini API to write a caption, then shown in the public feed.",
    ],
  },
  {
    title: "Who sees what",
    items: [
      "Photos and captions in the feed never show who posted them.",
      "If you vote, your first name and last initial appear on the rankboard. Your email and profile photo stay private.",
    ],
  },
  {
    title: "Storage and deletion",
    items: [
      "Data is stored with Supabase and the site runs on Vercel. We don't sell it or use it for ads.",
      "Email ia2630@columbia.edu to delete your account, profile and uploads.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="grid min-h-[100dvh] w-full lg:h-[100dvh] lg:grid-cols-[2fr_3fr] lg:overflow-hidden">
      <section className="relative flex flex-col justify-center px-6 pb-[2vh] pt-[8vh] lg:px-[5vw] lg:py-[8vh]">
        <Link href="/" className="absolute left-6 top-6 text-sm underline lg:left-10">
          ← Back
        </Link>
        <h1 className="hand text-[clamp(26px,3vw,40px)] tracking-[0.15em]">Privacy</h1>
        <p className="mt-2 max-w-sm text-xs text-ink/70 sm:text-sm">
          At 116 &amp; Broadway is a student project for a Columbia course. Here&apos;s what it collects and why.
        </p>
        <p className="mt-2 text-[11px] text-ink/50 lg:mt-6">Last updated October 13, 2026</p>
      </section>

      <section className="flex items-center bg-tile-face/80 px-6 py-[3vh] lg:border-l lg:py-[6vh] lg:border-ink/40 lg:px-[5vw]">
        <div className="grid w-full gap-x-12 gap-y-[2.5vh] sm:grid-cols-2 lg:gap-y-[5vh]">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-xs font-medium sm:text-sm">{s.title}</h2>
              <ul className="mt-1 grid gap-1.5 text-xs leading-relaxed text-ink/80 sm:text-sm">
                {s.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
