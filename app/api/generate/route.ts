import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

// The prompt is written for our target user and is saved with every caption.
const BASE_PROMPT = `You write captions for "At 116 & Broadway", a site where Columbia students upload campus photos and vote on AI captions.
Our typical user is a Columbia junior who is active on Sidechat (the anonymous campus app) and knows the campus inside jokes.
Write 1 short caption for this photo that would get upvoted on Columbia's Sidechat.
Rules:
- Keep it short: 12 words or fewer, so it fits on a sticky note.
- Use specific details you can actually see in the photo.
- Use Columbia references only when they fit naturally, for example Butler, Low Steps, John Jay, JJ's, Ferris, Lerner, the Core, Lit Hum, the housing lottery, Barnard, the 1 train, Morningside.
- Pick whichever style is funniest for this photo: a dry observation, Sidechat voice (lowercase, deadpan), or junior-year life (midterms, recruiting, housing).
- Never use em dashes. Use commas or periods instead.
- Be playful, never cruel: no jokes about people's looks or identity, no real named students, no slurs, nothing sexual.
Return only a JSON array with exactly 1 string.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to generate captions." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const path: string = body.path ?? "";
  const angle: string = String(body.angle ?? "").trim().slice(0, 200);

  // Users can only generate captions for photos in their own folder
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "That photo upload wasn't found. Upload it again." }, { status: 400 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("uploads")
    .download(path);
  if (downloadError || !file) {
    return NextResponse.json(
      { error: "Couldn't read that photo. Try a JPG or PNG." },
      { status: 400 }
    );
  }
  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "image/jpeg";

  const prompt = angle
    ? `${BASE_PROMPT}\nExtra direction from the user: ${angle}`
    : BASE_PROMPT;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 1,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const detail = await geminiRes.text();
    console.error("Gemini error", geminiRes.status, detail);
    return NextResponse.json(
      { error: `Caption request failed (${geminiRes.status}). Try again in a moment.` },
      { status: 502 }
    );
  }

  const geminiJson = await geminiRes.json();
  const parts: { text?: string; thought?: boolean }[] =
    geminiJson?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "");

  let captions: string[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      captions = parsed
        .map((c) => String(c).trim())
        // No em or en dashes in captions
        .map((c) => c.replace(/\s*[\u2014\u2013]\s*/g, ", "))
        .filter(Boolean)
        .slice(0, 1);
    }
  } catch {
    captions = [];
  }
  if (captions.length === 0) {
    return NextResponse.json(
      { error: "No captions came back for that photo. Try again." },
      { status: 502 }
    );
  }

  const imageUrl = supabase.storage.from("uploads").getPublicUrl(path).data
    .publicUrl;

  // Saved with the logged-in user's session, so RLS checks created_by = auth.uid()
  const { data: rows, error: insertError } = await supabase
    .from("captions")
    .insert(
      captions.map((caption) => ({
        image_url: imageUrl,
        caption,
        prompt,
        model: MODEL,
        created_by: user.id,
      }))
    )
    .select("id, caption");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ captions: rows });
}
