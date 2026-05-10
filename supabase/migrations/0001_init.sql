-- NEXUS Interview Coach - schema bootstrap
-- Run this in Supabase SQL editor (Dashboard -> SQL Editor -> New query).

create extension if not exists "uuid-ossp";

create table if not exists public.interview_history (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    target_role text,
    experience_level text,
    candidate_summary text,
    overall_score numeric,
    transcript text not null,
    analysis_markdown text not null,
    resume_text text,
    created_at timestamptz not null default now()
);

create index if not exists interview_history_user_id_created_at_idx
    on public.interview_history (user_id, created_at desc);

alter table public.interview_history enable row level security;

drop policy if exists "users read own history" on public.interview_history;
create policy "users read own history"
    on public.interview_history for select
    using (auth.uid() = user_id);

drop policy if exists "users insert own history" on public.interview_history;
create policy "users insert own history"
    on public.interview_history for insert
    with check (auth.uid() = user_id);

drop policy if exists "users delete own history" on public.interview_history;
create policy "users delete own history"
    on public.interview_history for delete
    using (auth.uid() = user_id);
