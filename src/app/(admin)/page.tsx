import Link from "next/link";
import Avatar from "@/components/Avatar";
import { requireAdmin, shortName } from "@/lib/admin";
import { loadAll } from "@/lib/data";
import { computeOps, loadOps } from "@/lib/ops";
import { computeStats } from "@/lib/stats";
import SettingsForm from "./SettingsForm";

function usd(n: number) {
  if (n === 0) return "$0.00";
  return n < 0.01 ? `$${n.toPrecision(2)}` : `$${n.toFixed(2)}`;
}

function Kpi({ label, value, sub, warn, children }: { label: string; value: string; sub?: string; warn?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`card p-4 ${warn ? "ring-2 ring-red-400" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-serif text-3xl font-bold tabular-nums ${warn ? "text-red-600" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      {children}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * The app is only worth something if three things hold: photos get an AI caption back,
 * the AI bill stays affordable, and nobody is blocked by limits. Everything here answers one of those.
 */
export default async function Dashboard() {
  const { supabase } = await requireAdmin();
  const [data, opsData] = await Promise.all([loadAll(supabase), loadOps(supabase)]);
  const t = computeStats(data).totals;
  const { reliability: rel, cost, models, limits, battlesWeek } = computeOps(opsData, data);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-1 font-serif text-3xl font-bold">Is the app healthy?</h1>
        <p className="mt-1 text-sm text-muted">Captions getting generated, AI costs in budget, and nobody stuck at a limit.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Caption success · 7 days"
          value={rel.rate == null ? "–" : `${rel.rate}%`}
          sub={rel.total ? `${rel.succeeded} of ${rel.total}${rel.medianSeconds != null ? ` · median ${rel.medianSeconds.toFixed(1)}s` : ""}` : "No caption requests yet"}
          warn={rel.rate != null && rel.rate < 90}
        />
        <Kpi
          label="AI spend · this month"
          value={usd(cost.spend)}
          sub={`of ${usd(cost.budget)} budget${cost.perCaption != null ? ` · ${usd(cost.perCaption)}/caption` : ""}`}
          warn={cost.budget > 0 && cost.spend >= cost.budget}
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chart-grid">
            <div className={`h-full ${cost.budgetPct >= 80 ? "bg-red-500" : "bg-chart-human"}`} style={{ width: `${cost.budgetPct}%` }} />
          </div>
        </Kpi>
        <Kpi
          label="Photos posted · 24 hours"
          value={String(limits.postsToday)}
          sub={`Limit ${limits.limit}/user · ${limits.usersAtLimit} at the limit`}
          warn={limits.usersAtLimit > 0}
        />
        <Kpi
          label="Battles · 7 days"
          value={String(battlesWeek)}
          sub={t.battles ? `Lions ${t.humanWins}–${t.aiWins} AI all time (${t.humanPct}%)` : "No battles yet"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <Panel title="Rate limits" subtitle="Changes apply to the next photo anyone posts">
          <SettingsForm limit={limits.limit} budget={cost.budget} />

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">Closest to the limit · 24 hours</p>
          {limits.nearLimit.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No one has posted in the last 24 hours.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {limits.nearLimit.map(({ user, posts }, i) => {
                const name = shortName(user?.first_name, user?.last_name);
                const share = limits.limit ? Math.min(100, Math.round((posts / limits.limit) * 100)) : 100;
                return (
                  <li key={user?.id ?? i} className="flex items-center gap-3">
                    <Avatar url={user?.avatar_url} name={name} size={24} />
                    <span className="w-28 truncate text-sm">{name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-chart-grid">
                      <div className={`h-full ${posts >= limits.limit ? "bg-red-500" : "bg-chart-human"}`} style={{ width: `${share}%` }} />
                    </div>
                    <span className="w-12 text-right text-sm tabular-nums">{posts}/{limits.limit}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-5 text-sm">
            <span className="font-semibold">Gemini pushback · 7 days:</span>{" "}
            <span className={limits.rateLimited ? "text-red-600" : "text-muted"}>{limits.rateLimited} rate-limited (429)</span>
            <span className="text-muted"> · {limits.overloaded} overloaded or timed out</span>
          </p>
        </Panel>

        <Panel title="Models: cost & reliability" subtitle="Every Gemini call in the last 30 days, including fallbacks">
          {models.length === 0 ? (
            <p className="text-sm text-muted">No model calls yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted">
                    <th className="pb-2 font-semibold">Model</th>
                    <th className="pb-2 text-right font-semibold">Calls</th>
                    <th className="pb-2 text-right font-semibold">Success</th>
                    <th className="pb-2 text-right font-semibold">Median</th>
                    <th className="pb-2 text-right font-semibold">Tokens in / out</th>
                    <th className="pb-2 text-right font-semibold">Est. cost</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {models.map((m) => (
                    <tr key={m.model} className="border-t border-chart-grid">
                      <td className="py-2 font-medium">{m.model}</td>
                      <td className="py-2 text-right">{m.calls}</td>
                      <td className={`py-2 text-right ${m.successRate < 50 ? "text-red-600" : ""}`}>{m.successRate}%</td>
                      <td className="py-2 text-right">{m.medianSeconds == null ? "–" : `${m.medianSeconds.toFixed(1)}s`}</td>
                      <td className="py-2 text-right">{m.tokensIn.toLocaleString()} / {m.tokensOut.toLocaleString()}</td>
                      <td className="py-2 text-right">{m.priced ? usd(m.cost) : <Link href="/models" className="text-accent underline">set price</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-muted">
            Costs are estimates at Gemini&apos;s paid list prices, which you can edit on{" "}
            <Link href="/models" className="underline">LLM models</Link>. On the free tier the real bill is $0.
            {cost.untracked > 0 && ` ${cost.untracked} call${cost.untracked === 1 ? "" : "s"} this month predate token tracking and aren't counted.`}
          </p>
        </Panel>
      </div>
    </div>
  );
}
