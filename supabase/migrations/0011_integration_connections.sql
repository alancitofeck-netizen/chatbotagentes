-- integration_connections: maps an external provider account (YCloud WABA/
-- phone number, HighLevel location, etc.) to the workspace that owns it.
-- Built now because the YCloud webhook (src/app/api/webhooks/ycloud/route.ts)
-- needs it for its most security-critical step: resolving `workspace_id`.
--
-- docs/blueprint/04-inbox.md + 12-security-audit.md #1 are explicit that this
-- resolution must happen by the RECEIVING number/WABA (`to`/`wabaId` in the
-- payload) against this table — never by the sending contact's own phone
-- (`from`), since the same contact phone could message business numbers
-- belonging to different workspaces. Getting this wrong is the one place an
-- application bug (not RLS) could leak conversations across tenants.
--
-- `external_account_id` stores the YCloud phone-number identifier as it
-- appears in the webhook's `to` field, matched exactly.
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('ycloud', 'openrouter', 'highlevel')),
  external_account_id text not null,
  status text not null default 'active',
  credentials_vault_ref text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (provider, external_account_id)
);

create index if not exists integration_connections_workspace_id_idx on public.integration_connections (workspace_id);

alter table public.integration_connections enable row level security;

create policy "integration_connections_select" on public.integration_connections
  for select using (core.is_workspace_member(workspace_id));
create policy "integration_connections_insert" on public.integration_connections
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "integration_connections_update" on public.integration_connections
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "integration_connections_delete" on public.integration_connections
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
