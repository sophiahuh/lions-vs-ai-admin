import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The caption pipeline. Everything it uses lives in the database and is managed
 * from the admin app: the prompt chain mix picks a chain, the chain's steps run
 * in order, models are tried by priority, active terms and examples are injected
 * into the prompt, and every request and model call is logged.
 */

type Step = {
  id: number;
  step_order: number;
  name: string;
  system_prompt: string;
  user_template: string;
  output_format: "text" | "caption_json";
  include_image: boolean;
  model: { model_id: string } | null;
};

export type PipelineResult = {
  caption: string;
  model: string;
  chainId: number;
  prompt: string;
  requestId: number;
};

const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite"];
const BUDGET_MS = 50_000;

function render(template: string, vars: Record<string, string>) {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickWeighted<T extends { weight: number }>(rows: T[]): T | undefined {
  const total = rows.reduce((n, r) => n + Math.max(0, r.weight), 0);
  if (total <= 0) return rows[0];
  let roll = Math.random() * total;
  for (const r of rows) {
    roll -= Math.max(0, r.weight);
    if (roll < 0) return r;
  }
  return rows[rows.length - 1];
}

async function callGemini(opts: {
  model: string;
  system: string;
  user: string;
  image: { base64: string; mimeType: string } | null;
  json: boolean;
}) {
  const parts: Record<string, unknown>[] = [];
  if (opts.image) parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.base64 } });
  parts.push({ text: opts.user });
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: opts.json
      ? {
          temperature: 1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              candidates: { type: "ARRAY", items: { type: "STRING" } },
              best: { type: "INTEGER" },
            },
            required: ["candidates", "best"],
          },
        }
      : { temperature: 0.4 },
  };

  const started = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => null);
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
      json?.error?.message ??
      "";
    // Thinking tokens are billed as output, so they count toward output_tokens.
    const usage = json?.usageMetadata;
    return {
      status: res.status,
      ok: res.ok && !!text,
      text,
      latency: Date.now() - started,
      inputTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage ? (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0) : null,
    };
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    return {
      status: timeout ? 408 : 0,
      ok: false,
      text: timeout ? "Timed out" : String(err),
      latency: Date.now() - started,
      inputTokens: null,
      outputTokens: null,
    };
  }
}

