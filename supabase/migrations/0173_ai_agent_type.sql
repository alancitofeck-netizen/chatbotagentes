-- Rediseño del Centro de Agentes IA (/agentes-ia) — el wizard ya distingue
-- "tipo" (Referidos/Citas/Seguimiento) para preseleccionar objetivos/tools/
-- prompt, pero nunca lo guardaba: after created, no había forma real de
-- distinguir un Agente de Citas de un Agente de Referidos genérico para
-- mostrar el badge/ícono correcto en la lista. Columna puramente aditiva,
-- nullable — agentes existentes (creados antes de este cambio, o vía el
-- modal simple de ATS) quedan agent_type=null y se les muestra el módulo
-- real en vez de un tipo inventado. No toca whitelist/RLS/permisos/motor.
alter table public.ai_agents add column if not exists agent_type text;
alter table public.ai_agents drop constraint if exists ai_agents_agent_type_check;
alter table public.ai_agents add constraint ai_agents_agent_type_check
  check (agent_type is null or agent_type in ('referrals', 'citas', 'seguimiento'));
