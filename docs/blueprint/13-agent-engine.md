# 13 — Motor del Agente (especificación oficial)

> **Especificación oficial.** Este documento define el funcionamiento obligatorio del motor del agente. Es parte del Blueprint del proyecto y no debe modificarse sin justificación técnica explícita. Formaliza y nombra explícitamente componentes que ya existían en el Blueprint (algunos descritos en [04-inbox.md](04-inbox.md) y [05-ai-engine.md](05-ai-engine.md) sin un nombre de componente propio) y añade dos piezas nuevas y justificadas: el **Decision Engine** como gate explícito antes de invocar al modelo, y la tabla `tool_calls` para persistencia de invocaciones de herramientas.

## Diagrama de flujo

```
Usuario
    │
    ▼
WhatsApp
    │
    ▼
YCloud
    │
    ▼
Ingress Normalizer
    │
    ▼
Buffer Inteligente
    │
    ▼
Decision Engine
    │
    ├────────► Handoff a Humano
    │
    ▼
Agent Runtime (OpenRouter)
    │
    ▼
Tool Router
    │
    ▼
Herramientas
    │
    ▼
Generación de respuesta
    │
    ▼
YCloud
    │
    ▼
WhatsApp
    │
    ▼
Persistencia en Supabase
```

## Responsabilidad de cada componente

### 1. Ingress Normalizer

Recibe **todos** los eventos provenientes de YCloud (no solo mensajes entrantes: también actualizaciones de estado, revisión de plantillas, cambios de calidad de número, etc.).

Debe:
- Normalizar el payload a un formato interno único, independiente del `type` específico del evento YCloud.
- Validar el origen (autenticidad del webhook).
- Preparar el evento para el resto del pipeline.

