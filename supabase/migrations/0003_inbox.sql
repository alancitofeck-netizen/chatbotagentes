-- Inbox conversacional (lectura + gestión): etiquetas + resolución de nombres
-- de miembros + Realtime. Spec: docs/blueprint/02-database.md (tags,
-- contact_tags ya diseñadas, nunca aplicadas), docs/blueprint/04-inbox.md.
-- Reutiliza conversations/messages/notes/contacts de 0002_crm_and_dashboard.sql.
-- core.is_workspace_member / core.has_workspace_role existen desde 0001.

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  color text not null default 'neutral',
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.contact_tags (
  contact_id uuid not null references public.contacts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (contact_id, tag_id)
);

create index if not exists contact_tags_tag_id_idx on public.contact_tags (tag_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;

create policy "tags_select" on public.tags
  for select using (core.is_workspace_member(workspace_id));
create policy "tags_insert" on public.tags
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "tags_delete" on public.tags
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- contact_tags scopes through its parent contact's workspace_id, same pattern
-- already used for pipeline_stages/pipeline_items in 0002 (scoped via pipeline).
create policy "contact_tags_select" on public.contact_tags
  for select using (
    exists (
      select 1 from public.contacts c
      where c.id = contact_tags.contact_id and core.is_workspace_member(c.workspace_id)
    )
  );
create policy "contact_tags_write" on public.contact_tags
  for all using (
    exists (
      select 1 from public.contacts c
      where c.id = contact_tags.contact_id
        and core.has_workspace_role(c.workspace_id, array['owner', 'admin', 'agent'])
    )
  )
  with check (
    exists (
      select 1 from public.contacts c
      where c.id = contact_tags.contact_id
        and core.has_workspace_role(c.workspace_id, array['owner', 'admin', 'agent'])
    )
  );

-- ---------------------------------------------------------------------------
-- public.workspace_member_names — resolves display name/email for a
-- workspace's members. workspace_members has no name column and the client
-- has no access to auth.users, so this SECURITY DEFINER function is the only
-- way to show "assigned to" labels. Lives in `public` (not `core`, where
-- is_workspace_member/has_workspace_role live) because it must be callable
-- via supabase.rpc() from server code — PostgREST only exposes the `public`
-- schema by default, while `core` is reserved for RLS-internal helpers that
-- are only ever referenced from SQL (inside policy definitions), never RPC'd.
-- ---------------------------------------------------------------------------

create or replace function public.workspace_member_names(ws_id uuid)
returns table (member_id uuid, user_id uuid, full_name text, email text)
language sql
security definer
set search_path = ''
stable
as $$
  select
    m.id as member_id,
    m.user_id,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email) as full_name,
    u.email
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = ws_id
    and core.is_workspace_member(ws_id);
$$;

grant execute on function public.workspace_member_names(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime — first use in this project. RLS still applies to Postgres
-- Changes subscriptions, so no extra authorization logic is needed client-side.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
