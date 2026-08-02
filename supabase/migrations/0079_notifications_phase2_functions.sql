-- Fase 2: los 4 checks basados en tiempo del sistema de notificaciones,
-- como funciones plpgsql en vez de una ruta HTTP + pg_net (a diferencia de
-- 0029_pgcron_buffer_flush.sql) — a diferencia del flush del buffer, que
-- necesita lógica de aplicación (llamar a OpenRouter), estos checks son pura
-- lectura/escritura de Postgres, así que pg_cron los invoca directamente sin
-- salir de la base — más simple y no depende de que Vercel esté arriba.
-- SECURITY DEFINER + search_path fijo (mismo patrón que workspace_member_names
-- y el resto de las funciones de este proyecto) porque escriben en
-- `notifications`, que no tiene policy de INSERT para ningún rol — pero sin
-- grant a PUBLIC/authenticated/anon: solo pg_cron (como el rol que programó
-- el schedule) las ejecuta, ningún cliente HTTP debe poder invocarlas.
--
-- Cada función usa DOS CTEs de escritura encadenadas (candidates → UPDATE
-- ... RETURNING → INSERT) en un único statement, no dos statements
-- separados — una CTE de PL/pgSQL no sobrevive más allá del statement que la
-- declara, así que un segundo `... FROM candidates` en una sentencia
-- distinta no puede verla.

create or replace function public.notifications_check_meeting_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with candidates as (
    select id, workspace_id, owner_id, subject
    from public.bookings
    where status <> 'cancelled'
      and owner_id is not null
      and reminder_minutes is not null
      and reminder_sent_at is null
      and now() >= start_time - (reminder_minutes || ' minutes')::interval
      and now() < start_time
  ),
  updated as (
    update public.bookings b
    set reminder_sent_at = now()
    from candidates c
    where b.id = c.id
    returning c.workspace_id, c.owner_id, c.subject, c.id as event_id
  )
  insert into public.notifications (workspace_id, member_id, category, event_type, priority, title, message, action_url, metadata)
  select workspace_id, owner_id, 'calendario', 'meeting_upcoming', 'info',
         'Reunión próxima', coalesce(subject, 'Evento') || ' empieza pronto.', '/calendar',
         jsonb_build_object('event_id', event_id)
  from updated;
end;
$$;
revoke execute on function public.notifications_check_meeting_reminders() from public;

create or replace function public.notifications_check_meeting_started()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with candidates as (
    select id, workspace_id, owner_id, subject
    from public.bookings
    where status <> 'cancelled'
      and owner_id is not null
      and started_notified_at is null
      and now() >= start_time
      and now() < end_time
  ),
  updated as (
    update public.bookings b
    set started_notified_at = now()
    from candidates c
    where b.id = c.id
    returning c.workspace_id, c.owner_id, c.subject, c.id as event_id
  )
  insert into public.notifications (workspace_id, member_id, category, event_type, priority, title, message, action_url, metadata)
  select workspace_id, owner_id, 'calendario', 'meeting_started', 'info',
         'Reunión iniciada', coalesce(subject, 'Evento') || ' acaba de empezar.', '/calendar',
         jsonb_build_object('event_id', event_id)
  from updated;
end;
$$;
revoke execute on function public.notifications_check_meeting_started() from public;

-- Umbral 5 días — confirmado con el usuario (no estaba especificado en el
-- spec original). Solo vuelve a notificar si el lead se tocó (updated_at
-- avanzó) y volvió a quedar quieto — no repite cada corrida mientras sigue
-- inactivo.
create or replace function public.notifications_check_stale_leads()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with candidates as (
    select id, workspace_id, owner_id, title
    from public.opportunities
    where status = 'open'
      and owner_id is not null
      and updated_at < now() - interval '5 days'
      and (stale_notified_at is null or stale_notified_at < updated_at)
  ),
  updated as (
    update public.opportunities o
    set stale_notified_at = now()
    from candidates c
    where o.id = c.id
    returning c.workspace_id, c.owner_id, c.title, c.id as opportunity_id
  )
  insert into public.notifications (workspace_id, member_id, category, event_type, priority, title, message, action_url, metadata)
  select workspace_id, owner_id, 'crm', 'lead_inactive', 'warning',
         'Lead sin actividad', title || ' no tiene actividad hace más de 5 días.', '/crm?opportunity=' || opportunity_id,
         jsonb_build_object('opportunity_id', opportunity_id)
  from updated;
end;
$$;
revoke execute on function public.notifications_check_stale_leads() from public;

-- Umbral 30 minutos — confirmado con el usuario. Solo mira conversaciones
-- abiertas Y asignadas (mismo criterio que ingest.ts/send.ts en Fase 1 —
-- sin dueño, no hay a quién notificar). "Sin responder" = el último mensaje
-- es inbound; en cuanto alguien contesta el LATERAL ya no matchea, así que
-- se autolimpia sin necesidad de resetear la columna de dedupe a mano.
create or replace function public.notifications_check_unanswered_conversations()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with candidates as (
    select c.id, c.workspace_id, c.assigned_user_id, m.created_at as last_inbound_at
    from public.conversations c
    join lateral (
      select direction, created_at
      from public.messages
      where conversation_id = c.id
      order by created_at desc
      limit 1
    ) m on true
    where c.status = 'open'
      and c.assigned_user_id is not null
      and m.direction = 'inbound'
      and m.created_at < now() - interval '30 minutes'
      and (c.unanswered_notified_at is null or c.unanswered_notified_at < m.created_at)
  ),
  updated as (
    update public.conversations c
    set unanswered_notified_at = now()
    from candidates cd
    where c.id = cd.id
    returning cd.workspace_id, cd.assigned_user_id, cd.id as conversation_id
  )
  insert into public.notifications (workspace_id, member_id, category, event_type, priority, title, message, action_url, metadata)
  select workspace_id, assigned_user_id, 'inbox', 'conversation_unanswered', 'warning',
         'Conversación sin responder', 'Hay un mensaje sin responder hace más de 30 minutos.', '/inbox',
         jsonb_build_object('conversation_id', conversation_id)
  from updated;
end;
$$;
revoke execute on function public.notifications_check_unanswered_conversations() from public;
