import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Built-in fallbacks, used only if the pipeline tables are empty or unreachable.
const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
const FALLBACK_PROMPT = `You write captions for "At 116 & Broadway", where Columbia students post photos and vote on AI captions.
Your reader is a Columbia junior who lives on Sidechat. They have seen every generic joke, so be specific.
The photo can be anything. Caption what is actually in it.
- Find the one odd or painfully relatable detail and build the joke on it. Twist at the end.
- 12 words or fewer. Never use em dashes.
- Playful, never cruel: no jokes about looks, bodies, or identity, no real named people, nothing sexual.`;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export const maxDuration = 60;

// The poster picks 1, 2 or 3 captions. The AI drafts a few more, then keeps the funniest.
const askFor = (count: number) =>
  `\n\nWrite ${count + 2} different caption ideas, then pick the ${count === 1 ? "single funniest" : `${count} funniest, each a different joke`}.
Return only JSON like {"ideas": ["...", "..."], "best": [${Array.from({ length: count }, () => '"..."').join(", ")}]}.`;

type Chain = { id: number; name: string };
type Step = { chain_id: number; step_order: number; prompt_text: string };

// Pick a prompt chain at random, weighted by the admin-controlled mix
function pickChain(chains: Chain[], mix: { chain_id: number; weight: number }[]) {
  const weighted = chains
    .map((c) => ({ c, w: mix.find((m) => m.chain_id === c.id)?.weight ?? 0 }))
    .filter((x) => x.w > 0);
  const total = weighted.reduce((s, x) => s + x.w, 0);
  if (!total) return chains[0] ?? null;
  let r = Math.random() * total;
  for (const x of weighted) {
    r -= x.w;
    if (r < 0) return x.c;
  }
  return weighted[weighted.length - 1].c;
}

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
    return NextResponse.json({ error: "GEMINI_API_KEY is not set on the server." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const path: string = body.path ?? "";
  const angle: string = String(body.angle ?? "").trim().slice(0, 200);
  const count = Math.min(3, Math.max(1, Math.round(Number(body.count) || 1)));

  // Users can only generate captions for photos in their own folder
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "That photo upload wasn't found. Upload it again." }, { status: 400 });
  }

  const { data: file, error: downloadError } = await supabase.storage.from("uploads").download(path);
  if (downloadError || !file) {
    return NextResponse.json({ error: "Couldn't read that photo. Try a JPG or PNG." }, { status: 400 });
  }
  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "image/jpeg";
  const imageUrl = supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl;

  // ---------- Load the pipeline the admin area controls ----------
  const [modelsQ, chainsQ, stepsQ, mixQ, termsQ, examplesQ] = await Promise.all([
    supabase
      .from("llm_models")
      .select("model_key, temperature, priority, is_active, llm_providers!inner(slug, is_active)")
      .eq("is_active", true)
      .eq("llm_providers.slug", "google")
      .eq("llm_providers.is_active", true)
      .order("priority"),
    supabase.from("prompt_chains").select("id, name"),
    supabase.from("prompt_chain_steps").select("chain_id, step_order, prompt_text").order("step_order"),
    supabase.from("prompt_chain_mix").select("chain_id, weight"),
    supabase.from("terms").select("term, definition").eq("is_active", true).limit(40),
    supabase.from("caption_examples").select("image_description, caption").eq("is_active", true).limit(8),
  ]);

  const models: { key: string; temperature: number }[] = (modelsQ.data ?? []).map(
    (m: { model_key: string; temperature: number }) => ({ key: m.model_key, temperature: Number(m.temperature) || 1 })
  );
  if (!models.length) FALLBACK_MODELS.forEach((key) => models.push({ key, temperature: 1 }));

  const chain = pickChain((chainsQ.data ?? []) as Chain[], (mixQ.data ?? []) as { chain_id: number; weight: number }[]);
  const steps = ((stepsQ.data ?? []) as Step[]).filter((s) => chain && s.chain_id === chain.id);
  let prompt = steps.length ? steps.map((s) => s.prompt_text.trim()).join("\n\n") : FALLBACK_PROMPT;

  const terms = (termsQ.data ?? []) as { term: string; definition: string }[];
  if (terms.length) {
    prompt += `\n\nColumbia references you may use when they fit the photo (never force them):\n${terms
      .map((t) => `- ${t.term}: ${t.definition}`)
      .join("\n")}`;
  }
  const examples = (examplesQ.data ?? []) as { image_description: string; caption: string }[];
  if (examples.length) {
    prompt += `\n\nExamples of captions that landed well (match the tone, don't copy them):\n${examples
      .map((e) => `- Photo: ${e.image_description} -> "${e.caption}"`)
      .join("\n")}`;
  }
  if (angle) prompt += `\n\nExtra direction from the user: ${angle}`;
  prompt += askFor(count);

  // ---------- Record the image and the generation request ----------
  let imageId: number | null = null;
  {
    const existing = await supabase.from("images").select("id").eq("url", imageUrl).maybeSingle();
    if (existing.data) imageId = existing.data.id;
    else {
      const ins = await supabase
        .from("images")
        .insert({ url: imageUrl, storage_path: path, uploaded_by: user.id })
        .select("id")
        .single();
      imageId = ins.data?.id ?? null;
    }
  }
  const reqIns = await supabase
    .from("caption_requests")
    .insert({ user_id: user.id, image_id: imageId, image_url: imageUrl, chain_id: chain?.id ?? null, caption_count: count, hint: angle || null })
    .select("id")
    .single();
  const requestId: number | null = reqIns.data?.id ?? null;
  if (reqIns.error) console.error("Couldn't log caption request", reqIns.error.message);

  const finish = async (fields: Record<string, unknown>) => {
    if (requestId) await supabase.from("caption_requests").update({ finished_at: new Date().toISOString(), ...fields }).eq("id", requestId);
  };
  const logResponse = async (row: { model_key: string; http_status?: number; latency_ms: number; response_text?: string; error?: string }) => {
    if (requestId) {
      const { error } = await supabase.from("llm_responses").insert({ request_id: requestId, ...row, response_text: row.response_text?.slice(0, 4000) });
      if (error) console.error("Couldn't log LLM response", error.message);
    }
  };

  // ---------- Call the models in priority order ----------
  let geminiText: string | null = null;
  let usedModel = models[0].key;
  let lastStatus = 0;
  let sawBusy = false;
  const queue = [...models];
  // Vercel stops the function at 60s, so every call gets a time limit
  const deadline = Date.now() + 48_000;
  for (let m = 0; m < queue.length && m < 6; m++) {
    const model = queue[m];
    const left = deadline - Date.now();
    if (left < 3_000) break;
    const started = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.key}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: model.temperature },
        }),
        signal: AbortSignal.timeout(Math.min(22_000, left)),
      });
      const raw = await res.text();
      if (res.ok) {
        const json = JSON.parse(raw);
        const parts: { text?: string; thought?: boolean }[] = json?.candidates?.[0]?.content?.parts ?? [];
        geminiText = parts
          .filter((p) => !p.thought && p.text)
          .map((p) => p.text)
          .join("")
          .trim()
          .replace(/^```(?:json)?\s*|\s*```$/g, "");
        usedModel = model.key;
        await logResponse({ model_key: model.key, http_status: res.status, latency_ms: Date.now() - started, response_text: geminiText });
        break;
      }
      lastStatus = res.status;
      if (RETRYABLE.has(res.status)) sawBusy = true;
      await logResponse({ model_key: model.key, http_status: res.status, latency_ms: Date.now() - started, error: raw.slice(0, 1000) });
      // Retired model: Google names the replacement, so queue it up
      if (res.status === 404) {
        const hint = raw.match(/use models\/([\w.-]+)/)?.[1];
        if (hint && !queue.some((q) => q.key === hint)) queue.push({ key: hint, temperature: model.temperature });
      }
    } catch (e) {
      lastStatus = 504;
      sawBusy = true;
      await logResponse({ model_key: model.key, http_status: 504, latency_ms: Date.now() - started, error: String(e).slice(0, 300) });
    }
  }

  if (geminiText === null) {
    const busy = sawBusy || RETRYABLE.has(lastStatus);
    const error = busy
      ? "The caption AI is busy right now. Give it a minute and try again."
      : `Caption request failed (${lastStatus}). Try again in a moment.`;
    await finish({ status: "failed", error });
    return NextResponse.json({ error }, { status: 502 });
  }

  let captions: string[] = [];
  try {
    const parsed = JSON.parse(geminiText);
    const best = Array.isArray(parsed?.best) ? parsed.best : [parsed?.best];
    const picked: unknown[] = Array.isArray(parsed) ? parsed : [...best, ...(Array.isArray(parsed?.ideas) ? parsed.ideas : [])];
    captions = picked
      .filter((c) => typeof c === "string")
      .map((c) => String(c).trim().replace(/^["“]|["”]$/g, ""))
      // No em or en dashes in captions
      .map((c) => c.replace(/\s*[—–]\s*/g, ", "))
      .filter(Boolean)
      .filter((c, i, all) => all.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i)
      .slice(0, count);
  } catch {
    captions = [];
  }
  if (captions.length === 0) {
    const error = "No captions came back for that photo. Try again.";
    await finish({ status: "failed", error, model_used: usedModel });
    return NextResponse.json({ error }, { status: 502 });
  }

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
        caption_request_id: requestId,
        chain_id: chain?.id ?? null,
      }))
    )
    .select("id, caption");

  if (insertError) {
    await finish({ status: "failed", error: insertError.message, model_used: usedModel });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await finish({ status: "done", model_used: usedModel, captions_created: rows?.length ?? 0 });
  return NextResponse.json({ captions: rows });
}
