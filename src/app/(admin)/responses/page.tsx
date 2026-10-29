import Link from "next/link";
import { fmtDate, requireAdmin } from "@/lib/admin";
import { pct } from "@/lib/data";

type Resp = {
  id: number;
  request_id: number;
  model: string;
  http_status: number | null;
  success: boolean;
  latency_ms: number | null;
  response_text: string | null;
  created_at: string;
  step: { step_order: number; name: string } | null;
};

export default async function ResponsesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("llm_responses")
    .select("id, request_id, model, http_status, success, latency_ms, response_text, created_at, step:prompt_chain_steps(step_order, name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Resp[];

  const byModel = new Map<string, { calls: number; ok: number; ms: number }>();
  for (const r of rows) {
    const m = byModel.get(r.model) ?? { calls: 0, ok: 0, ms: 0 };
    m.calls += 1;
    if (r.success) {
      m.ok += 1;
      m.ms += r.latency_ms ?? 0;
    }
    byModel.set(r.model, m);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Observability</p>
      <h1 className="mt-1 font-serif text-4xl font-bold">LLM responses</h1>
      <p className="mt-1 text-muted">Every raw model call, including failures and fallbacks. Latest 200.</p>

      {byModel.size > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[...byModel.entries()].map(([model, m]) => (
            <div key={model} className="card p-4">
              <p className="font-mono text-sm font-semibold">{model}</p>
              <p className="mt-1 font-serif text-3xl font-bold">{pct(m.ok, m.calls)}%</p>
              <p className="text-xs text-muted">
                success · {m.calls} calls · avg {m.ok ? (m.ms / m.ok / 1000).toFixed(1) : "–"}s when it works
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr><th>When</th><th>Request</th><th>Step</th><th>Model</th><th>Result</th><th>Time</th><th>Response</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted">No model calls logged yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-muted">{fmtDate(r.created_at)}</td>
                <td><Link href="/requests" className="text-accent hover:underline">#{r.request_id}</Link></td>
                <td className="whitespace-nowrap">{r.step ? `${r.step.step_order}. ${r.step.name}` : "–"}</td>
                <td className="whitespace-nowrap font-mono text-xs">{r.model}</td>
                <td className={`whitespace-nowrap font-semibold ${r.success ? "text-human" : "text-red-600"}`}>
                  {r.success ? "✓" : "✗"} {r.http_status ?? "–"}
                </td>
                <td className="whitespace-nowrap tabular-nums text-muted">{r.latency_ms != null ? `${(r.latency_ms / 1000).toFixed(1)}s` : "–"}</td>
                <td className="max-w-96 truncate text-xs text-muted" title={r.response_text ?? ""}>{r.response_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
