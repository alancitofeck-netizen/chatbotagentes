# 06 — Módulo CRM

`module_key = 'crm'` en `workspace_modules`. Vive en `src/lib/modules/crm/` + `src/app/(dashboard)/crm/`. Consume el núcleo (contactos, conversaciones, pipeline genérico, agenda, motor IA) — no duplica nada de eso.

## Contacto (entidad núcleo, sin extensión aquí)

`contacts` ya cubre: nombre, teléfono, email, tags, notas, actividad (mensajes + audit_log). Lo único que añade el módulo CRM es la relación a `opportunities` a través del pipeline.

## Pipeline de ventas

Instancia de `pipelines` con `module_key='crm'` (una por workspace, o varias si el workspace quiere pipelines separados por línea de negocio — no hay restricción de cardinalidad). `pipeline_stages` son las etapas personalizables (p. ej. Nuevo → Calificado → Propuesta → Ganado/Perdido, editable por el cliente). Cada `opportunities.pipeline_item_id` referencia una fila en `pipeline_items` con `item_type='opportunity'`.

`opportunities` ([02-database.md](02-database.md)): título, valor, moneda, responsable (`owner_id`), contacto asociado, estado. Etapa y posición en el tablero viven en `pipeline_items`, no en `opportunities` — así el mismo componente de tablero kanban sirve para CRM y ATS ([03-modules.md](03-modules.md)).

## Etiquetas, notas, actividad

Reutiliza `tags`/`contact_tags` y `notes` (`notable_type='conversation'` o el tipo que aplique) del núcleo. "Actividad" del contacto se arma leyendo `audit_log` + `messages` + `notes` filtrados por `contact_id`/`workspace_id` — no es una tabla nueva, es una vista/consulta.

## Modo Setter

Especialización del motor IA ([05-ai-engine.md](05-ai-engine.md)) orientada a calificación, descubrimiento y agendamiento: un `ai_prompts` con tools `check_agenda_availability` + `create_appointment` habilitadas, y un prompt de sistema enfocado en avanzar al contacto por las primeras etapas del pipeline (calificar) y reservar una cita cuando corresponde.

## Sincronización con HighLevel

Dirección inicial recomendada: **HighLevel como sistema externo de registro opcional**, no fuente de verdad — el workspace decide (vía `integration_connections` con `provider='highlevel'`) si sus contactos/oportunidades se reflejan hacia HighLevel (p. ej. para que el equipo comercial siga usando HighLevel en paralelo) y si el calendario de HighLevel es el que se usa para agendar. Ver diseño del adapter y los huecos de documentación de HighLevel en [08-integrations.md](08-integrations.md).

Mapeo:
- `contacts` (workspace) ↔ Contact de HighLevel (por `location_id` de la conexión).
- `opportunities` ↔ Opportunity de HighLevel (`pipelineId`/`stageId` de HighLevel se guardan en `opportunities.metadata` o en una tabla puente si se necesita mapear stage-por-stage; a definir en detalle en la fase de implementación de esta sincronización — no bloquea el resto del CRM, que funciona igual sin HighLevel conectado).
- `bookings` (`provider='highlevel'`) ↔ Appointment de HighLevel Calendars.

## Reutilización explícita

Este módulo **no** introduce: tabla de contactos propia, motor de pipeline propio, tabla de notas/adjuntos propia, ni un motor de IA propio. Toda su "lógica de módulo" es: qué tools/prompt se activan, cómo se mapean los datos hacia HighLevel, y la UI de `/crm`.
