/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { fmtDate, requireAdmin, shortName } from "@/lib/admin";

type Req = {
  id: number;
  status: "pending" | "succeeded" | "failed";
  source: string;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
  generation_id: string | null;
  user: { first_name: string | null; last_name: string | null } | null;
  chain: { name: string } | null;
  generation: { image_url: string } | null;
  responses: { id: number; model: string; http_status: number | null; success: boolean; latency_ms: number | null; response_text: string | null; step: { step_order: number; name: string } | null }[];
};

const STATUS: Record<string, string> = {
  succeeded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const { supabase } = await requireAdmin();
  const chainId = Number((await searchParams).chain) || null;
  let query = supabase
    .from("generation_requests")
    .select(
      "id, status, source, error, latency_ms, created_at, generation_id, user:profiles(first_name, last_name), chain:prompt_chains(name), generation:generations(image_url), responses:llm_responses(id, model, http_status, success, latency_ms, response_text, step:prompt_chain_steps(step_order, name))"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (chainId) query = query.eq("chain_id", chainId);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Req[];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Observability</p>
      <h1 className="mt-1 font-serif text-4xl font-bold">Generation requests</h1>
      <p className="mt-1 text-muted">Every attempt to generate an AI caption, newest first. Open one to see each model call it made.</p>
      {chainId && (
        <p className="mt-2 text-sm">
          Showing one chain only. <Link href="/requests" className="font-medium text-accent hover:underline">Show all chains</Link>
        </p>
      )}

      {rows.length === 0 && <p className="card mt-6 p-6 text-center text-muted">No requests yet. They appear as soon as someone posts a photo.</p>}
      <ul className="mt-6 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="card">
            <details>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
                {r.generation?.image_url ? (
                  <img src={r.generation.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-paper text-muted">–</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[r.status]}`}>{r.status}</span>
                <span className="font-medium">{r.chain?.name ?? "Unknown chain"}</span>
                <span className="text-muted">{shortName(r.user?.first_name, r.user?.last_name)} · {r.source}</span>
                <span className="text-muted">{fmtDate(r.created_at)}</span>
                <span className="ml-auto tabular-nums text-muted">
                  {r.responses.length} call{r.responses.length === 1 ? "" : "s"} · {r.latency_ms != null ? `${(r.latency_ms / 1000).toFixed(1)}s` : "–"}
                </span>
              </summary>
              <div className="border-t border-line p-4">
                {r.error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{r.error}</p>}
                {r.generation_id && (
                  <Link href={`/media/${r.generation_id}`} className="text-sm font-medium text-accent hover:underline">
                    Open the media this produced →
                  </Link>
                )}
                <ol className="mt-3 space-y-2">
                  {[...r.responses].sort((a, b) => a.id - b.id).map((resp) => (
                    <li key={resp.id} className="rounded-lg border border-line p-3 text-sm">
                      <p className="flex flex-wrap gap-x-3">
                        <span className="font-semibold">{resp.step ? `Step ${resp.step.step_order}: ${resp.step.name}` : "Step"}</span>
                        <span className="font-mono text-xs">{resp.model}</span>
                        <span className={resp.success ? "text-human" : "text-red-600"}>
                          {resp.success ? "✓ used" : "✗ failed"} · HTTP {resp.http_status ?? "–"}
                        </span>
                        <span className="text-muted">{resp.latency_ms != null ? `${(resp.latency_ms / 1000).toFixed(1)}s` : ""}</span>
                      </p>
                      {resp.response_text && (
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-paper p-2 text-xs">{resp.response_text}</pre>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
