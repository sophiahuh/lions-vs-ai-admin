"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type ImageState = { ok?: string; error?: string };

/**
 * UPDATE an image: the new file is already uploaded (to newPath) by the browser.
 * Point any media using the old file at the new one, then delete the old file.
 */
export async function replaceImage(oldPath: string, newPath: string): Promise<ImageState> {
  const { supabase, user } = await requireAdmin();
  if (!newPath.startsWith(`${user.id}/`)) return { error: "Invalid upload." };
  const newUrl = supabase.storage.from("uploads").getPublicUrl(newPath).data.publicUrl;
  const { error } = await supabase.from("generations").update({ image_path: newPath, image_url: newUrl }).eq("image_path", oldPath);
  if (error) return { error: error.message };
  await supabase.storage.from("uploads").remove([oldPath]);
  revalidatePath("/images");
  revalidatePath("/media");
  return { ok: "Image replaced." };
}

/** DELETE an image that no post uses. */
export async function deleteImage(path: string): Promise<ImageState> {
  const { supabase } = await requireAdmin();
  const { data: used } = await supabase.from("generations").select("id").eq("image_path", path).limit(1);
  if (used?.length) return { error: "This photo is in a post. Delete the post instead, or replace the photo." };
  const { error } = await supabase.storage.from("uploads").remove([path]);
  if (error) return { error: error.message };
  revalidatePath("/images");
  return { ok: "Image deleted." };
}

export async function refreshImages() {
  await requireAdmin();
  revalidatePath("/images");
}
