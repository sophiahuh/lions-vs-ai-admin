/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { fmtDay, requireAdmin, shortName } from "@/lib/admin";
import { loadAll, pct } from "@/lib/data";

type Filter = "all" | "ai" | "lions" | "none";
const FILTERS: [Filter, string][] = [
  ["all", "All photos"],
  ["ai", "AI winning"],
  ["lions", "Lions winning"],
  ["none", "No battles yet"],
];

export default async function RatingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; show?: string }> }) {
  const { tab, show } = await searchParams;
  const view = tab === "log" ? "log" : "photos";
  const filter = (FILTERS.find(([k]) => k === show)?.[0] ?? "all") as Filter;
  const { supabase } = await requireAdmin();
  const d = await loadAll(supabase);

  const userById = new Map(d.users.map((u) => [u.id, u]));
  const capById = new Map(d.captions.map((c) => [c.id, c]));
  const genById = new Map(d.generations.map((g) => [g.id, g]));
  const who = (id: string | null) => {
    const u = id ? userById.get(id) : undefined;
    return shortName(u?.first_name, u?.last_name);
  };

  // One bucket per photo: its AI caption, each human caption, and how their battles went.
  const photos = d.generations
    .map((g) => {
      const caps = d.captions.filter((c) => c.generation_id === g.id);
      const battles = d.battles.filter((b) => b.generation_id === g.id);
      const aiWins = battles.filter((b) => b.winner === "ai").length;
      return {
        g,
        ai: caps.find((c) => c.author_type === "ai"),
        humans: caps
          .filter((c) => c.author_type === "human")
          .map((h) => {
            const bs = battles.filter((b) => b.human_caption_id === h.id);
            return { h, battles: bs.length, wins: bs.filter((b) => b.winner === "human").length };
          })
          .sort((a, b) => b.battles - a.battles),
        battles: battles.length,
        aiWins,
        lionWins: battles.length - aiWins,
      };
    })
    .filter((p) =>
      filter === "all"
        ? true
        : filter === "none"
          ? p.battles === 0
          : filter === "ai"
            ? p.battles > 0 && p.aiWins > p.lionWins
            : p.battles > 0 && p.lionWins > p.aiWins
    )
    .sort((a, b) => b.battles - a.battles);

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? "bg-navy text-white" : "text-muted hover:bg-cu-blue-soft"}`;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Content</p>
      <h1 className="mt-1 font-serif text-4xl font-bold">Ratings</h1>
      <p className="mt-1 text-muted">How each photo&apos;s captions are doing in blind battles, and every vote behind it. Read-only.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/votes" className={chip(view === "photos")}>By photo</Link>
        <Link href="/votes?tab=log" className={chip(view === "log")}>Every vote</Link>
      </div>

      {view === "photos" ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            {FILTERS.map(([key, label]) => (
              <Link key={key} href={key === "all" ? "/votes" : `/votes?show=${key}`} className={chip(filter === key)}>{label}</Link>
            ))}
          </div>
          {photos.length === 0 && <p className="card mt-4 p-6 text-center text-muted">No photos match.</p>}
          <ul className="mt-4 space-y-3">
            {photos.map((p) => (
              <li key={p.g.id} className="card grid gap-4 p-4 sm:grid-cols-[96px_1fr_180px]">
                <Link href={`/media/${p.g.id}`}>
                  <img src={p.g.image_url} alt="" className="h-24 w-24 rounded-lg bg-cu-blue-soft object-cover" />
                </Link>
                <div className="min-w-0 space-y-2 text-sm">
                  <p>
                    <span className="mr-2 text-xs font-bold text-chart-ai">🤖 AI</span>
                    {p.ai?.body ?? <span className="text-muted">No AI caption</span>}
                    {p.ai && <span className="ml-2 text-xs text-muted">▲{p.ai.upvotes} ▼{p.ai.downvotes}</span>}
                  </p>
                  {p.humans.map(({ h, battles, wins }) => (
                    <p key={h.id}>
                      <span className="mr-2 text-xs font-bold text-chart-human">🦁 {who(h.author_id)}</span>
                      {h.body}
                      <span className="ml-2 text-xs text-muted">
                        {battles ? `beat the AI ${wins} of ${battles}` : "no battles yet"} · ▲{h.upvotes} ▼{h.downvotes}
                      </span>
                    </p>
                  ))}
                  <p className="text-xs text-muted">Posted {fmtDay(p.g.created_at)}</p>
                </div>
                <div className="self-center">
                  {p.battles ? (
                    <>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-chart-human">Lions {p.lionWins}</span>
                        <span className="text-chart-ai">AI {p.aiWins}</span>
                      </div>
                      <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-chart-grid">
                        <div className="bg-chart-human" style={{ width: `${pct(p.lionWins, p.battles)}%` }} />
                        <div className="bg-chart-ai" style={{ width: `${pct(p.aiWins, p.battles)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted">{p.battles} battle{p.battles === 1 ? "" : "s"}</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted">No battles yet</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="table min-w-[820px]">
            <thead>
              <tr><th>Photo</th><th>Caption</th><th>Voter</th><th>Vote</th><th>Date</th></tr>
            </thead>
            <tbody>
              {d.battles.length + d.votes.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted">No votes yet.</td></tr>
              )}
              {d.battles.map((b) => {
                const picked = capById.get(b.winner === "human" ? b.human_caption_id : b.ai_caption_id);
                return (
                  <tr key={`b${b.id}`}>
                    <td><Thumb href={`/media/${b.generation_id}`} src={genById.get(b.generation_id)?.image_url} /></td>
                    <td className="max-w-96">
                      <span className="text-muted">Picked: </span>
                      {picked?.body}
                    </td>
                    <td className="whitespace-nowrap">{who(b.user_id)}</td>
                    <td className="whitespace-nowrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${b.winner === "human" ? "bg-chart-human" : "bg-chart-ai"}`}>
                        {b.winner === "human" ? "🦁 Lions win" : "🤖 AI wins"}
                      </span>
                      {b.changed_at && <span className="ml-2 text-xs text-muted">switched</span>}
                    </td>
                    <td className="whitespace-nowrap text-muted">{fmtDay(b.created_at)}</td>
                  </tr>
                );
              })}
              {d.votes
                .filter((v) => v.source !== "matchup")
                .map((v) => {
                  const c = capById.get(v.caption_id);
                  return (
                    <tr key={`v${v.id}`}>
                      <td><Thumb href={c ? `/media/${c.generation_id}` : undefined} src={c ? genById.get(c.generation_id)?.image_url : undefined} /></td>
                      <td className="max-w-96">
                        <span className="text-muted">{c?.author_type === "ai" ? "🤖 " : "🦁 "}</span>
                        {c?.body ?? "Deleted caption"}
                      </td>
                      <td className="whitespace-nowrap">{who(v.user_id)}</td>
                      <td className="whitespace-nowrap font-semibold">{v.value > 0 ? "▲ Up" : "▼ Down"}</td>
                      <td className="whitespace-nowrap text-muted">{fmtDay(v.created_at)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Thumb({ href, src }: { href?: string; src?: string }) {
  if (!src) return <span className="block h-10 w-10 rounded bg-chart-grid" />;
  const img = <img src={src} alt="" className="h-10 w-10 rounded object-cover" />;
  return href ? <Link href={href}>{img}</Link> : img;
}
