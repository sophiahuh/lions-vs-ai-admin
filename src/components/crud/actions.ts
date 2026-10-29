"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { getResource, type Resource } from "@/lib/resources";

export type CrudState = { ok?: string; error?: string };

function readValues(resource: Resource, formData: FormData) {
  const values: Record<string, unknown> = {};
  for (const f of resource.fields) {
    const raw = formData.get(f.name);
    if (f.type === "boolean") {
      values[f.name] = raw === "on";
      continue;
    }
    let text = String(raw ?? "").trim();
    if (f.lowercase) text = text.toLowerCase();
    if (!text) {
      if (f.required) throw new Error(`${f.label} is required.`);
      values[f.name] = null;
      continue;
    }
    if (f.type === "number" || f.type === "select") {
      const n = Number(text);
      if (!Number.isFinite(n)) throw new Error(`${f.label} must be a number.`);
      values[f.name] = n;
    } else values[f.name] = text;
  }
  return values;
}

function friendly(message: string) {
  if (/duplicate key/i.test(message)) return "That already exists.";
  if (/violates check constraint/i.test(message)) return "That value isn't allowed. Check the format.";
  if (/foreign key/i.test(message)) return "This is still used elsewhere, so it can't be removed.";
  return message;
}

export async function saveRow(key: string, id: number | null, _prev: CrudState, formData: FormData): Promise<CrudState> {
  const { supabase } = await requireAdmin();
  const resource = getResource(key);
  if (!resource) return { error: "Unknown table." };
  try {
    const values = readValues(resource, formData);
    const { error } = id
      ? await supabase.from(resource.table).update(values).eq("id", id)
      : await supabase.from(resource.table).insert(values);
    if (error) return { error: friendly(error.message) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
  revalidatePath(`/${key}`);
  return { ok: id ? "Saved." : `Added.` };
}

export async function deleteRow(key: string, id: number): Promise<CrudState> {
  const { supabase } = await requireAdmin();
  const resource = getResource(key);
  if (!resource) return { error: "Unknown table." };
  const { error } = await supabase.from(resource.table).delete().eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/${key}`);
  return { ok: "Deleted." };
}
