import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { pct } from "@/lib/data";
import { NewChainForm } from "./ChainForms";

type Step = {
  id: number;
  step_order: number;
  name: string;
  system_prompt: string;
  user_template: string;
  output_format: string;
  include_image: boolean;
  model: { model_id: string } | null;
};
type Chain = { id: number; name: string; description: string | null; steps: Step[]; mix: { weight: number } | null };

export default async function ChainsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: chains }, { data: gens }, { data: battles }, { data: reqs }] = await Promise.all([
    supabase
      .from("prompt_chains")
      .select("id, name, description, mix:prompt_chain_mix(weight), steps:prompt_chain_steps(id, step_order, name, system_prompt, user_template, output_format, include_image, model:llm_models(model_id))")
      .order("id"),
    supabase.from("generations").select("id, prompt_chain_id"),
    supabase.from("battles").select("generation_id, winner"),
    supabase.from("generation_requests").select("chain_id, status, latency_ms"),
  ]);

  const chainOf = new Map((gens ?? []).map((g) => [g.id as string, g.prompt_chain_id as number | null]));
  const stats = (id: number) => {
    const bs = (battles ?? []).filter((b) => chainOf.get(b.generation_id as string) === id);
    const rs = (reqs ?? []).filter((r) => r.chain_id === id);
    const ok = rs.filter((r) => r.status === "succeeded");
    const avg = ok.length ? Math.round(ok.reduce((n, r) => n + (r.latency_ms ?? 0), 0) / ok.length / 100) / 10 : null;
    return {
      photos: [...chainOf.values()].filter((c) => c === id).length,
      battles: bs.length,
      aiWins: bs.filter((b) => b.winner === "ai").length,
      requests: rs.length,
      failed: rs.filter((r) => r.status === "failed").length,
      avgSeconds: avg,
    };
  };

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Pipeline</p>
      <h1 className="mt-1 font-serif text-4xl font-bold">Prompt chains</h1>
      <p className="mt-1 text-muted">
        Each chain is a sequence of model calls that turns a photo into an AI caption. The{" "}
        <Link href="/mix" className="font-medium text-accent hover:underline">chain mix</Link> decides which chain each new photo uses.
        Open a chain to edit its prompts.
      </p>

      <NewChainForm />

      <div className="mt-6 space-y-6">
        {((chains ?? []) as unknown as Chain[]).map((c) => {
          const s = stats(c.id);
          const mix = Array.isArray(c.mix) ? c.mix[0] : c.mix;
          return (
            <section key={c.id} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-2xl font-bold">
                  <Link href={`/chains/${c.id}`} className="hover:underline">{c.name}</Link>
                </h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-cu-blue-soft px-3 py-1 text-sm font-semibold">Mix weight {mix?.weight ?? 0}</span>
                  <Link href={`/chains/${c.id}`} className="btn btn-primary px-4 py-1.5 text-sm">Edit prompts</Link>
                </div>
              </div>
              {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}

              <dl className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
                {[
                  ["Photos", s.photos],
                  ["Requests", s.requests],
                  ["Failed", s.failed],
                  ["Avg. time", s.avgSeconds == null ? "–" : `${s.avgSeconds}s`],
                  ["AI win rate", s.battles ? `${pct(s.aiWins, s.battles)}%` : "–"],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl bg-paper p-3">
                    <dd className="font-serif text-2xl font-bold">{value}</dd>
                    <dt className="text-xs text-muted">{label}</dt>
                  </div>
                ))}
              </dl>

              <ol className="mt-5 space-y-2">
                {[...c.steps].sort((a, b) => a.step_order - b.step_order).map((step) => (
                  <li key={step.id} className="rounded-xl border border-line px-4 py-3 text-sm">
                    <span className="font-semibold">Step {step.step_order}: {step.name}</span>
                    <span className="text-muted">
                      {" "}· {step.output_format === "caption_json" ? "final caption" : "notes for the next step"} · photo{" "}
                      {step.include_image ? "attached" : "not attached"} · {step.model?.model_id ?? "model by priority"}
                    </span>
                  </li>
                ))}
                {c.steps.length === 0 && <li className="text-sm text-muted">No steps yet. Open the chain to add one.</li>}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
