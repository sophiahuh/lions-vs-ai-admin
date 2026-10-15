-- Week 6: admin access. Run in the Supabase SQL editor. Safe to re-run.

-- 1. The flag that gates the admin area.
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Users can still edit their own name and photo, but never is_superadmin.
-- Column-level privileges make the flag read-only through the API.
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, avatar_url, updated_at) on public.profiles to authenticated;

-- 2. One helper every admin rule uses. Runs as owner so it can read the flag.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_superadmin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke execute on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- 3. Admin-only access, enforced by the database (not just the admin app).
-- Votes and battles: admins can read everyone's.
drop policy if exists "Admins read all votes" on public.votes;
create policy "Admins read all votes" on public.votes
  for select to authenticated using (public.is_superadmin());
drop policy if exists "Admins read all battles" on public.battles;
create policy "Admins read all battles" on public.battles
  for select to authenticated using (public.is_superadmin());

-- AI media: admins can create, edit, and delete any generation and caption.
drop policy if exists "Admins edit generations" on public.generations;
create policy "Admins edit generations" on public.generations
  for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "Admins delete generations" on public.generations;
create policy "Admins delete generations" on public.generations
  for delete to authenticated using (public.is_superadmin());
grant update (context, prompt, model) on public.generations to authenticated;

drop policy if exists "Admins add captions" on public.captions;
create policy "Admins add captions" on public.captions
  for insert to authenticated
  with check (public.is_superadmin() and upvotes = 0 and downvotes = 0);
drop policy if exists "Admins edit captions" on public.captions;
create policy "Admins edit captions" on public.captions
  for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "Admins delete captions" on public.captions;
create policy "Admins delete captions" on public.captions
  for delete to authenticated using (public.is_superadmin());
grant update (body) on public.captions to authenticated;

-- Storage: admins can remove any uploaded photo when deleting media.
drop policy if exists "Admins delete any upload" on storage.objects;
create policy "Admins delete any upload" on storage.objects
  for delete to authenticated using (bucket_id = 'uploads' and public.is_superadmin());

-- 4. Admin user list, including emails from auth.users. Refuses non-admins.
create or replace function public.admin_users()
returns table (
  id uuid, email text, first_name text, last_name text, avatar_url text,
  is_superadmin boolean, created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.first_name, p.last_name, p.avatar_url, p.is_superadmin,
           u.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at;
end;
$$;
revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

-- 5. Bootstrap (the answer to "won't you be locked out?"):
-- The SQL editor runs as the database owner and bypasses RLS and column
-- privileges, so the project owner can grant the first admin here.
update public.profiles set is_superadmin = true
where id = (select id from auth.users where email = 'sophiahuh@gmail.com');

select u.email, p.first_name, p.is_superadmin
from public.profiles p join auth.users u on u.id = p.id
order by u.created_at;
