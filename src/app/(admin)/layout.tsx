import Avatar from "@/components/Avatar";
import { requireAdmin, shortName } from "@/lib/admin";
import Nav from "./Nav";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { user, profile } = await requireAdmin();
  const name = shortName(profile.first_name, profile.last_name);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[230px_1fr]">
      <aside className="bg-navy text-white md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="h-1 bg-cu-blue" />
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:block">
          <p className="font-serif text-lg font-bold">
            Lions <span className="text-xs font-normal italic text-cu-blue">vs.</span> AI
          </p>
          <span className="rounded bg-[#d9480f] px-1.5 py-0.5 text-[10px] font-bold tracking-widest md:mt-1 md:inline-block">ADMIN</span>
        </div>
        <div className="px-3 pb-3 md:flex-1 md:overflow-y-auto">
          <Nav />
        </div>
        <div className="hidden items-center gap-3 border-t border-white/10 px-4 py-4 md:flex">
          <Avatar url={profile.avatar_url} name={name} size={32} />
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-white/60">{user.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        {children}
        <form action="/auth/signout" method="post" className="mt-10 md:hidden">
          <button className="btn btn-secondary w-full py-2.5">Sign out ({user.email})</button>
        </form>
      </main>
    </div>
  );
}
