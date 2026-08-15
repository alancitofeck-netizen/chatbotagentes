-- Muchos setters no tienen cuenta de Growth Link (no son workspace_members),
-- así que setter_id queda null para ellos (ver advisorSync/runner.ts, el
-- Setter es opcional). Sin un texto crudo, la Agenda no tenía nada que
-- mostrar para esas citas — se guarda el nombre tal cual viene de la hoja
-- como respaldo de visualización, nunca como identidad (eso sigue siendo
-- setter_id exclusivamente).
alter table public.agenda_appointments add column setter_name text;
