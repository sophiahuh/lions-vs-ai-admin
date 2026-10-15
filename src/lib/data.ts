import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type UserRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};
export type Generation = { id: string; user_id: string; image_url: string; model: string; created_at: string };
export type Caption = {
  id: string;
  generation_id: string;
  author_type: "ai" | "human";
  author_id: string | null;
  body: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
};
export type Battle = {
  id: number;
  user_id: string;
  generation_id: string;
  human_caption_id: string;
  ai_caption_id: string;
  winner: "ai" | "human";
  created_at: string;
};
export type Vote = { id: number; caption_id: string; user_id: string; value: number; source: string; created_at: string };

/** Loads every table the admin views need. Fine at class-project scale. */
export async function loadAll(supabase: Client) {
  const [users, generations, captions, battles, votes] = await Promise.all([
    supabase.rpc("admin_users"),
    supabase.from("generations").select("id, user_id, image_url, model, created_at").order("created_at", { ascending: false }),
    supabase
      .from("captions")
      .select("id, generation_id, author_type, author_id, body, upvotes, downvotes, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("battles")
      .select("id, user_id, generation_id, human_caption_id, ai_caption_id, winner, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("votes").select("id, caption_id, user_id, value, source, created_at").order("created_at", { ascending: false }),
  ]);
  const firstError = [users, generations, captions, battles, votes].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  return {
    users: (users.data ?? []) as UserRow[],
    generations: (generations.data ?? []) as Generation[],
    captions: (captions.data ?? []) as Caption[],
    battles: (battles.data ?? []) as Battle[],
    votes: (votes.data ?? []) as Vote[],
  };
}

export function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

export function nyDayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function nyHour(iso: string) {
  return Number(new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false })) % 24;
}

export function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
