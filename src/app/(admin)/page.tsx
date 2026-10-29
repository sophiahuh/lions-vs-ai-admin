import { DailyBattles, Legend, PercentBars } from "@/components/charts";
import { requireAdmin } from "@/lib/admin";
import { loadAll, pct } from "@/lib/data";
import { computeStats } from "@/lib/stats";

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
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

/** One screen, no scrolling: the score, four headline counts, and two charts. */
export default async function Dashboard() {
  const { supabase } = await requireAdmin();
  const data = await loadAll(supabase);
  const s = computeStats(data);
  const t = s.totals;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-1 font-serif text-3xl font-bold">Who&apos;s winning?</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[3fr_4fr]">
        <section className="flex flex-col justify-between rounded-2xl bg-navy p-6 text-white">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cu-blue">Lions</p>
              <p className="font-serif text-6xl font-bold tabular-nums">{t.humanWins}</p>
            </div>
            <p className="pb-3 font-serif text-xl italic text-white/50">vs.</p>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff9a73]">AI</p>
              <p className="font-serif text-6xl font-bold tabular-nums">{t.aiWins}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/70">
            {t.battles
              ? `Columbia students win ${t.humanPct}% of blind battles against the AI.`
              : "No battles yet."}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <Kpi label="Users" value={t.users} sub={`${t.admins} admin${t.admins === 1 ? "" : "s"}`} />
          <Kpi label="Photos" value={t.photos} sub={`${t.humanCaptions} human captions`} />
          <Kpi label="Battles" value={t.battles} sub={`${t.switched} pick${t.switched === 1 ? "" : "s"} switched`} />
          <Kpi label="Votes" value={t.votes} sub={`${t.upvotes} up · ${t.votes - t.upvotes} down`} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Battles per day" subtitle="Last 14 days, New York time">
          <div className="mb-3"><Legend /></div>
          <DailyBattles days={s.days} />
        </Panel>

        <Panel title="Model scoreboard" subtitle="How often each Gemini model's caption beats the human">
          {s.models.length === 0 ? (
            <p className="text-sm text-muted">No AI captions yet.</p>
          ) : (
            <PercentBars
              color="ai"
              rows={s.models.map((m) => ({
                label: m.model,
                value: pct(m.aiWins, m.battles),
                detail: `${m.photos} photo${m.photos === 1 ? "" : "s"} · AI won ${m.aiWins} of ${m.battles} battles`,
              }))}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
