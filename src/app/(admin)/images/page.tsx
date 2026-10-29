/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { fmtDate, requireAdmin, shortName } from "@/lib/admin";
import { ImageActions, UploadImage } from "./ImageTools";

type Obj = { name: string; created_at: string | null; metadata: { size?: number } | null };

export default async function ImagesPage() {
  const { supabase, user } = await requireAdmin();
  const bucket = supabase.storage.from("uploads");

  // READ: list every user folder, then every file inside it.
  const { data: folders } = await bucket.list("", { limit: 1000 });
  const files: { path: string; created_at: string | null; size: number; owner: string }[] = [];
  for (const folder of folders ?? []) {
    if (folder.id) continue; // a file at the root, not a folder
    const { data: items } = await bucket.list(folder.name, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    for (const f of (items ?? []) as Obj[]) {
      if (f.name === ".emptyFolderPlaceholder") continue;
      files.push({ path: `${folder.name}/${f.name}`, created_at: f.created_at, size: f.metadata?.size ?? 0, owner: folder.name });
    }
  }
  files.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const [{ data: gens }, { data: users }] = await Promise.all([
    supabase.from("generations").select("id, image_path"),
    supabase.rpc("admin_users"),
  ]);
  const genByPath = new Map((gens ?? []).map((g) => [g.image_path as string, g.id as string]));
  const userById = new Map(((users ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Content</p>
          <h1 className="mt-1 font-serif text-4xl font-bold">Images</h1>
          <p className="mt-1 text-muted">
            Every uploaded photo ({files.length}). Replacing an image updates any AI media that uses it.
          </p>
        </div>
        <UploadImage adminId={user.id} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {files.map((f) => {
          const genId = genByPath.get(f.path);
          const owner = userById.get(f.owner);
          return (
            <div key={f.path} className="card overflow-hidden">
              <img src={bucket.getPublicUrl(f.path).data.publicUrl} alt="" className="aspect-square w-full bg-cu-blue-soft object-cover" />
              <div className="p-3 text-xs">
                <p className="text-muted">
                  {shortName(owner?.first_name, owner?.last_name)} · {fmtDate(f.created_at)} · {Math.round(f.size / 1024)} KB
                </p>
                {genId ? (
                  <Link href={`/media/${genId}`} className="mt-1 inline-block font-medium text-accent hover:underline">Used by AI media →</Link>
                ) : (
                  <p className="mt-1 text-muted">Not used by any media</p>
                )}
                <ImageActions adminId={user.id} path={f.path} used={!!genId} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
