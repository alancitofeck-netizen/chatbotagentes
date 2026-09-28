-- Amplía las etapas de un lead de Mini Apps para el kanban del rediseño de
-- la pestaña Leads (Fase 2): hoy solo hay 4 valores (new/contacted/
-- converted/discarded); se agregan 2 intermedios que el mockup pide
-- ("Cita agendada", "Propuesta enviada"). Aditivo — las filas existentes ya
-- usan valores que siguen siendo válidos, y updateMiniAppLeadStatus ya acepta
-- cualquier MiniAppLeadStatus sin cambios. "Perdido" del mockup ya existe
-- como 'discarded'.
alter table public.mini_app_leads drop constraint if exists mini_app_leads_status_check;
alter table public.mini_app_leads add constraint mini_app_leads_status_check
  check (status in ('new', 'contacted', 'cita_agendada', 'propuesta_enviada', 'converted', 'discarded'));
