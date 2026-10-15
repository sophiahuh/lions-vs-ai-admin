/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { fmtDate, requireAdmin, shortName } from "@/lib/admin";
import { loadAll } from "@/lib/data";

export default async function VotesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const showVotes = tab === "votes";
  const { supabase } = await requireAdmin();
  const d = await loadAll(supabase);

  const userById = new Map(d.users.map((u) => [u.id, u]));
  const capById = new Map(d.captions.map((c) => [c.id, c]));
  const genById = new Map(d.generations.map((g) => [g.id, g]));
  const who = (id: string) => {
    const u = userById.get(id);
    return shortName(u?.first_name, u?.last_name);
  };
  const tabCls = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? "bg-navy text-white" : "text-muted hover:bg-cu-blue-soft"}`;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Votes</p>
      <h1 className="mt-1 font-serif text-4xl font-bold">Ratings</h1>
      <p className="mt-1 text-muted">Every battle and every up/down vote. Read-only.</p>

      <div className="mt-5 flex gap-2">
        <Link href="/votes" className={tabCls(!showVotes)}>Battles ({d.battles.length})</Link>
        <Link href="/votes?tab=votes" className={tabCls(showVotes)}>Up/down votes ({d.votes.length})</Link>
      </div>

      <div className="card mt-4 overflow-x-auto">
        {!showVotes ? (
          <table className="table min-w-[860px]">
            <thead>
              <tr><th>When</th><th>Voter</th><th>Photo</th><th>Human caption</th><th>AI caption</th><th>Winner</th></tr>
            </thead>
            <tbody>
              {d.battles.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted">No battles yet.</td></tr>
              )}
              {d.battles.map((b) => (
                <tr key={b.id}>
                  <td className="whitespace-nowrap text-muted">{fmtDate(b.created_at)}</td>
                  <td className="whitespace-nowrap">{who(b.user_id)}</td>
                  <td>
                    <Link href={`/media/${b.generation_id}`}>
                      <img src={genById.get(b.generation_id)?.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                    </Link>
                  </td>
                  <td className={`max-w-64 ${b.winner === "human" ? "font-semibold" : "text-muted"}`}>{capById.get(b.human_caption_id)?.body}</td>
                  <td className={`max-w-64 ${b.winner === "ai" ? "font-semibold" : "text-muted"}`}>{capById.get(b.ai_caption_id)?.body}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${b.winner === "human" ? "bg-chart-human" : "bg-chart-ai"}`}>
                      {b.winner === "human" ? "🦁 Lions" : "🤖 AI"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="table min-w-[760px]">
            <thead>
              <tr><th>When</th><th>Voter</th><th>Caption</th><th>Author</th><th>Vote</th><th>Source</th></tr>
            </thead>
            <tbody>
              {d.votes.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted">No votes yet.</td></tr>
              )}
              {d.votes.map((v) => {
                const c = capById.get(v.caption_id);
                return (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap text-muted">{fmtDate(v.created_at)}</td>
                    <td className="whitespace-nowrap">{who(v.user_id)}</td>
                    <td className="max-w-80">
                      {c ? <Link href={`/media/${c.generation_id}`} className="hover:underline">{c.body}</Link> : "Deleted caption"}
                    </td>
                    <td className="whitespace-nowrap text-muted">{c?.author_type === "ai" ? "🤖 AI" : c?.author_id ? who(c.author_id) : "–"}</td>
                    <td className="font-semibold">{v.value > 0 ? "▲ Up" : "▼ Down"}</td>
                    <td className="text-muted">{v.source === "matchup" ? "Battle" : "Direct"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
