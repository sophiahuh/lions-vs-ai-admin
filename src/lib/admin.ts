import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
};

/**
 * Every admin page and server action calls this. Signed-out users go to
 * /login; signed-in users without profiles.is_superadmin go to /denied.
 * The database enforces the same rule through RLS, so this is a second layer.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The flag itself isn't readable through the API; ask the database instead.
  const { data: isAdmin } = await supabase.rpc("is_superadmin");
  if (isAdmin !== true) redirect("/denied");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle<Omit<AdminProfile, "is_superadmin">>();

  return { supabase, user, profile: { ...(profile ?? { id: user.id, first_name: null, last_name: null, avatar_url: null }), is_superadmin: true } };
}

export function shortName(first: string | null | undefined, last: string | null | undefined) {
  const f = first?.trim();
  const l = last?.trim();
  if (!f) return "Unnamed user";
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
}

/** Date only, for content where the time of day doesn't matter. */
export function fmtDay(iso: string | null | undefined) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
