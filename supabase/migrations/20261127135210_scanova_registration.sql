create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 150),
  email text not null,
  role text not null check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (length(btrim(event_name)) between 1 and 200),
  description text not null default '',
  venue text not null check (length(btrim(venue)) between 1 and 240),
  event_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  registration_deadline timestamptz not null,
  capacity integer not null check (capacity > 0),
  registration_status text not null default 'upcoming'
    check (registration_status in ('upcoming', 'open', 'closed', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  full_name text not null check (length(btrim(full_name)) between 3 and 150),
  email text not null check (length(email) <= 254 and email = lower(btrim(email))
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  organization text not null check (length(btrim(organization)) between 1 and 160),
  contact_number text not null check (contact_number ~ '^\+[1-9][0-9]{7,14}$'),
  registration_status text not null default 'confirmed'
    check (registration_status in ('confirmed', 'cancelled')),
  consent_at timestamptz not null,
  request_id uuid not null,
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, request_id),
  unique (event_id, id)
);

create unique index scanova_confirmed_email
  on public.registrations (event_id, email) where registration_status = 'confirmed';

create index scanova_registration_trend on public.registrations (event_id, registered_at);

create table public.qr_tickets (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null,
  event_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  ticket_status text not null default 'active' check (ticket_status in ('active', 'revoked')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((ticket_status = 'revoked') = (revoked_at is not null)),
  unique (event_id, registration_id, id),
  foreign key (event_id, registration_id) references public.registrations (event_id, id)
);

create unique index scanova_active_ticket
  on public.qr_tickets (event_id, registration_id) where ticket_status = 'active';

create table public.checkin_logs (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null,
  event_id uuid not null,
  ticket_id uuid not null,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references public.profiles (id) on delete set null,
  checkin_status text not null default 'checked_in' check (checkin_status = 'checked_in'),
  device_information text check (length(device_information) <= 250),
  unique (event_id, registration_id),
  foreign key (event_id, registration_id, ticket_id)
    references public.qr_tickets (event_id, registration_id, id)
);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null,
  event_id uuid not null,
  email_type text not null check (email_type = 'registration_confirmation'),
  recipient_email text not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  provider_reference text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check ((delivery_status = 'sent') = (sent_at is not null)),
  foreign key (event_id, registration_id) references public.registrations (event_id, id)
);

create unique index scanova_open_email_delivery
  on public.email_logs (event_id, registration_id, email_type) where delivery_status in ('pending', 'sent');

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index scanova_audit_entity on public.audit_logs (entity_type, entity_id, created_at);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.qr_tickets enable row level security;
alter table public.checkin_logs enable row level security;
alter table public.email_logs enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles, public.events, public.registrations, public.qr_tickets,
  public.checkin_logs, public.email_logs, public.audit_logs from public, anon, authenticated;

grant select on public.profiles to authenticated;
create policy scanova_read_own_profile on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create function public.scanova_set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger scanova_profile_updated_at before update on public.profiles
  for each row execute function public.scanova_set_updated_at();
create trigger scanova_event_updated_at before update on public.events
  for each row execute function public.scanova_set_updated_at();
create trigger scanova_registration_updated_at before update on public.registrations
  for each row execute function public.scanova_set_updated_at();

create function public.scanova_event_capacity_floor() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.capacity < old.capacity and new.capacity < (
    select count(*) from public.registrations r
    where r.event_id = old.id and r.registration_status = 'confirmed'
  ) then
    raise exception using errcode = '23514', message = 'Capacity is below confirmed registrations';
  end if;
  return new;
end;
$$;

create trigger scanova_event_capacity_floor before update of capacity on public.events
  for each row execute function public.scanova_event_capacity_floor();

create function public.scanova_register(
  p_event_id uuid, p_full_name text, p_email text, p_organization text,
  p_contact_number text, p_consent boolean, p_request_id uuid
) returns table (
  result text, registration_id uuid, confirmed_count integer, available_slots integer
)
language plpgsql set search_path = ''
as $$
declare
  selected_event public.events%rowtype;
  existing_registration public.registrations%rowtype;
  seats_taken integer;
  new_id uuid;
begin
  p_full_name := btrim(p_full_name);
  p_email := lower(btrim(p_email));
  p_organization := btrim(p_organization);
  if p_consent is distinct from true or p_request_id is null
    or p_full_name is null or length(p_full_name) not between 3 and 150
    or p_email is null or length(p_email) > 254
    or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_organization is null or length(p_organization) not between 1 and 160
    or p_contact_number is null or p_contact_number !~ '^\+[1-9][0-9]{7,14}$'
  then
    return query select 'invalid_input'::text, null::uuid, null::integer, null::integer;
    return;
  end if;

  select e.* into selected_event from public.events e where e.id = p_event_id for update;
  if not found then
    return query select 'invalid_event'::text, null::uuid, null::integer, null::integer;
    return;
  end if;

  select count(*)::integer into seats_taken from public.registrations r
  where r.event_id = p_event_id and r.registration_status = 'confirmed';

  select r.* into existing_registration from public.registrations r
  where r.event_id = p_event_id and r.request_id = p_request_id;
  if found then
    if existing_registration.registration_status = 'confirmed'
      and existing_registration.full_name = p_full_name and existing_registration.email = p_email
      and existing_registration.organization = p_organization
      and existing_registration.contact_number = p_contact_number
    then
      return query select 'confirmed'::text, existing_registration.id, seats_taken,
        greatest(0, selected_event.capacity - seats_taken);
    else
      return query select 'request_conflict'::text, null::uuid, null::integer, null::integer;
    end if;
    return;
  end if;

  if selected_event.registration_status <> 'open' or selected_event.registration_deadline <= clock_timestamp() then
    return query select 'registration_closed'::text, null::uuid, null::integer, null::integer;
    return;
  end if;

  if exists (select 1 from public.registrations r where r.event_id = p_event_id
    and r.email = p_email and r.registration_status = 'confirmed') then
    return query select 'duplicate_registration'::text, null::uuid, null::integer, null::integer;
    return;
  end if;

  if seats_taken >= selected_event.capacity then
    return query select 'event_full'::text, null::uuid, seats_taken, 0;
    return;
  end if;

  insert into public.registrations (event_id, full_name, email, organization, contact_number, consent_at, request_id)
  values (p_event_id, p_full_name, p_email, p_organization, p_contact_number, clock_timestamp(), p_request_id)
  returning id into new_id;
  return query select 'confirmed'::text, new_id, seats_taken + 1, selected_event.capacity - seats_taken - 1;
end;
$$;

revoke all on function public.scanova_set_updated_at() from public, anon, authenticated;
revoke all on function public.scanova_event_capacity_floor() from public, anon, authenticated;
revoke all on function public.scanova_register(uuid, text, text, text, text, boolean, uuid)
  from public, anon, authenticated;
