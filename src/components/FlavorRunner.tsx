"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Call = {
  model: string;
  http_status: number | null;
  success: boolean;
  latency_ms: number | null;
  response_text: string | null;
  step: { step_order: number; name: string } | null;
};
type Result = { caption: string; model: string; requestId: number; calls: Call[] };

/**
 * Runs a flavor on an existing photo through /api/run-flavor.
 * "test" leaves the photo alone; "regenerate" replaces its AI caption.
 */
export default function FlavorRunner(props: {
  mode: "test" | "regenerate";
  models: string[];
  /** Test mode: the flavor is fixed and you pick a photo. */
  chainId?: number;
  photos?: { id: string; image_url: string }[];
  /** Regenerate mode: the photo is fixed and you pick a flavor. */
  generationId?: string;
  chains?: { id: number; name: string }[];
  battles?: number;
}) {
  const router = useRouter();
  const [photo, setPhoto] = useState(props.generationId ?? props.photos?.[0]?.id ?? "");
  const [chain, setChain] = useState(props.chainId ? String(props.chainId) : "");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const regenerate = props.mode === "regenerate";

  async function run() {
    if (regenerate && props.battles && !confirm(`Replace the AI caption? Its ${props.battles} battle${props.battles === 1 ? "" : "s"} and votes are cleared so the new caption starts fresh.`)) return;
    setBusy(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/run-flavor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: props.mode, generationId: photo, chainId: chain || undefined, model: model || undefined }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !data?.caption) return setError(data?.error ?? "Something went wrong.");
    setResult(data);
    if (regenerate) router.refresh();
  }

  if (!regenerate && !props.photos?.length) {
    return <p className="text-sm text-muted">Post a photo first; tests run on existing photos.</p>;
  }

  return (
    <div className="space-y-4">
      {!regenerate && (
        <div>
          <p className="text-sm font-semibold">Photo</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {props.photos!.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPhoto(p.id)}
                className={`shrink-0 overflow-hidden rounded-lg ring-2 ${photo === p.id ? "ring-accent" : "ring-transparent opacity-70 hover:opacity-100"}`}
              >
                <img src={p.image_url} alt="" className="h-16 w-16 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {regenerate && (
          <label className="text-sm">
            <span className="font-semibold">Flavor</span>
            <select value={chain} onChange={(e) => setChain(e.target.value)} className="field mt-1">
              <option value="">By weights</option>
              {props.chains?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="font-semibold">Model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="field mt-1">
            <option value="">As set on each step</option>
            {props.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={run} disabled={busy || !photo} className="btn btn-primary px-4 py-2.5">
          {busy ? "Running… (up to a minute)" : regenerate ? "Regenerate AI caption" : "Run test"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {regenerate ? "New AI caption" : "This flavor wrote"} · {result.model}
          </p>
          <p className="mt-1 font-serif text-lg">“{result.caption}”</p>
          <ol className="mt-3 space-y-1 text-xs">
            {result.calls.map((c, i) => (
              <li key={i}>
                <details>
                  <summary className="cursor-pointer">
                    <span className={c.success ? "text-human" : "text-red-600"}>{c.success ? "✓" : "✗"}</span>{" "}
                    Step {c.step?.step_order}: {c.step?.name} · {c.model} · HTTP {c.http_status ?? "–"} ·{" "}
                    {c.latency_ms != null ? `${(c.latency_ms / 1000).toFixed(1)}s` : "–"}
                  </summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-paper p-2">{c.response_text}</pre>
                </details>
              </li>
            ))}
          </ol>
          <Link href="/requests" className="mt-2 inline-block text-xs text-accent hover:underline">Logged in Caption requests →</Link>
        </div>
      )}
    </div>
  );
}
