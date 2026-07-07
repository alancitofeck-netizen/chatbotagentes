# 04 — Inbox conversacional

> Terminología: la especificación oficial del motor del agente ([13-agent-engine.md](13-agent-engine.md)) nombra el Route Handler de ingestión descrito abajo como **Ingress Normalizer**, y el mecanismo de buffer como **Buffer Inteligente** — mismos mecanismos, sin cambios de fondo, solo alineación de nombre de componente.

## Funcionalidades (núcleo, usadas por CRM y ATS por igual)

- Lista de conversaciones (filtrable por estado, etiqueta, responsable).
- Historial completo de mensajes.
- Estado de conversación: `open | pending_human | closed`.
- Etiquetas (`tags`/`contact_tags`).
- Asignación de responsable (`conversations.assigned_user_id`).
- Búsqueda (por contacto, contenido de mensaje — Postgres full-text search sobre `messages.content`).
- Filtros (estado, etiqueta, módulo de origen, responsable).
- Mensajes en tiempo real (Supabase Realtime).
- Notas internas (`notes` con `notable_type='conversation'`).
- Archivos adjuntos (`attachments` con `attachable_type='message'`).

## Flujo de mensaje entrante

```
YCloud webhook (whatsapp.inbound_message.received)
  → Route Handler /api/webhooks/ycloud (service_role, sin RLS de usuario)
  → verificar autenticidad (header secreto, ver 08-integrations.md) — si falla, 401 sin insertar en webhook_events
  → INSERT en webhook_events (idempotencia por event_id)
  → resolver workspace_id por `to`/`wabaId` contra integration_connections (NUNCA por el `from` del contacto)
  → upsert contacto (workspace_id + phone)
  → upsert/crear conversación (por contacto + whatsapp_phone_number_id)
  → INSERT mensaje (direction='inbound')
  → upsert fila en conversation_buffers (ver abajo)
  → Realtime empuja el mensaje al cliente vía postgres_changes
```

El endpoint de ingestión responde 200 rápido (solo persiste), y devuelve error 5xx únicamente ante fallo real de escritura — no espera a que la IA responda. El procesamiento de IA/negocio ocurre después, disparado por el flush del buffer.

