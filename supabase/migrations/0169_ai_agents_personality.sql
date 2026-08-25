-- Fase 5 (config estructurada del agente) — pedido explícito del usuario:
-- personalidad (formalidad/cercanía/emojis/longitud/preguntas/persuasión)
-- y reglas como lista editable, separadas del prompt de texto libre.
-- Genérico para CUALQUIER ai_agents (crm/ats/referrals), no solo
-- referidos — mismo criterio que se usó para extender el motor en la
-- Fase 4: una capacidad real del motor, no un bolt-on aparte.
--
-- "Acciones permitidas/prohibidas" (el resto de lo pedido en esta fase) NO
-- suma columnas nuevas: ya existe agent_tools (0007_ai_prompts.sql) + su UI
-- (ToolsTab.tsx) con exactamente esa forma — checkboxes de qué puede hacer
-- el agente además de conversar. Duplicarlo hubiera sido la segunda fuente
-- de verdad que el usuario pidió explícitamente evitar en toda la sesión.
--
-- personality sigue el mismo patrón que business_hours (0024): jsonb con
-- default completo, sin CHECK de shape (se valida en la app).
alter table public.ai_agents add column if not exists personality jsonb not null default '{
  "formality": "media",
  "warmth": "alta",
  "directness": "equilibrado",
  "emojiUsage": "bajo",
  "messageLength": "cortos",
  "questioningStyle": "frecuente",
  "persuasiveness": "media"
}'::jsonb;

alter table public.ai_agents add column if not exists rules text[] not null default '{}';
