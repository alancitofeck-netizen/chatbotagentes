# 07 — Módulo ATS (reclutamiento)

`module_key = 'ats'` en `workspace_modules`. Vive en `src/lib/modules/ats/` + `src/app/(dashboard)/ats/`. Requisito de origen: debe estar **completamente integrado al inbox conversacional** — no es una herramienta de RR. HH. aislada, la comunicación con candidatos pasa por el mismo WhatsApp/inbox que usa el módulo CRM.

## Candidatos = extensión de Contactos

`candidates` ([02-database.md](02-database.md)) es una tabla 1:1 con `contacts` (`contact_id unique`), no una entidad paralela. Un candidato **es** un contacto (mismo teléfono, misma conversación, mismo hilo de WhatsApp) con datos adicionales de reclutamiento (`resume_attachment_id`, `source`). Esto es lo que permite reutilizar 100% del inbox, buffer, motor IA y notas/adjuntos del núcleo sin ninguna adaptación.

## Vacantes

`vacancies`: título, descripción, departamento, ubicación, estado (`open|paused|closed`). **Cada vacante es dueña de una instancia del pipeline genérico** (`vacancies.pipeline_id → pipelines` con `module_key='ats'`) — no existe un "pipeline de reclutamiento" único y global, sino uno por vacante, con sus propias `pipeline_stages` personalizables (p. ej. Aplicó → Preclasificado → Entrevista → Oferta → Contratado/Rechazado).

## Pipeline de reclutamiento

`candidate_applications` conecta candidato + vacante, y referencia una fila en `pipeline_items` (`item_type='candidate_application'`) para su etapa/posición — exactamente el mismo mecanismo que usa `opportunities` en el módulo CRM ([06-crm.md](06-crm.md)). El tablero kanban de la UI del ATS es el mismo componente que el tablero del CRM, parametrizado por `pipeline_id`.

## Entrevistas y agenda

`interviews` referencia una `candidate_applications` y opcionalmente una fila en `bookings` (núcleo, `provider='internal'` por defecto). **Decisión/supuesto**: a diferencia del módulo CRM (donde el calendario de HighLevel es central para agendar con prospectos de venta), las entrevistas internas de RR. HH. probablemente no necesitan pasar por HighLevel — se asume `bookings.provider='internal'` (disponibilidad gestionada dentro de la plataforma, por entrevistador) como default para ATS, dejando la puerta abierta a `provider='highlevel'` si el workspace así lo configura. **A confirmar con el usuario** antes de construir esta parte.

## Evaluaciones

`evaluations`: una fila por entrevista + evaluador, con `scorecard jsonb` (estructura de scorecard configurable por workspace/vacante — no fija a nivel de esquema), `rating` y `comments`. Varias evaluaciones pueden existir por entrevista si participan varios entrevistadores.

## Notas y adjuntos

Reutiliza `notes` (`notable_type='candidate_application'`) y `attachments` (`attachable_type='candidate_application'` para CV/documentos adicionales, o `attachable_type='message'` si el CV llega por WhatsApp). `candidates.resume_attachment_id` apunta al CV "actual" del candidato para acceso rápido, aunque el historial completo vive en `attachments`.

## Comunicación por WhatsApp

Ninguna tabla ni servicio nuevo: la conversación con un candidato es una fila normal de `conversations`/`messages` del núcleo, con `contact_id` apuntando al contacto que además tiene fila en `candidates`. El inbox no distingue "conversación CRM" de "conversación ATS" a nivel de datos — la distinción es de contexto (a qué `candidate_applications`/`opportunities` está asociado ese contacto), visible en el panel lateral de la UI.

## IA para preclasificación

Especialización del motor IA ([05-ai-engine.md](05-ai-engine.md)): un `ai_prompts` con `module_key='ats'` y tools propias:
- `extract_resume_data`: parsea el adjunto de CV y estructura datos (experiencia, educación, habilidades).
- `score_candidate`: puntúa al candidato contra los requisitos de la vacante (de `vacancies.description` o campos estructurados a definir), y puede mover automáticamente la `candidate_applications` a la etapa "Preclasificado" o "Rechazado" del pipeline según umbral configurable.

## Reportes ATS, métricas de contratación y dashboard de RR. HH.

No son tablas nuevas de captura, son **vistas de solo lectura** sobre datos existentes:
- Time-to-hire: `candidate_applications.applied_at` → fecha de `pipeline_items` en etapa "Contratado".
- Conversión de embudo: conteo de `candidate_applications` por `pipeline_stages` de cada vacante.
- Origen de candidatos: agregación de `candidates.source`.
- Dashboard de RR. HH.: composición de estas métricas por vacante/departamento/rango de fechas.

Se implementan como vistas SQL (`ats_funnel_view`, etc.) o consultas server-side directas — a decidir en fase de implementación según necesidad real de rendimiento, no requiere nueva tabla base.

## Reutilización explícita

Este módulo **no** introduce: tabla de contactos propia (usa `contacts` + `candidates` 1:1), motor de pipeline propio (usa `pipelines`/`pipeline_stages`/`pipeline_items`), tabla de mensajería propia (usa `conversations`/`messages`), tabla de notas/adjuntos propia, ni motor de IA propio. Sí introduce datos genuinamente nuevos del dominio de reclutamiento: `vacancies`, `candidates`, `candidate_applications`, `interviews`, `evaluations`.
