-- Cache del Asistente IA del Inbox (Resumen/Análisis de lead/Extracción) —
-- sin esto, abrir el popover o la card "Resumen IA" cada vez dispararía una
-- llamada nueva a OpenRouter. Se regenera solo a demanda ("Regenerar" en el
-- popover), nunca en cada page load — mismo criterio que kpi_ai_insights
-- (Asesores -> Performance). Solo escribe el Server Action con
-- service-role (no hay policy de insert/update para el cliente de sesión).
create table public.conversation_ai_insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade unique,
  summary text,
  next_step text,
  lead_analysis jsonb,
  extracted_info jsonb,
  generated_at timestamptz not null default now()
);

create index conversation_ai_insights_workspace_idx on public.conversation_ai_insights (workspace_id);

alter table public.conversation_ai_insights enable row level security;

create policy "conversation_ai_insights_select" on public.conversation_ai_insights
  for select using (core.is_workspace_member(workspace_id));
