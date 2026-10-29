"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type SettingsState = { ok?: string; error?: string };

/** UPDATE the per-user posting limit and the monthly AI budget. */
export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { supabase } = await requireAdmin();
  const limit = Number(formData.get("daily_post_limit"));
  const budget = Number(formData.get("monthly_ai_budget_usd"));
  if (!Number.isInteger(limit) || limit < 0 || limit > 500) return { error: "The daily limit must be a whole number from 0 to 500." };
  if (!Number.isFinite(budget) || budget < 0) return { error: "The budget must be a dollar amount of 0 or more." };

  const updated_at = new Date().toISOString();
  for (const [key, value] of [["daily_post_limit", limit], ["monthly_ai_budget_usd", budget]] as const) {
    const { data, error } = await supabase.from("app_settings").update({ value, updated_at }).eq("key", key).select("key");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Settings table is missing. Run supabase/week7-ops.sql first." };
  }
  revalidatePath("/");
  return { ok: "Saved. The new limit applies to the next photo anyone posts." };
}