**Implementación**: Route Handler `/api/webhooks/ycloud` ([04-inbox.md](04-inbox.md), [08-integrations.md](08-integrations.md)). Ya cubre: verificación de autenticidad (header secreto) → idempotencia (`webhook_events`, único por `(provider, event_id)`) → resolución de `workspace_id` por el número/WABA **receptor** (`to`/`wabaId`), nunca por el remitente ([12-security-audit.md](12-security-audit.md) #1) → normalización a `messages` (mensajes) o actualización del recurso correspondiente (plantillas, calidad de número, etc.).

### 2. Buffer Inteligente

No responder inmediatamente — esperar una ventana configurable, agrupar mensajes consecutivos, detectar cuándo el usuario terminó de escribir, y enviar un único bloque de contexto al agente. Objetivo: responder como un humano, evitar respuestas fragmentadas.

**Implementación**: ya especificada en detalle en [04-inbox.md](04-inbox.md) — estado en `conversation_buffers` (fila por conversación, no timer en memoria, sobrevive a cold starts serverless) con **claim atómico** (`UPDATE...SET status='processing'...RETURNING`) para evitar doble-procesamiento si el cron se solapa consigo mismo ([12-security-audit.md](12-security-audit.md) #6). Sin cambios respecto a lo ya documentado.

### 3. Decision Engine

**Componente formalizado por esta especificación** — antes vivía implícito dentro del flujo de IA (un simple chequeo de `conversations.mode`); ahora es un paso explícito y previo a invocar el Agent Runtime.

Se ejecuta inmediatamente después de que el Buffer Inteligente reclama un lote de mensajes, y decide una de:

- `ai_respond` → continúa al Agent Runtime.
- `human_respond` / `wait` → no se invoca al modelo; el lote queda visible en el inbox para un agente humano.
- `escalate` → `conversations.status → pending_human` (ver Handoff, [05-ai-engine.md](05-ai-engine.md)).
- `run_automation` → dispara una automatización (`automations`) sin pasar por el LLM, cuando la regla no requiere razonamiento (p. ej. una palabra clave exacta).
- `invoke_tool_directly` → para automatizaciones que solo necesitan ejecutar una tool determinística (vía Tool Router) sin generación de lenguaje.

Inputs de la decisión, todos ya modelados en el Blueprint (este componente los combina, no introduce datos nuevos):

- **Ventana de 24 horas** y **`contacts.whatsapp_opt_status`** ([09-security.md](09-security.md)).
- **Estado del contacto**: `conversations.mode`/`status` actuales.
- **Reglas del workspace**: `workspace_modules` (¿el módulo relevante está activo?), `workspace_quotas` (¿hay cupo de IA disponible? — si no, la decisión es `escalate`, ver "Degradación por fallo o cuota" en [05-ai-engine.md](05-ai-engine.md)), `automations` con trigger coincidente.
- **Configuración del agente**: `ai_prompts` activo para ese workspace/módulo.

**Relación con Handoff**: el Decision Engine es quien decide *antes* de invocar al modelo si la conversación debe ir a un humano; una vez dentro del Agent Runtime, el propio modelo puede además solicitar handoff a mitad de turno (tool `request_human_handoff`, ver [05-ai-engine.md](05-ai-engine.md)) — esa solicitud vuelve a pasar por el Decision Engine como una re-evaluación, no la ejecuta el modelo directamente.

### 4. Agent Runtime (OpenRouter)

Construye el contexto (prompt de sistema + variables dinámicas + contexto de contacto + contexto de CRM/ATS + memoria de conversación + tools habilitadas) y realiza la llamada al LLM vía OpenRouter.

**Implementación**: ya especificado como "Construcción de contexto" y el cuerpo del "Flujo IA" en [05-ai-engine.md](05-ai-engine.md), incluyendo el chequeo de cuota preflight, el fallback de modelos (`models[]`) y el reintento propio con backoff. Sin cambios de fondo — se renombra este tramo del flujo como "Agent Runtime" para alinear terminología con esta especificación.

### 5. Tool Router

**El modelo nunca ejecuta herramientas directamente.** El Tool Router es quien decide y controla la ejecución real cuando el Agent Runtime recibe un `function_call` del modelo:

- Qué handler ejecutar (`tools.handler_key`).
- Validación de `arguments` contra el `json_schema` de la tool.
- Permisos: la tool debe estar en `agent_tools` para ese `ai_prompts`, y todo id referenciado se revalida contra el `workspace_id` de la conversación actual (nunca se confía en lo que el modelo "recuerda" — defensa central contra prompt injection, [05-ai-engine.md](05-ai-engine.md)).
- Parámetros e idempotencia: ejecución con `idempotency_key` derivada de `(conversation_id, buffer flush)` para evitar doble-ejecución ante reintentos.
- Reintentos y manejo de errores ante fallo del handler (p. ej. si la tool llama a HighLevel y HighLevel está caído — ver resiliencia en [08-integrations.md](08-integrations.md)).

Todas las herramientas son desacopladas y extensibles: cada una es un handler independiente en `src/lib/ai/tools/<handler_key>.ts` que ejecuta contra el núcleo o, si toca un proveedor externo, contra el adapter correspondiente — nunca contra el SDK del proveedor directamente. Este es exactamente el "Contrato obligatorio de todo tool handler" ya descrito en [05-ai-engine.md](05-ai-engine.md); el Tool Router es el componente que lo hace cumplir.

### 6. Generación de respuesta

Antes de enviar, se valida (de forma incondicional, sin excepción por tipo de remitente IA/humano/automatización):

- **Políticas**: opt-out del contacto.
- **Ventana de 24 horas**: sesión libre vs. plantilla obligatoria.
- **Formato**: el payload es válido para el tipo de mensaje (`text`/`template`/media) según el contrato de YCloud ([08-integrations.md](08-integrations.md)).
- **Auditoría**: se registra en `audit_log` antes/al momento de enviar, no después.

**Implementación**: estas validaciones ya están centralizadas en el adapter de YCloud ([04-inbox.md](04-inbox.md), [12-security-audit.md](12-security-audit.md) #7/#8) precisamente para que ningún camino de envío —IA, humano, automatización, tool— pueda saltárselas por omisión. Envío final mediante YCloud.

### 7. Persistencia

Se guarda en Supabase:

| Dato | Tabla | Estado |
|---|---|---|
| Conversación | `conversations` | Ya existente |
| Mensajes | `messages` | Ya existente |
| Eventos (webhooks) | `webhook_events` | Ya existente |
| **Tool Calls** | `tool_calls` | **Nueva — agregada por esta especificación** |
| Logs operativos | — | Cubierto por logs nativos de Vercel/Supabase + `tool_calls`/`webhook_events`/`audit_log` como registro estructurado; no se crea una tabla genérica de "logs" adicional (ver [09-security.md](09-security.md), Observabilidad) |
| Auditoría | `audit_log` | Ya existente |
| Costos de IA / tokens consumidos | `usage_events` | Ya existente |

**`tool_calls` (nueva tabla, justificación)**: el Blueprint original no tenía un registro estructurado de invocaciones de tools — `audit_log` registra *acciones de negocio* ("se creó una oportunidad"), pero no el detalle técnico de la invocación (qué tool, con qué argumentos, qué devolvió, si fue idempotente-repetida, cuánto tardó). Esta especificación pide explícitamente persistir "Tool Calls" como categoría propia, y es un gap real de trazabilidad para depurar el Tool Router en producción:

```sql
tool_calls(
  id uuid pk, workspace_id uuid fk, conversation_id uuid fk,
  tool_id uuid fk tools, idempotency_key text,
  arguments jsonb, result jsonb null,
  status text check in ('validated','executed','rejected','failed'),
  error text null, latency_ms int null,
  created_at timestamptz
) unique(idempotency_key)
```

Ver [02-database.md](02-database.md) para su incorporación al esquema núcleo.

## Principios de diseño

El motor debe ser modular, extensible, event-driven, multi-tenant, escalable, observable, resiliente y seguro. Cada componente tiene una única responsabilidad y se comunica mediante interfaces bien definidas; ningún componente depende directamente de otro si puede abstraerse mediante servicios o eventos. Mapeo a lo ya decidido en el Blueprint:

| Principio | Cómo se cumple |
|---|---|
| Modular / Extensible | Patrón adapter por integración ([08-integrations.md](08-integrations.md)), tools desacopladas por handler, módulos activables ([03-modules.md](03-modules.md)) |
| Multi-tenant | `workspace_id` + RLS en toda tabla, incluida `tool_calls` ([02-database.md](02-database.md), [09-security.md](09-security.md)) |
| Escalable | Buffer/estado en Postgres en vez de memoria de proceso, Realtime acotado por conversación ([04-inbox.md](04-inbox.md), [10-roadmap.md](10-roadmap.md)) |
| Observable | `tool_calls` + `audit_log` + `webhook_events` + logs nativos de plataforma ([09-security.md](09-security.md)) |
| Resiliente | Reintentos con backoff, degradación a `pending_human` ante fallo de proveedor o cuota, HighLevel siempre best-effort ([05-ai-engine.md](05-ai-engine.md), [08-integrations.md](08-integrations.md)) |
| Seguro | RLS con `WITH CHECK`/`search_path` correctos, defensas de prompt injection, contrato de tool handler, opt-out/ventana 24h incondicionales ([09-security.md](09-security.md), [05-ai-engine.md](05-ai-engine.md)) |
| **Event-driven** | **Matiz honesto**: el pipeline es *polling-driven* (pg_cron sobre estado en Postgres), no un bus de eventos real — decisión deliberada dada la restricción de stack 100% serverless sin worker propio ([01-architecture.md](01-architecture.md)). Se aproxima a semántica event-driven (cada fila de estado representa un evento pendiente de procesar) pero no se debe interpretar como pub-sub real. Si el volumen de la Fase 8 lo justifica, este es el punto donde se reevaluaría migrar a un mecanismo de eventos real. |

## Reconciliación con el resto del Blueprint

Esta especificación no reemplaza [04-inbox.md](04-inbox.md) ni [05-ai-engine.md](05-ai-engine.md) — les da nombre de componente y los ordena en un solo diagrama de punta a punta. Cambios concretos que sí introduce:

1. **Decision Engine** como paso explícito previo al Agent Runtime (antes era un chequeo implícito de `conversations.mode` dentro del flujo de IA).
2. **`tool_calls`** como tabla nueva de persistencia técnica de invocaciones de herramientas (antes solo existía `audit_log`, que es de negocio, no técnico).
3. Reconocimiento explícito de que "event-driven" es polling-driven en la práctica, dada la restricción de stack — para que nadie interprete el principio como una promesa de arquitectura pub-sub que no existe.
