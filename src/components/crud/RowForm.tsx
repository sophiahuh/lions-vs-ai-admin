"use client";

import { useActionState, useState, useTransition } from "react";
import type { Field } from "@/lib/resources";
import { deleteRow, saveRow, type CrudState } from "./actions";

export type Option = { value: string | number; label: string };

export default function RowForm({
  resourceKey,
  fields,
  options,
  row,
  submitLabel,
}: {
  resourceKey: string;
  fields: Field[];
  options: Record<string, Option[]>;
  row?: Record<string, unknown> & { id: number };
  submitLabel: string;
}) {
  const action = saveRow.bind(null, resourceKey, row?.id ?? null);
  const [state, formAction, pending] = useActionState<CrudState, FormData>(action, {});
  const [delState, setDelState] = useState<CrudState>({});
  const [deleting, startDelete] = useTransition();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const value = row?.[f.name];
        const common = { name: f.name, required: f.required, placeholder: f.placeholder, disabled: pending };
        return (
          <label key={f.name} className={`block ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{f.label}</span>
            {f.type === "textarea" ? (
              <textarea {...common} defaultValue={(value as string) ?? ""} rows={3} className="field mt-1" />
            ) : f.type === "boolean" ? (
              <span className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" name={f.name} defaultChecked={row ? Boolean(value) : true} disabled={pending} className="h-4 w-4 accent-[var(--accent)]" />
                Yes
              </span>
            ) : f.type === "select" ? (
              <select {...common} defaultValue={value == null ? "" : String(value)} className="field mt-1">
                <option value="">Choose…</option>
                {(options[f.name] ?? []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input {...common} type={f.type === "number" ? "number" : "text"} defaultValue={value == null ? "" : String(value)} className="field mt-1" />
            )}
          </label>
        );
      })}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn btn-primary px-4 py-2 text-sm">{pending ? "Saving…" : submitLabel}</button>
        {row && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (!confirm("Delete this row? This can't be undone.")) return;
              startDelete(async () => setDelState(await deleteRow(resourceKey, row.id)));
            }}
            className="btn bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
        {(state.error || delState.error) && <span className="text-sm text-red-600">{state.error || delState.error}</span>}
        {state.ok && !state.error && <span className="text-sm text-human">{state.ok}</span>}
      </div>
    </form>
  );
}
