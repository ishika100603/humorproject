"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfile(data);
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
      }
    };
    load();
  }, [router]);

  const saveNames = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const supabase = createClient();
    const updates = {
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id);
    if (error) {
      setStatus(error.message);
    } else {
      setProfile({ ...profile, ...updates });
      setStatus("Name saved.");
    }
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    setStatus("");
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const path = `${profile.id}/${Date.now()}-${safeName}`;

    // The photo file goes to Supabase Storage; only its URL goes in the table
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file);
    if (uploadError) {
      setStatus(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", profile.id);

    if (error) {
      setStatus(error.message);
    } else {
      setProfile({ ...profile, avatar_url: data.publicUrl });
      setStatus("Photo updated.");
    }
    setUploading(false);
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (!profile)
    return <p className="mx-auto w-full max-w-md px-4 py-8">Loading your profile…</p>;

  const needsName = !profile.first_name || !profile.last_name;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <nav className="mb-4 flex items-center justify-between">
        <a href="/" className="text-sm font-semibold underline">
          Back to captions
        </a>
        <button onClick={signOut} className="text-sm underline">
          Log out
        </button>
      </nav>

      <div className="mosaic">
        <div className="mosaic-field px-6 py-7">
          <h1 className="condensed text-center text-4xl font-extrabold uppercase leading-none">
            Your profile
          </h1>
          <p className="mt-2 text-center text-sm text-ink/70">
            Only you can see this. Your captions post without your name.
          </p>

          {needsName && (
            <p className="mt-5 rounded-md border-2 border-mustard bg-mustard/15 p-3 text-sm">
              Add your first and last name to finish setting up your account.
            </p>
          )}

          <div className="mt-6 flex items-center gap-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Your profile photo"
                className="h-24 w-24 rounded-full border-2 border-ink object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-ink/40 bg-grout text-sm">
                No photo
              </div>
            )}
            <label className="cursor-pointer rounded-md border-2 border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-white">
              {uploading ? "Uploading photo…" : profile.avatar_url ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadPhoto}
                className="sr-only"
                disabled={uploading}
              />
            </label>
          </div>

          <form onSubmit={saveNames} className="mt-6 grid gap-4">
            <p className="text-sm text-ink/70">{profile.email}</p>
            <label className="grid gap-1">
              <span className="text-sm font-semibold">First name</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className="rounded-md border-2 border-ink/30 bg-white px-3 py-2 focus:border-teal"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-semibold">Last name</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className="rounded-md border-2 border-ink/30 bg-white px-3 py-2 focus:border-teal"
              />
            </label>
            <button className="rounded-md bg-teal px-4 py-3 font-bold text-white hover:bg-ink">
              Save name
            </button>
            {status && (
              <p className="text-sm" role="status">
                {status}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
