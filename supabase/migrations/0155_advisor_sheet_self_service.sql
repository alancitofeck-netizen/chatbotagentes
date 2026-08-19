-- Autoservicio: CUALQUIER workspace (no solo los gestionados por una
-- agencia vía advisor_client_id) tiene que poder conectar su propia hoja de
-- Agenda desde su propio Perfil -> Integraciones, sin depender de que una
-- agencia lo dé de alta primero en su roster (clients). Pedido explícito:
-- "cada workspace tiene que tener su propia agenda... toda cuenta nueva que
-- se vaya creando tenga que poder poner la hoja de calculo".
--
-- Se reusa advisor_sheet_connections/agenda_appointments tal cual (mismo
-- runner, mismo cron, misma UI de mapeo de columnas) en vez de duplicar
-- tablas: advisor_client_id NULL = "conexión propia del workspace" (el
-- propio workspace_id es el destino de los datos, sin indirección de
-- agencia). RLS ya admite esto sin cambios (0154: owner/admin/agent sobre
-- su propio workspace_id, sea o no una agencia).
alter table public.advisor_sheet_connections alter column advisor_client_id drop not null;
alter table public.agenda_appointments alter column advisor_client_id drop not null;

-- Una sola conexión propia por workspace (mismo "un asesor, una hoja" que ya
-- rige para las gestionadas por agencia, vía el unique(workspace_id, advisor_client_id)
-- existente -- pero ese constraint no alcanza para NULL, Postgres trata cada
-- NULL como distinto).
create unique index advisor_sheet_connections_self_unique
  on public.advisor_sheet_connections (workspace_id)
  where advisor_client_id is null;
