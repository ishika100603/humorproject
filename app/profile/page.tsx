"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { LogBox } from "../art";
import Crown from "../crown";

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
  const [leaving, setLeaving] = useState<"" | "in" | "rolling">("");
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [crowns, setCrowns] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);

  // The reset email lands here with ?reset=1
  useEffect(() => {
    setResetting(new URLSearchParams(window.location.search).has("reset"));
  }, []);

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
      const pts = await supabase.rpc("my_points");
      if (!pts.error && pts.data?.[0]) setCrowns(Number(pts.data[0].points));
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
      toast("error", "Didn't save", `${error.message}. Try again, or email ia2630@columbia.edu.`);
    } else {
      setProfile({ ...profile, ...updates });
      setStatus("");
      toast("success", "Approved!", "Your name is saved.");
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
      toast("error", "Photo didn't upload", `${uploadError.message}. Try a JPG or PNG under 5 MB.`);
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
      toast("error", "Didn't save", `${error.message}. Try again, or email ia2630@columbia.edu.`);
    } else {
      setProfile({ ...profile, avatar_url: data.publicUrl });
      setStatus("Photo updated.");
      toast("success", "Approved!", "Looking good. Photo updated.");
    }
    setUploading(false);
  };

  // Lets Google users add a password, and anyone who used "Forgot password" set a new one
  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast("error", "Too short", "Passwords need at least 6 characters.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast("error", "Didn't save", `${error.message}. Try again.`);
      return;
    }
    setNewPassword("");
    setResetting(false);
    window.history.replaceState(null, "", "/profile");
    toast("success", "Approved!", "New password saved.");
  };

  const sendReset = async () => {
    if (!profile?.email) return;
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) toast("error", "Didn't send", `${error.message}. Try again in a minute.`);
    else toast("success", "Sent", `Check ${profile.email} for a reset link.`);
  };

  const signOut = async () => {
    setLeaving("in");
    const supabase = createClient();
    await supabase.auth.signOut();
    setTimeout(() => setLeaving("rolling"), 250);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  };

  if (!profile)
    return <p className="mx-auto w-full max-w-md px-4 py-8">Loading your profile…</p>;

  const needsName = !profile.first_name || !profile.last_name;

  if (leaving)
    return (
      <main className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#cfe8dc]">
        <p className="text-xl font-medium tracking-[0.15em] text-[#1d2a3a]">LOG OUT</p>
        <div className="mt-6 h-40 w-[min(360px,80vw)]">
          <LogBox state={leaving === "rolling" ? "rolling" : "in"} />
        </div>
        <p className="mt-4 text-[#1d2a3a]">See you back at 116 &amp; Broadway.</p>
      </main>
    );

  const shown = [profile.first_name, profile.last_name ? `${profile.last_name[0]}.` : ""].filter(Boolean).join(" ");

  return (
    <main className="grid min-h-[100dvh] w-full lg:h-[100dvh] lg:grid-cols-2 lg:overflow-hidden">
      <section className="relative flex flex-col items-center justify-center px-8 pb-[3vh] pt-[9vh] text-center lg:py-[8vh]">
        <a href="/feed" className="absolute left-6 top-6 text-sm underline lg:left-10">
          ← Back
        </a>
        <label className="group relative cursor-pointer" title="Change photo">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Your profile photo"
              className="h-[min(16vh,220px)] w-[min(16vh,220px)] lg:h-[min(30vh,220px)] lg:w-[min(30vh,220px)] rounded-full border border-ink object-cover"
            />
          ) : (
            <div className="flex h-[min(16vh,220px)] w-[min(16vh,220px)] lg:h-[min(30vh,220px)] lg:w-[min(30vh,220px)] items-center justify-center rounded-full border border-dashed border-ink/50 bg-white/40 text-sm text-ink/60">
              Add a photo
            </div>
          )}
          <span className="absolute inset-x-0 -bottom-7 text-xs text-ink/60 underline opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? "Uploading…" : profile.avatar_url ? "Change photo" : "Upload photo"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={uploadPhoto}
            className="sr-only"
            disabled={uploading}
          />
        </label>
        <p className="hand mt-[3vh] lg:mt-[5vh] text-[clamp(20px,2vw,28px)] tracking-[0.15em]">{shown || "Hello, stranger"}</p>
        {crowns !== null && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-ink/70">
            <Crown className="h-4 w-4" /> {crowns} {crowns === 1 ? "crown" : "crowns"}
          </p>
        )}
        <p className="mt-2 text-xs text-ink/50">Your name never shows on captions.</p>
      </section>

      <section className="relative flex items-center justify-center bg-tile-face/80 px-8 pb-[4vh] pt-[7vh] lg:border-l lg:border-ink/40 lg:px-[6vw] lg:py-[8vh]">
        <button onClick={signOut} className="absolute right-6 top-[2vh] text-sm underline lg:right-10 lg:top-6">
          Log out
        </button>
        <div className="w-full max-w-[340px]">
          <h1 className="text-xl font-medium">Your profile</h1>
          <p className="mt-1 text-sm text-ink/60">{profile.email}</p>
          {needsName && <p className="mt-2 text-xs text-teal">Add your name to finish setting up.</p>}

          <form onSubmit={saveNames} className="mt-[3vh] grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-ink/70">First name</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className="min-w-0 rounded-md border border-ink/30 bg-white px-3 py-1.5 focus:border-teal"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-ink/70">Last name</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="min-w-0 rounded-md border border-ink/30 bg-white px-3 py-1.5 focus:border-teal"
                />
              </label>
            </div>
            {(firstName.trim() !== (profile.first_name ?? "") || lastName.trim() !== (profile.last_name ?? "")) && (
              <button className="pop h-10 rounded-md bg-ink px-4 text-sm text-white hover:bg-teal">Save name</button>
            )}
            {status && (
              <p className="text-xs text-ink/60" role="status">
                {status}
              </p>
            )}
          </form>

          {resetting ? (
            <form onSubmit={savePassword} className="mt-[4vh] grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-ink/70">Pick a new password</span>
                <input
                  type="password"
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="rounded-md border border-ink/30 bg-white px-3 py-1.5 focus:border-teal"
                />
              </label>
              <button className="h-10 rounded-md border border-ink px-4 text-sm hover:bg-white">Save password</button>
            </form>
          ) : (
            <button onClick={sendReset} className="mt-[3vh] text-xs text-ink/60 underline hover:text-ink">
              Forgot password?
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
