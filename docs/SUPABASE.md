# AgentID Supabase setup

## What Supabase does in Stage 3

Supabase provides the persistent PostgreSQL database for application data that should survive backend restarts:

- authentication audit events;
- successful verified interaction history;
- consumed replay nonces;
- richer application metadata for agents;
- the stored facts used by the analytics service.

Supabase is **not** the identity authority. `AgentRegistry` on Ethereum remains authoritative for whether an AgentID exists, which wallet owns it, and whether it is Active or Revoked. Metadata returned by the API is always merged with a fresh blockchain record before it is sent to a client.

The backend also has a complete in-memory mode. Supabase credentials are optional for development and classroom demonstrations.

## 1. Create a free Supabase project

1. Open [Supabase](https://supabase.com/) and sign in.
2. Create a new project in an organization.
3. Choose a project name, database password, and nearby region.
4. Wait for the project database to finish provisioning.

Do not place the database password or any API key in committed files.

## 2. Find the project URL and server key

Open the project's **Connect** dialog to find its URL. API keys can also be managed under **Settings > API Keys**.

For this backend, use a server-side **secret key** (`sb_secret_...`) when available. A legacy `service_role` key also works. The environment variable retains the requested name `SUPABASE_SERVICE_ROLE_KEY`, but its value may be the newer server secret key.

Never use a publishable/anonymous key for the backend persistence adapter. Never place a secret or service-role key in browser code. Supabase documents that server secret and legacy service-role keys map to the `service_role` database role and bypass Row Level Security, so they must remain on the server: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 3. Configure backend environment variables

Create the untracked local environment file:

```powershell
cd "C:\BlockChain Project67\backend"
Copy-Item .env.example .env
```

Edit `backend/.env`:

```dotenv
SUPABASE_ENABLED=true
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SECRET_KEY
```

The `.gitignore` excludes `.env` and `.env.*` except for the safe `.env.example`. Do not paste a real key into documentation, source code, screenshots, logs, chat, or frontend configuration.

## 4. Apply the SQL migration

The versioned migration is:

```text
supabase/migrations/202609190001_stage3_persistence.sql
```

### Beginner option: Supabase SQL Editor

1. Open the project dashboard.
2. Open **SQL Editor**.
3. Create a new query.
4. Copy the complete migration file into the query.
5. Review it, then run it once.
6. Confirm that `agent_metadata`, `audit_events`, `interactions`, and `replay_nonces` exist in the Table Editor.

The SQL uses `create table if not exists` and `create index if not exists`, so rerunning it is safe for the same schema. For a long-lived team project, use the CLI migration workflow rather than making unrelated manual schema edits in the remote dashboard.

### CLI option

If the Supabase CLI is available, log in, link the repository to the project, and push the committed migration:

```powershell
cd "C:\BlockChain Project67"
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Supabase explains the tracked migration workflow in its [database migration guide](https://supabase.com/docs/guides/deployment/database-migrations).

## 5. Seed demo agent metadata

After the migration and environment configuration:

```powershell
cd "C:\BlockChain Project67\backend"
$env:NODE_OPTIONS='--require=../.tools/node-userinfo-workaround.cjs' # current Codex/Windows host only
npm run seed:data
```

The command upserts TravelAI, HotelAI, and PaymentAI metadata by `agent_id`, so repeated runs update the same three rows rather than duplicating them. It does not register, update, revoke, or reactivate blockchain identities.

## 6. Start and verify the backend

Start the local blockchain and seed `AgentRegistry` as described in the root README. Then start the backend:

```powershell
cd "C:\BlockChain Project67\backend"
$env:NODE_OPTIONS='--require=../.tools/node-userinfo-workaround.cjs' # current Codex/Windows host only
npm run dev
```

Check:

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/health
Invoke-RestMethod http://127.0.0.1:4000/api/metadata/agents
Invoke-RestMethod http://127.0.0.1:4000/api/audit
Invoke-RestMethod http://127.0.0.1:4000/api/interactions
Invoke-RestMethod http://127.0.0.1:4000/api/analytics/summary
```

A successful persistent startup reports:

```text
Persistence mode: SUPABASE
```

`GET /api/health` then returns `persistenceMode: "SUPABASE"` and `supabaseConnected: true` without returning credentials.

Run a signed authentication demo, inspect the database tables, restart only the backend, and inspect them again. Audit events, successful interactions, and consumed nonces should remain. The normal automated suite uses in-memory and mocked Supabase clients and never requires internet access.

## 7. Fallback mode

Fallback mode is selected when:

- `SUPABASE_ENABLED=false`;
- the URL or server key is absent; or
- the startup Supabase health check fails.

The backend logs `Persistence mode: IN_MEMORY`. Authentication, deterministic agent communication, audit APIs, interaction APIs, analytics, metadata, and all nine security scenarios continue to work. Audit events, interactions, and replay nonces reset when the process exits. Demo metadata is preloaded for each process.

To force fallback mode:

```dotenv
SUPABASE_ENABLED=false
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## 8. Security model and Row Level Security

The migration:

- enables Row Level Security on all four tables;
- creates no anonymous or authenticated browser policies;
- revokes table access from the `anon` and `authenticated` roles;
- grants server access to `service_role`.

This prevents accidental public Data API access. It does **not** make a leaked server key safe: service-role access bypasses RLS. Supabase explicitly warns that secret/service-role keys must never be exposed to customers or browsers: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [securing data](https://supabase.com/docs/guides/database/secure-data).

A later frontend must call the AgentID backend or use separate publishable-key policies designed for specific public data. It must never receive `SUPABASE_SERVICE_ROLE_KEY`.

## 9. Test commands

The normal suite is offline:

```powershell
cd "C:\BlockChain Project67\backend"
npm run typecheck
npm test
```

The suite covers fallback behavior, persistence interfaces, filtering, pagination, interaction gating, analytics, metadata merging, atomic duplicate-nonce mapping, simulated restart persistence, and mocked Supabase repository behavior.

## 10. Troubleshooting

- `Persistence mode: IN_MEMORY` with a warning: verify all three Supabase variables and confirm the migration has been applied.
- `SERVICE_UNAVAILABLE` during nonce consumption: the persistent replay decision could not be made, so authentication failed closed rather than bypassing replay protection.
- Audit or interaction persistence warning: the security decision or verified response was preserved, but the operational record could not be stored.
- Empty metadata table: run `npm run seed:data` with Supabase mode confirmed.
- Local Hardhat identity missing: restart the local node, then rerun `npm run demo:localhost`; Supabase does not replace blockchain registration.

Live Supabase connectivity was not verified during Stage 3 implementation because no real project URL or server key was provided. The official client integration is implemented and covered with mocked-client tests.
