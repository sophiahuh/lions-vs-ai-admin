/* eslint-disable @next/next/no-img-element */
import Avatar from "@/components/Avatar";
import { DailyBattles, HourStrip, Legend, PercentBars } from "@/components/charts";
import { requireAdmin, shortName } from "@/lib/admin";
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

export default async function Dashboard() {
  const { supabase } = await requireAdmin();
  const data = await loadAll(supabase);
  const s = computeStats(data);
  const t = s.totals;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-1 font-serif text-4xl font-bold">Who&apos;s winning?</h1>
        <p className="mt-1 text-muted">Live numbers from the Lions vs. AI database.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Users" value={t.users} sub={`${t.admins} admin${t.admins === 1 ? "" : "s"}`} />
        <Kpi label="Photos" value={t.photos} sub="each with one AI caption" />
        <Kpi label="Captions" value={t.humanCaptions + t.aiCaptions} sub={`${t.humanCaptions} human · ${t.aiCaptions} AI`} />
        <Kpi label="Battles" value={t.battles} sub="blind human vs. AI picks" />
        <Kpi label="Votes" value={t.votes} sub={`${t.upvotes} up · ${t.votes - t.upvotes} down`} />
      </div>

      <section className="overflow-hidden rounded-2xl bg-navy p-6 text-white">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Battles per day" subtitle="Last 14 days, New York time">
          <div className="mb-3"><Legend /></div>
          <DailyBattles days={s.days} />
        </Panel>

        <Panel title="Does length matter?" subtitle="How often the human caption wins, by its length">
          {s.buckets.every((b) => b.battles === 0) ? (
            <p className="text-sm text-muted">No battles yet.</p>
          ) : (
            <PercentBars
              color="human"
              rows={s.buckets.map((b) => ({
                label: b.label,
                value: pct(b.wins, b.battles),
                detail: b.battles ? `Won ${b.wins} of ${b.battles} battles` : "No battles yet",
              }))}
            />
          )}
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

        <Panel title="When Columbia plays" subtitle="Posts and battles by hour of day, New York time">
          <HourStrip hours={s.hours} />
          <p className="mt-3 text-xs text-muted">Darker means busier. Hover a cell for the count.</p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Toughest AI captions" subtitle="Most battle wins">
          <CaptionList items={s.toughestAi} empty="The AI hasn't won a battle yet." />
        </Panel>
        <Panel title="Lion legends" subtitle="Human captions with the most wins">
          <CaptionList items={s.bestHuman} empty="No human wins yet." showAuthor />
        </Panel>
        <Panel title="Most active voters" subtitle="Battles decided">
          {s.voters.length === 0 ? (
            <p className="text-sm text-muted">No votes yet.</p>
          ) : (
            <ol className="space-y-3">
              {s.voters.map((v, i) => {
                const name = shortName(v.user?.first_name, v.user?.last_name);
                return (
                  <li key={v.user?.id ?? i} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-bold text-muted">{i + 1}</span>
                    <Avatar url={v.user?.avatar_url} name={name} size={30} />
                    <span className="flex-1 text-sm font-medium">{name}</span>
                    <span className="text-sm font-semibold tabular-nums">{v.battles}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CaptionList({
  items,
  empty,
  showAuthor,
}: {
  items: ReturnType<typeof computeStats>["toughestAi"];
  empty: string;
  showAuthor?: boolean;
}) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((x) => (
        <li key={x.caption!.id} className="flex gap-3">
          {x.image && <img src={x.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">{x.caption!.body}</p>
            <p className="mt-0.5 text-xs text-muted">
              {x.wins}–{x.battles - x.wins}
              {showAuthor && x.author && ` · ${shortName(x.author.first_name, x.author.last_name)}`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
