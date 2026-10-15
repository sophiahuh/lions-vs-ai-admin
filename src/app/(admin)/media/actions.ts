"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

export type FormState = { ok?: boolean; error?: string };

/** UPDATE: edit the AI caption text and the saved generation details. */
export async function updateMedia(generationId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const aiCaptionId = String(formData.get("ai_caption_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const context = String(formData.get("context") ?? "").trim();

  if (!body || body.length > 140) return { error: "The AI caption must be 1 to 140 characters." };
  if (!prompt || !model) return { error: "Prompt and model can't be empty." };

  const { error: capError } = await supabase.from("captions").update({ body }).eq("id", aiCaptionId).eq("author_type", "ai");
  if (capError) return { error: capError.message };
  const { error: genError } = await supabase
    .from("generations")
    .update({ prompt, model, context: context || null })
    .eq("id", generationId);
  if (genError) return { error: genError.message };

  revalidatePath(`/media/${generationId}`);
  revalidatePath("/media");
  return { ok: true };
}

/** DELETE: remove a generation (captions, votes, and battles cascade) and its photo. */
export async function deleteMedia(generationId: string) {
  const { supabase } = await requireAdmin();
  const { data: gen } = await supabase.from("generations").select("image_path").eq("id", generationId).maybeSingle();
  const { error } = await supabase.from("generations").delete().eq("id", generationId);
  if (error) throw new Error(error.message);
  if (gen?.image_path) await supabase.storage.from("uploads").remove([gen.image_path]);
  revalidatePath("/media");
  redirect("/media?deleted=1");
}

/** Moderation: remove one human caption (its votes and battles cascade). */
export async function deleteCaption(generationId: string, captionId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("captions").delete().eq("id", captionId).eq("author_type", "human");
  if (error) throw new Error(error.message);
  revalidatePath(`/media/${generationId}`);
}
