import Avatar from "@/components/Avatar";
import { fmtDate, requireAdmin, shortName } from "@/lib/admin";
import { loadAll } from "@/lib/data";

export default async function UsersPage() {
  const { supabase } = await requireAdmin();
  const d = await loadAll(supabase);

  const posts = new Map<string, number>();
  for (const g of d.generations) posts.set(g.user_id, (posts.get(g.user_id) ?? 0) + 1);
  const captions = new Map<string, number>();
  for (const c of d.captions) if (c.author_id) captions.set(c.author_id, (captions.get(c.author_id) ?? 0) + 1);
  const decided = new Map<string, number>();
  for (const b of d.battles) decided.set(b.user_id, (decided.get(b.user_id) ?? 0) + 1);
  const capAuthor = new Map(d.captions.map((c) => [c.id, c.author_id]));
  const record = new Map<string, { wins: number; battles: number }>();
  for (const b of d.battles) {
    const author = capAuthor.get(b.human_caption_id);
    if (!author) continue;
    const r = record.get(author) ?? { wins: 0, battles: 0 };
    r.battles += 1;
    if (b.winner === "human") r.wins += 1;
    record.set(author, r);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Users</p>
      <h1 className="mt-1 font-serif text-4xl font-bold">Profiles</h1>
      <p className="mt-1 text-muted">{d.users.length} accounts. Read-only.</p>

      <div className="card mt-6 overflow-x-auto">
        <table className="table min-w-[860px]">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Last sign-in</th>
              <th className="text-right">Photos</th>
              <th className="text-right">Captions</th>
              <th className="text-right">Votes cast</th>
              <th className="text-right">Record vs. AI</th>
            </tr>
          </thead>
          <tbody>
            {d.users.map((u) => {
              const name = shortName(u.first_name, u.last_name);
              const r = record.get(u.id);
              return (
                <tr key={u.id}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Avatar url={u.avatar_url} name={name} size={30} />
                      <span className="font-medium">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "Unnamed user"}</span>
                    </span>
                  </td>
                  <td className="text-muted">{u.email}</td>
                  <td>
                    {u.is_superadmin ? (
                      <span className="rounded bg-[#d9480f] px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white">ADMIN</span>
                    ) : (
                      <span className="text-xs text-muted">Member</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-muted">{fmtDate(u.created_at)}</td>
                  <td className="whitespace-nowrap text-muted">{fmtDate(u.last_sign_in_at)}</td>
                  <td className="text-right tabular-nums">{posts.get(u.id) ?? 0}</td>
                  <td className="text-right tabular-nums">{captions.get(u.id) ?? 0}</td>
                  <td className="text-right tabular-nums">{decided.get(u.id) ?? 0}</td>
                  <td className="text-right tabular-nums">{r ? `${r.wins}–${r.battles - r.wins}` : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
