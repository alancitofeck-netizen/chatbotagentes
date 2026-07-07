# MASTER BLUEPRINT

Punto de entrada único al Blueprint de la plataforma. Este documento es un **índice + resumen ejecutivo** — no duplica el contenido de los documentos detallados, lo resume y enlaza. **La fuente de verdad de cada tema vive en su documento detallado**; si algo cambia, se edita ahí primero y este resumen se actualiza para que siga reflejando la realidad (evita mantener dos copias del mismo contenido).

---

## 1. Qué es esto

Plataforma SaaS multi-tenant tipo "WhatsApp Web para equipos": inbox conversacional humano + agentes de IA con handoff, CRM ligero, automatizaciones, agendamiento y cumplimiento estricto de Meta/WhatsApp — extendida con un **módulo ATS** (reclutamiento) completamente integrado al mismo inbox. Cada empresa cliente es un **workspace** aislado; cada módulo (CRM, ATS, futuros) se activa o desactiva **por workspace**.

Stack: Next.js (App Router) + TypeScript + Tailwind CSS v4, Supabase (Postgres + Auth + Realtime + Storage), desplegado en Vercel. Integraciones: YCloud (WhatsApp BSP), OpenRouter (gateway LLM), HighLevel (CRM/calendario externo).

→ Detalle: [00-product.md](00-product.md)

## 2. Arquitectura general

Núcleo compartido (workspaces, contactos, conversaciones/WhatsApp, motor de IA, pipeline genérico, calendario, notas/adjuntos, integraciones) + módulos verticales activables. Sin servidor propio fuera de Vercel + Supabase — el procesamiento asíncrono (buffer de mensajes, reintentos, refresco de tokens) vive como **estado en Postgres procesado por `pg_cron`/Edge Functions**, no en infraestructura de colas externa. Tiempo real vía Supabase Realtime, suscripción acotada por conversación abierta + lista (no canal global). Integraciones aisladas del dominio mediante el patrón adapter (`MessagingProvider`/`LLMProvider`/`CRMProvider`). API pública propia: **diferida deliberadamente**, no construida todavía.

→ Detalle: [01-architecture.md](01-architecture.md)

## 3. Módulos del sistema

Activación por workspace vía `workspace_modules(workspace_id, module_key, enabled, config)`, con enforcement en **3 capas**: servidor (obligatorio), RLS (defensa en profundidad), UI (solo UX). Un módulo nunca duplica entidades del núcleo — las extiende.

| Módulo | `module_key` | Qué añade sobre el núcleo |
|---|---|---|
| Core (siempre activo) | — | Workspaces, auth, contactos, conversaciones/mensajes, buffer, pipeline genérico, calendario, notas/adjuntos, motor IA, integraciones, auditoría |
| CRM / Sales-Support | `crm` | Oportunidades sobre el pipeline genérico, Modo Setter, sync con HighLevel |
| ATS / Reclutamiento | `ats` | Vacantes (dueñas de su propio pipeline), candidatos (extensión 1:1 de contactos), entrevistas/evaluaciones, IA de preclasificación, reportes RR. HH. |

→ Detalle: [03-modules.md](03-modules.md)

## 4. Modelo de datos

Multi-tenancy por columna `workspace_id` + RLS (no schema-per-tenant). Entidades núcleo clave: `workspaces`, `workspace_members`, `workspace_modules`, `contacts` (con `whatsapp_opt_status`), `conversations`, `messages`, `conversation_buffers`, `notes`/`attachments` (polimórficas), `pipelines`/`pipeline_stages`/`pipeline_items` (motor genérico reusado por CRM y ATS), `bookings`, `ai_prompts`, `tools`/`agent_tools`, `integration_connections`, `webhook_events`, `usage_events`, `workspace_quotas`, `audit_log`. Módulo CRM añade `opportunities`; módulo ATS añade `vacancies`, `candidates`, `candidate_applications`, `interviews`, `evaluations`.

