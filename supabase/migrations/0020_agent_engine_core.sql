-- Motor de IA (Fase 3, docs/blueprint/13-agent-engine.md + 05-ai-engine.md +
-- 04-inbox.md) — tablas núcleo del pipeline que faltaban: `ai_prompts`/
-- `tools`/`agent_tools` (0007_ai_prompts.sql) ya existían como pura
-- configuración (Prompt Builder), sin nada que las ejecutara. Esta migración
-- agrega las piezas de estado/trazabilidad que el pipeline necesita para
-- correr de verdad: Buffer Inteligente, idempotencia de webhooks, métering,
-- auditoría, cuota, y el registro técnico de tool calls.
--
-- Deltas deliberados frente al DDL literal de docs/blueprint/02-database.md
-- (flagueados, no silenciosos):
--   - usage_events suma `is_sandbox boolean` — el botón "Probar" del Prompt
--     Builder (Fase 7) también gasta crédito real de OpenRouter y debe contar
--     contra la cuota del workspace, pero distinguible de tráfico real.
--   - webhook_events no lleva ninguna policy para authenticated/anon — sigue
--     la excepción explícita de 02-database.md ("la única tabla sin RLS de
--     usuario final"): RLS habilitado, cero policies, así que solo
--     service_role (que bypassea RLS) puede tocarla.

create table if not exists public.conversation_buffers (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  window_seconds int not null default 10,
  flush_at timestamptz not null,
  pending_message_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing')),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists conversation_buffers_flush_idx
  on public.conversation_buffers (status, flush_at);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb not null,
  processed_at timestamptz,
  attempts int not null default 0,
  last_error text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null,
  model text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric not null default 0,
  is_sandbox boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_workspace_created_idx
  on public.usage_events (workspace_id, created_at desc);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_type text not null check (actor_type in ('user', 'ai', 'system')),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_log_workspace_created_idx
  on public.audit_log (workspace_id, created_at desc);

create table if not exists public.workspace_quotas (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  ai_monthly_budget_usd numeric,
  ai_requests_per_minute int,
  updated_at timestamptz not null default now()
);

create table if not exists public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  tool_id uuid not null references public.tools (id),
  idempotency_key text not null,
  arguments jsonb not null,
  result jsonb,
  status text not null check (status in ('validated', 'executed', 'rejected', 'failed')),
  error text,
  latency_ms int,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists tool_calls_conversation_created_idx
  on public.tool_calls (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.conversation_buffers enable row level security;
alter table public.webhook_events enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.workspace_quotas enable row level security;
alter table public.tool_calls enable row level security;

-- webhook_events: deliberately zero policies for authenticated/anon — see
-- header comment. Only service_role (bypasses RLS) reads/writes it.

create policy "conversation_buffers_select" on public.conversation_buffers
  for select using (core.is_workspace_member(workspace_id));

create policy "usage_events_select" on public.usage_events
  for select using (core.is_workspace_member(workspace_id));

create policy "audit_log_select" on public.audit_log
  for select using (core.is_workspace_member(workspace_id));

-- audit_log insert: only rows attributed to the calling user themselves
-- (actor_type='user') go through the authenticated client — ai/system rows
-- are written by the service-role client (webhook/cron/tool router paths),
-- which bypasses RLS entirely, so no policy is needed for those. actor_id
-- stores a workspace_members.id (same convention as messages.sender_id /
-- conversations.assigned_user_id elsewhere in this schema), not auth.uid(),
-- so matching it requires resolving the caller's own member row first.
create policy "audit_log_insert_self" on public.audit_log
  for insert
  with check (
    core.is_workspace_member(workspace_id)
    and actor_type = 'user'
    and actor_id in (
      select id from public.workspace_members
      where workspace_id = audit_log.workspace_id and user_id = auth.uid()
    )
  );

create policy "tool_calls_select" on public.tool_calls
  for select using (core.is_workspace_member(workspace_id));

create policy "workspace_quotas_select" on public.workspace_quotas
  for select using (core.is_workspace_member(workspace_id));

create policy "workspace_quotas_insert" on public.workspace_quotas
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "workspace_quotas_update" on public.workspace_quotas
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- Buffer Inteligente: estado en Postgres en vez de timer en memoria
-- (docs/blueprint/04-inbox.md). Ambas funciones son SECURITY DEFINER,
-- llamadas únicamente por el service-role client (webhook de ingestión y el
-- dispatcher de buffer), mismo patrón que core.is_workspace_member.
-- ---------------------------------------------------------------------------

-- Upsert atómico: agrega el message_id al arreglo pendiente y empuja
-- flush_at adelante — cada mensaje nuevo pospone el flush, agrupando ráfagas.
create or replace function public.push_conversation_buffer_message(
  p_conversation_id uuid,
  p_workspace_id uuid,
  p_message_id uuid,
  p_window_seconds int default 10
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversation_buffers
    (conversation_id, workspace_id, window_seconds, flush_at, pending_message_ids, status)
  values (
    p_conversation_id, p_workspace_id, p_window_seconds,
    now() + (p_window_seconds || ' seconds')::interval,
    array[p_message_id], 'pending'
  )
  on conflict (conversation_id) do update
  set pending_message_ids = array_append(public.conversation_buffers.pending_message_ids, p_message_id),
      flush_at = now() + (p_window_seconds || ' seconds')::interval,
      status = 'pending';
end;
$$;

revoke all on function public.push_conversation_buffer_message(uuid, uuid, uuid, int) from public;
grant execute on function public.push_conversation_buffer_message(uuid, uuid, uuid, int) to service_role;

-- Claim atómico de los buffers vencidos (12-security-audit.md #6): el
-- UPDATE...RETURNING es la unidad atómica que garantiza que, si el dispatcher
-- se solapa consigo mismo, solo una ejecución gane cada fila.
-- `for update skip locked` es defensa adicional sobre el mismo predicado.
create or replace function public.claim_pending_conversation_buffers(p_limit int default 10)
returns setof public.conversation_buffers
language sql
security definer
set search_path = ''
as $$
  update public.conversation_buffers
  set status = 'processing', claimed_at = now()
  where conversation_id in (
    select conversation_id from public.conversation_buffers
    where status = 'pending' and flush_at <= now()
    order by flush_at
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_pending_conversation_buffers(int) from public;
grant execute on function public.claim_pending_conversation_buffers(int) to service_role;

-- Limpieza por diferencia (04-inbox.md paso 4): saca solo los message_ids que
-- efectivamente se procesaron, nunca resetea ciego toda la fila (mensajes
-- nuevos pudieron llegar durante el procesamiento y ya la volvieron a marcar
-- 'pending'). Si el arreglo resultante queda vacío, se elimina la fila.
create or replace function public.clear_processed_buffer_messages(
  p_conversation_id uuid,
  p_processed_message_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining uuid[];
begin
  select array(
    select unnest(pending_message_ids)
    except
    select unnest(p_processed_message_ids)
  ) into v_remaining
  from public.conversation_buffers
  where conversation_id = p_conversation_id;

  if v_remaining is null or array_length(v_remaining, 1) is null then
    delete from public.conversation_buffers where conversation_id = p_conversation_id and status = 'processing';
  else
    update public.conversation_buffers
    set pending_message_ids = v_remaining, status = 'pending'
    where conversation_id = p_conversation_id;
  end if;
end;
$$;

revoke all on function public.clear_processed_buffer_messages(uuid, uuid[]) from public;
grant execute on function public.clear_processed_buffer_messages(uuid, uuid[]) to service_role;
