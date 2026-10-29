import Link from "next/link";
import { notFound } from "next/navigation";
import FlavorRunner from "@/components/FlavorRunner";
import { requireAdmin } from "@/lib/admin";
import { pct } from "@/lib/data";
import { ChainDetailsForm, DeleteChainButton, StepControls, StepEditor, type ModelOption, type StepRow } from "../ChainForms";

const PLACEHOLDERS: [string, string][] = [
  ["{{length}}", "Target caption length in words: the human caption's length, clamped to 3–25."],
  ["{{casing}}", "“Write it in all lowercase.” when the human caption is lowercase, otherwise normal capitalization."],
  ["{{terms}}", "The active Columbia terms with definitions, or nothing when there are none."],
  ["{{examples}}", "Up to 8 active example captions with photo descriptions, or nothing."],
  ["{{previous}}", "The output of the step before this one. Empty in step 1."],
];

export default async function FlavorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const { supabase } = await requireAdmin();
  const [{ data: chain }, { data: steps }, { data: mix }, { data: models }, { data: reqs }, { data: photos }] = await Promise.all([
    supabase.from("prompt_chains").select("id, name, description").eq("id", id).maybeSingle(),
    supabase
      .from("prompt_chain_steps")
      .select("id, step_order, name, system_prompt, user_template, output_format, include_image, model_id")
      .eq("chain_id", id)
      .order("step_order"),
    supabase.from("prompt_chain_mix").select("chain_id, weight"),
    supabase.from("llm_models").select("id, model_id, is_active").order("priority"),
    supabase.from("generation_requests").select("status").eq("chain_id", id),
    supabase.from("generations").select("id, image_url").not("image_path", "is", null).order("created_at", { ascending: false }).limit(12),
  ]);
  if (!chain) notFound();

  const rows = (steps ?? []) as StepRow[];
  const modelOptions = (models ?? []) as (ModelOption & { is_active: boolean })[];
  const modelName = new Map(modelOptions.map((m) => [m.id, m.model_id]));
  const weights = (mix ?? []) as { chain_id: number; weight: number }[];
  const weight = weights.find((w) => w.chain_id === id)?.weight ?? 0;
  const totalWeight = weights.reduce((n, w) => n + w.weight, 0);
  const runs = reqs ?? [];
  const failed = runs.filter((r) => r.status === "failed").length;
  const finalStep = rows.findLast((s) => s.output_format === "caption_json");
  const activeFallbacks = modelOptions.filter((m) => m.is_active).map((m) => m.model_id);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/chains" className="text-sm font-medium text-accent hover:underline">← All flavors</Link>
      <h1 className="mt-2 font-serif text-4xl font-bold">{chain.name}</h1>
      {chain.description && <p className="mt-1 max-w-3xl text-muted">{chain.description}</p>}

      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 text-sm">
        <div>
          <dt className="text-muted">Share of new photos</dt>
          <dd className="mt-0.5 font-semibold">
            <Link href="/chains" className="text-accent hover:underline">{totalWeight ? pct(weight, totalWeight) : 0}%</Link>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Steps</dt>
          <dd className="mt-0.5 font-semibold">{rows.length}</dd>
        </div>
        <div>
          <dt className="text-muted">Runs</dt>
          <dd className="mt-0.5 font-semibold">
            <Link href={`/requests?chain=${id}`} className="text-accent hover:underline">
              {runs.length} run{runs.length === 1 ? "" : "s"}{failed ? ` · ${failed} failed` : ""}
            </Link>
          </dd>
        </div>
      </dl>

      {rows.length > 0 && !finalStep && (
        <p className="mt-5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          No step outputs a final caption, so this flavor will fail every run. Set the last step&apos;s output to “Final caption”.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section>
            <h2 className="font-serif text-2xl font-bold">Steps, in the order they run</h2>
            <p className="mt-0.5 text-sm text-muted">
              {rows.length} call{rows.length === 1 ? "" : "s"} to the model per photo, plus fallback calls when a model is busy.
              Saved changes apply to the very next photo.
            </p>
          </section>

          <section className="card border-accent/40 p-5">
            <h2 className="font-serif text-xl font-bold">Test this flavor</h2>
            <p className="mb-4 mt-0.5 text-sm text-muted">
              Runs this flavor on a photo that&apos;s already posted and shows what every step returned. Nothing on the photo
              changes; the run is logged in Caption requests.
            </p>
            <FlavorRunner
              mode="test"
              chainId={id}
              photos={(photos ?? []) as { id: string; image_url: string }[]}
              models={activeFallbacks}
            />
          </section>

          {rows.map((step, i) => (
            <section key={step.id} className="card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl font-bold">Step {step.step_order}</h3>
                  <p className="text-sm text-muted">
                    {step.include_image ? "Photo and text" : "Text only"} in →{" "}
                    {step.output_format === "caption_json" ? "final caption" : "notes for the next step"} ·{" "}
                    {step.model_id ? modelName.get(step.model_id) : "model by priority"}
                  </p>
                </div>
                <StepControls chainId={id} stepId={step.id} isFirst={i === 0} isLast={i === rows.length - 1} />
              </div>
              <StepEditor key={`${step.id}-${step.step_order}`} chainId={id} step={step} models={modelOptions} />
            </section>
          ))}

          <details className="card p-5" open={rows.length === 0}>
            <summary className="cursor-pointer font-serif text-xl font-bold">+ Add a step</summary>
            <div className="mt-4">
              <StepEditor key={`new-${rows.length}`} chainId={id} models={modelOptions} />
            </div>
          </details>

          <section className="card p-5">
            <h2 className="font-serif text-xl font-bold">Flavor details</h2>
            <div className="mt-4">
              <ChainDetailsForm chainId={id} name={chain.name} description={chain.description} />
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <DeleteChainButton chainId={id} />
              <p className="mt-1 text-xs text-muted">Only possible when its weight is 0.</p>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-2xl border border-accent/30 bg-cu-blue-soft p-4 text-sm">
            <h2 className="font-semibold">Fallback</h2>
            <p className="mt-1 text-muted">
              Each step tries its own model first, then every active model in priority order
              {activeFallbacks.length ? ` (${activeFallbacks.join(" → ")})` : ""}, then retries the list once.
              Change the order on <Link href="/models" className="underline">Models &amp; prices</Link>.
            </p>
          </section>
          <section className="card p-4 text-sm">
            <h2 className="font-semibold">Placeholders</h2>
            <p className="mt-1 text-muted">Filled in for each photo before the prompt is sent. Use them in either prompt.</p>
            <dl className="mt-3 space-y-3">
              {PLACEHOLDERS.map(([name, desc]) => (
                <div key={name}>
                  <dt className="font-mono text-xs font-semibold">{name}</dt>
                  <dd className="mt-0.5 text-muted">{desc}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
