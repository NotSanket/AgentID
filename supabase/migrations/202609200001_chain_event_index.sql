begin;

create table if not exists public.chain_event_index (
  chain_id bigint not null check (chain_id > 0),
  contract_address text not null check (char_length(contract_address) = 42),
  block_number bigint not null check (block_number >= 0),
  transaction_hash text not null,
  log_index integer not null check (log_index >= 0),
  event_name text not null check (event_name in (
    'AgentRegistered',
    'AgentUpdated',
    'AgentRevoked',
    'AgentReactivated'
  )),
  agent_id text not null,
  decoded_data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (chain_id, contract_address, transaction_hash, log_index)
);

create index if not exists chain_event_index_lookup_idx
  on public.chain_event_index (chain_id, contract_address, block_number, log_index);

create index if not exists chain_event_index_agent_idx
  on public.chain_event_index (agent_id, block_number);

create table if not exists public.chain_indexer_state (
  chain_id bigint not null check (chain_id > 0),
  contract_address text not null check (char_length(contract_address) = 42),
  last_scanned_block bigint not null check (last_scanned_block >= 0),
  updated_at timestamptz not null default now(),
  primary key (chain_id, contract_address)
);

create or replace function public.prevent_chain_indexer_regression()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.last_scanned_block := greatest(old.last_scanned_block, new.last_scanned_block);
  end if;
  return new;
end;
$$;

drop trigger if exists chain_indexer_state_no_regression on public.chain_indexer_state;
create trigger chain_indexer_state_no_regression
before update on public.chain_indexer_state
for each row execute function public.prevent_chain_indexer_regression();

alter table public.chain_event_index enable row level security;
alter table public.chain_indexer_state enable row level security;

revoke all on table public.chain_event_index from anon, authenticated;
revoke all on table public.chain_indexer_state from anon, authenticated;
grant select, insert, update, delete on table public.chain_event_index to service_role;
grant select, insert, update, delete on table public.chain_indexer_state to service_role;
revoke all on function public.prevent_chain_indexer_regression() from public, anon, authenticated;
grant execute on function public.prevent_chain_indexer_regression() to service_role;

commit;
