-- Core tables needed for the Dashboard + CRM Kanban slice.
-- Spec: docs/blueprint/02-database.md (workspace_modules, contacts, conversations,
-- messages, pipelines/pipeline_stages/pipeline_items, opportunities, bookings, notes)
-- plus two additions justified and documented in that same file: contacts.company
-- and the new `tasks` table. RLS follows the corrected pattern from
-- docs/blueprint/09-security.md (commands separated, WITH CHECK on INSERT/UPDATE).
-- core.is_workspace_member / core.has_workspace_role already exist (migration 0001).

create table if not exists public.workspace_modules (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module_key text not null check (module_key in ('crm', 'ats')),
  enabled boolean not null default false,
  config jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (workspace_id, module_key)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  company text,
  avatar_url text,
  source text,
  custom_fields jsonb not null default '{}',
  whatsapp_opt_status text not null default 'unknown'
    check (whatsapp_opt_status in ('subscribed', 'unsubscribed', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, phone)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  whatsapp_phone_number_id text,
  status text not null default 'open' check (status in ('open', 'pending_human', 'closed')),
  mode text not null default 'human' check (mode in ('human', 'ai', 'hybrid')),
  assigned_user_id uuid references public.workspace_members (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('contact', 'agent', 'ai', 'system')),
  sender_id uuid,
  type text not null default 'text',
  content jsonb not null default '{}',
  external_id text,
  wamid text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module_key text not null check (module_key in ('crm', 'ats')),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  name text not null,
  position int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  external_refs jsonb not null default '{}'
);

create table if not exists public.pipeline_items (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages (id) on delete cascade,
  item_type text not null check (item_type in ('opportunity', 'candidate_application')),
  item_id uuid not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  pipeline_item_id uuid references public.pipeline_items (id) on delete set null,
  title text not null,
  value numeric not null default 0,
  currency text not null default 'USD',
  owner_id uuid references public.workspace_members (id) on delete set null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  provider text not null default 'internal' check (provider in ('internal', 'highlevel')),
  external_id text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'rescheduled', 'cancelled', 'completed')),
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  notable_type text not null,
  notable_id uuid not null,
  author_id uuid references public.workspace_members (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  related_type text,
  related_id uuid,
  assigned_to uuid references public.workspace_members (id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists contacts_workspace_id_idx on public.contacts (workspace_id);
create index if not exists contacts_opt_status_idx on public.contacts (workspace_id, whatsapp_opt_status);

create index if not exists conversations_workspace_status_idx
  on public.conversations (workspace_id, status, last_message_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
create index if not exists messages_workspace_created_idx
  on public.messages (workspace_id, created_at desc);

create index if not exists pipeline_items_board_idx
  on public.pipeline_items (pipeline_id, stage_id, position);

create index if not exists opportunities_workspace_idx on public.opportunities (workspace_id);
create index if not exists bookings_workspace_start_idx on public.bookings (workspace_id, start_time);

create index if not exists tasks_related_idx on public.tasks (related_type, related_id, completed_at);
create index if not exists tasks_assignee_idx
  on public.tasks (workspace_id, assigned_to, completed_at, due_at);

-- ---------------------------------------------------------------------------
-- RLS — enable + policies separated by command (docs/blueprint/09-security.md #2)
-- ---------------------------------------------------------------------------

alter table public.workspace_modules enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.pipeline_items enable row level security;
alter table public.opportunities enable row level security;
alter table public.bookings enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;

-- workspace_modules: any member reads, only owner/admin toggles
create policy "workspace_modules_select" on public.workspace_modules
  for select using (core.is_workspace_member(workspace_id));
create policy "workspace_modules_insert" on public.workspace_modules
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "workspace_modules_update" on public.workspace_modules
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Generic pattern for the rest: member reads; owner/admin/agent write; owner/admin deletes.
create policy "contacts_select" on public.contacts
  for select using (core.is_workspace_member(workspace_id));
create policy "contacts_insert" on public.contacts
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "contacts_update" on public.contacts
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "contacts_delete" on public.contacts
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "conversations_select" on public.conversations
  for select using (core.is_workspace_member(workspace_id));
create policy "conversations_insert" on public.conversations
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "conversations_update" on public.conversations
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "messages_select" on public.messages
  for select using (core.is_workspace_member(workspace_id));
create policy "messages_insert" on public.messages
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "pipelines_select" on public.pipelines
  for select using (core.is_workspace_member(workspace_id));
create policy "pipelines_insert" on public.pipelines
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "pipelines_update" on public.pipelines
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- pipeline_stages/pipeline_items scope through their parent pipeline's workspace_id.
create policy "pipeline_stages_select" on public.pipeline_stages
  for select using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_stages.pipeline_id and core.is_workspace_member(p.workspace_id)
    )
  );
create policy "pipeline_stages_write" on public.pipeline_stages
  for all using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_stages.pipeline_id
        and core.has_workspace_role(p.workspace_id, array['owner', 'admin'])
    )
  )
  with check (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_stages.pipeline_id
        and core.has_workspace_role(p.workspace_id, array['owner', 'admin'])
    )
  );

create policy "pipeline_items_select" on public.pipeline_items
  for select using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_items.pipeline_id and core.is_workspace_member(p.workspace_id)
    )
  );
create policy "pipeline_items_write" on public.pipeline_items
  for all using (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_items.pipeline_id
        and core.has_workspace_role(p.workspace_id, array['owner', 'admin', 'agent'])
    )
  )
  with check (
    exists (
      select 1 from public.pipelines p
      where p.id = pipeline_items.pipeline_id
        and core.has_workspace_role(p.workspace_id, array['owner', 'admin', 'agent'])
    )
  );

create policy "opportunities_select" on public.opportunities
  for select using (core.is_workspace_member(workspace_id));
create policy "opportunities_insert" on public.opportunities
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "opportunities_update" on public.opportunities
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "opportunities_delete" on public.opportunities
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "bookings_select" on public.bookings
  for select using (core.is_workspace_member(workspace_id));
create policy "bookings_insert" on public.bookings
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "bookings_update" on public.bookings
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "notes_select" on public.notes
  for select using (core.is_workspace_member(workspace_id));
create policy "notes_insert" on public.notes
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "notes_delete" on public.notes
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "tasks_select" on public.tasks
  for select using (core.is_workspace_member(workspace_id));
create policy "tasks_insert" on public.tasks
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "tasks_update" on public.tasks
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "tasks_delete" on public.tasks
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