function parseCaption(text: string) {
  const parsed = JSON.parse(text) as { candidates?: string[]; best?: number };
  const options = (parsed.candidates ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
  const pick = options[parsed.best ?? 0] ?? options[0] ?? "";
  return pick.replace(/^["“]|["”]$/g, "").slice(0, 140);
}

export async function runCaptionPipeline(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    source: "app" | "admin";
    image: { base64: string; mimeType: string };
    humanCaption?: string | null;
    words?: number;
    /** Admin tests and regenerations can force a flavor instead of rolling the weights. */
    chainId?: number;
    /** ...and force a model to be tried first on every step. */
    model?: string;
  }
): Promise<PipelineResult> {
  const started = Date.now();

  // 1. Pick a chain by the admin-controlled weights, unless one was requested.
  let chainId = opts.chainId;
  if (!chainId) {
    const { data: mix } = await supabase.from("prompt_chain_mix").select("chain_id, weight");
    const chosen = pickWeighted((mix ?? []) as { chain_id: number; weight: number }[]);
    if (!chosen) throw new Error("No prompt chains are configured.");
    chainId = chosen.chain_id;
  }

  // 2. Load the chain's steps, active models, terms, and examples.
  const [stepsRes, modelsRes, termsRes, examplesRes] = await Promise.all([
    supabase
      .from("prompt_chain_steps")
      .select("id, step_order, name, system_prompt, user_template, output_format, include_image, model:llm_models(model_id)")
      .eq("chain_id", chainId)
      .order("step_order"),
    supabase.from("llm_models").select("model_id").eq("is_active", true).order("priority"),
    supabase.from("terms").select("term, definition").eq("is_active", true).order("term"),
    supabase.from("generation_examples").select("image_description, caption").eq("is_active", true).limit(8),
  ]);
  const steps = (stepsRes.data ?? []) as unknown as Step[];
  if (!steps.length) throw new Error("The selected prompt chain has no steps.");
  const models = (modelsRes.data ?? []).map((m) => m.model_id as string);
  const modelOrder = models.length ? models : FALLBACK_MODELS;

  const human = opts.humanCaption?.trim();
  const words = human ? human.split(/\s+/).filter(Boolean).length : (opts.words ?? 10);
  const lowercase = human ? human === human.toLowerCase() : false;
  const terms = termsRes.data ?? [];
  const examples = examplesRes.data ?? [];
  const vars: Record<string, string> = {
    length: String(Math.min(25, Math.max(3, words))),
    casing: lowercase ? "Write it in all lowercase." : "Use normal capitalization.",
    terms: terms.length
      ? "Columbia glossary (use a term only if it makes the joke land):\n" +
        terms.map((t) => `- ${t.term}: ${t.definition}`).join("\n")
      : "",
    examples: examples.length
      ? "Examples of captions that worked (match the quality, not the content):\n" +
        examples.map((e) => `- Photo: ${e.image_description}\n  Caption: ${e.caption}`).join("\n")
      : "",
    previous: "",
  };

  // 3. Log the request.
  const { data: request, error: reqError } = await supabase
    .from("generation_requests")
    .insert({ user_id: opts.userId, chain_id: chainId, source: opts.source })
    .select("id")
    .single();
  if (reqError || !request) throw new Error(reqError?.message ?? "Could not start the generation request.");
  const requestId = request.id as number;

  const promptLog: string[] = [];
  let caption = "";
  let usedModel = "";
  try {
    for (const step of steps) {
      const system = step.system_prompt;
      const user = render(step.user_template, vars);
      promptLog.push(`STEP ${step.step_order}: ${step.name}\nSYSTEM:\n${system}\n\nUSER:\n${user}${step.include_image ? "\n[photo attached]" : ""}`);

      // Try each model once in priority order (a step's own model first), then a
      // second pass if time remains. A slow or overloaded model never blocks the
      // fallbacks behind it.
      const firstPass = [...new Set([...(opts.model ? [opts.model] : []), ...(step.model ? [step.model.model_id] : []), ...modelOrder])];
      const attempts = [...firstPass, ...firstPass];
      let output = "";
      let lastError = "The AI service is busy. Please try again in a minute.";
      for (let i = 0; i < attempts.length && !output; i++) {
        if (Date.now() - started > BUDGET_MS - 15_000) break;
        if (i === firstPass.length) await new Promise((r) => setTimeout(r, 1000));
        const r = await callGemini({
          model: attempts[i],
          system,
          user,
          image: step.include_image ? opts.image : null,
          json: step.output_format === "caption_json",
        });
        let parsed = "";
        if (r.ok) {
          try {
            parsed = step.output_format === "caption_json" ? parseCaption(r.text) : r.text.trim();
          } catch {
            parsed = "";
          }
        }
        await supabase.from("llm_responses").insert({
          request_id: requestId,
          step_id: step.id,
          model: attempts[i],
          http_status: r.status,
          success: !!parsed,
          latency_ms: r.latency,
          input_tokens: r.inputTokens,
          output_tokens: r.outputTokens,
          response_text: r.text.slice(0, 4000),
        });
        if (parsed) {
          output = parsed;
          usedModel = attempts[i];
        } else {
          lastError = r.ok ? "The AI returned something unusable." : r.text.slice(0, 200) || lastError;
          if (r.ok) continue;
          if (![404, 408, 429, 500, 503, 0].includes(r.status)) break;
        }
      }
      if (!output) throw new Error(lastError);
      vars.previous = output;
      if (step.output_format === "caption_json") caption = output;
    }
    if (!caption) throw new Error("The prompt chain never produced a caption.");

    await supabase
      .from("generation_requests")
      .update({ status: "succeeded", latency_ms: Date.now() - started, completed_at: new Date().toISOString() })
      .eq("id", requestId);
    return { caption, model: usedModel, chainId, prompt: promptLog.join("\n\n---\n\n"), requestId };
  } catch (err) {
    await supabase
      .from("generation_requests")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message.slice(0, 500) : "Unknown error",
        latency_ms: Date.now() - started,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    throw err;
  }
}

/** Link a finished request to the generation it produced. */
export async function linkRequest(supabase: SupabaseClient, requestId: number, generationId: string) {
  await supabase.from("generation_requests").update({ generation_id: generationId }).eq("id", requestId);
}
