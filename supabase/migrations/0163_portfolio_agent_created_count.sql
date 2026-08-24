-- Falta un contador de "pólizas nuevas" separado de "actualizadas" para el
-- resumen de "Última sincronización" del Analizador de Cartera — sin esto
-- no hay forma honesta de mostrar ese desglose (0162 ya trae updated_count/
-- cancelled_count, pero created_count quedó afuera por error).
alter table public.insurance_sync_jobs add column if not exists created_count int;
