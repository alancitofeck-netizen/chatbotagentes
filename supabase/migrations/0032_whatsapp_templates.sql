-- Plantillas de WhatsApp (Blueprint: 08-integrations.md/09-security.md
-- mencionan plantillas solo como requisito de cumplimiento fuera de la
-- ventana de 24h — nunca hubo tabla/UI de gestión). Gestión real vía la API
-- de templates de YCloud (POST/GET/DELETE /v2/whatsapp/templates,
-- src/lib/integrations/ycloud.ts), sincronizada por el webhook
-- whatsapp.template.reviewed (src/app/api/webhooks/ycloud/route.ts).
--
-- workspace_id se guarda directo en la fila (no se resuelve por wabaId en el
-- webhook): resolveWorkspaceIdForYCloudAccount (ycloud.ts) matchea por
-- número de teléfono, no por WABA, así que no sirve para esto — en cambio el
-- webhook busca la fila por ycloud_template_id, que ya conoce su workspace.
create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  ycloud_template_id text not null,
  name text not null,
  language text not null,
  category text not null check (category in ('AUTHENTICATION', 'MARKETING', 'UTILITY')),
  components jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  waba_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name, language),
  unique (ycloud_template_id)
);

create index if not exists whatsapp_templates_workspace_id_idx on public.whatsapp_templates (workspace_id);

alter table public.whatsapp_templates enable row level security;

create policy "whatsapp_templates_select" on public.whatsapp_templates
  for select using (core.is_workspace_member(workspace_id));
create policy "whatsapp_templates_insert" on public.whatsapp_templates
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "whatsapp_templates_update" on public.whatsapp_templates
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "whatsapp_templates_delete" on public.whatsapp_templates
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- The template.reviewed webhook runs as service-role (bypasses RLS anyway)
-- but status/updated_at need to change on an otherwise-immutable-by-workspace
-- row — the update policy above already covers owner/admin from the client
-- side; service-role writes aren't subject to RLS at all.
