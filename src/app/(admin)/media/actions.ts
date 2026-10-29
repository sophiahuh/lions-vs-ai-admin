"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

export type FormState = { ok?: boolean; error?: string };

/** UPDATE: the poster's context note. AI captions change only by regenerating (see /api/run-flavor). */
export async function updateMedia(generationId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const context = String(formData.get("context") ?? "").trim();
  if (context.length > 280) return { error: "Keep the note under 280 characters." };
  const { error } = await supabase.from("generations").update({ context: context || null }).eq("id", generationId);
  if (error) return { error: error.message };
  revalidatePath(`/media/${generationId}`);
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
