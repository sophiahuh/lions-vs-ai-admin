"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "./settings-actions";

export default function SettingsForm({ limit, budget }: { limit: number; budget: number }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="font-semibold">Photos per user / day</span>
        <input name="daily_post_limit" type="number" min={0} max={500} defaultValue={limit} className="field mt-1 w-28" />
      </label>
      <label className="text-sm">
        <span className="font-semibold">Monthly AI budget ($)</span>
        <input name="monthly_ai_budget_usd" type="number" min={0} step="any" defaultValue={budget} className="field mt-1 w-28" />
      </label>
      <button disabled={pending} className="btn btn-primary px-4 py-2">{pending ? "Saving…" : "Save"}</button>
      {state.error && <span className="w-full text-sm text-red-600">{state.error}</span>}
      {state.ok && <span className="w-full text-sm text-human">{state.ok}</span>}
    </form>
  );
}
