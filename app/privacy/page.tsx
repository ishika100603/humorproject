import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy | Caption the City",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <nav className="mb-4">
        <a href="/" className="text-sm font-semibold underline">
          Back to captions
        </a>
      </nav>

      <div className="mosaic">
        <div className="mosaic-field px-6 py-7">
          <h1 className="condensed text-4xl font-extrabold uppercase leading-none">
            Privacy policy
          </h1>
          <p className="mt-2 text-sm text-ink/70">Last updated October 11, 2026</p>

          <div className="mt-6 grid gap-5 leading-relaxed">
            <p>
              Caption the City is a student project for a Columbia University
              course. This page explains what the app collects and how it is
              used.
            </p>

            <section>
              <h2 className="text-lg font-bold">What we collect</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  From Google sign-in: your email address and Google account ID.
                </li>
                <li>
                  What you add: your first and last name and profile photo (on
                  your profile), photos you upload for captions, and your
                  upvotes and downvotes.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold">How it is used</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>To log you in and keep your profile and votes tied to you.</li>
                <li>
                  Photos you upload are sent to Google&apos;s Gemini API to write
                  captions. The photo and its captions then appear in the public
                  feed.
                </li>
                <li>
                  Captions and photos in the feed are shown without your name.
                  Your name, email and profile photo are only visible to you.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold">Where it is stored</h2>
              <p className="mt-2">
                Data is stored with Supabase (database and file storage) and the
                site is hosted on Vercel. We don&apos;t sell your data or use it
                for advertising.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold">Deleting your data</h2>
              <p className="mt-2">
                Email{" "}
                <a href="mailto:ia2630@columbia.edu" className="underline">
                  ia2630@columbia.edu
                </a>{" "}
                to have your account, profile and uploads deleted.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
