import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { nyDayKey, pct, type Battle, type Generation, type UserRow } from "@/lib/data";

type Client = Awaited<ReturnType<typeof createClient>>;

type Request = { id: number; status: "pending" | "succeeded" | "failed"; latency_ms: number | null; created_at: string };
type Response = {
  model: string;
  http_status: number | null;
  success: boolean;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};
type Model = { model_id: string; display_name: string | null; input_usd_per_mtok: number | null; output_usd_per_mtok: number | null };

export const SETTING_KEYS = ["daily_post_limit", "monthly_ai_budget_usd"] as const;
export type Settings = Record<(typeof SETTING_KEYS)[number], number>;
const DEFAULTS: Settings = { daily_post_limit: 20, monthly_ai_budget_usd: 10 };

/** Pipeline logs, model prices, and admin settings from the last 31 days. */
export async function loadOps(supabase: Client) {
  const sinceIso = new Date(Date.now() - 31 * 864e5).toISOString();
  const [requests, responses, models, settings] = await Promise.all([
    supabase.from("generation_requests").select("id, status, latency_ms, created_at").gte("created_at", sinceIso),
    supabase
      .from("llm_responses")
      .select("model, http_status, success, latency_ms, input_tokens, output_tokens, created_at")
      .gte("created_at", sinceIso),
    supabase.from("llm_models").select("model_id, display_name, input_usd_per_mtok, output_usd_per_mtok").order("priority"),
    supabase.from("app_settings").select("key, value"),
  ]);
  const firstError = [requests, responses, models, settings].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const s = { ...DEFAULTS };
  for (const row of (settings.data ?? []) as { key: string; value: number }[]) {
    if (row.key in s) s[row.key as keyof Settings] = Number(row.value);
  }
  return {
    requests: (requests.data ?? []) as Request[],
    responses: (responses.data ?? []) as Response[],
    models: (models.data ?? []) as Model[],
    settings: s,
  };
}

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Estimated USD for one call, or null when tokens or prices are unknown. */
function callCost(r: Response, m: Model | undefined) {
  if (r.input_tokens == null || r.output_tokens == null || !m) return null;
  if (m.input_usd_per_mtok == null || m.output_usd_per_mtok == null) return null;
  return (r.input_tokens * Number(m.input_usd_per_mtok) + r.output_tokens * Number(m.output_usd_per_mtok)) / 1e6;
}

export function computeOps(
  ops: Awaited<ReturnType<typeof loadOps>>,
  d: { users: UserRow[]; generations: Generation[]; battles: Battle[] }
) {
  const now = Date.now();
  const weekAgo = now - 7 * 864e5;
  const dayAgo = now - 864e5;
  const month = nyDayKey(new Date(now).toISOString()).slice(0, 7);
  const modelById = new Map(ops.models.map((m) => [m.model_id, m]));

  // Reliability: did people who posted a photo get an AI caption back?
  const week = ops.requests.filter((r) => Date.parse(r.created_at) >= weekAgo && r.status !== "pending");
  const ok = week.filter((r) => r.status === "succeeded");
  const reliability = {
    succeeded: ok.length,
    total: week.length,
    rate: week.length ? pct(ok.length, week.length) : null,
    medianSeconds: median(ok.flatMap((r) => (r.latency_ms == null ? [] : [r.latency_ms / 1000]))),
  };

  // Spend this calendar month (New York time), estimated from token counts and model prices.
  const monthResponses = ops.responses.filter((r) => nyDayKey(r.created_at).slice(0, 7) === month);
  let spend = 0;
  let untracked = 0;
  for (const r of monthResponses) {
    const c = callCost(r, modelById.get(r.model));
    if (c == null) untracked += 1;
    else spend += c;
  }
  const monthCaptions = ops.requests.filter(
    (r) => r.status === "succeeded" && nyDayKey(r.created_at).slice(0, 7) === month
  ).length;
  const budget = ops.settings.monthly_ai_budget_usd;
  const cost = {
    spend,
    budget,
    budgetPct: budget > 0 ? Math.min(100, Math.round((spend / budget) * 100)) : 0,
    perCaption: monthCaptions ? spend / monthCaptions : null,
    untracked,
  };

  // Each model over the last 30 days: calls, success, speed, tokens, cost.
  const byModel = new Map<string, { calls: number; ok: number; latency: number[]; tokensIn: number; tokensOut: number; cost: number }>();
  for (const r of ops.responses) {
    const m = byModel.get(r.model) ?? { calls: 0, ok: 0, latency: [], tokensIn: 0, tokensOut: 0, cost: 0 };
    m.calls += 1;
    if (r.success) m.ok += 1;
    if (r.latency_ms != null) m.latency.push(r.latency_ms / 1000);
    m.tokensIn += r.input_tokens ?? 0;
    m.tokensOut += r.output_tokens ?? 0;
    m.cost += callCost(r, modelById.get(r.model)) ?? 0;
    byModel.set(r.model, m);
  }
  const models = [...byModel.entries()]
    .map(([model, m]) => ({
      model,
      priced: modelById.get(model)?.input_usd_per_mtok != null,
      calls: m.calls,
      successRate: pct(m.ok, m.calls),
      medianSeconds: median(m.latency),
      tokensIn: m.tokensIn,
      tokensOut: m.tokensOut,
      cost: m.cost,
    }))
    .sort((a, b) => b.calls - a.calls);

  // Rate limits: posts in the last 24 hours against the per-user limit, and Gemini pushback.
  const limit = ops.settings.daily_post_limit;
  const postsByUser = new Map<string, number>();
  for (const g of d.generations) {
    if (Date.parse(g.created_at) >= dayAgo) postsByUser.set(g.user_id, (postsByUser.get(g.user_id) ?? 0) + 1);
  }
  const userById = new Map(d.users.map((u) => [u.id, u]));
  const nearLimit = [...postsByUser.entries()]
    .map(([id, posts]) => ({ user: userById.get(id), posts }))
    .sort((a, b) => b.posts - a.posts)
    .slice(0, 4);
  const weekResponses = ops.responses.filter((r) => Date.parse(r.created_at) >= weekAgo);
  const limits = {
    limit,
    postsToday: [...postsByUser.values()].reduce((a, b) => a + b, 0),
    usersAtLimit: [...postsByUser.values()].filter((n) => n >= limit).length,
    nearLimit,
    rateLimited: weekResponses.filter((r) => r.http_status === 429).length,
    overloaded: weekResponses.filter((r) => r.http_status === 503 || r.http_status === 408).length,
  };

  // Engagement: the app only works if people keep voting.
  const battlesWeek = d.battles.filter((b) => Date.parse(b.created_at) >= weekAgo).length;

  return { reliability, cost, models, limits, battlesWeek };
}
