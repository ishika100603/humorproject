import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Tried in order. If Google says a model is busy or missing, we move to the next one.
const MODELS = Array.from(
  new Set(
    [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"].filter(
      Boolean
    ) as string[]
  )
);
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const maxDuration = 60;

// The prompt is written for our target user and is saved with every caption.
const BASE_PROMPT = `You write captions for "At 116 & Broadway", where Columbia students post photos and vote on AI captions.
Your reader is a Columbia junior who lives on Sidechat. They have seen every generic joke, so be specific.
The photo can be anything: food, a pet, a dorm room, a screenshot, a sunset, a selfie, a weird sign. Caption what is actually in it.

How to be funny:
- Find the one odd, oddly specific, or painfully relatable detail in the photo and build the joke on it.
- Short setup, twist at the end. The last few words should land the joke.
- Sound like a real student posting, not a brand or a greeting card. Lowercase deadpan is fine.
- Connect it to student life only when it fits (deadlines, dining halls, the 1 train, Butler, housing, recruiting, midterms). Don't force Columbia into every caption.
- Skip the obvious first joke anyone would make, puns on the object's name, hashtags, emojis, and "POV".
- 12 words or fewer. Never use em dashes.
- Playful, never cruel: no jokes about looks, bodies, or identity, no real named people, nothing sexual.

Write 3 different caption ideas, then pick the funniest.
Return only JSON like {"ideas": ["...", "...", "..."], "best": "..."}.`;

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

  const requestBody = JSON.stringify({
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
  });

  let geminiRes: Response | null = null;
  let usedModel = MODELS[0];
  let lastStatus = 0;
  let sawBusy = false;
  const queue = [...MODELS];
  outer: for (let m = 0; m < queue.length && m < 6; m++) {
    const model = queue[m];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: requestBody,
          }
        );
        if (res.ok) {
          geminiRes = res;
          usedModel = model;
          break outer;
        }
        lastStatus = res.status;
        if (RETRYABLE.has(res.status)) sawBusy = true;
        const detail = await res.text();
        console.error("Gemini error", model, res.status, detail.slice(0, 500));
        // Retired model: Google names the replacement, so queue it up and move on
        if (res.status === 404) {
          const hint = detail.match(/use models\/([\w.-]+)/)?.[1];
          if (hint && !queue.includes(hint)) queue.push(hint);
          break;
        }
        if (!RETRYABLE.has(res.status)) break outer;
      } catch (e) {
        lastStatus = 503;
        sawBusy = true;
        console.error("Gemini fetch failed", model, e);
      }
      if (attempt === 0) await sleep(1200);
    }
  }

  if (!geminiRes) {
    const busy = sawBusy || RETRYABLE.has(lastStatus);
    return NextResponse.json(
      {
        error: busy
          ? "The caption AI is busy right now. Give it a minute and try again."
          : `Caption request failed (${lastStatus}). Try again in a moment.`,
      },
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
    const picked: unknown[] = Array.isArray(parsed)
      ? parsed
      : [parsed?.best, ...(Array.isArray(parsed?.ideas) ? parsed.ideas : [])];
    captions = picked
      .filter((c) => typeof c === "string")
      .map((c) => String(c).trim().replace(/^["“]|["”]$/g, ""))
      // No em or en dashes in captions
      .map((c) => c.replace(/\s*[\u2014\u2013]\s*/g, ", "))
      .filter(Boolean)
      .slice(0, 1);
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
        model: usedModel,
        created_by: user.id,
      }))
    )
    .select("id, caption");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ captions: rows });
}
