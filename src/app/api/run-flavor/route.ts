import { NextResponse } from "next/server";
import { linkRequest, runCaptionPipeline } from "@/lib/pipeline";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Runs a flavor on an existing photo.
 * - mode "test": shows what the flavor writes; nothing on the photo changes.
 * - mode "regenerate": replaces the photo's AI caption. Its old battles and votes go with it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_superadmin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const mode = body?.mode === "regenerate" ? "regenerate" : "test";
  const generationId = typeof body?.generationId === "string" ? body.generationId : "";
  const chainId = Number(body?.chainId) || undefined;
  const model = typeof body?.model === "string" && body.model ? body.model : undefined;

  const { data: gen } = await supabase
    .from("generations")
    .select("id, image_path, captions(id, author_type, body)")
    .eq("id", generationId)
    .maybeSingle();
  if (!gen?.image_path) return NextResponse.json({ error: "That photo can't be found." }, { status: 404 });

  const { data: file } = await supabase.storage.from("uploads").download(gen.image_path);
  if (!file) return NextResponse.json({ error: "Could not read the photo file." }, { status: 400 });

  const caps = (gen.captions ?? []) as { id: string; author_type: string; body: string }[];
  const human = caps.find((c) => c.author_type === "human")?.body ?? null;
  const oldAi = caps.find((c) => c.author_type === "ai");

  try {
    const result = await runCaptionPipeline(supabase, {
      userId: user.id,
      source: "admin",
      image: { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType: file.type || "image/jpeg" },
      humanCaption: human,
      chainId,
      model,
    });

    if (mode === "regenerate") {
      if (oldAi) {
        const { error } = await supabase.from("captions").delete().eq("id", oldAi.id);
        if (error) throw error;
      }
      const { error: insertError } = await supabase
        .from("captions")
        .insert({ generation_id: gen.id, author_type: "ai", body: result.caption });
      if (insertError) throw insertError;
      await supabase
        .from("generations")
        .update({ prompt: result.prompt, model: result.model, prompt_chain_id: result.chainId })
        .eq("id", gen.id);
      await linkRequest(supabase, result.requestId, gen.id);
    }

    const { data: calls } = await supabase
      .from("llm_responses")
      .select("model, http_status, success, latency_ms, response_text, step:prompt_chain_steps(step_order, name)")
      .eq("request_id", result.requestId)
      .order("id");
    return NextResponse.json({ caption: result.caption, model: result.model, requestId: result.requestId, calls: calls ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 502 });
  }
}
