-- Agenda ↔ hoja de agendas (pedido del usuario: "Conectar hoja de agendas" desde la propia
-- Agenda, con equivalencias, vista previa, leads guardados en la Agenda y escritura del estado
-- de vuelta en la hoja). Sincronización SOLO manual (botón "Actualizar"), por pedido explícito.
--
-- Justificación contra 02-database.md: se reutiliza el motor que ya existe
-- (advisor_sheet_connections / advisor_sheet_rows / agenda_appointments, 0142-0155) en vez de
-- crear tablas paralelas — la conexión "propia" de cada workspace (advisor_client_id null, 0155)
-- es exactamente "la hoja de agendas de esta cuenta". Lo nuevo es mínimo:
--
--  1. agenda_appointments
--     · producto, contactado: columnas PRODUCTO y CONTACTÉ de la hoja (texto ya traducido por las
--       equivalencias / Sí-No).
--     · sin_hora: la hoja no trae HORA — la cita se guarda a las 00:00 de ese día pero se muestra
--       "sin hora" (nunca se inventa un horario).
--     · deleted_in_sheet: la fila desapareció de la hoja. No se borra nada del CRM; se marca.
--     · sheet_connection_id + sheet_row_number: de qué hoja/fila vino, para escribir el estado
--       de vuelta en esa celda (antes de escribir se verifica que el teléfono de la fila siga
--       coincidiendo — si la hoja se reordenó, no se pisa otra fila).
--     · estado 'propuesta': nuevo, entre "realizada" y "venta" (KPI "Propuestas").
--  2. advisor_sheet_connections
--     · value_map: equivalencias valor-de-la-hoja → valor-del-CRM para estado / producto / tipo
--       de cita: { "estado": { "1ER reunión": "agendada" }, "producto": {...}, "appointmentType": {...} }.
--     · options: { "create_leads": bool, "write_back": bool }.
--     · spreadsheet_title: nombre real de la hoja, para la franja "Sincronizado con Google Sheets".
--     · utc_offset_minutes: zona horaria de las horas de la hoja (getTimezoneOffset() del navegador
--       de quien configura; Mexico = 360). Antes estaba fijo en UTC-3 en runner.ts — el default
--       180 conserva exactamente ese comportamiento para las conexiones existentes.
--     · last_sync_started_at: para marcar "NUEVO LEAD" a los contactos creados en la última sync.
--  3. Se desprograma el cron 'sync-advisor-sheets' (cada 2h, 0151): la sync pasa a ser
--     únicamente manual, mismo criterio que 0198 para "Exportar referidos".

alter table public.agenda_appointments
  add column producto text,
  add column contactado boolean,
  add column sin_hora boolean not null default false,
  add column deleted_in_sheet boolean not null default false,
  add column sheet_connection_id uuid references public.advisor_sheet_connections (id) on delete set null,
  add column sheet_row_number int;

create index agenda_appointments_sheet_connection_idx on public.agenda_appointments (sheet_connection_id) where sheet_connection_id is not null;

alter table public.agenda_appointments drop constraint agenda_appointments_estado_cita_check;
alter table public.agenda_appointments add constraint agenda_appointments_estado_cita_check
  check (estado_cita in ('agendada', 'confirmada', 'realizada', 'no_show', 'cancelada', 'propuesta', 'venta'));

alter table public.advisor_sheet_connections
  add column value_map jsonb not null default '{}'::jsonb,
  add column options jsonb not null default '{"create_leads": true, "write_back": true}'::jsonb,
  add column spreadsheet_title text,
  add column utc_offset_minutes int not null default 180 check (utc_offset_minutes between -840 and 840),
  add column last_sync_started_at timestamptz;

do $unschedule$
begin
  if exists (select 1 from cron.job where jobname = 'sync-advisor-sheets') then
    perform cron.unschedule('sync-advisor-sheets');
  end if;
end
$unschedule$;
