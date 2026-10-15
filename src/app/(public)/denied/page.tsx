import { createClient } from "@/lib/supabase/server";

export default async function DeniedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="card p-8 text-center shadow-sm">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 font-serif text-3xl font-bold">Admins only</h1>
        <p className="mt-2 text-sm text-muted">
          {user?.email ? (
            <>
              <span className="font-medium text-ink">{user.email}</span> doesn&apos;t have admin access.
            </>
          ) : (
            "You need to sign in with an admin account."
          )}
        </p>
        <p className="mt-1 text-sm text-muted">Ask an existing admin to grant you access.</p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="btn btn-secondary w-full py-2.5">Sign in with a different account</button>
        </form>
      </div>
    </main>
  );
}
