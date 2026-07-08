# 02 — Base de datos

## Estrategia

Una sola base Postgres (Supabase), **multi-tenancy por columna `workspace_id` + RLS** (no schema-per-tenant, no base de datos por cliente). Motivo: es el patrón estándar de Supabase, permite administración cross-tenant simple (soporte, analítica agregada) y evita el costo operativo de N esquemas/bases. Detalle de políticas en [09-security.md](09-security.md).

Regla de proyecto: **no crear una tabla nueva sin antes verificar si una tabla del núcleo ya cubre el caso** (p. ej. "candidato" reutiliza `contacts`, no lo duplica; "pipeline de reclutamiento" reutiliza `pipelines`/`pipeline_stages`, no crea uno paralelo). Justificar en el PR cualquier tabla nueva.

## Núcleo (compartido por todos los módulos)

```sql
workspaces(
  id uuid pk, name text, slug text unique, created_at timestamptz
)

workspace_members(
  id uuid pk, workspace_id uuid fk, user_id uuid fk auth.users,
  role text check in ('owner','admin','agent','viewer'),
  created_at timestamptz
) unique(workspace_id, user_id)

workspace_modules(
  workspace_id uuid fk, module_key text check in ('crm','ats'),
  enabled boolean default false, config jsonb default '{}', updated_at timestamptz
) pk(workspace_id, module_key)

contacts(
  id uuid pk, workspace_id uuid fk, name text, phone text, email text,
  company text null,                        -- agregado con el Dashboard/CRM (2026-07-08): columna de
                                             -- primera clase, no custom_fields, porque se filtra/muestra
                                             -- directamente (Kanban, futura sección Contactos)
  avatar_url text, source text, custom_fields jsonb default '{}',
  whatsapp_opt_status text check in ('subscribed','unsubscribed','unknown') default 'unknown',
  created_at timestamptz, updated_at timestamptz
) unique(workspace_id, phone)
-- whatsapp_opt_status: ver 09-security.md (cumplimiento) y 04-inbox.md (enforcement en el adapter de envío)

tags(id uuid pk, workspace_id uuid fk, name text, color text) unique(workspace_id, name)
contact_tags(contact_id uuid fk, tag_id uuid fk) pk(contact_id, tag_id)
-- Aplicadas en supabase/migrations/0003_inbox.sql (Inbox conversacional, 2026-07-08).
-- contact_tags se scopea por RLS a través de su contact_id padre (mismo patrón
-- que pipeline_stages/pipeline_items → pipeline en la migración anterior).

-- public.workspace_member_names(ws_id uuid) — función SECURITY DEFINER (0003_inbox.sql)
-- que resuelve member_id/user_id/full_name/email leyendo auth.users, porque
-- workspace_members no guarda nombre y el cliente no tiene acceso a auth.users.
-- Vive en `public` (no en `core`, donde están is_workspace_member/has_workspace_role)
-- porque debe ser invocable vía supabase.rpc() — PostgREST solo expone el schema
-- `public` por defecto; `core` queda reservado para helpers de RLS referenciados
-- solo desde SQL (dentro de policies), nunca vía RPC.

conversations(
  id uuid pk, workspace_id uuid fk, contact_id uuid fk,
  whatsapp_phone_number_id text,          -- número emisor YCloud del workspace
  status text check in ('open','pending_human','closed'),
  mode text check in ('human','ai','hybrid'),
  assigned_user_id uuid fk workspace_members null,
  last_message_at timestamptz, created_at timestamptz
)

messages(
  id uuid pk, workspace_id uuid fk, conversation_id uuid fk,
  direction text check in ('inbound','outbound'),
  sender_type text check in ('contact','agent','ai','system'),
  sender_id uuid null, type text, content jsonb,
  external_id text, wamid text, status text,
  created_at timestamptz
)
-- index (conversation_id, created_at desc) para paginación de hilo

conversation_buffers(
  conversation_id uuid pk fk, workspace_id uuid fk,
  window_seconds int, flush_at timestamptz, pending_message_ids uuid[],
  status text check in ('pending','processing') default 'pending',
  claimed_at timestamptz null,
  created_at timestamptz
)
-- ver 04-inbox.md: fila que reemplaza el "timer en memoria"
-- status/claimed_at: claim atómico para evitar doble-procesamiento concurrente (12-security-audit.md #6)

notes(
  id uuid pk, workspace_id uuid fk,
  notable_type text, notable_id uuid,      -- polimórfico: conversation | contact | candidate_application | vacancy
  author_id uuid fk, body text, created_at timestamptz
)

attachments(
  id uuid pk, workspace_id uuid fk,
  attachable_type text, attachable_id uuid, -- polimórfico: message | contact | candidate_application | interview
  storage_path text, filename text, mime_type text, size_bytes bigint,
  created_at timestamptz
)
-- storage_path apunta a Supabase Storage, bucket privado por workspace

pipelines(
  id uuid pk, workspace_id uuid fk, module_key text check in ('crm','ats'),
  name text, created_at timestamptz
)
pipeline_stages(
  id uuid pk, pipeline_id uuid fk, name text, position int,
  is_won boolean default false, is_lost boolean default false,
  external_refs jsonb default '{}'   -- {"highlevel": "stage_id_xyz"}
)
-- external_refs: mapeo etapa↔proveedor externo a nivel de ETAPA (constante),
-- no repetido por cada opportunity/candidate_application (12-security-audit.md #18)
pipeline_items(
  id uuid pk, pipeline_id uuid fk, stage_id uuid fk,
  item_type text check in ('opportunity','candidate_application'),
  item_id uuid, position int, created_at timestamptz, updated_at timestamptz
)
-- motor de pipeline genérico: 06-crm.md y 07-ats.md lo instancian cada uno con su item_type

bookings(
  id uuid pk, workspace_id uuid fk, contact_id uuid fk,
  provider text check in ('internal','highlevel'), external_id text null,
  start_time timestamptz, end_time timestamptz,
  status text check in ('scheduled','rescheduled','cancelled','completed'),
  subject text, created_at timestamptz
)

tasks(
  id uuid pk, workspace_id uuid fk, title text,
  related_type text null, related_id uuid null,  -- polimórfico: opportunity | contact | candidate_application (opcional)
  assigned_to uuid fk workspace_members null,
  due_at timestamptz null, completed_at timestamptz null,
  created_at timestamptz
)
-- agregada con el Dashboard/CRM (2026-07-08): no existía ningún concepto de tarea/recordatorio.
-- Sirve al panel "Tareas pendientes" del núcleo y para derivar "próxima actividad" en tarjetas de
-- pipeline (la tarea incompleta más próxima con related_id = ese opportunity/candidate_application).
-- Mismo patrón polimórfico que notes, no un sistema de proyectos — si crece, revisar entonces.

automations(
  id uuid pk, workspace_id uuid fk, name text,
  trigger jsonb, conditions jsonb, actions jsonb,
  enabled boolean default true, created_at timestamptz
)

ai_prompts(
  id uuid pk, workspace_id uuid fk, module_key text,
  name text, system_prompt text, variables jsonb default '{}',
  model_config jsonb,                       -- modelo(s) OpenRouter, fallback chain, provider prefs
  status text check in ('draft','active','archived'),
  version int, created_at timestamptz
)

tools(
  id uuid pk, workspace_id uuid null,       -- null = tool global del sistema
  key text, name text, description text,
  json_schema jsonb, handler_key text, enabled boolean default true
)
agent_tools(prompt_id uuid fk, tool_id uuid fk) pk(prompt_id, tool_id)

tool_calls(
  id uuid pk, workspace_id uuid fk, conversation_id uuid fk,
  tool_id uuid fk tools, idempotency_key text,
  arguments jsonb, result jsonb null,
  status text check in ('validated','executed','rejected','failed'),
  error text null, latency_ms int null,
  created_at timestamptz
) unique(idempotency_key)
-- registro técnico de cada invocación del Tool Router (qué tool, argumentos, resultado, latencia),
-- distinto de audit_log (que registra la acción de negocio resultante) — ver 13-agent-engine.md

integration_connections(
  id uuid pk, workspace_id uuid fk,
  provider text check in ('ycloud','openrouter','highlevel'),
  external_account_id text, status text,
  credentials_vault_ref text,               -- referencia a Supabase Vault, nunca la clave en claro
  metadata jsonb, created_at timestamptz
)

webhook_events(
  id uuid pk, provider text, event_id text, event_type text,
  payload jsonb, processed_at timestamptz null,
  attempts int default 0, last_error text null,
  status text check in ('pending','processed','failed') default 'pending',
  created_at timestamptz
) unique(provider, event_id)  -- idempotencia
-- attempts/last_error/status: techo de reintentos + estado terminal 'failed' en vez de
-- reintentar indefinidamente o perderse en silencio (12-security-audit.md #12)

usage_events(
  id uuid pk, workspace_id uuid fk, provider text,
  model text, tokens_in int, tokens_out int, cost_usd numeric,
  created_at timestamptz
) -- base para métering propio de OpenRouter, ver 08-integrations.md

audit_log(
  id uuid pk, workspace_id uuid fk,
  actor_type text check in ('user','ai','system'), actor_id uuid null,
  action text, entity_type text, entity_id uuid,
  metadata jsonb, created_at timestamptz
)

workspace_quotas(
  workspace_id uuid pk fk,
  ai_monthly_budget_usd numeric, ai_requests_per_minute int,
  updated_at timestamptz
)
-- usada para el chequeo preflight de OpenRouter (05-ai-engine.md) y el rate limiting
-- propio de tool-calls/mensajes-IA por workspace (09-security.md) — 12-security-audit.md #11, #13
```

