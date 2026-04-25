
create table if not exists public.smoke_test_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  endpoint text not null,
  status_code int,
  ok boolean not null default false,
  valid_json boolean not null default false,
  duration_ms int,
  error_message text,
  request_id text
);

create index if not exists idx_smoke_test_runs_ran_at on public.smoke_test_runs(ran_at desc);
create index if not exists idx_smoke_test_runs_endpoint on public.smoke_test_runs(endpoint, ran_at desc);

alter table public.smoke_test_runs enable row level security;

drop policy if exists "Presidents can read smoke runs" on public.smoke_test_runs;
create policy "Presidents can read smoke runs"
  on public.smoke_test_runs for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.is_president = true
    )
  );
