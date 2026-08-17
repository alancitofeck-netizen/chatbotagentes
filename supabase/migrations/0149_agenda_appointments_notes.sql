-- Columna NOTAS de la hoja del asesor — se quiere mostrar en el detalle de
-- la cita en Agenda (teléfono/email ya viven en contacts, pero notas no
-- tenía dónde guardarse a nivel cita). Mismo criterio que setter_name
-- (0147): snapshot de solo lectura, se sobreescribe en cada sync, nunca se
-- acumula (a diferencia de la nota que además se sigue insertando en la
-- tabla `notes` del CRM, historial aparte).
alter table public.agenda_appointments add column notes text;
