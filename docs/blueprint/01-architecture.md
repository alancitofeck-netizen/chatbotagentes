# 01 — Arquitectura general

## Diagrama de alto nivel

```
                         ┌─────────────────────────┐
                         │        Vercel            │
                         │  Next.js App Router       │
                         │  - UI (Server/Client Comp)│
                         │  - Route Handlers (API)   │
                         │  - Server Actions          │
                         └───────────┬───────────────┘
                                     │ @supabase/ssr (cookies)
                                     ▼
                         ┌─────────────────────────┐
                         │       Supabase            │
                         │  - Postgres (RLS)          │
                         │  - Auth                    │
                         │  - Realtime (postgres_changes)
                         │  - Storage (adjuntos)      │
                         │  - Edge Functions          │
                         │  - pg_cron                 │
                         └───────────┬───────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
        ┌───────────┐         ┌───────────┐          ┌───────────┐
        │  YCloud    │         │ OpenRouter │          │ HighLevel  │
        │ (WhatsApp) │         │ (LLM)      │          │ (CRM/Cal.) │
        └───────────┘         └───────────┘          └───────────┘
```

No hay un servidor "propio" fuera de Vercel + Supabase — es una restricción real del stack (ver [00-product.md](00-product.md)). Todo el procesamiento asíncrono debe vivir dentro de estas dos plataformas.

## Núcleo compartido vs. módulos verticales

```
src/
  lib/
    supabase/          # client.ts, server.ts, middleware.ts (YA EXISTE, no tocar el patrón)
    core/               # workspaces, membership, roles, contactos, conversaciones/mensajes,
                        # pipeline genérico, calendario, notas/adjuntos, auditoría
    ai/                 # prompt builder, tools registry, buffer, handoff, orquestación OpenRouter
    integrations/
      ycloud/           # adapter WhatsApp
      openrouter/       # adapter LLM
      highlevel/        # adapter CRM/calendario externo
    modules/
      crm/              # lógica específica del módulo CRM (usa core + ai)
      ats/              # lógica específica del módulo ATS (usa core + ai)
  app/
    (dashboard)/
      inbox/            # núcleo — visible siempre
      crm/              # visible solo si workspace_modules.crm.enabled
      ats/              # visible solo si workspace_modules.ats.enabled
      settings/
    api/
      webhooks/
        ycloud/         # Route Handler de ingestión
        highlevel/      # Route Handler de ingestión
      cron/             # endpoints invocados por Supabase Cron / Vercel Cron para flush de buffer, etc.
```

Justificación: mantiene la separación núcleo/módulo del [03-modules.md](03-modules.md) también a nivel de código, no solo de datos — un tercer módulo futuro se agrega en `lib/modules/<nuevo>` y `app/(dashboard)/<nuevo>` sin tocar `core/` ni `ai/`.

## Procesamiento asíncrono en stack 100% serverless

No hay worker dedicado. Decisión: **cola/estado en Postgres + Supabase Cron/Edge Functions**, no infraestructura de colas externa (SQS, Redis, etc.) — se ajusta al stack obligatorio y es suficiente para el volumen inicial (ver [10-roadmap.md](10-roadmap.md) para el umbral en que esto debe reevaluarse).

Patrón general:
1. Un evento entra (webhook de YCloud/HighLevel, o una acción de usuario) y se persiste inmediatamente como una fila en una tabla de estado (`webhook_events`, `conversation_buffers`, `scheduled_jobs`).
2. Un job programado (`pg_cron` disparando una función SQL, o un Supabase Edge Function invocado por Cron) recorre filas pendientes cuyo `run_at <= now()` y las procesa.
3. Si el procesamiento excede el tiempo de una función (límite ~150s en Edge Functions), el job se diseña para ser idempotente y reanudable (se marca `processing` con lock optimista, y se puede reintentar).

Esto se usa para: buffer inteligente de mensajes ([04-inbox.md](04-inbox.md)), reintentos de envío a YCloud, refresco de tokens OAuth de HighLevel antes de que expiren, y ejecución de automatizaciones diferidas.

## Tiempo real

Supabase Realtime (`postgres_changes`) sobre las tablas `messages` y `conversations`, filtrado por `workspace_id` vía RLS (el cliente solo puede suscribirse a lo que sus políticas le permiten leer). El cliente se suscribe únicamente a la conversación abierta + la lista de conversaciones del workspace, no a un canal global sin filtro — importante para escalar a miles de conversaciones concurrentes (ver riesgo en [10-roadmap.md](10-roadmap.md)).

## Capa de integraciones

Cada integración externa (YCloud, OpenRouter, HighLevel) se implementa como un **adapter** detrás de una interfaz de dominio (`MessagingProvider`, `LLMProvider`, `CRMProvider`), de modo que la lógica de negocio en `core/` y `modules/` nunca importa el SDK del proveedor directamente. Hoy solo hay una implementación por interfaz, pero esto aísla el detalle de vendor (rate limits, forma de payload, auth) y facilita reemplazar/añadir proveedores sin tocar dominio. Detalle completo en [08-integrations.md](08-integrations.md).

## API pública (decisión de alcance)

**Diferido, no un olvido** ([12-security-audit.md](12-security-audit.md) #22): el brief de producto no pidió una API pública de la plataforma hacia sus propios clientes (para que un workspace integre *su* CRM/ERP externo con *esta* plataforma). No se construye ahora — sería alcance no solicitado. El patrón adapter/módulo ya usado internamente ([01-architecture.md](01-architecture.md) arriba) deja la puerta abierta a exponerla en una fase futura sin rediseño (los mismos servicios de dominio en `src/lib/core/` y `src/lib/modules/` que hoy sirven a los Route Handlers internos servirían a endpoints públicos versionados con su propio auth por API key y rate limiting). Se documenta aquí explícitamente para que su ausencia no se lea como un gap accidental.

## Decisión de despliegue

Sin `vercel.json` propio — Next.js zero-config. Los cron jobs se configuran preferentemente como **Supabase Cron** (pg_cron ejecutando funciones SQL/Edge Functions) en vez de Vercel Cron, porque el procesamiento vive más cerca de los datos y no depende de límites de duración de funciones de Vercel. Vercel Cron queda como alternativa si se requiere invocar específicamente un Route Handler de Next.js.
