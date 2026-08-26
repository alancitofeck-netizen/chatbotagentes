-- Fase 11 de Agentes IA — Análisis IA con sugerencias accionables. Ninguna
-- tabla de "sugerencia pendiente de aprobación" existía todavía en el
-- proyecto (confirmado por grep antes de esta migración) — esta es la
-- única tabla nueva de la fase, todo lo demás (aplicar un cambio aceptado)
-- pasa por las Server Actions ya existentes en src/lib/ai-agents/actions.ts.
create table public.ai_agent_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.ai_agents (id) on delete cascade,
  kind text not null check (kind in ('strength', 'opportunity', 'pattern')),
  -- NULL para strength/pattern (informativas, sin acción). Solo 'opportunity' trae field+proposed_value.
  field text check (field in ('rules', 'tools', 'prompt')),
  title text not null,
  body text not null,
  proposed_value jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references public.workspace_members (id) on delete set null,
  reviewed_at timestamptz,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index ai_agent_suggestions_agent_idx on public.ai_agent_suggestions (agent_id, generated_at desc);

alter table public.ai_agent_suggestions enable row level security;

-- Mismo criterio de RLS que ai_agents: cualquier miembro del workspace lee,
-- solo owner/admin escribe (aunque en la práctica todo el write path pasa
-- por Server Actions con service-role, se deja la policy real igual que en
-- el resto del proyecto, en vez de confiar solo en el gate de la app).
create policy "ai_agent_suggestions_select" on public.ai_agent_suggestions
  for select using (core.is_workspace_member(workspace_id));
create policy "ai_agent_suggestions_insert" on public.ai_agent_suggestions
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "ai_agent_suggestions_update" on public.ai_agent_suggestions
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