→ Detalle: [02-database.md](02-database.md)

## 5. Inbox conversacional

Lista/hilo/estado/etiquetas/asignación/búsqueda/filtros/notas/adjuntos/tiempo real. Mensaje entrante: webhook YCloud → autenticidad → `webhook_events` (idempotente) → resolución de `workspace_id` por número **receptor** (`to`/`wabaId`, nunca por el remitente) → upsert contacto/conversación → buffer. **Buffer inteligente**: fila de estado en Postgres (no timer en memoria) con claim atómico para evitar doble-procesamiento concurrente. Todo envío saliente pasa por el adapter de YCloud, que aplica **incondicionalmente** ventana de 24h y opt-out.

→ Detalle: [04-inbox.md](04-inbox.md)

## 6. Motor de IA / Motor del Agente

Prompt Builder (versionado, activación, sandbox de prueba) + Tools activables por prompt + memoria de conversación + contexto de CRM/ATS. Especificación oficial del pipeline de punta a punta (Ingress Normalizer → Buffer Inteligente → **Decision Engine** → Agent Runtime → **Tool Router** → Generación de respuesta → Persistencia), con nombre de componente propio para cada etapa y una tabla nueva (`tool_calls`) para trazabilidad técnica de herramientas. Handoff humano (`human`/`ai`/`hybrid`, `open`/`pending_human`/`closed`) también sirve como **degradación ante fallo de proveedor o cuota excedida**. Defensas de **prompt injection**: contenido del contacto tratado como dato no confiable, ningún tool handler confía en IDs que el modelo "recuerda" sin re-validar workspace. Chequeo de **cuota preflight** contra `workspace_quotas` antes de cada llamada a OpenRouter — el métering retroactivo solo no es una protección.

→ Detalle: [05-ai-engine.md](05-ai-engine.md) (mecanismos) + [13-agent-engine.md](13-agent-engine.md) (especificación oficial del pipeline y sus componentes)

## 7. Módulo CRM

Contactos + pipeline de ventas (oportunidades) + tags/notas/actividad + Modo Setter (calificación/agendamiento) + sync opcional con HighLevel (mapeo de etapa a nivel de `pipeline_stages.external_refs`, no por oportunidad).

→ Detalle: [06-crm.md](06-crm.md)

## 8. Módulo ATS

Candidatos = extensión 1:1 de contactos (mismo hilo de WhatsApp). Vacantes dueñas de su propio pipeline (mismo motor genérico que CRM). Entrevistas/agenda, evaluaciones, adjuntos de CV (Storage privado + URLs firmadas), IA de preclasificación (`extract_resume_data`, `score_candidate`), reportes/dashboard de RR. HH. como vistas de solo lectura, no tablas nuevas de captura.

→ Detalle: [07-ats.md](07-ats.md)

## 9. Integraciones externas

| Proveedor | Rol | Puntos clave confirmados | Huecos/riesgos abiertos |
|---|---|---|---|
| **YCloud** | WhatsApp BSP | `X-API-Key`, `POST /v2/whatsapp/messages`, webhooks con envelope común, rate limits documentados | Sin mecanismo de firma de webhook confirmado — mitigado con header secreto + idempotencia |
| **OpenRouter** | Gateway LLM | Bearer + OpenAI-compatible, fallback vía `models[]`, `provider` routing, tool calling estilo OpenAI | Sin límites nativos por sub-cliente — mitigado con `workspace_quotas` propio |
| **HighLevel** | CRM/calendario externo | Bearer JWT, tokens Location vs Agency (agencia puede derivar tokens de location), webhooks con `X-GHL-Signature` | OAuth2 exacto (scopes, endpoints) no confirmado — spike obligatorio antes de Fase 5 |

Todas las integraciones detrás de un adapter (`src/lib/integrations/<provider>/`), con reintentos propios (backoff + jitter) y fallo no bloqueante para HighLevel (best-effort, nunca bloquea el flujo conversacional).

