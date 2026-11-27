alter table public.email_logs
  add column dispatch_attempts integer not null default 0 check (dispatch_attempts >= 0),
  add column next_attempt_at timestamptz not null default now(),
  add column claim_token uuid,
  add column claim_expires_at timestamptz,
  add constraint scanova_email_claim_pair check ((claim_token is null) = (claim_expires_at is null));

create index scanova_pending_email_dispatch on public.email_logs (next_attempt_at, id)
  where delivery_status = 'pending';

create index scanova_email_registration_latest on public.email_logs (event_id, registration_id, created_at desc);

create table public.scanova_rate_limits (
  key text not null,
  bucket timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (key, bucket)
);
create index scanova_rate_limit_age on public.scanova_rate_limits (bucket);
alter table public.scanova_rate_limits enable row level security;
revoke all on public.scanova_rate_limits from public, anon, authenticated;
