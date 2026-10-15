import "server-only";
import { nyDayKey, nyHour, pct, wordCount, type Battle, type Caption, type Generation, type UserRow, type Vote } from "@/lib/data";

/** Last `n` calendar days in New York time, oldest first, as YYYY-MM-DD keys. */
export function lastDays(n: number) {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(nyDayKey(new Date(now - i * 864e5).toISOString()));
  return out;
}

export function computeStats(d: {
  users: UserRow[];
  generations: Generation[];
  captions: Caption[];
  battles: Battle[];
  votes: Vote[];
}) {
  const capById = new Map(d.captions.map((c) => [c.id, c]));
  const userById = new Map(d.users.map((u) => [u.id, u]));
  const genById = new Map(d.generations.map((g) => [g.id, g]));

  const humanWins = d.battles.filter((b) => b.winner === "human").length;
  const aiWins = d.battles.length - humanWins;

  // Battles per day, split by winner.
  const days = lastDays(14).map((day) => ({ day, human: 0, ai: 0 }));
  const dayIdx = new Map(days.map((x, i) => [x.day, i]));
  for (const b of d.battles) {
    const i = dayIdx.get(nyDayKey(b.created_at));
    if (i !== undefined) days[i][b.winner] += 1;
  }

  // Does length matter? Human win rate by the human caption's word count.
  const buckets = [
    { label: "1–5 words", min: 1, max: 5 },
    { label: "6–10 words", min: 6, max: 10 },
    { label: "11–15 words", min: 11, max: 15 },
    { label: "16+ words", min: 16, max: Infinity },
  ].map((b) => ({ ...b, battles: 0, wins: 0 }));
  for (const b of d.battles) {
    const h = capById.get(b.human_caption_id);
    if (!h) continue;
    const n = wordCount(h.body);
    const bucket = buckets.find((x) => n >= x.min && n <= x.max);
    if (!bucket) continue;
    bucket.battles += 1;
    if (b.winner === "human") bucket.wins += 1;
  }

  // Model scoreboard: AI win rate per Gemini model.
  const models = new Map<string, { model: string; photos: number; battles: number; aiWins: number }>();
  for (const g of d.generations) {
    const m = models.get(g.model) ?? { model: g.model, photos: 0, battles: 0, aiWins: 0 };
    m.photos += 1;
    models.set(g.model, m);
  }
  for (const b of d.battles) {
    const g = genById.get(b.generation_id);
    const m = g && models.get(g.model);
    if (!m) continue;
    m.battles += 1;
    if (b.winner === "ai") m.aiWins += 1;
  }

  // Activity by hour (New York): posts plus battles decided.
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const g of d.generations) hours[nyHour(g.created_at)].count += 1;
  for (const b of d.battles) hours[nyHour(b.created_at)].count += 1;

  // Caption leaderboards by battle record.
  const record = new Map<string, { wins: number; battles: number }>();
  const bump = (id: string, won: boolean) => {
    const r = record.get(id) ?? { wins: 0, battles: 0 };
    r.battles += 1;
    if (won) r.wins += 1;
    record.set(id, r);
  };
  for (const b of d.battles) {
    bump(b.human_caption_id, b.winner === "human");
    bump(b.ai_caption_id, b.winner === "ai");
  }
  const ranked = (type: "ai" | "human") =>
    [...record.entries()]
      .map(([id, r]) => ({ caption: capById.get(id), ...r }))
      .filter((x) => x.caption?.author_type === type && x.wins > 0)
      .sort((a, b) => b.wins - a.wins || b.wins / b.battles - a.wins / a.battles)
      .slice(0, 5)
      .map((x) => ({
        ...x,
        author: x.caption?.author_id ? userById.get(x.caption.author_id) : undefined,
        image: x.caption ? genById.get(x.caption.generation_id)?.image_url : undefined,
      }));

  // Most active voters by battles decided.
  const voterCounts = new Map<string, number>();
  for (const b of d.battles) voterCounts.set(b.user_id, (voterCounts.get(b.user_id) ?? 0) + 1);
  const voters = [...voterCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ user: userById.get(id), battles: n }));

  return {
    totals: {
      users: d.users.length,
      admins: d.users.filter((u) => u.is_superadmin).length,
      photos: d.generations.length,
      humanCaptions: d.captions.filter((c) => c.author_type === "human").length,
      aiCaptions: d.captions.filter((c) => c.author_type === "ai").length,
      battles: d.battles.length,
      votes: d.votes.length,
      upvotes: d.votes.filter((v) => v.value > 0).length,
      humanWins,
      aiWins,
      humanPct: pct(humanWins, d.battles.length),
    },
    days,
    buckets,
    models: [...models.values()].sort((a, b) => b.photos - a.photos),
    hours,
    toughestAi: ranked("ai"),
    bestHuman: ranked("human"),
    voters,
  };
}
