-- Pestaña Tareas del módulo Clientes necesita "Relacionado con" (LinkedIn,
-- Reporting, Agenda, Meta Ads, Reunión, Contrato...) para clasificar a qué
-- área de la relación con el cliente pertenece cada tarea. No existe hoy:
-- tasks.related_type/related_id es un vínculo polimórfico a una entidad real
-- (contact/conversation/opportunity, ver src/lib/tasks/queries.ts), no una
-- etiqueta de área. Mismo criterio que bookings.campana (0127): texto libre,
-- carga manual, arranca vacío — cada asesor/setter etiqueta sus tareas como
-- quiera, sin catálogo fijo.
alter table public.tasks add column if not exists related_area text;
