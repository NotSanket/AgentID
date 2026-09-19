# AgentID Supabase files

Apply the SQL files in `migrations/` in filename order. The Stage 3 migration creates only off-chain application tables. It does not copy or replace AgentRegistry wallet ownership or lifecycle state.

The tables have Row Level Security enabled, no browser policies, and explicit anonymous/authenticated access revocation. The backend uses a server-only service-role key, which bypasses RLS and must never be exposed to browser code.

See `docs/SUPABASE.md` for the complete beginner setup and verification workflow.
