-- Exam Ready database. Paste this into Supabase → SQL Editor → New query → Run.
-- Every study set, file, exam and the student's profile is one row, keyed per student.

create table if not exists public.docs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Row Level Security: each student can only see and change their own rows.
alter table public.docs enable row level security;

drop policy if exists "Read own docs" on public.docs;
drop policy if exists "Add own docs" on public.docs;
drop policy if exists "Change own docs" on public.docs;
drop policy if exists "Delete own docs" on public.docs;

create policy "Read own docs"   on public.docs for select using (auth.uid() = user_id);
create policy "Add own docs"    on public.docs for insert with check (auth.uid() = user_id);
create policy "Change own docs" on public.docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own docs" on public.docs for delete using (auth.uid() = user_id);
