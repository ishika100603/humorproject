import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@supabase/supabase-js";

// Runs ONE step of a prompt chain for the prompt chain tool (a separate app).
// The tool calls this once per step, so every step gets the full time limit and
// its output shows as soon as it's ready. Step 1 gets the image and its prompt;
// every later step gets the previous step's output (sent back by the tool) plus
// its own prompt. The last step's lines become the captions.
// Called with the signed-in superadmin's Supabase token, so RLS still applies.

export const maxDuration = 60;

const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function cors(origin: string | null) {
  const ok =
    !!origin && (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    Vary: "Origin",
  };
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

const parseCaptions = (text: string) => {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let list: unknown[] = [];
  try {
    const j = JSON.parse(t);
    list = Array.isArray(j) ? j : Array.isArray(j?.captions) ? j.captions : [];
  } catch {
    list = t.split("\n");
  }
  return list
    .filter((c) => typeof c === "string")
    .map((c) => String(c).trim().replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["“]|["”]$/g, ""))
    .map((c) => c.replace(/\s*[—–]\s*/g, ", "))
    .filter((c) => c.length > 1 && c.length < 300)
    .slice(0, 10);
};

export async function POST(request: Request) {
  const headers = cors(request.headers.get("origin"));
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("Sign in first.", 401);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail("GEMINI_API_KEY is not set on the caption app.", 500);

  const supabase = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return fail("Your session expired. Sign in again.", 401);
  const { data: isAdmin } = await supabase.rpc("is_superadmin");
  if (isAdmin !== true) return fail("Only superadmins can run prompt chains.", 403);

  const body = await request.json().catch(() => ({}));
  const chainId = Number(body.chain_id);
  const imageUrl = String(body.image_url ?? "");
  const publish = body.publish === true;
  const stepIndex = Math.max(0, Math.floor(Number(body.step_index) || 0));
  const previous = String(body.previous ?? "").slice(0, 8000);
  if (!chainId) return fail("Pick a prompt chain.");
  if (!/^https:\/\//.test(imageUrl)) return fail("Pick an image.");

  const [chainQ, stepsQ, modelsQ] = await Promise.all([
    supabase.from("prompt_chains").select("id, name").eq("id", chainId).maybeSingle(),
    supabase.from("prompt_chain_steps").select("step_order, title, prompt_text").eq("chain_id", chainId).order("step_order"),
    supabase
      .from("llm_models")
      .select("model_key, temperature, llm_providers!inner(slug, is_active)")
      .eq("is_active", true)
      .eq("llm_providers.slug", "google")
      .eq("llm_providers.is_active", true)
      .order("priority"),
  ]);
  if (!chainQ.data) return fail("That prompt chain doesn't exist.");
  const steps = (stepsQ.data ?? []) as { step_order: number; title: string; prompt_text: string }[];
  if (!steps.length) return fail("This chain has no steps yet. Add at least one.");
  const models = ((modelsQ.data ?? []) as { model_key: string; temperature: number }[]).map((m) => ({
    key: m.model_key,
    temperature: Number(m.temperature) || 1,
  }));
  if (!models.length) FALLBACK_MODELS.forEach((key) => models.push({ key, temperature: 1 }));

  if (stepIndex >= steps.length) return fail("That step doesn't exist any more. Reload the page.");

  // The image, sent inline to step 1 only
  let image: { mime: string; data: string } = { mime: "", data: "" };
  if (stepIndex === 0) try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(String(res.status));
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!mime.startsWith("image/")) throw new Error("not an image");
    image = { mime, data: Buffer.from(await res.arrayBuffer()).toString("base64") };
  } catch {
    return fail("Couldn't load that image. Try another one.");
  }

  // Step 1 opens the request; later steps add to it
  let requestId: number | null = Number(body.request_id) || null;
  if (stepIndex === 0) {
    const req = await supabase
      .from("caption_requests")
      .insert({ user_id: user.id, image_url: imageUrl, chain_id: chainId, caption_count: 0, hint: "Prompt chain tool run" })
      .select("id")
      .single();
    requestId = req.data?.id ?? null;
  }
  const finish = async (fields: Record<string, unknown>) => {
    if (requestId) await supabase.from("caption_requests").update({ finished_at: new Date().toISOString(), ...fields }).eq("id", requestId);
  };

  const deadline = Date.now() + 54_000;
  const outputs: { step_order: number; title: string; model: string; ms: number; output: string }[] = [];
  let lastOutput = previous;

  {
    const i = stepIndex;
    const step = steps[i];
    const isLast = i === steps.length - 1;
    let text = step.prompt_text.trim();
    if (i > 0) text += `\n\nInput from the previous step:\n${previous}`;
    if (isLast) text += "\n\nFormat: put each caption on its own line, with no numbering, quotes or extra commentary.";
    const parts = i === 0 ? [{ inline_data: { mime_type: image.mime, data: image.data } }, { text }] : [{ text }];

    let done = false;
    for (const model of models) {
      const left = deadline - Date.now();
      if (left < 3_000) break;
      const started = Date.now();
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.key}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: model.temperature } }),
          signal: AbortSignal.timeout(Math.min(28_000, left)),
        });
        const raw = await res.text();
        const ms = Date.now() - started;
        if (res.ok) {
          const json = JSON.parse(raw);
          const out = ((json?.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
            .filter((p) => !p.thought && p.text)
            .map((p) => p.text)
            .join("")
            .trim();
          if (requestId)
            await supabase.from("llm_responses").insert({
              request_id: requestId,
              model_key: model.key,
              http_status: res.status,
              latency_ms: ms,
              response_text: `Step ${step.step_order} · ${step.title}\n${out}`.slice(0, 4000),
              prompt_tokens: json?.usageMetadata?.promptTokenCount,
              output_tokens: (json?.usageMetadata?.candidatesTokenCount ?? 0) + (json?.usageMetadata?.thoughtsTokenCount ?? 0) || undefined,
              total_tokens: json?.usageMetadata?.totalTokenCount,
            });
          outputs.push({ step_order: step.step_order, title: step.title, model: model.key, ms, output: out });
          lastOutput = out;
          done = true;
          break;
        }
        if (requestId)
          await supabase
            .from("llm_responses")
            .insert({ request_id: requestId, model_key: model.key, http_status: res.status, latency_ms: ms, error: raw.slice(0, 800) });
        if (!RETRYABLE.has(res.status) && res.status !== 404) break;
      } catch (e) {
        if (requestId)
          await supabase
            .from("llm_responses")
            .insert({ request_id: requestId, model_key: model.key, http_status: 504, latency_ms: Date.now() - started, error: String(e).slice(0, 300) });
      }
    }
    if (!done) {
      const error = `Step ${step.step_order} (${step.title}) failed: the AI was busy or too slow. Try again.`;
      await finish({ status: "failed", error });
      return NextResponse.json({ error, outputs, request_id: requestId }, { status: 502, headers });
    }
  }

  // Not the last step yet: hand the output back so the tool can send it to the next one
  if (stepIndex < steps.length - 1) {
    return NextResponse.json({ request_id: requestId, outputs, next_step: stepIndex + 1, total_steps: steps.length }, { headers });
  }

  const captions = parseCaptions(lastOutput);
  const model = outputs[outputs.length - 1]?.model ?? null;
  let saved = 0;
  let publishError: string | null = null;
  if (publish && captions.length) {
    const { data, error: insertError } = await supabase
      .from("captions")
      .insert(
        captions.map((caption) => ({
          image_url: imageUrl,
          caption,
          prompt: `Prompt chain: ${chainQ.data!.name}`,
          model,
          created_by: user.id,
          caption_request_id: requestId,
          chain_id: chainId,
        }))
      )
      .select("id");
    saved = data?.length ?? 0;
    if (insertError) {
      publishError = insertError.message;
      console.error("chain-run: couldn't post captions", insertError);
    }
  }
  await finish({ status: captions.length ? "done" : "failed", model_used: model, caption_count: captions.length, captions_created: saved, error: captions.length ? null : "The last step returned no captions." });

  return NextResponse.json(
    { request_id: requestId, outputs, captions, published: saved, publish_requested: publish, publish_error: publishError },
    { headers }
  );
}
