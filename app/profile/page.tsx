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
      setStatus("Saved!");
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
      setStatus("Photo updated!");
    }
    setUploading(false);
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (!profile) return <p className="p-6">Loading your profile…</p>;

  const needsName = !profile.first_name || !profile.last_name;

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Profile</h1>
        <button onClick={signOut} className="text-sm text-gray-600 underline">
          Log out
        </button>
      </div>

      {needsName && (
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-900">
          Welcome! Please add your first and last name to finish setting up
          your profile.
        </div>
      )}

      <div className="mb-6 flex items-center gap-4">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Profile photo"
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200 text-gray-500">
            No photo
          </div>
        )}
        <label className="cursor-pointer rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
          {uploading ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/*"
            onChange={uploadPhoto}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      <form onSubmit={saveNames} className="grid gap-4">
        <p className="text-sm text-gray-600">{profile.email}</p>
        <label className="grid gap-1">
          <span className="text-sm font-medium">First name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="rounded-lg border px-3 py-2"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Last name</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="rounded-lg border px-3 py-2"
          />
        </label>
        <button className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800">
          Save
        </button>
        {status && <p className="text-sm">{status}</p>}
      </form>
    </main>
  );
}
