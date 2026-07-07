# 00 — Producto

## Visión

Plataforma SaaS multi-tenant tipo "WhatsApp Web para equipos" que combina:

- Inbox conversacional humano (WhatsApp).
- Agentes de IA con handoff humano.
- CRM ligero.
- Automatizaciones y herramientas activables.
- Prompting configurable (Prompt Builder).
- Agendamiento.
- Cumplimiento estricto de políticas de Meta/WhatsApp.

**No es un chatbot simple.** Es una plataforma de atención conversacional donde IA y humanos colaboran sobre la misma bandeja de entrada, con contexto de CRM y herramientas activables.

## Concepto de workspace

Cada empresa cliente = un **workspace** aislado (multi-tenant estricto, ver [02-database.md](02-database.md) y [09-security.md](09-security.md)). Ningún workspace accede a datos de otro. Dentro de cada workspace existen usuarios, roles, contactos, conversaciones, agentes IA, herramientas, automatizaciones y configuración propia.

## Plataforma modular

La plataforma es un **núcleo compartido** (workspaces, auth, contactos, conversaciones/WhatsApp, motor de IA, pipeline genérico, calendario, adjuntos/notas, integraciones) sobre el que corren **módulos verticales activables por workspace**:

1. **Módulo CRM** ([06-crm.md](06-crm.md)) — inbox de ventas/soporte con CRM ligero, Prompt Builder, Tools, Modo Setter, agenda vía HighLevel.
2. **Módulo ATS** ([07-ats.md](07-ats.md)) — reclutamiento (vacantes, candidatos, pipeline de reclutamiento, entrevistas, evaluaciones), completamente integrado al inbox conversacional y reutilizando el mismo motor de IA/pipeline/agenda del núcleo.
3. Módulos futuros — el mecanismo de activación (ver [03-modules.md](03-modules.md)) está diseñado para no requerir re-arquitectura al añadir un tercer módulo.

Un workspace puede tener CRM, ATS, ambos, o ninguno activo; el enforcement de qué módulo está activo ocurre en servidor (no solo ocultando UI).

## Funcionalidades principales (resumen — detalle en su documento correspondiente)

| Funcionalidad | Documento |
|---|---|
| Inbox conversacional (lista, historial, etiquetas, asignación, búsqueda, filtros, tiempo real, notas, adjuntos) | [04-inbox.md](04-inbox.md) |
| Motor IA (humano/IA/híbrido, contexto dinámico, memoria, tools) | [05-ai-engine.md](05-ai-engine.md) |
| Buffer inteligente de mensajes | [04-inbox.md](04-inbox.md) |
| Handoff humano | [05-ai-engine.md](05-ai-engine.md) |
| CRM (contactos, pipeline, etapas, responsable, notas) | [06-crm.md](06-crm.md) |
| Prompt Builder (versionado, activación, pruebas) | [05-ai-engine.md](05-ai-engine.md) |
| Tools activables | [05-ai-engine.md](05-ai-engine.md) |
| Modo Setter (calificación/descubrimiento/agendamiento) | [05-ai-engine.md](05-ai-engine.md) |
| Agenda (disponibilidad, reservas, reprogramaciones) | [04-inbox.md](04-inbox.md), [08-integrations.md](08-integrations.md) |
| Módulo ATS completo | [07-ats.md](07-ats.md) |
| Cumplimiento Meta/WhatsApp (ventana 24h, plantillas, auditoría) | [09-security.md](09-security.md) |

## Stack obligatorio

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS v4.
- **Backend**: Supabase (Postgres + Auth + Realtime + Storage).
- **Integraciones**: YCloud (WhatsApp BSP), OpenRouter (gateway LLM), HighLevel (CRM/calendario externo).
- **Deploy**: Vercel.

Ver [01-architecture.md](01-architecture.md) para cómo estas piezas encajan, y [08-integrations.md](08-integrations.md) para el detalle técnico de cada integración.

## Supuestos y pendientes explícitos

- **"Movinsa"**: mencionado en el brief original junto a "ATS" como presunto repositorio existente a revisar. Se confirmó que no existe repositorio remoto ni local con ese nombre. Se interpreta como referencia no aclarada (posible nombre de cliente/workspace piloto) — no bloquea la planificación. **Pendiente de confirmación del usuario.**
- No existe todavía un brief de diseño visual — [11-ui-ux.md](11-ui-ux.md) documenta una propuesta razonable a validar, no una decisión cerrada.
- El alcance de "cumplimiento Meta" se interpreta a partir de las reglas públicas de WhatsApp Business Platform (ventana de 24h, plantillas aprobadas) — no se recibió un documento legal/compliance adicional.
