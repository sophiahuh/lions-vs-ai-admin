"use client";

import { useActionState, useState } from "react";
import { saveMix, type MixState } from "./actions";

export default function MixForm({ rows }: { rows: { chain_id: number; name: string; weight: number }[] }) {
  const [weights, setWeights] = useState(Object.fromEntries(rows.map((r) => [r.chain_id, r.weight])));
  const [state, action, pending] = useActionState<MixState, FormData>(saveMix, {});
  const total = Object.values(weights).reduce((n, w) => n + (Number(w) || 0), 0);

  return (
    <form action={action} className="space-y-5">
      {rows.map((r) => {
        const w = Number(weights[r.chain_id]) || 0;
        const share = total ? Math.round((w / total) * 100) : 0;
        return (
          <div key={r.chain_id}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`w${r.chain_id}`} className="font-semibold">{r.name}</label>
              <span className="text-sm text-muted">{share}% of new photos</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                id={`w${r.chain_id}`}
                type="range"
                min={0}
                max={100}
                value={w}
                onChange={(e) => setWeights({ ...weights, [r.chain_id]: Number(e.target.value) })}
                className="flex-1 accent-[var(--accent)]"
              />
              <input
                name={`weight_${r.chain_id}`}
                type="number"
                min={0}
                max={100}
                value={w}
                onChange={(e) => setWeights({ ...weights, [r.chain_id]: Number(e.target.value) })}
                className="field w-20 text-center"
              />
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn btn-primary px-5 py-2.5">{pending ? "Saving…" : "Save weights"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-human">{state.ok}</span>}
      </div>
    </form>
  );
}
