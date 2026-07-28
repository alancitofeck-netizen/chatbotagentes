-- Mini Apps module (Phase 1): registry + public lead-ingestion inbox.
-- See docs/blueprint plan for the full design — this migration only adds
-- the admin/registry + leads tables. No public-page hosting/rendering
-- exists yet (Phase 2); `slug`/`branding`/`config` are forward-compatible
-- placeholders for it.

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps'));

create table public.mini_apps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  -- Forward-compat for a future template catalog; only one real value exists today.
  template_key text not null default 'simulador_retiro' check (template_key in ('simulador_retiro')),
  -- Globally unique (not per-workspace): a future hosted public page would
  -- live at a single shared subdomain (apps.growthlink.uk/<slug>). Nothing
  -- is served at this path yet in this phase.
  slug text not null unique,
  -- Phase 1: the mini app is built and hosted externally by a 3rd-party dev
  -- (e.g. the retirement simulator). This is just where it actually lives.
  external_url text,
  assigned_agent_id uuid references public.workspace_members (id) on delete set null,
  -- CORS allow-list: exact origins (scheme+host[+port]).
  allowed_origins text[] not null default '{}',
  api_key_hash text not null,
  api_key_last4 text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  branding jsonb not null default '{}',
  config jsonb not null default '{}',
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mini_apps_workspace_id_idx on public.mini_apps (workspace_id);

create table public.mini_app_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  mini_app_id uuid not null references public.mini_apps (id) on delete cascade,
  -- Denormalized so "filter by origen_app / agente" stays a plain indexed
  -- column even if the mini_apps row's own name/agent changes later.
  origen_app text not null,
  agente text,
  nombre text not null,
  whatsapp text not null,
  consentimiento boolean not null,
  consentimiento_fecha timestamptz not null,
  fecha timestamptz not null,
  received_at timestamptz not null default now(),
  -- Everything template-specific (edad, ahorro_mensual, fondo_estimado, ...)
  -- plus any unrecognized future field — one bucket, not one column per field.
  data jsonb not null default '{}',
  contact_id uuid references public.contacts (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'discarded')),
  ip_address text,
  user_agent text,
  -- Defense-in-depth on top of the webhook_events ledger check.
  unique (mini_app_id, whatsapp, fecha)
);

create index mini_app_leads_workspace_id_idx on public.mini_app_leads (workspace_id);
create index mini_app_leads_mini_app_received_idx on public.mini_app_leads (mini_app_id, received_at desc);
create index mini_app_leads_origen_agente_idx on public.mini_app_leads (workspace_id, origen_app, agente);

alter table public.mini_apps enable row level security;
alter table public.mini_app_leads enable row level security;

-- mini_apps: any workspace member can create/edit (explicit product ask —
-- "cualquier usuario del workspace puede crear mini apps"). Regenerating the
-- API key and deleting are gated owner/admin at the Server Action layer
-- (requireManagerRole), not via a stricter RLS policy, to keep this simple.
create policy "mini_apps_select" on public.mini_apps
  for select using (core.is_workspace_member(workspace_id));
create policy "mini_apps_insert" on public.mini_apps
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "mini_apps_update" on public.mini_apps
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "mini_apps_delete" on public.mini_apps
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- mini_app_leads: deliberately NO insert policy for authenticated/anon — the
-- only legitimate writer is the public POST endpoint, which always uses
-- createServiceRoleClient() (bypasses RLS), same reasoning as webhook_events.
create policy "mini_app_leads_select" on public.mini_app_leads
  for select using (core.is_workspace_member(workspace_id));
create policy "mini_app_leads_update" on public.mini_app_leads
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
