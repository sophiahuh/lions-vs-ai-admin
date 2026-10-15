/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate, requireAdmin, shortName } from "@/lib/admin";
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
      "id, image_url, image_path, context, prompt, model, created_at, poster:profiles(first_name, last_name), captions(id, author_type, author_id, body, upvotes, downvotes, author:profiles(first_name, last_name))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!gen) notFound();

  const { data: battles } = await supabase.from("battles").select("human_caption_id, winner").eq("generation_id", id);
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
      <Link href="/media" className="text-sm text-muted hover:underline">← AI media</Link>
      <h1 className="mt-3 font-serif text-3xl font-bold">AI media</h1>
      <p className="mt-1 text-sm text-muted">
        Posted by {shortName(poster?.first_name, poster?.last_name)} · {fmtDate(gen.created_at)}
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
          {ai ? (
            <EditForm
              generationId={gen.id}
              aiCaptionId={ai.id}
              body={ai.body}
              prompt={gen.prompt}
              model={gen.model}
              context={gen.context ?? ""}
            />
          ) : (
            <p className="card p-5 text-sm text-muted">This photo has no AI caption.</p>
          )}
          <section className="card border-red-200 p-5">
            <h2 className="font-serif text-xl font-bold text-red-700">Delete</h2>
            <p className="mt-1 text-sm text-muted">Removes the photo, all its captions, votes, and battles. This can&apos;t be undone.</p>
            <form action={removeMedia} className="mt-3">
              <button className="btn bg-red-600 px-4 py-2 text-white hover:bg-red-700">Delete this media</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
