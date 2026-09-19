begin;

create extension if not exists pgcrypto;

create table if not exists public.agent_metadata (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null unique,
  display_name text,
  description text,
  category text,
  capabilities jsonb not null default '[]'::jsonb,
  avatar_key text,
  accent_theme text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  request_id text,
  sender_agent_id text,
  receiver_agent_id text,
  action text,
  result text not null check (result in ('VERIFIED', 'BLOCKED')),
  code text not null,
  reason text not null,
  recovered_wallet text,
  registered_wallet text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  sender_agent_id text not null,
  receiver_agent_id text not null,
  action text not null,
  request_payload jsonb not null,
  response_payload jsonb not null,
  authentication_code text not null,
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.replay_nonces (
  id uuid primary key default gen_random_uuid(),
  sender_agent_id text not null,
  nonce text not null,
  request_id text not null,
  consumed_at timestamptz not null default now(),
  constraint replay_nonces_sender_nonce_unique unique (sender_agent_id, nonce)
);

create index if not exists audit_events_created_at_idx on public.audit_events (created_at desc);
create index if not exists audit_events_sender_agent_id_idx on public.audit_events (sender_agent_id);
create index if not exists audit_events_receiver_agent_id_idx on public.audit_events (receiver_agent_id);
create index if not exists audit_events_event_type_idx on public.audit_events (event_type);
create index if not exists audit_events_result_idx on public.audit_events (result);
create index if not exists audit_events_request_id_idx on public.audit_events (request_id);
create index if not exists interactions_created_at_idx on public.interactions (created_at desc);
create index if not exists interactions_sender_agent_id_idx on public.interactions (sender_agent_id);
create index if not exists interactions_receiver_agent_id_idx on public.interactions (receiver_agent_id);
create index if not exists replay_nonces_request_id_idx on public.replay_nonces (request_id);
create index if not exists replay_nonces_consumed_at_idx on public.replay_nonces (consumed_at desc);

alter table public.agent_metadata enable row level security;
alter table public.audit_events enable row level security;
alter table public.interactions enable row level security;
alter table public.replay_nonces enable row level security;

revoke all on table public.agent_metadata from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;
revoke all on table public.interactions from anon, authenticated;
revoke all on table public.replay_nonces from anon, authenticated;

grant all on table public.agent_metadata to service_role;
grant all on table public.audit_events to service_role;
grant all on table public.interactions to service_role;
grant all on table public.replay_nonces to service_role;

commit;
