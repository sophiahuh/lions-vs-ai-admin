-- Week 7: observability and control tables behind the caption pipeline.
-- Run in the Supabase SQL editor after the earlier files. Safe to re-run.

-- ---------- Tables ----------
create table if not exists public.llm_providers (
  id bigint generated always as identity primary key,
  name text not null unique,
  base_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.llm_models (
  id bigint generated always as identity primary key,
  provider_id bigint not null references public.llm_providers (id) on delete cascade,
  model_id text not null unique,
  display_name text,
  is_active boolean not null default true,
  priority integer not null default 100,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  step_order integer not null,
  name text not null,
  system_prompt text not null,
  user_template text not null,
  output_format text not null check (output_format in ('text', 'caption_json')),
  include_image boolean not null default true,
  model_id bigint references public.llm_models (id) on delete set null,
  unique (chain_id, step_order)
);

create table if not exists public.prompt_chain_mix (
  chain_id bigint primary key references public.prompt_chains (id) on delete cascade,
  weight integer not null default 0 check (weight between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.terms (
  id bigint generated always as identity primary key,
  term text not null unique,
  definition text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_examples (
  id bigint generated always as identity primary key,
  image_description text not null,
  caption text not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_requests (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  generation_id uuid references public.generations (id) on delete set null,
  chain_id bigint references public.prompt_chains (id) on delete set null,
  source text not null default 'app' check (source in ('app', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  error text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists generation_requests_created_idx on public.generation_requests (created_at desc);

create table if not exists public.llm_responses (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.generation_requests (id) on delete cascade,
  step_id bigint references public.prompt_chain_steps (id) on delete set null,
  model text not null,
  http_status integer,
  success boolean not null default false,
  latency_ms integer,
  response_text text,
  created_at timestamptz not null default now()
);
create index if not exists llm_responses_request_idx on public.llm_responses (request_id);

create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  domain text not null unique check (domain = lower(domain) and domain !~ '@'),
  created_at timestamptz not null default now()
);

create table if not exists public.whitelisted_emails (
  id bigint generated always as identity primary key,
  email text not null unique check (email = lower(email) and email ~ '@'),
  note text,
  created_at timestamptz not null default now()
);

alter table public.generations add column if not exists prompt_chain_id bigint
  references public.prompt_chains (id) on delete set null;

-- ---------- Row Level Security ----------
-- Pipeline config: signed-in users read it (the app needs it to generate),
-- only admins change it. Signed-out visitors can't see any of it.
do $$
declare t text;
begin
  foreach t in array array['llm_providers','llm_models','prompt_chains','prompt_chain_steps',
                           'prompt_chain_mix','terms','generation_examples']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Signed-in users read %s" on public.%I', t, t);
    execute format('create policy "Signed-in users read %s" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "Admins write %s" on public.%I', t, t);
    execute format('create policy "Admins write %s" on public.%I for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin())', t, t);
  end loop;
end $$;

-- Signup lists: admins only.
do $$
declare t text;
begin
  foreach t in array array['allowed_signup_domains','whitelisted_emails']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Admins manage %s" on public.%I', t, t);
    execute format('create policy "Admins manage %s" on public.%I for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin())', t, t);
  end loop;
end $$;

-- Generation logs: users write their own; only admins read everything.
alter table public.generation_requests enable row level security;
revoke all on public.generation_requests from anon;
grant select, insert, update on public.generation_requests to authenticated;
drop policy if exists "Users log their own requests" on public.generation_requests;
create policy "Users log their own requests" on public.generation_requests
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users finish their own requests" on public.generation_requests;
create policy "Users finish their own requests" on public.generation_requests
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users and admins read requests" on public.generation_requests;
create policy "Users and admins read requests" on public.generation_requests
  for select to authenticated using ((select auth.uid()) = user_id or public.is_superadmin());

alter table public.llm_responses enable row level security;
revoke all on public.llm_responses from anon;
grant select, insert on public.llm_responses to authenticated;
drop policy if exists "Users log responses to their requests" on public.llm_responses;
create policy "Users log responses to their requests" on public.llm_responses
  for insert to authenticated with check (
    exists (select 1 from public.generation_requests r where r.id = request_id and r.user_id = (select auth.uid()))
  );
drop policy if exists "Admins read responses" on public.llm_responses;
create policy "Admins read responses" on public.llm_responses
  for select to authenticated using (public.is_superadmin());

grant update (prompt_chain_id, image_path, image_url) on public.generations to authenticated;

-- Admin image library: admins can list and replace any uploaded image.
drop policy if exists "Admins read all uploads" on storage.objects;
create policy "Admins read all uploads" on storage.objects
  for select to authenticated using (bucket_id = 'uploads' and public.is_superadmin());

-- Is this email allowed to use the app? (domain allowlist or whitelist)
create or replace function public.is_email_allowed(check_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.whitelisted_emails w where w.email = lower(check_email))
      or exists (select 1 from public.allowed_signup_domains d where d.domain = lower(split_part(check_email, '@', 2)));
$$;
revoke execute on function public.is_email_allowed(text) from public, anon;
grant execute on function public.is_email_allowed(text) to authenticated;

-- ---------- Seed data ----------
insert into public.llm_providers (name, base_url, notes) values
  ('Google', 'https://generativelanguage.googleapis.com', 'Gemini API, free tier')
on conflict (name) do nothing;

insert into public.llm_models (provider_id, model_id, display_name, priority, notes)
select p.id, m.model_id, m.display_name, m.priority, m.notes
from public.llm_providers p,
  (values ('gemini-3.5-flash', 'Gemini 3.5 Flash', 10, 'Primary model'),
          ('gemini-3.8-flash', 'Gemini 3.8 Flash', 20, 'Newer, often overloaded'),
          ('gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', 30, 'Fallback when others are busy')) as m(model_id, display_name, priority, notes)
where p.name = 'Google'
on conflict (model_id) do nothing;

insert into public.prompt_chains (name, description) values
  ('Brainstorm & pick', 'One call: brainstorm 4 captions with different comedic angles, then pick the funniest.'),
  ('Describe, then joke', 'Two calls: first describe what is in the photo, then write the joke from that description.')
on conflict (name) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, name, system_prompt, user_template, output_format, include_image)
select c.id, s.step_order, s.name, s.system_prompt, s.user_template, s.output_format, s.include_image
from public.prompt_chains c
join (values
  ('Brainstorm & pick', 1, 'Brainstorm and pick',
$p$You write captions for photos on Lions vs. AI, a site where Columbia University students vote between a human-written caption and an AI-written caption without knowing which is which. Your goal is to win the vote by being genuinely funnier.

What wins:
- An actual joke: a twist, an exaggeration, an unexpected comparison, or a painfully relatable observation.
- Reacting to what is specifically in the image: the expression, the situation, the composition, or the meme format.
- If the image is a well-known meme template, use it the way people actually use that meme.

What loses:
- Naming a place, class, or event without a punchline. A reference is not a joke.
- Leaning on Columbia or NYC names out of habit. Use one only when it is the punchline or makes the joke land.
- Describing the photo, being wholesome and flat, or sounding like ad copy.

Voice: a witty college student posting on Instagram or in a group chat. Casual and quick.

Rules:
- First brainstorm 4 candidate captions that each take a different comedic angle, then pick the single funniest one.
- Match the requested length and casing.
- Never mock anyone's appearance, body, race, religion, gender, sexuality, or disability. No slurs. No sexual content.
- Never identify or name real people who appear in the image.
- No hashtags, no emojis, and no quotation marks around the caption.$p$,
$p$Write captions for the attached image.
Aim for about {{length}} words.
{{casing}}

{{terms}}

{{examples}}$p$, 'caption_json', true),
  ('Describe, then joke', 1, 'Describe the photo',
$p$You describe photos precisely for a comedy writer. Be concrete and observant: who or what is in the frame, their expressions and body language, the setting, any visible text, and anything odd, ironic, or relatable. If it is a known meme template, name the template. Never name or identify real people.$p$,
$p$Describe the attached image in 3 to 5 sentences. Finish with one line starting with "Funny angle:" that names the most promising comedic angle.$p$, 'text', true),
  ('Describe, then joke', 2, 'Write the joke',
$p$You write one caption for a photo on Lions vs. AI, where Columbia students vote between a human caption and an AI caption without knowing which is which. Win by being genuinely funny: a twist, an exaggeration, or a painfully relatable observation. A place or class name on its own is not a joke. Casual group-chat voice. Brainstorm 4 candidates with different angles, then pick the funniest. Match the requested length and casing. Never mock appearance, identity, or disability; no slurs or sexual content; never name real people. No hashtags, emojis, or quotation marks.$p$,
$p$Here is a description of the photo:
{{previous}}

Write the caption. Aim for about {{length}} words.
{{casing}}

{{terms}}

{{examples}}$p$, 'caption_json', false)
) as s(chain_name, step_order, name, system_prompt, user_template, output_format, include_image)
  on s.chain_name = c.name
on conflict (chain_id, step_order) do nothing;

insert into public.prompt_chain_mix (chain_id, weight)
select id, case name when 'Brainstorm & pick' then 70 else 30 end from public.prompt_chains
on conflict (chain_id) do nothing;

update public.generations set prompt_chain_id = (select id from public.prompt_chains where name = 'Brainstorm & pick')
where prompt_chain_id is null;

insert into public.terms (term, definition) values
  ('Butler', 'Butler Library, the main library. Open late; the default place to suffer through finals.'),
  ('Low Steps', 'The big steps in front of Low Library where everyone sits when it is sunny.'),
  ('the Core', 'The Core Curriculum: required classes every Columbia College student takes.'),
  ('Lit Hum', 'Literature Humanities, the first-year Core class that reads a classic every week or two.'),
  ('CC', 'Contemporary Civilization, the Core class on political and moral philosophy.'),
  ('John Jay', 'John Jay Dining Hall, the main dining hall for first-years.'),
  ('JJ''s Place', 'Late-night dining spot in the basement of John Jay.'),
  ('Ferris', 'Ferris Booth Commons, the dining hall inside Lerner Hall.'),
  ('Lerner', 'Lerner Hall, the student center on Broadway.'),
  ('Carman', 'Carman Hall, a first-year dorm known for small rooms.'),
  ('Barnard', 'Barnard College, the women''s college across Broadway, part of the Columbia community.'),
  ('the 1 train', 'The subway line that stops at 116th St–Columbia University.'),
  ('Koronet', 'Koronet Pizza on Broadway, famous for enormous slices.'),
  ('Pupin', 'Pupin Hall, the physics building where many early-morning science classes happen.')
on conflict (term) do nothing;

insert into public.generation_examples (image_description, caption, notes)
select * from (values
  ('Meme of a teenage boy in class visibly straining to hold in a cough.', 'Holding back the urge to say actually in discussion section.', 'Relatable classroom tension'),
  ('Cartoon bedroom at night with a bunny tucked into bed.', 'Me tucked in at 9pm after one minor inconvenience.', 'Exaggeration'),
  ('A packed subway car at rush hour, everyone pressed together.', 'the 1 train at 9:58 when your 10:10 is in Pupin', 'Columbia reference used as the punchline')
) as v(image_description, caption, notes)
where not exists (select 1 from public.generation_examples);

insert into public.allowed_signup_domains (domain) values ('columbia.edu'), ('barnard.edu')
on conflict (domain) do nothing;
insert into public.whitelisted_emails (email, note) values ('sophiahuh@gmail.com', 'Project owner')
on conflict (email) do nothing;

select
  (select count(*) from public.llm_models) as models,
  (select count(*) from public.prompt_chain_steps) as steps,
  (select count(*) from public.terms) as terms,
  (select count(*) from public.generation_examples) as examples,
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) as tables_without_rls;