→ Detalle: [08-integrations.md](08-integrations.md)

## 10. Seguridad, multi-tenancy y cumplimiento

RLS con policies separadas por comando (`WITH CHECK` en INSERT) y funciones `SECURITY DEFINER` con `search_path` fijo. 4 roles (`owner`/`admin`/`agent`/`viewer`). Secretos vía Supabase Vault, nunca en texto plano. Storage de adjuntos privado + URLs firmadas. Opt-in/opt-out (`contacts.whatsapp_opt_status`) enforced en el adapter de envío. Rate limiting propio (endpoints públicos + cuota por workspace) además de los límites de los proveedores. Observabilidad operativa (correlation ID, logs nativos de Vercel/Supabase) distinta de `audit_log` (auditoría de negocio). Cumplimiento WhatsApp: ventana de 24h centralizada en el adapter, plantillas, auditoría completa.

→ Detalle: [09-security.md](09-security.md)

## 11. UI/UX y sistema de diseño

**Estructura** (propuesta, no validada con wireframes): layout de 3 columnas estilo WhatsApp Web (lista/hilo/panel contextual), navegación condicionada por módulos activos, tablero kanban reusado entre CRM y ATS, dashboard RR. HH. para ATS.

**Identidad visual** (sistema definido): minimalista/premium (Intercom/Linear/Notion/Stripe/Vercel/Missive como referencia de comportamiento, no de apariencia literal). Dos azules con roles distintos — primary (azul profundo, navegación/énfasis) y accent (azul brillante, única acción interactiva por vista) — grises modernos, semánticos deliberadamente apagados. Geist como única familia tipográfica. **Actualizado tras referencia visual del usuario** (misma paleta, distinto lenguaje de forma): tarjetas flotantes con sombra suave por defecto (ya no "pocas sombras"), radios generosos (12–28px, `radius-full` en pills/search), patrón de "tarjeta de contraste" oscura (máx. una por vista), motion rápido y sin rebote (120–240ms). Tokens ya implementados en [src/app/globals.css](../../src/app/globals.css). Modo oscuro con los mismos nombres de token. Desktop-first; mobile solo para administración básica. **Pendiente**: no existe archivo de logo real de Growth Link — paleta a validar contra él cuando esté disponible.

→ Detalle: [11-ui-ux.md](11-ui-ux.md) (estructura) + [14-design-system.md](14-design-system.md) (identidad visual, tokens, inventario de componentes)

## 12. Roadmap técnico

8 fases: **0** Fundación (RLS/pooling correctos desde el inicio) → **1** Inbox+YCloud (resolución de workspace, autenticidad de webhook, opt-out, Storage privado) → **2** CRM base → **3** Motor IA (claim atómico de buffer, prompt injection, cuota preflight) → **4** Handoff+Modo Setter → **5** HighLevel (spike OAuth2 obligatorio primero) → **6** Módulo ATS → **7** Automatizaciones+endurecimiento → **8** Escala (validar Realtime/particionado con datos reales). Los hallazgos **Crítica** de la auditoría ya están incorporados en las fases 0/1/3, no diferidos.

→ Detalle: [10-roadmap.md](10-roadmap.md)

## 13. Auditoría técnica

Revisión completa (Principal Architect + Security Engineer + Staff Backend Engineer) de 23 dimensiones — seguridad multi-tenant, RLS, auth, secretos, webhooks, buffer/concurrencia, ventana 24h, opt-in/out, prompt injection, seguridad de tools, límites/costo, errores/reintentos, rate limiting, observabilidad, recuperación ante fallos, escalabilidad, rendimiento de BD, diseño CRM/ATS, arquitectura modular, integraciones, API pública, roadmap. Todos los hallazgos **Crítica** y **Alta** ya están aplicados en los documentos `00`–`11`. Ningún cambio eliminó funcionalidad.

