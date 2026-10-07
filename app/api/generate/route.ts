import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

// The prompt is written for our user persona, Sam, and is saved with every caption.
const BASE_PROMPT = `You are a comedy writer for "Caption the City", a site for Columbia students who are new to New York.
Our typical user is Sam: a Columbia College junior from the Midwest, chronically online, who lives in the dorms and explores NYC on weekends.
Write 3 short, funny captions for this photo that Sam would want to screenshot and send to the group chat.
Rules:
- Each caption is under 20 words.
- Use specific details you can actually see in the photo.
- Mix styles: one observational, one in an internet/meme voice, one about being new to NYC or college life.
- Keep it playful and kind: no insults about people's appearance, no slurs, nothing sexual.
Return only a JSON array of 3 strings.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
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
    return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("uploads")
    .download(path);
  if (downloadError || !file) {
    return NextResponse.json(
      { error: "Could not read the uploaded photo." },
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
      { error: `The AI request failed (${geminiRes.status}). Try again.` },
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
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch {
    captions = [];
  }
  if (captions.length === 0) {
    return NextResponse.json(
      { error: "The AI didn't return any captions. Try again." },
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
