/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { fmtDay, requireAdmin, shortName } from "@/lib/admin";
import { loadAll } from "@/lib/data";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const { supabase } = await requireAdmin();
  const d = await loadAll(supabase);
  const userById = new Map(d.users.map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Content · AI media</p>
          <h1 className="mt-1 font-serif text-4xl font-bold">Posts</h1>
          <p className="mt-1 text-muted">
            {d.generations.length} posts. Each is a photo with one AI caption and the students&apos; captions it battles.
          </p>
        </div>
        <Link href="/media/new" className="btn btn-primary px-4 py-2.5">+ New post</Link>
      </div>
      {deleted && <p className="mt-4 rounded-lg border border-line bg-cu-blue-soft p-3 text-sm">Deleted.</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {d.generations.map((g) => {
          const caps = d.captions.filter((c) => c.generation_id === g.id);
          const ai = caps.find((c) => c.author_type === "ai");
          const humans = caps.filter((c) => c.author_type === "human").length;
          const battles = d.battles.filter((b) => b.generation_id === g.id);
          const aiWins = battles.filter((b) => b.winner === "ai").length;
          const poster = userById.get(g.user_id);
          return (
            <Link key={g.id} href={`/media/${g.id}`} className="card group overflow-hidden transition hover:border-accent">
              <img src={g.image_url} alt="" className="aspect-[4/3] w-full bg-cu-blue-soft object-cover" />
              <div className="p-4">
                <p className="text-xs font-semibold text-chart-ai">🤖 AI caption</p>
                <p className="mt-0.5 line-clamp-2 text-sm leading-snug">{ai?.body ?? "Missing AI caption"}</p>
                <p className="mt-3 text-xs text-muted">
                  {humans} human · {battles.length} battle{battles.length === 1 ? "" : "s"}
                  {battles.length > 0 && ` · AI ${aiWins}–${battles.length - aiWins}`}
                </p>
                <p className="text-xs text-muted">
                  {shortName(poster?.first_name, poster?.last_name)} · {fmtDay(g.created_at)} · {g.model}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
