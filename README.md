# Lions vs. AI · Admin

Admin area for [Lions vs. AI](https://github.com/sophiahuh/hello-world-nextjs), a game where
Columbia students vote blind between a human caption and an AI caption on each photo.

## What it does

| Area | Access |
|---|---|
| **Dashboard** | Live stats: totals, Lions vs. AI scoreboard, battles per day, whether caption length matters, which Gemini model wins most, activity by hour, toughest AI captions, best human captions, most active voters |
| **Users** | Read every profile, with email, role, sign-in times, and activity |
| **AI media** | Create (upload a photo and Gemini writes the AI caption), read, update (edit caption, prompt, model, context), and delete. Admins can also remove individual human captions |
| **Votes** | Read every battle and every up/down vote, including which battle picks were switched |

## Security

Every route except `/login`, `/denied`, and the auth callbacks requires a Google sign-in **and**
`profiles.is_superadmin = true`. It is enforced in three layers:

1. `src/proxy.ts` checks every request and redirects non-admins.
2. Every admin page and server action calls `requireAdmin()` again.
3. **The database itself** only grants admin powers through RLS policies that call
   `public.is_superadmin()` (see `supabase/admin.sql`). Even someone who bypassed the app and
   called the Supabase API directly with a non-admin account would get nothing.

Users cannot make themselves admins: column-level privileges let signed-in users update only
`first_name`, `last_name`, `avatar_url`, and `updated_at` on their own profile, never
`is_superadmin`.

### "Won't you be locked out?"

The admin app can't grant the first admin, because only admins can do admin things. The way
out is the Supabase dashboard: its SQL editor runs as the database owner, which bypasses RLS
and column privileges. The project owner runs this once (it's at the end of `admin.sql`):

```sql
update public.profiles set is_superadmin = true
where id = (select id from auth.users where email = 'you@example.com');
```

## Setup

1. Run `supabase/admin.sql` in the Supabase SQL editor (after the main app's SQL files).
2. Add `/auth/callback` for this app's domains to Supabase → Authentication → URL Configuration.
3. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`.
