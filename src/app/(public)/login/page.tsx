import GoogleSignInButton from "./GoogleSignInButton";

const ERRORS: Record<string, string> = {
  auth_failed: "Sign-in failed. Please try again.",
  missing_code: "Sign-in was cancelled or the link expired. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="card p-8 shadow-sm">
        <p className="eyebrow">Lions vs. AI · Admin</p>
        <h1 className="mt-2 font-serif text-3xl font-bold">Admin sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Restricted area. Sign in with a Google account that has admin access.
        </p>
        {error && (
          <p className="mt-5 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {ERRORS[error] ?? "Something went wrong. Please try again."}
          </p>
        )}
        <div className="mt-6">
          <GoogleSignInButton />
        </div>
      </div>
    </main>
  );
}