**Resolución de `workspace_id` (crítico, [12-security-audit.md](12-security-audit.md) #1)**: un mismo número de teléfono de *contacto* (`from`) puede escribirle a números de negocio de workspaces distintos (es un dato del mundo externo, no controlado por la plataforma) — `contacts` solo garantiza unicidad de `(workspace_id, phone)`, no de `phone` global. El workspace **siempre** se determina por el número/WABA *receptor* (`to`/`wabaId` del payload) contra `integration_connections`, nunca inferido del remitente. Resolver mal esto es la única forma en que un bug de aplicación (no de RLS) podría cruzar datos entre tenants.

## Buffer inteligente

**Objetivo**: cuando llegan varios mensajes seguidos del mismo contacto, esperar una ventana configurable y enviar un lote consolidado al agente IA, evitando respuestas fragmentadas.

**Problema a resolver**: el stack es serverless (Vercel + Supabase, sin proceso persistente) — un `setTimeout` en memoria no sirve, porque la función que atendió el webhook termina su ejecución antes de que la ventana expire.

**Diseño elegido**: la ventana vive como **estado en Postgres**, no en memoria.

1. Al llegar un mensaje inbound, se hace `UPSERT` sobre `conversation_buffers` (PK = `conversation_id`): se agrega el `message_id` al arreglo `pending_message_ids`, se **reescribe** `flush_at = now() + window_seconds` (por defecto configurable por workspace, p. ej. 8–15s) y se fuerza `status='pending'`. Cada mensaje nuevo empuja el flush hacia adelante — esto agrupa ráfagas sin importar cuántos mensajes lleguen.
2. Un job programado (`pg_cron`, cada 3–5s) llama una función/Edge Function que **reclama atómicamente** las filas vencidas: `UPDATE conversation_buffers SET status='processing', claimed_at=now() WHERE flush_at <= now() AND status='pending' RETURNING *`. Este `UPDATE...RETURNING` es la unidad atómica que garantiza que, si el job se solapa consigo mismo (ejecución más lenta que el intervalo, reintento, etc.), **solo una ejecución gane cada fila** — sin esto, dos ejecuciones concurrentes podrían procesar el mismo lote dos veces (doble respuesta de IA, doble ejecución de tools con efectos secundarios — [12-security-audit.md](12-security-audit.md) #6).
3. Por cada fila reclamada: toma los mensajes referenciados (en orden), los concatena como un solo turno de usuario, e invoca el flujo de IA ([05-ai-engine.md](05-ai-engine.md)) si `conversations.mode` lo permite (`ai` o `hybrid`).
4. Al terminar de procesar, **no se asume que el buffer sigue vacío**: si llegaron mensajes nuevos durante el procesamiento (el `UPSERT` del paso 1 pudo haber corrido en paralelo, agregando IDs y poniendo `status='pending'` de nuevo), esa fila ya quedó correctamente marcada `pending` con un `flush_at` propio — el siguiente tick del cron la recoge normalmente. El código de flush limpia únicamente los `message_ids` que efectivamente procesó (por diferencia de conjunto), nunca hace `DELETE`/reset ciego de toda la fila.

**Por qué esta estrategia y no alternativas**:
- Debounce en el cliente/edge (ej. Vercel Edge Function con `waitUntil`) — descartado: no hay garantía de que la misma instancia siga viva para el segundo mensaje de la ráfaga.
- Cola externa (Redis/BullMQ) — descartado: requiere infraestructura fuera del stack obligatorio (Vercel + Supabase).
- Postgres + Cron: usa exactamente lo que ya está disponible, es inspeccionable con SQL normal, y el estado sobrevive a cualquier reinicio/cold start.

## Modo de conversación (human / ai / hybrid)

`conversations.mode` decide si el flush del buffer dispara al motor IA:
- `human`: el buffer igual agrupa mensajes para presentarlos juntos en el inbox, pero no se llama a la IA — un agente humano responde manualmente.
- `ai`: el flush invoca la IA y, salvo que el propio agente decida escalar (ver [05-ai-engine.md](05-ai-engine.md)), la respuesta sale automáticamente.
- `hybrid`: la IA genera una respuesta sugerida (se guarda como mensaje en estado `draft` o nota interna) pero requiere que un humano la apruebe/edite antes de enviarse.

## Envío saliente y actualización de estado

Los mensajes salientes (humano, IA, automatización o tool) se envían **siempre** a través del adapter YCloud ([08-integrations.md](08-integrations.md)) — nunca directamente contra la API de YCloud desde otro punto del código. El adapter es el único lugar que aplica, de forma incondicional:

1. **Chequeo de opt-out**: si `contacts.whatsapp_opt_status = 'unsubscribed'`, el adapter rechaza el envío (salvo el caso excepcional de un mensaje transaccional explícitamente solicitado por el propio contacto, p. ej. confirmar su propia baja). El estado se actualiza desde los webhooks `contact.unsubscribe.created` (→ `unsubscribed`) y `contact.unsubscribe.deleted` (→ `subscribed`), siguiendo el mismo camino de ingestión de `webhook_events`.
2. **Guardrail de ventana de 24h**: fuera de ventana sin plantilla aprobada, el adapter rechaza el envío de sesión libre (ver [08-integrations.md](08-integrations.md), [09-security.md](09-security.md)).

Centralizar ambos checks en el adapter (en vez de en cada flujo llamador) es deliberado: ningún camino de envío —IA, humano, automatización, tool— puede saltárselos por omisión ([12-security-audit.md](12-security-audit.md) #7, #8).

El `status` del mensaje (`accepted → sent → delivered → read` / `failed`) se actualiza por el webhook `whatsapp.message.updated`, siguiendo el mismo camino de ingestión (`webhook_events` → actualizar `messages.status`) para mantener un solo punto de entrada de eventos de YCloud.

## Tiempo real

Suscripción Realtime del cliente: canal por conversación abierta (`messages` filtrado por `conversation_id`) + canal de lista (`conversations` filtrado por `workspace_id`, campos mínimos). RLS garantiza que un usuario solo pueda suscribirse a conversaciones de su propio workspace. Ver el riesgo de escala de conexiones Realtime en [10-roadmap.md](10-roadmap.md).
