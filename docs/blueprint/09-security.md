# 09 — Seguridad, multi-tenancy y cumplimiento

## Autenticación

Supabase Auth, gestionado exclusivamente a través de los helpers ya existentes en `src/lib/supabase/{client,server,middleware}.ts` — **nunca** leer/escribir cookies de sesión por fuera de ellos (regla ya vigente en [CLAUDE.md](../../CLAUDE.md)).

## Roles y permisos

`workspace_members.role`: `owner | admin | agent | viewer`.

| Acción | owner | admin | agent | viewer |
|---|---|---|---|---|
| Gestionar workspace/billing/módulos activos | ✅ | ✅ | ❌ | ❌ |
| Gestionar integraciones (YCloud/OpenRouter/HighLevel) | ✅ | ✅ | ❌ | ❌ |
| Editar prompts/tools | ✅ | ✅ | ❌ | ❌ |
| Atender conversaciones, CRM, ATS | ✅ | ✅ | ✅ | 🔍 solo lectura |
| Invitar/remover miembros | ✅ | ✅ | ❌ | ❌ |

(Tabla orientativa — el detalle fino de permisos por acción se ajusta en implementación, pero la jerarquía de 4 roles es la decisión de base.)

## RLS (Row Level Security) — patrón

Función helper `SECURITY DEFINER` para evitar recomputar/recursión cara en cada policy. **Corrección de auditoría** ([12-security-audit.md](12-security-audit.md) #2): toda función `SECURITY DEFINER` fija `search_path` explícitamente — sin esto, es vulnerable a *search_path hijacking* (un objeto en un esquema con prioridad en el `search_path` de la sesión podría suplantar una tabla/función referenciada sin calificar):

```sql
create function core.is_workspace_member(ws_id uuid) returns boolean
language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  )
$$;

create function core.has_workspace_role(ws_id uuid, roles text[]) returns boolean
language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and role = any(roles)
  )
$$;
```

Policy estándar por tabla tenant-scoped. **Corrección de auditoría** ([12-security-audit.md](12-security-audit.md) #2): las policies se separan por comando — Postgres evalúa `USING` en SELECT/UPDATE/DELETE pero **INSERT solo evalúa `WITH CHECK`**; una policy `for insert, update using (...)` (como aparecía en un borrador anterior) deja el INSERT sin protección real de rol:

```sql
alter table conversations enable row level security;

create policy "select_own_workspace" on conversations
  for select using (core.is_workspace_member(workspace_id));

create policy "insert_agent_and_above" on conversations
  for insert with check (core.has_workspace_role(workspace_id, array['owner','admin','agent']));

create policy "update_agent_and_above" on conversations
  for update using (core.has_workspace_role(workspace_id, array['owner','admin','agent']))
  with check (core.has_workspace_role(workspace_id, array['owner','admin','agent']));

create policy "delete_admin_and_above" on conversations
  for delete using (core.has_workspace_role(workspace_id, array['owner','admin']));
```

Tablas de módulo (`vacancies`, `candidates`, ...) añaden además el check de módulo activo descrito en [03-modules.md](03-modules.md) — en **todas** las operaciones, no solo SELECT (**corrección de auditoría**, [12-security-audit.md](12-security-audit.md) #2/#20: el borrador original solo mostraba el ejemplo de SELECT gateado por módulo):

```sql
create policy "select_if_module_enabled" on vacancies
  for select using (
    core.is_workspace_member(workspace_id)
    and exists (
      select 1 from workspace_modules
      where workspace_id = vacancies.workspace_id
        and module_key = 'ats' and enabled
    )
  );

create policy "write_if_module_enabled" on vacancies
  for insert with check (
    core.has_workspace_role(workspace_id, array['owner','admin','agent'])
    and exists (
      select 1 from workspace_modules
      where workspace_id = vacancies.workspace_id
        and module_key = 'ats' and enabled
    )
  );
-- mismo patrón para update/delete de vacancies, candidates, candidate_applications, interviews, evaluations
```

## Bypass de service_role para ingestión de webhooks

Los Route Handlers de `/api/webhooks/ycloud` y `/api/webhooks/highlevel` usan el cliente Supabase con `SUPABASE_SERVICE_ROLE_KEY` (server-only, ya documentado en `.env.local.example`) porque el webhook no llega autenticado como un usuario de Supabase. Esto **evade RLS por diseño** — la validación de que el evento pertenece al workspace correcto se hace manualmente en código resolviendo `workspace_id` por el número/WABA **receptor** (`to`/`wabaId`) contra `integration_connections`, **nunca por el remitente** (`from`) del payload externo — ver el detalle del riesgo en [04-inbox.md](04-inbox.md) y [12-security-audit.md](12-security-audit.md) #1.

## Storage de adjuntos ([12-security-audit.md](12-security-audit.md) #19)

Los buckets de Supabase Storage para `attachments` son **privados por workspace**, nunca públicos. El acceso a un archivo (CV, documento, imagen adjunta) es siempre vía URL firmada de corta duración generada server-side tras verificar que el usuario solicitante es miembro del workspace dueño del adjunto — nunca una URL pública directa. Esto aplica en particular a los CVs del módulo ATS, que contienen PII completa (nombre, historial laboral, datos de contacto) y deben tratarse con el mismo rigor que cualquier dato sensible de cliente.

## Opt-in / Opt-out ([12-security-audit.md](12-security-audit.md) #8)

Omisión corregida del diseño original: `contacts.whatsapp_opt_status` (`subscribed|unsubscribed|unknown`, [02-database.md](02-database.md)) se actualiza desde los webhooks de YCloud `contact.unsubscribe.created` (→ `unsubscribed`) y `contact.unsubscribe.deleted` (→ `subscribed`). El adapter de YCloud ([08-integrations.md](08-integrations.md)) rechaza **incondicionalmente** cualquier envío no transaccional a un contacto `unsubscribed`, sin importar si el remitente es la IA, un humano o una automatización — ver el detalle en [04-inbox.md](04-inbox.md). Esto es un requisito de cumplimiento (política de Meta y, en varias jurisdicciones, regulación de comunicaciones no solicitadas), no una funcionalidad opcional.

## Rate limiting y protección contra abuso ([12-security-audit.md](12-security-audit.md) #13)

Dos superficies distintas:

1. **Endpoints públicos** (`/api/webhooks/*`): rate limit a nivel de Route Handler independiente de la validez del payload, para frenar volumen antes de tocar la base de datos ante un intento de abuso o DoS del endpoint.
2. **Consumo por workspace**: reutiliza `workspace_quotas` ([02-database.md](02-database.md), [05-ai-engine.md](05-ai-engine.md)) para limitar tool-calls/mensajes-IA por minuto — protege la disponibilidad compartida (incluida la cuota global de OpenRouter, que no aísla por sub-cliente) de un workspace comprometido o abusivo. No se construye un segundo mecanismo de límites paralelo al de cuota de costo.

Los rate limits documentados en [08-integrations.md](08-integrations.md) (YCloud, OpenRouter) son restricciones del *proveedor* hacia nosotros — no sustituyen esta protección propia, que es de la plataforma hacia sus propios workspaces.

## Observabilidad ([12-security-audit.md](12-security-audit.md) #14)

Distinta de `audit_log` (auditoría de negocio — "qué hizo el usuario/la IA"): la observabilidad operativa responde "¿está el sistema sano?".

- **Correlación**: un `correlation_id` (derivable de `conversation_id` + timestamp del flush de buffer) se propaga a través de todo el pipeline (webhook → buffer → IA → envío) para poder rastrear un mensaje de punta a punta en logs.
- **Logs**: se usan los logs nativos de Vercel y de Supabase (`get_logs`/`get_advisors` vía el MCP de Supabase ya configurado, ver [CLAUDE.md](../../CLAUDE.md)) como primera línea — no se construye un sistema de logging propio antes de necesitarlo.
- **Métricas mínimas** (vistas SQL o dashboard simple, no herramienta externa nueva): eventos de webhook fallidos por proveedor (`webhook_events.status='failed'`), latencia media de flush de buffer, costo diario por workspace (`usage_events`).

Sin esto, un incidente de un proveedor externo se detecta por quejas de clientes en vez de por monitoreo propio.

## Auditoría

`audit_log` ([02-database.md](02-database.md)) registra toda acción sensible: cambios de `conversations.mode`/`status`, ejecuciones de tools de IA con efectos secundarios (crear oportunidad, agendar cita), cambios de configuración de integraciones, y activación/desactivación de módulos. `actor_type` distingue si el cambio lo hizo un humano, la IA o un job del sistema.

## Gestión de secretos

Ninguna clave de proveedor (YCloud, OpenRouter, HighLevel) se guarda en texto plano en tablas de aplicación ni en variables de entorno compartidas entre workspaces — todas via Supabase Vault, referenciadas por `integration_connections.credentials_vault_ref` ([02-database.md](02-database.md), [08-integrations.md](08-integrations.md)). Las claves de entorno actuales (`.env.local.example`) son solo para las credenciales *propias* de la instancia de la plataforma (Supabase del proyecto), no para credenciales de clientes.

## Cumplimiento Meta / WhatsApp

- **Ventana de 24 horas**: fuera de esa ventana desde el último mensaje entrante del contacto, no se puede enviar mensaje de sesión libre — solo plantillas aprobadas. El adapter de YCloud ([08-integrations.md](08-integrations.md), [04-inbox.md](04-inbox.md)) valida esto de forma incondicional antes de cualquier envío — IA, humano, automatización o tool —, consultando `messages` por el último `direction='inbound'` de la conversación.
- **Plantillas**: gestión de plantillas y su estado de aprobación vía la API de plantillas de YCloud (`whatsapp.template.reviewed` webhook actualiza el estado local).
- **Estados de conversación**: `conversations.status`/`mode` sirven también como evidencia de cumplimiento (quién respondió, cuándo se escaló a humano).
- **Auditoría**: todo envío queda en `messages` + `audit_log`, permitiendo reconstruir el historial de cumplimiento ante una auditoría de Meta.

## Supuestos de esta sección

Esta sección interpreta las reglas públicas de WhatsApp Business Platform; no se recibió un documento legal/compliance adicional del cliente. Si existe uno, debe reemplazar los supuestos aquí anotados.
