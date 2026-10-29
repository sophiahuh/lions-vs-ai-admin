/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import FlavorRunner from "@/components/FlavorRunner";
import { fmtDay, requireAdmin, shortName } from "@/lib/admin";
import { deleteCaption, deleteMedia } from "../actions";
import EditForm from "./EditForm";

type Cap = {
  id: string;
  author_type: "ai" | "human";
  author_id: string | null;
  body: string;
  upvotes: number;
  downvotes: number;
  author: { first_name: string | null; last_name: string | null } | null;
};

export default async function MediaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const { data: gen } = await supabase
    .from("generations")
    .select(
      "id, image_url, image_path, context, prompt, model, created_at, flavor:prompt_chains(name), poster:profiles(first_name, last_name), captions(id, author_type, author_id, body, upvotes, downvotes, author:profiles(first_name, last_name))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!gen) notFound();

  const [{ data: battles }, { data: chains }, { data: models }] = await Promise.all([
    supabase.from("battles").select("human_caption_id, winner").eq("generation_id", id),
    supabase.from("prompt_chains").select("id, name").order("id"),
    supabase.from("llm_models").select("model_id").eq("is_active", true).order("priority"),
  ]);
  const flavor = gen.flavor as unknown as { name: string } | null;
  const caps = gen.captions as unknown as Cap[];
  const ai = caps.find((c) => c.author_type === "ai");
  const humans = caps.filter((c) => c.author_type === "human");
  const poster = gen.poster as unknown as { first_name: string | null; last_name: string | null } | null;
  const recordFor = (hid: string) => {
    const bs = (battles ?? []).filter((b) => b.human_caption_id === hid);
    return { wins: bs.filter((b) => b.winner === "human").length, total: bs.length };
  };
  const removeMedia = deleteMedia.bind(null, gen.id);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/media" className="text-sm text-muted hover:underline">← Posts</Link>
      <h1 className="mt-3 font-serif text-3xl font-bold">Post</h1>
      <p className="mt-1 text-sm text-muted">
        Posted by {shortName(poster?.first_name, poster?.last_name)} · {fmtDay(gen.created_at)}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <img src={gen.image_url} alt="" className="card w-full bg-cu-blue-soft object-contain" />
          <section className="card p-5">
            <h2 className="font-serif text-xl font-bold">Human captions ({humans.length})</h2>
            {humans.length === 0 ? (
              <p className="mt-2 text-sm text-muted">None yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {humans.map((h) => {
                  const r = recordFor(h.id);
                  const remove = deleteCaption.bind(null, gen.id, h.id);
                  return (
                    <li key={h.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm">{h.body}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {shortName(h.author?.first_name, h.author?.last_name)} · {r.total ? `beat the AI ${r.wins} of ${r.total}` : "no battles yet"} · ▲{h.upvotes} ▼{h.downvotes}
                        </p>
                      </div>
                      <form action={remove}>
                        <button className="text-xs text-red-600 hover:underline">Remove</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card space-y-4 p-5">
            <h2 className="font-serif text-xl font-bold">AI caption</h2>
            {ai ? (
              <>
                <p className="rounded-xl bg-paper p-4 font-serif text-lg">“{ai.body}”</p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted">Flavor</dt>
                    <dd className="font-medium">{flavor?.name ?? "Before flavors existed"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Model</dt>
                    <dd className="font-mono text-xs">{gen.model}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Battles on this caption</dt>
                    <dd className="font-medium">
                      {(battles ?? []).length} · AI won {(battles ?? []).filter((b) => b.winner === "ai").length}
                    </dd>
                  </div>
                </dl>
                <details className="text-sm">
                  <summary className="cursor-pointer text-accent">Prompt that wrote it</summary>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-paper p-3 text-xs">{gen.prompt}</pre>
                </details>
              </>
            ) : (
              <p className="text-sm text-muted">This photo has no AI caption yet.</p>
            )}
            <div className="border-t border-line pt-4">
              <p className="text-sm text-muted">
                AI captions aren&apos;t typed by hand. To change one, rerun a flavor or a different model on this photo.
              </p>
              <div className="mt-3">
                <FlavorRunner
                  mode="regenerate"
                  generationId={gen.id}
                  chains={(chains ?? []) as { id: number; name: string }[]}
                  models={(models ?? []).map((m) => m.model_id as string)}
                  battles={(battles ?? []).length}
                />
              </div>
            </div>
          </section>
          <EditForm generationId={gen.id} context={gen.context ?? ""} />
          <section className="card border-red-200 p-5">
            <h2 className="font-serif text-xl font-bold text-red-700">Delete</h2>
            <p className="mt-1 text-sm text-muted">Removes the photo, all its captions, votes, and battles. This can&apos;t be undone.</p>
            <form action={removeMedia} className="mt-3">
              <button className="btn bg-red-600 px-4 py-2 text-white hover:bg-red-700">Delete this post</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
