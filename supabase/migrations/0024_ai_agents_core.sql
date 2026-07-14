-- "Agentes IA" (CRM tab) — re-architects the Motor de IA from "one active
-- prompt per (workspace, module_key)" to real named, multi-agent identities.
-- Not in docs/blueprint/02-database.md at all — a genuine extension beyond
-- the documented architecture, built at the user's explicit request so a
-- workspace can run several specialized AI agents without further schema
-- changes later.
--
-- `ai_prompts` keeps being the versioned PROMPT CONTENT (draft/active/
-- archived, system_prompt/variables/model_config) — it now belongs to a
-- stable `ai_agents` row via `agent_id` instead of being looked up directly
-- by (workspace_id, module_key). `agent_tools` moves from being a property
-- of one prompt VERSION to a property of the stable AGENT (retooling
-- shouldn't require creating a new prompt version).

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module_key text not null check (module_key in ('crm', 'ats')),
  name text not null,
  description text not null default '',
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  -- Only 'whatsapp' is a real, wired channel in this codebase today
  -- (sendOutboundWhatsAppMessage) — 'linkedin'/'instagram'/etc. are
  -- decorative/future, same "prepared, not wired" posture already used for
  -- documents.source's 'google_docs'/'google_sheets' values.
  channels text[] not null default '{}',
  model text not null default 'openai/gpt-4o-mini',
  temperature numeric not null default 0.7 check (temperature >= 0 and temperature <= 2),
  max_tokens int not null default 1024 check (max_tokens > 0),
  -- Same UTC-3/Mon-Fri/9-18 default already hardcoded in
  -- src/lib/ai/tools/agendaConfig.ts, now configurable per agent.
  business_hours jsonb not null default
    '{"enabled": false, "timezone": "America/Argentina/Buenos_Aires", "days": [1,2,3,4,5], "start": "09:00", "end": "18:00"}',
  response_mode text not null default 'auto' check (response_mode in ('auto', 'assisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_agents_workspace_module_idx on public.ai_agents (workspace_id, module_key);

alter table public.ai_agents enable row level security;

-- Same posture as ai_prompts (docs/blueprint/09-security.md RBAC table —
-- "Editar prompts/tools" is owner/admin only).
create policy "ai_agents_select" on public.ai_agents
  for select using (core.is_workspace_member(workspace_id));
create policy "ai_agents_insert" on public.ai_agents
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "ai_agents_update" on public.ai_agents
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "ai_agents_delete" on public.ai_agents
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- ai_prompts: add agent_id (nullable -> backfill -> NOT NULL, never a blind
-- add-not-null against a populated table). Verified against the real
-- production data before writing this: exactly one (workspace_id,
-- module_key, name) family exists today ("Prompt de prueba E2E"), so this
-- backfill produces exactly one ai_agents row.
-- ---------------------------------------------------------------------------

alter table public.ai_prompts add column if not exists agent_id uuid references public.ai_agents (id) on delete cascade;

insert into public.ai_agents (workspace_id, module_key, name, status, channels, model, response_mode)
select distinct
  p.workspace_id,
  p.module_key,
  p.name,
  case when exists (
    select 1 from public.ai_prompts p2
    where p2.workspace_id = p.workspace_id and p2.module_key = p.module_key and p2.name = p.name and p2.status = 'active'
  ) then 'active' else 'inactive' end,
  array['whatsapp'],
  'openai/gpt-4o-mini',
  'auto'
from public.ai_prompts p
where p.agent_id is null;

update public.ai_prompts p
set agent_id = a.id
from public.ai_agents a
where p.agent_id is null
  and a.workspace_id = p.workspace_id and a.module_key = p.module_key and a.name = p.name;

alter table public.ai_prompts alter column agent_id set not null;
create index if not exists ai_prompts_agent_idx on public.ai_prompts (agent_id);

-- ---------------------------------------------------------------------------
-- agent_tools: repoint prompt_id -> agent_id.
-- ---------------------------------------------------------------------------

alter table public.agent_tools add column if not exists agent_id uuid references public.ai_agents (id) on delete cascade;

update public.agent_tools at
set agent_id = p.agent_id
from public.ai_prompts p
where p.id = at.prompt_id and at.agent_id is null;

-- De-dup: multiple prompt VERSIONS of the same agent could produce
-- duplicate (agent_id, tool_id) pairs after the join above.
delete from public.agent_tools a using public.agent_tools b
where a.agent_id = b.agent_id and a.tool_id = b.tool_id and a.ctid > b.ctid;

-- Old policies reference prompt_id directly — must drop them BEFORE
-- dropping the column, or Postgres refuses (dependent object error).
drop policy if exists "agent_tools_select" on public.agent_tools;
drop policy if exists "agent_tools_write" on public.agent_tools;

alter table public.agent_tools drop constraint if exists agent_tools_pkey;
alter table public.agent_tools alter column agent_id set not null;
alter table public.agent_tools drop column if exists prompt_id;
alter table public.agent_tools add primary key (agent_id, tool_id);

create policy "agent_tools_select" on public.agent_tools
  for select using (
    exists (select 1 from public.ai_agents a where a.id = agent_tools.agent_id and core.is_workspace_member(a.workspace_id))
  );
create policy "agent_tools_write" on public.agent_tools
  for all
  using (
    exists (select 1 from public.ai_agents a where a.id = agent_tools.agent_id and core.has_workspace_role(a.workspace_id, array['owner', 'admin']))
  )
  with check (
    exists (select 1 from public.ai_agents a where a.id = agent_tools.agent_id and core.has_workspace_role(a.workspace_id, array['owner', 'admin']))
  );

-- ---------------------------------------------------------------------------
-- Historial/Métricas tabs (Fase 6 del plan) need to attribute technical/
-- usage rows back to the agent that produced them — nullable since sandbox
-- runs and any future non-agent-driven call must remain valid rows.
-- ---------------------------------------------------------------------------

alter table public.tool_calls add column if not exists agent_id uuid references public.ai_agents (id) on delete set null;
alter table public.audit_log add column if not exists agent_id uuid references public.ai_agents (id) on delete set null;
alter table public.usage_events add column if not exists agent_id uuid references public.ai_agents (id) on delete set null;

create index if not exists tool_calls_agent_idx on public.tool_calls (agent_id);
create index if not exists usage_events_agent_idx on public.usage_events (agent_id);

-- ---------------------------------------------------------------------------
-- agent_test_runs: dedicated log for the "Pruebas"/"Historial" tabs. Sandbox
-- runs deliberately never touch tool_calls/messages/conversation_buffers
-- (docs comment in agentRuntime.ts's runSandboxTurn) — Historial wanting to
-- show sandbox history shouldn't blur that already-justified line, so this
-- is its own small table rather than repurposing tool_calls.
-- ---------------------------------------------------------------------------

create table if not exists public.agent_test_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ai_agents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  test_message text not null,
  reply text,
  tool_trace jsonb not null default '[]',
  error text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric not null default 0,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_test_runs_agent_created_idx on public.agent_test_runs (agent_id, created_at desc);

alter table public.agent_test_runs enable row level security;

create policy "agent_test_runs_select" on public.agent_test_runs
  for select using (core.is_workspace_member(workspace_id));
create policy "agent_test_runs_insert" on public.agent_test_runs
  for insert with check (core.is_workspace_member(workspace_id));
