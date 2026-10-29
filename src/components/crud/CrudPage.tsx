import { requireAdmin } from "@/lib/admin";
import { getResource } from "@/lib/resources";
import RowForm, { type Option } from "./RowForm";

/** A full create/read/update/delete page for one table in RESOURCES. */
export default async function CrudPage({ resourceKey }: { resourceKey: string }) {
  const { supabase } = await requireAdmin();
  const resource = getResource(resourceKey)!;

  const { data, error } = await supabase
    .from(resource.table)
    .select("*")
    .order(resource.orderBy, { ascending: resource.ascending ?? false });
  const rows = (data ?? []) as (Record<string, unknown> & { id: number })[];

  const options: Record<string, Option[]> = {};
  for (const f of resource.fields) {
    if (!f.optionsFrom) continue;
    const { data: opts } = await supabase.from(f.optionsFrom.table).select(`${f.optionsFrom.value}, ${f.optionsFrom.label}`);
    options[f.name] = ((opts ?? []) as unknown as Record<string, string | number>[]).map((o) => ({
      value: o[f.optionsFrom!.value],
      label: String(o[f.optionsFrom!.label]),
    }));
  }
  const display = (f: (typeof resource.fields)[number], v: unknown) => {
    if (f.type === "boolean") return v ? "✓ Active" : "Off";
    if (f.optionsFrom) return options[f.name]?.find((o) => String(o.value) === String(v))?.label ?? "–";
    return v == null || v === "" ? "–" : String(v);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Manage</p>
      <h1 className="mt-1 font-serif text-4xl font-bold">{resource.title}</h1>
      <p className="mt-1 text-muted">{resource.description}</p>

      <details className="card mt-6 p-5">
        <summary className="cursor-pointer font-semibold text-accent">+ Add {resource.singular}</summary>
        <div className="mt-4">
          <RowForm resourceKey={resourceKey} fields={resource.fields} options={options} submitLabel={`Add ${resource.singular}`} />
        </div>
      </details>

      {error && <p className="mt-4 text-sm text-red-600">{error.message}</p>}
      <p className="mt-6 text-sm text-muted">{rows.length} {rows.length === 1 ? resource.singular : `${resource.singular}s`}</p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="card">
            <details>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 p-4">
                {resource.fields.slice(0, 4).map((f, i) => (
                  <span key={f.name} className={i === 0 ? "font-semibold" : "text-sm text-muted"}>
                    {display(f, row[f.name])}
                  </span>
                ))}
                <span className="ml-auto text-xs font-medium text-accent">Edit</span>
              </summary>
              <div className="border-t border-line p-4">
                <RowForm resourceKey={resourceKey} fields={resource.fields} options={options} row={row} submitLabel="Save changes" />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
