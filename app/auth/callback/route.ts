import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Came from a "Forgot password" email: open the set-a-new-password box
      const sent = data.user?.recovery_sent_at ? new Date(data.user.recovery_sent_at).getTime() : 0;
      const fromReset = Date.now() - sent < 60 * 60 * 1000;
      return NextResponse.redirect(fromReset ? `${origin}/profile?reset=1` : `${origin}/memes?welcome=1`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
