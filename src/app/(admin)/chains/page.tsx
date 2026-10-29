import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { pct } from "@/lib/data";
import MixForm from "../mix/MixForm";
import { NewChainForm } from "./ChainForms";

type Step = {
  id: number;
  step_order: number;
  name: string;
  output_format: string;
  include_image: boolean;
  model: { model_id: string } | null;
};
type Chain = { id: number; name: string; description: string | null; steps: Step[]; mix: { weight: number } | { weight: number }[] | null };

export default async function FlavorsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: chains }, { data: battles }, { data: reqs }] = await Promise.all([
    supabase
      .from("prompt_chains")
      .select("id, name, description, mix:prompt_chain_mix(weight), steps:prompt_chain_steps(id, step_order, name, output_format, include_image, model:llm_models(model_id))")
      .order("id"),
    supabase.from("battles").select("generation_id, winner"),
    supabase.from("generation_requests").select("chain_id, status, latency_ms, generation_id"),
  ]);
  const list = ((chains ?? []) as unknown as Chain[]).map((c) => ({
    ...c,
    weight: (Array.isArray(c.mix) ? c.mix[0] : c.mix)?.weight ?? 0,
  }));
  const totalWeight = list.reduce((n, c) => n + c.weight, 0);

  // Only count what each flavor actually ran. Photos posted before flavors existed have no request log.
  const stats = (id: number) => {
    const rs = (reqs ?? []).filter((r) => r.chain_id === id);
    const ok = rs.filter((r) => r.status === "succeeded");
    const photos = new Set(ok.map((r) => r.generation_id).filter(Boolean));
    const bs = (battles ?? []).filter((b) => photos.has(b.generation_id));
    const avg = ok.length ? Math.round(ok.reduce((n, r) => n + (r.latency_ms ?? 0), 0) / ok.length / 100) / 10 : null;
    return {
      runs: rs.length,
      failed: rs.length - ok.length,
      photos: photos.size,
      avgSeconds: avg,
      aiWinRate: bs.length ? `${pct(bs.filter((b) => b.winner === "ai").length, bs.length)}%` : "–",
    };
  };

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Caption writing · prompt chains</p>
      <h1 className="mt-1 font-serif text-4xl font-bold">Flavors</h1>
      <p className="mt-1 text-muted">
        A flavor is one recipe for writing the AI caption: a fixed sequence of model calls, each with its own prompt.
        Every new photo gets exactly one flavor, picked at random using the weights below.
      </p>

      <section className="card mt-6 p-5">
        <h2 className="font-serif text-xl font-bold">Weights</h2>
        <p className="mb-4 mt-0.5 text-sm text-muted">Which flavor writes each new photo&apos;s caption. Set a flavor to 0 to switch it off.</p>
        <MixForm rows={list.map((c) => ({ chain_id: c.id, name: c.name, weight: c.weight }))} />
      </section>

      <div className="mt-6 space-y-4">
        {list.map((c) => {
          const s = stats(c.id);
          const share = totalWeight ? pct(c.weight, totalWeight) : 0;
          const steps = [...c.steps].sort((a, b) => a.step_order - b.step_order);
          return (
            <section key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl font-bold">
                    <Link href={`/chains/${c.id}`} className="hover:underline">{c.name}</Link>
                  </h2>
                  {c.description && <p className="mt-0.5 text-sm text-muted">{c.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-cu-blue-soft px-3 py-1 text-sm font-semibold">{share}% of new photos</span>
                  <Link href={`/chains/${c.id}`} className="btn btn-primary px-4 py-1.5 text-sm">Edit &amp; test</Link>
                </div>
              </div>

              {share > 0 && s.runs === 0 && (
                <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  This flavor gets {share}% of new photos but has never run. Open it and use “Test this flavor” to make sure it works.
                </p>
              )}

              <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {steps.map((step, i) => (
                  <li key={step.id} className="flex items-center gap-2">
                    {i > 0 && <span className="text-muted">→</span>}
                    <span className="rounded-lg border border-line px-3 py-1.5">
                      <span className="font-semibold">{step.step_order}. {step.name}</span>
                      <span className="text-muted"> · {step.include_image ? "sees photo" : "text only"}</span>
                    </span>
                  </li>
                ))}
                {steps.length > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="text-muted">→</span>
                    <span className="font-semibold text-chart-ai">caption</span>
                  </li>
                )}
                {steps.length === 0 && <li className="text-muted">No steps yet.</li>}
              </ol>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
                {[
                  ["Runs", s.runs],
                  ["Failed", s.failed],
                  ["Photos captioned", s.photos],
                  ["Avg. time", s.avgSeconds == null ? "–" : `${s.avgSeconds}s`],
                  ["AI win rate", s.aiWinRate],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl bg-paper p-3">
                    <dd className="font-serif text-2xl font-bold">{value}</dd>
                    <dt className="text-xs text-muted">{label}</dt>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>

      <h2 className="mt-8 font-serif text-xl font-bold">New flavor</h2>
      <NewChainForm />
    </div>
  );
}