## Módulo CRM ([06-crm.md](06-crm.md))

```sql
opportunities(
  id uuid pk, workspace_id uuid fk, contact_id uuid fk,
  pipeline_item_id uuid fk,                 -- fila en pipeline_items (item_type='opportunity')
  title text, value numeric, currency text default 'USD',
  owner_id uuid fk workspace_members, status text,
  created_at timestamptz, updated_at timestamptz
)
```

## Módulo ATS ([07-ats.md](07-ats.md))

```sql
vacancies(
  id uuid pk, workspace_id uuid fk, title text, description text,
  department text, location text,
  status text check in ('open','paused','closed'),
  pipeline_id uuid fk,                      -- pipeline propio (module_key='ats') por vacante
  created_at timestamptz
)

candidates(
  id uuid pk, workspace_id uuid fk,
  contact_id uuid fk unique,                -- 1:1 con contacts — el candidato ES un contacto + este extra
  resume_attachment_id uuid fk attachments null,
  source text, created_at timestamptz
)

candidate_applications(
  id uuid pk, workspace_id uuid fk,
  vacancy_id uuid fk, candidate_id uuid fk,
  pipeline_item_id uuid fk,                 -- fila en pipeline_items (item_type='candidate_application')
  status text, applied_at timestamptz
) unique(vacancy_id, candidate_id)

interviews(
  id uuid pk, workspace_id uuid fk,
  application_id uuid fk, booking_id uuid fk bookings null,
  interviewer_id uuid fk workspace_members,
  scheduled_at timestamptz, status text, created_at timestamptz
)

evaluations(
  id uuid pk, workspace_id uuid fk,
  interview_id uuid fk, evaluator_id uuid fk workspace_members,
  scorecard jsonb, rating numeric, comments text, created_at timestamptz
)
```

