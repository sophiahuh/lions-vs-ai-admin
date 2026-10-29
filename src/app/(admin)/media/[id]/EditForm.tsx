"use client";

import { useActionState } from "react";
import { updateMedia, type FormState } from "../actions";

/** The poster's own note is the only hand-editable part of a post. */
export default function EditForm(props: { generationId: string; context: string }) {
  const action = updateMedia.bind(null, props.generationId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="card space-y-3 p-5">
      <label className="block">
        <span className="font-serif text-xl font-bold">Context note</span>
        <span className="mt-0.5 block text-sm text-muted">Optional background the poster gave for the photo.</span>
        <input name="context" defaultValue={props.context} className="field mt-2" placeholder="None" />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn btn-primary px-4 py-2">{pending ? "Saving…" : "Save note"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-human">Saved.</span>}
      </div>
    </form>
  );
}
