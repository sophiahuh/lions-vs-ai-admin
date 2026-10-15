/** Small, dependency-free charts. Each mark has a hover tooltip; every chart has a table view. */

export function Legend() {
  return (
    <div className="flex gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-chart-human" /> Lions win
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-chart-ai" /> AI wins
      </span>
    </div>
  );
}

/** Stacked daily bars: Lion wins on the baseline, AI wins on top, 2px gap between. */
export function DailyBattles({ days }: { days: { day: string; human: number; ai: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.human + d.ai));
  const label = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div>
      <div className="relative flex h-40 items-end gap-1.5 border-b border-chart-grid pt-6">
        <span className="absolute left-0 top-0 text-[10px] text-muted">{max}</span>
        {days.map((d) => {
          const total = d.human + d.ai;
          return (
            <div key={d.day} tabIndex={0} className="tip flex h-full flex-1 flex-col justify-end outline-none">
              <span className="tip-box">
                {label(d.day)}: {total} battle{total === 1 ? "" : "s"} · Lions {d.human} · AI {d.ai}
              </span>
              {d.ai > 0 && (
                <div
                  className={`bg-chart-ai ${d.human > 0 ? "mb-[2px] rounded-t" : "rounded-t"}`}
                  style={{ height: `${(d.ai / max) * 100}%` }}
                />
              )}
              {d.human > 0 && (
                <div className={`bg-chart-human ${d.ai > 0 ? "" : "rounded-t"}`} style={{ height: `${(d.human / max) * 100}%` }} />
              )}
              {total === 0 && <div className="h-px bg-chart-grid" />}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{label(days[0].day)}</span>
        <span>Today</span>
      </div>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">Table view</summary>
        <table className="table mt-2">
          <thead>
            <tr><th>Day</th><th>Lions</th><th>AI</th></tr>
          </thead>
          <tbody>
            {days.filter((d) => d.human + d.ai > 0).map((d) => (
              <tr key={d.day}><td>{label(d.day)}</td><td>{d.human}</td><td>{d.ai}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Horizontal percentage bars with value labels in text ink. */
export function PercentBars({
  rows,
  color,
}: {
  rows: { label: string; value: number; detail: string }[];
  color: "human" | "ai";
}) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="tip outline-none" tabIndex={0}>
          <span className="tip-box">{r.detail}</span>
          <div className="flex items-baseline justify-between text-sm">
            <span>{r.label}</span>
            <span className="font-semibold tabular-nums">{r.value}%</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-chart-grid">
            <div
              className={`h-full rounded-full ${color === "human" ? "bg-chart-human" : "bg-chart-ai"}`}
              style={{ width: `${r.value}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-muted">{r.detail}</p>
        </li>
      ))}
    </ul>
  );
}

/** 24-hour activity strip: one hue, light to dark by count. */
export function HourStrip({ hours }: { hours: { hour: number; count: number }[] }) {
  const max = Math.max(1, ...hours.map((h) => h.count));
  const fmt = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return (
    <div>
      <div className="grid grid-cols-12 gap-[2px] sm:grid-cols-24">
        {hours.map((h) => (
          <div key={h.hour} tabIndex={0} className="tip outline-none">
            <span className="tip-box">{fmt(h.hour)}: {h.count} event{h.count === 1 ? "" : "s"}</span>
            <div
              className="h-9 rounded"
              style={{
                background:
                  h.count === 0
                    ? "var(--chart-grid)"
                    : `color-mix(in oklab, var(--chart-human) ${25 + Math.round((h.count / max) * 75)}%, var(--card))`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
      </div>
    </div>
  );
}
