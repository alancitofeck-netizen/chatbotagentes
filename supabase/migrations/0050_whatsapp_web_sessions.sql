-- Second WhatsApp channel: "WhatsApp Web" via QR code (Baileys), independent
-- of YCloud. Unlike every existing integration (one shared credential per
-- (workspace, provider) — see integration_connections, 0011), this one is
-- N-per-workspace: any member (Owner/Admin/Agent) can connect their OWN
-- personal WhatsApp number. That per-user, constantly-mutating-credential
-- shape doesn't fit integration_connections at all (same reasoning that
-- already justified kpi_sheet_connections as its own table, 0033_kpi_module.sql
-- — here even more so: higher write frequency, per-member granularity, no
-- single shared secret). The live integration_connections_provider_check
-- constraint is deliberately left untouched by this feature.
--
-- This table is the UI-facing/Realtime-subscribed status row. The actual
-- Baileys auth-state (Signal protocol keys, mutated on every message) lives
-- in whatsapp_web_credentials (0051), split out specifically so per-message
-- credential churn never fires a Realtime event toward the browser.
create table if not exists public.whatsapp_web_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  status text not null default 'connecting'
    check (status in ('connecting', 'qr_pending', 'connected', 'disconnected', 'logged_out')),
  phone_e164 text,
  device_name text,
  qr_data text,
  qr_expires_at timestamptz,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  disconnect_reason text,
  -- Vault secret id for this session's AES-256-GCM symmetric key (used by the
  -- worker to encrypt/decrypt rows in whatsapp_web_credentials) — NOT the
  -- auth-state blob itself. Same "opaque Vault ref, never the secret" shape
  -- as integration_connections.credentials_vault_ref.
  credentials_vault_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, member_id)
);

create index if not exists whatsapp_web_sessions_workspace_id_idx on public.whatsapp_web_sessions (workspace_id);

alter table public.whatsapp_web_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- Two small RLS helpers, complementing core.has_workspace_role/
-- core.is_workspace_member (0001_workspaces_and_members.sql) — not a
-- replacement, this feature's permission rule (Owner: everyone; Admin:
-- everyone except the Owner's own connection; Agent: only their own) needs
-- one more primitive than those two already provide.
-- ---------------------------------------------------------------------------
create or replace function core.is_own_member_row(p_member_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where id = p_member_id and user_id = auth.uid()
  )
$$;

create or replace function core.member_role_of(p_member_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.workspace_members where id = p_member_id
$$;

-- SELECT only — no insert/update/delete policy for `authenticated` at all
-- (RLS enabled + no write policy = default-deny, same posture already used
-- for kpi_entries/kpi_setters in 0033_kpi_module.sql). Every write goes
-- through provision_whatsapp_web_session below (human-triggered connect) or
-- the worker's own service-role client (socket lifecycle) — never a raw
-- table write from the browser.
create policy "whatsapp_web_sessions_select" on public.whatsapp_web_sessions
  for select using (
    core.has_workspace_role(workspace_id, array['owner', 'admin'])
    or core.is_own_member_row(member_id)
  );

-- ---------------------------------------------------------------------------
-- provision_whatsapp_web_session — the ONE human-authenticated write path.
-- Mirrors upsert_whatsapp_integration's Vault-write shape
-- (0012_whatsapp_integration_vault.sql: vault.create_secret + revoke-from-
-- public/grant-to-authenticated), applied to a per-session symmetric key
-- instead of a provider API key.
--
-- Permission rule (confirmed with the user): Owner manages any connection in
-- the workspace; Admin manages any connection except the Owner's own; Agent
-- manages only their own.
-- ---------------------------------------------------------------------------
create or replace function public.provision_whatsapp_web_session(
  p_workspace_id uuid,
  p_member_id uuid
)
returns table (session_id uuid, fresh_login boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_status text;
  v_secret_id uuid;
  v_old_secret_id uuid;
  v_target_role text;
begin
  v_target_role := core.member_role_of(p_member_id);

  if not (
    core.is_own_member_row(p_member_id)
    or core.has_workspace_role(p_workspace_id, array['owner'])
    or (core.has_workspace_role(p_workspace_id, array['admin']) and v_target_role <> 'owner')
  ) then
    raise exception 'not authorized to manage this WhatsApp Web connection';
  end if;

  select id, status into v_session_id, v_status
  from public.whatsapp_web_sessions
  where workspace_id = p_workspace_id and member_id = p_member_id;

  if v_session_id is null then
    v_secret_id := vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'whatsapp_web_session_key:' || p_workspace_id::text || ':' || p_member_id::text
    );
    insert into public.whatsapp_web_sessions (workspace_id, member_id, status, credentials_vault_ref)
    values (p_workspace_id, p_member_id, 'connecting', v_secret_id)
    returning id into v_session_id;
    return query select v_session_id, true;
    return;
  end if;

  if v_status = 'logged_out' then
    -- A real logout invalidates every Signal key — a fresh key + a clean
    -- credentials slate, never reuse of the old one. vault.secrets.name is
    -- unique, so the new secret needs a name distinct from the one it's
    -- replacing (appending the session id does that); the old secret is
    -- then deleted outright — otherwise it's a permanently orphaned row in
    -- Vault every time a member logs out and reconnects.
    select credentials_vault_ref into v_old_secret_id
    from public.whatsapp_web_sessions where id = v_session_id;

    v_secret_id := vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'whatsapp_web_session_key:' || p_workspace_id::text || ':' || p_member_id::text || ':' || v_session_id::text || ':' || extract(epoch from clock_timestamp())::text
    );
    delete from public.whatsapp_web_credentials where whatsapp_web_credentials.session_id = v_session_id;
    update public.whatsapp_web_sessions
    set status = 'connecting', credentials_vault_ref = v_secret_id, qr_data = null, qr_expires_at = null,
        phone_e164 = null, device_name = null, updated_at = now()
    where id = v_session_id;

    if v_old_secret_id is not null then
      delete from vault.secrets where id = v_old_secret_id;
    end if;

    return query select v_session_id, true;
    return;
  end if;

  if v_status = 'disconnected' then
    update public.whatsapp_web_sessions
    set status = 'connecting', updated_at = now()
    where id = v_session_id;
    return query select v_session_id, false;
    return;
  end if;

  -- connecting/qr_pending/connected: no-op, just hand back the existing id.
  return query select v_session_id, false;
end;
$$;

revoke all on function public.provision_whatsapp_web_session(uuid, uuid) from public;
grant execute on function public.provision_whatsapp_web_session(uuid, uuid) to authenticated;