→ Detalle: [12-security-audit.md](12-security-audit.md)

---

## Índice completo de documentos

| Archivo | Contenido |
|---|---|
| [00-product.md](00-product.md) | Visión, concepto de workspace, plataforma modular, supuestos abiertos |
| [01-architecture.md](01-architecture.md) | Arquitectura general, núcleo vs. módulos, procesamiento asíncrono, decisión de API pública |
| [02-database.md](02-database.md) | Esquema completo (núcleo, CRM, ATS), índices, pooling/particionado |
| [03-modules.md](03-modules.md) | Mecanismo de activación de módulos en 3 capas |
| [04-inbox.md](04-inbox.md) | Flujo de mensajería, buffer inteligente, resolución de workspace, opt-out |
| [05-ai-engine.md](05-ai-engine.md) | Prompt Builder, tools, flujo IA, handoff, prompt injection, cuota |
| [06-crm.md](06-crm.md) | Módulo CRM: contactos, pipeline de ventas, Modo Setter, sync HighLevel |
| [07-ats.md](07-ats.md) | Módulo ATS: vacantes, candidatos, pipeline de reclutamiento, IA de preclasificación |
| [08-integrations.md](08-integrations.md) | YCloud, OpenRouter, HighLevel — hechos técnicos, adapters, resiliencia |
| [09-security.md](09-security.md) | Auth/roles, RLS, secretos, Storage, opt-in/out, rate limiting, observabilidad, cumplimiento |
| [10-roadmap.md](10-roadmap.md) | Fases, riesgos, decisiones de arquitectura, checklist de tareas |
| [11-ui-ux.md](11-ui-ux.md) | Estructura de información propuesta (layout, vistas) — no validada con wireframes |
| [12-security-audit.md](12-security-audit.md) | Auditoría técnica de 23 puntos, con hallazgos ya aplicados al resto del Blueprint |
| [13-agent-engine.md](13-agent-engine.md) | Especificación oficial del motor del agente: diagrama de pipeline, componentes (Ingress Normalizer, Buffer, Decision Engine, Agent Runtime, Tool Router, Persistencia) |
| [14-design-system.md](14-design-system.md) | Identidad visual: tokens de color/tipografía/spacing/radius/elevación/grid/animación, estados, inventario de componentes |

## Supuestos y pendientes abiertos (ver detalle en cada documento)

- **"Movinsa"**: mencionado en el brief original, sin aclarar — no bloquea el plan ([00-product.md](00-product.md)).
- **OAuth2 exacto de HighLevel** (scopes, endpoints de token): no confirmable desde documentación pública — spike obligatorio antes de Fase 5 ([08-integrations.md](08-integrations.md)).
- **Mecanismo de firma de webhooks de YCloud**: no confirmado — mitigado con header secreto hasta validar con soporte de YCloud ([08-integrations.md](08-integrations.md)).
- **UI/UX**: estructura propuesta sin validar con wireframes reales ([11-ui-ux.md](11-ui-ux.md)).
- **Logo real de Growth Link**: no existe el archivo en el repo — la paleta de [14-design-system.md](14-design-system.md) es una interpretación del brief verbal, a re-validar cuando exista el asset.
- **Bookings del ATS vía HighLevel o motor interno**: se asumió motor interno por defecto para entrevistas — a confirmar con el usuario ([07-ats.md](07-ats.md)).

## Mantenimiento de este documento

Este archivo se actualiza únicamente cuando cambia algo **estructural** en el Blueprint (nuevo módulo, nueva integración, cambio de fase de roadmap, nuevo hallazgo crítico de auditoría). Cambios de detalle dentro de un tema (ajustar un campo de tabla, precisar una regla de negocio) se hacen en el documento correspondiente y no necesariamente requieren tocar este resumen, salvo que cambien alguna de las afirmaciones aquí resumidas.
