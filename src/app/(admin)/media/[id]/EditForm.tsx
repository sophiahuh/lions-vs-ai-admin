"use client";

import { useActionState } from "react";
import { updateMedia, type FormState } from "../actions";

export default function EditForm(props: {
  generationId: string;
  aiCaptionId: string;
  body: string;
  prompt: string;
  model: string;
  context: string;
}) {
  const action = updateMedia.bind(null, props.generationId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h2 className="font-serif text-xl font-bold">Edit AI media</h2>
      <input type="hidden" name="ai_caption_id" value={props.aiCaptionId} />
      <label className="block">
        <span className="text-sm font-medium">AI caption</span>
        <textarea name="body" defaultValue={props.body} maxLength={140} rows={2} className="field mt-1 resize-none" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Context</span>
        <input name="context" defaultValue={props.context} className="field mt-1" placeholder="Optional" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Model</span>
        <input name="model" defaultValue={props.model} className="field mt-1 font-mono text-sm" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Prompt</span>
        <textarea name="prompt" defaultValue={props.prompt} rows={8} className="field mt-1 font-mono text-xs" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-human">Saved.</p>}
      <button disabled={pending} className="btn btn-primary px-5 py-2.5">{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