## Índices críticos

- `workspace_id` btree en toda tabla tenant-scoped (soporte de RLS y de queries de listado).
- `contacts(workspace_id, phone)` unique — deduplicación de contacto por número.
- `messages(conversation_id, created_at desc)` — paginación de hilo.
- `conversations(workspace_id, status, last_message_at desc)` — lista de inbox.
- `webhook_events(provider, event_id)` unique — idempotencia de reintentos de webhook.
- `pipeline_items(pipeline_id, stage_id, position)` — orden de tablero kanban.
- `contacts(workspace_id, whatsapp_opt_status)` — chequeo rápido de opt-out antes de cada envío saliente.
- `tool_calls(conversation_id, created_at desc)` — traza de invocaciones de tools por conversación; `idempotency_key` unique ya cubre la deduplicación.
- `tasks(related_type, related_id, completed_at)` — resolver "próxima actividad" de una tarjeta de pipeline sin escanear toda la tabla.
- `tasks(workspace_id, assigned_to, completed_at, due_at)` — panel "Tareas pendientes" por usuario.

## Notas de RLS

Cada tabla de arriba lleva una policy `USING (core.is_workspace_member(workspace_id))` (lectura) y variantes por rol para escritura — detalle completo en [09-security.md](09-security.md). `webhook_events` es la única tabla sin RLS de usuario final: solo el `service_role` (usado por los Route Handlers de ingestión de webhooks) escribe/lee ahí.

## Conexiones y volumen (auditoría — [12-security-audit.md](12-security-audit.md) #17)

- **Connection pooling obligatorio desde ahora**: todo acceso desde Route Handlers/Server Actions/Edge Functions usa el connection pooler de Supabase (modo transacción/pgbouncer), no conexiones directas — funciones serverless abren conexiones cortas y frecuentes que agotan el límite de Postgres sin pooler.
- **Particionado (Fase 8, no ahora)**: `messages`, `webhook_events` y `audit_log` son candidatas a particionado por rango de fecha (mensual) cuando el volumen lo justifique. La política de retención/archivado de estas tablas es una decisión de producto/legal (cuánto tiempo conservar historial de mensajes), no solo técnica — debe definirse con el negocio antes de implementar el particionado.
- **Storage de adjuntos**: bucket privado por workspace (nunca público), acceso solo vía URLs firmadas de corta duración — aplica en particular a CVs del módulo ATS, que contienen PII completa (ver [09-security.md](09-security.md)).
