"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type MixState = { ok?: string; error?: string };

/** UPDATE the prompt chain mix: one weight (0–100) per chain. */
export async function saveMix(_prev: MixState, formData: FormData): Promise<MixState> {
  const { supabase } = await requireAdmin();
  const updates: { chain_id: number; weight: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("weight_")) continue;
    const weight = Number(value);
    if (!Number.isInteger(weight) || weight < 0 || weight > 100) return { error: "Weights must be whole numbers from 0 to 100." };
    updates.push({ chain_id: Number(key.slice(7)), weight });
  }
  if (!updates.some((u) => u.weight > 0)) return { error: "At least one chain needs a weight above 0." };
  for (const u of updates) {
    const { error } = await supabase
      .from("prompt_chain_mix")
      .update({ weight: u.weight, updated_at: new Date().toISOString() })
      .eq("chain_id", u.chain_id);
    if (error) return { error: error.message };
  }
  revalidatePath("/mix");
  revalidatePath("/chains");
  return { ok: "Mix saved. New photos use these weights right away." };
}
