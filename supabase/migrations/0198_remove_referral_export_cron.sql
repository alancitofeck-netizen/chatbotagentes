-- El usuario no quiere el reintento automático cada 3 minutos de
-- "Exportar Referidos a hoja" (0197_referral_sheet_export.sql) — prefiere
-- reintentar a mano con el botón "Exportar a hoja" que ya existe en
-- Asesorías > Referidos (exportPendingReferralsAction, que ya procesa
-- cualquier referido sin exportar o con error, sin necesidad de cron). Se
-- desprograma el job y se borra la función que solo usaba el cron — el
-- resto de la 0197 (tablas, policies, exportación automática al crear/
-- actualizar un referido) sigue igual, no se toca.

select cron.unschedule('sync-referral-exports');

drop function if exists public.claim_pending_referral_exports(int);
