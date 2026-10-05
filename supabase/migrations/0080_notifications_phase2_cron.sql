-- Fase 2: programa los 4 checks de 0079 vía pg_cron — mismo mecanismo que
-- 0029_pgcron_buffer_flush.sql, corre dentro de Postgres, no sujeto a los
-- límites de Cron Jobs de Vercel (ver CLAUDE.md). Frecuencias distintas
-- según cuán sensible al tiempo es cada check: los de reunión son
-- minuto-a-minuto (la ventana de recordatorio es en minutos), los otros dos
-- son más laxos porque sus umbrales son de decenas de minutos/días.
-- pg_cron's interval shorthand only accepts seconds ('[1-59] seconds') —
-- anything minute-or-coarser needs standard 5-field cron syntax instead.
do $gate$
begin
  -- Sólo producción programa este job (ver docs/mobile/cron-en-branches.md).
  if current_setting('app.environment', true) = 'production' then
    perform cron.schedule('notifications-meeting-reminders', '* * * * *', $$select public.notifications_check_meeting_reminders();$$);
  end if;
end
$gate$;
do $gate$
begin
  -- Sólo producción programa este job (ver docs/mobile/cron-en-branches.md).
  if current_setting('app.environment', true) = 'production' then
    perform cron.schedule('notifications-meeting-started', '* * * * *', $$select public.notifications_check_meeting_started();$$);
  end if;
end
$gate$;
do $gate$
begin
  -- Sólo producción programa este job (ver docs/mobile/cron-en-branches.md).
  if current_setting('app.environment', true) = 'production' then
    perform cron.schedule('notifications-unanswered-conversations', '*/5 * * * *', $$select public.notifications_check_unanswered_conversations();$$);
  end if;
end
$gate$;
do $gate$
begin
  -- Sólo producción programa este job (ver docs/mobile/cron-en-branches.md).
  if current_setting('app.environment', true) = 'production' then
    perform cron.schedule('notifications-stale-leads', '*/30 * * * *', $$select public.notifications_check_stale_leads();$$);
  end if;
end
$gate$;
