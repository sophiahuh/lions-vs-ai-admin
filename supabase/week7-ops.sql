-- Week 7 follow-up: what an admin needs to keep the app running.
--   * token counts on every model call, so spend can be estimated
--   * editable per-model prices (USD per 1M tokens)
--   * app_settings: the per-user posting limit and a monthly AI budget, editable by admins
-- Safe to re-run.

alter table public.llm_responses
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer;

alter table public.llm_models
  add column if not exists input_usd_per_mtok numeric(10, 4) check (input_usd_per_mtok >= 0),
  add column if not exists output_usd_per_mtok numeric(10, 4) check (output_usd_per_mtok >= 0);

-- Paid-tier list prices as of Oct 2026 (3.8 Flash and 3.5 Flash-Lite from ai.google.dev/gemini-api/docs/pricing;
-- 3.5 Flash from third-party price trackers). Admins can edit these on the LLM models page.
update public.llm_models set input_usd_per_mtok = 1.50, output_usd_per_mtok = 9.00
  where model_id = 'gemini-3.5-flash' and input_usd_per_mtok is null;
update public.llm_models set input_usd_per_mtok = 0.75, output_usd_per_mtok = 3.75
  where model_id = 'gemini-3.8-flash' and input_usd_per_mtok is null;
update public.llm_models set input_usd_per_mtok = 0.30, output_usd_per_mtok = 2.50
  where model_id = 'gemini-3.5-flash-lite' and input_usd_per_mtok is null;

create table if not exists public.app_settings (
  key text primary key,
  value numeric not null check (value >= 0),
  label text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon;
grant select, update on public.app_settings to authenticated;
drop policy if exists "Signed-in users read settings" on public.app_settings;
create policy "Signed-in users read settings" on public.app_settings
  for select to authenticated using (true);
drop policy if exists "Admins update settings" on public.app_settings;
create policy "Admins update settings" on public.app_settings
  for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

insert into public.app_settings (key, value, label) values
  ('daily_post_limit', 20, 'Photos each user can post per 24 hours'),
  ('monthly_ai_budget_usd', 10, 'Monthly AI spend budget (USD)')
on conflict (key) do nothing;

select
  (select count(*) from public.app_settings) as settings,
  (select count(*) from public.llm_models where input_usd_per_mtok is not null) as priced_models;
