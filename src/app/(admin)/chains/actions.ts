"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

export type FormState = { ok?: string; error?: string };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function refresh(chainId?: number) {
  revalidatePath("/chains");
  revalidatePath("/mix");
  if (chainId) revalidatePath(`/chains/${chainId}`);
}

function friendly(message: string) {
  if (/duplicate key/i.test(message)) return "A chain with that name already exists.";
  return message;
}

/** CREATE a chain (with a 0 mix weight, so it doesn't run until an admin turns it on). */
export async function createChain(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const name = text(fd, "name");
  if (!name) return { error: "Give the chain a name." };
  const { data, error } = await supabase
    .from("prompt_chains")
    .insert({ name, description: text(fd, "description") || null })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  await supabase.from("prompt_chain_mix").insert({ chain_id: data.id, weight: 0 });
  refresh();
  redirect(`/chains/${data.id}`);
}

/** UPDATE a chain's name and description. */
export async function updateChain(chainId: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const name = text(fd, "name");
  if (!name) return { error: "The chain needs a name." };
  const { error } = await supabase
    .from("prompt_chains")
    .update({ name, description: text(fd, "description") || null })
    .eq("id", chainId);
  if (error) return { error: friendly(error.message) };
  refresh(chainId);
  return { ok: "Saved." };
}

/** DELETE a chain and its steps. Blocked while the mix still sends photos to it. */
export async function deleteChain(chainId: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { data: mix } = await supabase.from("prompt_chain_mix").select("weight").eq("chain_id", chainId).maybeSingle();
  if ((mix?.weight ?? 0) > 0) return { error: "Set this chain's weight to 0 in the chain mix before deleting it." };
  const { error } = await supabase.from("prompt_chains").delete().eq("id", chainId);
  if (error) return { error: error.message };
  refresh();
  redirect("/chains");
}

function readStep(fd: FormData) {
  const name = text(fd, "name");
  const system_prompt = String(fd.get("system_prompt") ?? "").trim();
  const user_template = String(fd.get("user_template") ?? "").trim();
  const output_format = text(fd, "output_format");
  const model = text(fd, "model_id");
  if (!name) return { error: "The step needs a name." };
  if (!system_prompt || !user_template) return { error: "Both the system prompt and the user prompt are required." };
  if (output_format !== "text" && output_format !== "caption_json") return { error: "Pick what this step outputs." };
  return {
    values: {
      name,
      system_prompt,
      user_template,
      output_format,
      include_image: fd.get("include_image") === "on",
      model_id: model ? Number(model) : null,
    },
  };
}

/** CREATE a step at the end of the chain. */
export async function addStep(chainId: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const parsed = readStep(fd);
  if (!parsed.values) return { error: parsed.error };
  const { data: last } = await supabase
    .from("prompt_chain_steps")
    .select("step_order")
    .eq("chain_id", chainId)
    .order("step_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("prompt_chain_steps")
    .insert({ ...parsed.values, chain_id: chainId, step_order: (last?.step_order ?? 0) + 1 });
  if (error) return { error: error.message };
  refresh(chainId);
  return { ok: "Step added." };
}

/** UPDATE one step's prompts and settings. */
export async function updateStep(chainId: number, stepId: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const parsed = readStep(fd);
  if (!parsed.values) return { error: parsed.error };
  const { error } = await supabase.from("prompt_chain_steps").update(parsed.values).eq("id", stepId).eq("chain_id", chainId);
  if (error) return { error: error.message };
  refresh(chainId);
  return { ok: "Saved. The next photo uses this version." };
}

/** Renumber a chain's steps 1..n in their current order. */
async function renumber(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], chainId: number) {
  const { data } = await supabase.from("prompt_chain_steps").select("id, step_order").eq("chain_id", chainId).order("step_order");
  for (const [i, s] of (data ?? []).entries()) {
    if (s.step_order !== i + 1) await supabase.from("prompt_chain_steps").update({ step_order: i + 1 }).eq("id", s.id);
  }
}

/** DELETE a step and close the gap in the numbering. */
export async function deleteStep(chainId: number, stepId: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("prompt_chain_steps").delete().eq("id", stepId).eq("chain_id", chainId);
  if (error) return { error: error.message };
  await renumber(supabase, chainId);
  refresh(chainId);
  return { ok: "Step deleted." };
}

/** Swap a step with its neighbor. step_order is unique per chain, so park one at 0 first. */
export async function moveStep(chainId: number, stepId: number, direction: -1 | 1): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("prompt_chain_steps").select("id, step_order").eq("chain_id", chainId).order("step_order");
  const steps = data ?? [];
  const i = steps.findIndex((s) => s.id === stepId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= steps.length) return {};
  const [a, b] = [steps[i], steps[j]];
  for (const [id, order] of [[a.id, 0], [b.id, a.step_order], [a.id, b.step_order]] as const) {
    const { error } = await supabase.from("prompt_chain_steps").update({ step_order: order }).eq("id", id);
    if (error) return { error: error.message };
  }
  refresh(chainId);
  return {};
}
