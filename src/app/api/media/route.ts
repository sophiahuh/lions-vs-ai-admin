import { NextResponse } from "next/server";
import { linkRequest, runCaptionPipeline } from "@/lib/pipeline";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** CREATE: an admin uploads a photo and Gemini writes its AI caption. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_superadmin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const imagePath = typeof payload?.imagePath === "string" ? payload.imagePath : "";
  const humanCaption = typeof payload?.humanCaption === "string" ? payload.humanCaption.trim().slice(0, 140) : "";
  const words = Number(payload?.words) || 10;
  if (!imagePath.startsWith(`${user.id}/`) || imagePath.includes("..")) {
    return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
  }

  const { data: file, error: dlError } = await supabase.storage.from("uploads").download(imagePath);
  if (dlError || !file || !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Could not read the uploaded photo." }, { status: 400 });
  }

  try {
    const { model, caption, chainId, prompt, requestId } = await runCaptionPipeline(supabase, {
      userId: user.id,
      source: "admin",
      image: { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType: file.type },
      humanCaption,
      words,
    });
    const imageUrl = supabase.storage.from("uploads").getPublicUrl(imagePath).data.publicUrl;
    const { data: gen, error: genError } = await supabase
      .from("generations")
      .insert({ user_id: user.id, image_path: imagePath, image_url: imageUrl, prompt, model, prompt_chain_id: chainId })
      .select("id")
      .single();
    if (genError) throw genError;

    const rows: Record<string, unknown>[] = [{ generation_id: gen.id, author_type: "ai", body: caption }];
    if (humanCaption) rows.push({ generation_id: gen.id, author_type: "human", author_id: user.id, body: humanCaption });
    const { error: capError } = await supabase.from("captions").insert(rows);
    if (capError) {
      await supabase.from("generations").delete().eq("id", gen.id);
      throw capError;
    }
    await linkRequest(supabase, requestId, gen.id);
    return NextResponse.json({ id: gen.id });
  } catch (err) {
    await supabase.storage.from("uploads").remove([imagePath]);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 502 });
  }
}
