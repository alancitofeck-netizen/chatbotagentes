-- Fase 2 del sistema de notificaciones (eventos basados en tiempo, ver plan
-- de implementación) — columnas de dedupe para que los checks periódicos
-- (0079/0080) no reinserten la misma notificación en cada corrida de
-- pg_cron. Cada columna guarda cuándo se notificó por última vez esa
-- condición; el check solo vuelve a disparar si el dato relevante (updated_at
-- / último mensaje) avanzó más allá de esa marca.

alter table public.bookings add column if not exists reminder_sent_at timestamptz;
alter table public.bookings add column if not exists started_notified_at timestamptz;

alter table public.opportunities add column if not exists stale_notified_at timestamptz;

alter table public.conversations add column if not exists unanswered_notified_at timestamptz;
