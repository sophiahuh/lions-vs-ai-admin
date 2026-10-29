"use client";

import { useActionState } from "react";
import {
  addStep,
  createChain,
  deleteChain,
  deleteStep,
  moveStep,
  updateChain,
  updateStep,
  type FormState,
} from "./actions";

export type ModelOption = { id: number; model_id: string };
export type StepRow = {
  id: number;
  step_order: number;
  name: string;
  system_prompt: string;
  user_template: string;
  output_format: "text" | "caption_json";
  include_image: boolean;
  model_id: number | null;
};

function Status({ state }: { state: FormState }) {
  if (state.error) return <span className="text-sm text-red-600">{state.error}</span>;
  if (state.ok) return <span className="text-sm text-human">{state.ok}</span>;
  return null;
}

/** A one-click action (delete, move) with an optional confirm prompt. */
export function ActionButton({
  action,
  label,
  confirmText,
  className = "btn btn-secondary px-3 py-1.5 text-sm",
  disabled,
}: {
  action: (prev: FormState) => Promise<FormState>;
  label: string;
  confirmText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
      className="inline-flex items-center gap-2"
    >
      <button disabled={pending || disabled} className={className}>{pending ? "…" : label}</button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function NewChainForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createChain, {});
  return (
    <form action={action} className="card mt-6 grid gap-3 p-5 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
      <label className="text-sm">
        <span className="font-semibold">New chain name</span>
        <input name="name" required placeholder="Setup, then punchline" className="field mt-1" />
      </label>
      <label className="text-sm">
        <span className="font-semibold">What it does</span>
        <input name="description" placeholder="One line on how this chain writes captions" className="field mt-1" />
      </label>
      <button disabled={pending} className="btn btn-primary px-4 py-2.5">{pending ? "Creating…" : "Create chain"}</button>
      <div className="sm:col-span-3"><Status state={state} /></div>
    </form>
  );
}

export function ChainDetailsForm({ chainId, name, description }: { chainId: number; name: string; description: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateChain.bind(null, chainId), {});
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm">
        <span className="font-semibold">Name</span>
        <input name="name" defaultValue={name} required className="field mt-1" />
      </label>
      <label className="block text-sm">
        <span className="font-semibold">Description</span>
        <textarea name="description" defaultValue={description ?? ""} rows={2} className="field mt-1" />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn btn-primary px-4 py-2">{pending ? "Saving…" : "Save chain"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Edit an existing step, or (without `step`) add a new one at the end of the chain. */
export function StepEditor({ chainId, step, models }: { chainId: number; step?: StepRow; models: ModelOption[] }) {
  const save = step ? updateStep.bind(null, chainId, step.id) : addStep.bind(null, chainId);
  const [state, action, pending] = useActionState<FormState, FormData>(save, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="font-semibold">Step name</span>
        <input name="name" defaultValue={step?.name} required placeholder="Describe the photo" className="field mt-1" />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="font-semibold">Model</span>
          <select name="model_id" defaultValue={step?.model_id ?? ""} className="field mt-1">
            <option value="">By priority (fallback order)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.model_id}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-semibold">Output</span>
          <select name="output_format" defaultValue={step?.output_format ?? "caption_json"} className="field mt-1">
            <option value="text">Notes for the next step</option>
            <option value="caption_json">Final caption</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
          <input type="checkbox" name="include_image" defaultChecked={step?.include_image ?? true} className="h-4 w-4 accent-[var(--accent)]" />
          <span className="font-semibold">Send the photo</span>
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-semibold">System prompt</span>
        <textarea
          name="system_prompt"
          defaultValue={step?.system_prompt}
          required
          rows={10}
          spellCheck={false}
          className="field mt-1 font-mono text-xs leading-relaxed"
        />
      </label>
      <label className="block text-sm">
        <span className="font-semibold">User prompt</span>
        <textarea
          name="user_template"
          defaultValue={step?.user_template}
          required
          rows={4}
          spellCheck={false}
          className="field mt-1 font-mono text-xs leading-relaxed"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn btn-primary px-4 py-2">
          {pending ? "Saving…" : step ? "Save step" : "Add step"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function StepControls({ chainId, stepId, isFirst, isLast }: { chainId: number; stepId: number; isFirst: boolean; isLast: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton action={moveStep.bind(null, chainId, stepId, -1)} label="↑ Move up" disabled={isFirst} />
      <ActionButton action={moveStep.bind(null, chainId, stepId, 1)} label="↓ Move down" disabled={isLast} />
      <ActionButton
        action={deleteStep.bind(null, chainId, stepId)}
        label="Delete step"
        confirmText="Delete this step? This can't be undone."
        className="btn px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
      />
    </div>
  );
}

export function DeleteChainButton({ chainId }: { chainId: number }) {
  return (
    <ActionButton
      action={deleteChain.bind(null, chainId)}
      label="Delete chain"
      confirmText="Delete this chain and all its steps? This can't be undone."
      className="btn px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
    />
  );
}
