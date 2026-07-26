-- The actual Baileys auth-state (Signal protocol keys), split from
-- whatsapp_web_sessions (0050) so per-message credential churn never fires a
-- Realtime event toward the browser, and so a client-facing SELECT policy
-- never has to reason about what's safe to expose here (nothing is).
--
-- One row per key rather than one JSON blob per session — mirrors Baileys'
-- own `useMultiFileAuthState` shape. Baileys' key store writes/reads arrive
-- as small per-key batches (e.g. a handful of pre-keys during pairing, one
-- session update per message) — a single mutating blob would force
-- rewriting the whole thing on every message at "hundreds of workspaces"
-- scale; narrow per-key upserts don't.
create table if not exists public.whatsapp_web_credentials (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.whatsapp_web_sessions (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key_type text not null
    check (key_type in ('creds', 'pre-key', 'session', 'sender-key', 'app-state-sync-key', 'app-state-sync-version', 'sender-key-memory')),
  key_id text not null,
  encrypted_value bytea not null,
  iv bytea not null,
  auth_tag bytea not null,
  updated_at timestamptz not null default now(),
  unique (session_id, key_type, key_id)
);

create index if not exists whatsapp_web_credentials_session_id_idx on public.whatsapp_web_credentials (session_id);

alter table public.whatsapp_web_credentials enable row level security;

-- No policy for anon/authenticated at all — not even "does a credential
-- exist" is exposed here (that's already visible via
-- whatsapp_web_sessions.status). Explicit revokes as defense-in-depth,
-- mirroring get_whatsapp_credentials (0013_whatsapp_credentials_lookup.sql).
revoke all on public.whatsapp_web_credentials from anon, authenticated;

-- Read side for the worker: resolves the per-session symmetric key so it can
-- decrypt/encrypt whatsapp_web_credentials rows. Never reachable by
-- anon/authenticated — same posture as get_whatsapp_credentials.
create or replace function public.get_whatsapp_web_session_key(p_session_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select ds.decrypted_secret
  from public.whatsapp_web_sessions s
  join vault.decrypted_secrets ds on ds.id = s.credentials_vault_ref::uuid
  where s.id = p_session_id
$$;

revoke all on function public.get_whatsapp_web_session_key(uuid) from public;
revoke all on function public.get_whatsapp_web_session_key(uuid) from anon;
revoke all on function public.get_whatsapp_web_session_key(uuid) from authenticated;
grant execute on function public.get_whatsapp_web_session_key(uuid) to service_role;
