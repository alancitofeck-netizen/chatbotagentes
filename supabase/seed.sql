-- Demo data for the Dashboard + CRM slice. No real data pipeline exists yet
-- (no YCloud, no real leads) — this seeds realistic-looking rows against the
-- real workspace of whoever registered first, so the Dashboard/CRM aren't
-- empty. Looks the workspace up dynamically (oldest workspace) instead of a
-- hardcoded id. Meant to run once: the pipeline/stages are guarded against
-- duplication (skipped if a 'crm' pipeline already exists), contacts dedupe
-- on (workspace_id, phone), but conversations/messages/bookings/standalone
-- tasks are NOT idempotent — re-running duplicates those.

do $$
declare
  v_workspace_id uuid;
  v_pipeline_id uuid;
  v_stage_new uuid;
  v_stage_contacted uuid;
  v_stage_interested uuid;
  v_stage_meeting uuid;
  v_stage_proposal uuid;
  v_stage_negotiation uuid;
  v_stage_won uuid;
  v_stage_lost uuid;
  v_contact_ids uuid[];
  v_contact_id uuid;
  v_conversation_id uuid;
  v_opportunity_id uuid;
  v_pipeline_item_id uuid;
  v_tag_vip uuid;
  v_tag_urgente uuid;
  v_tag_nuevo_lead uuid;
  v_tag_precio uuid;
  v_tag_reactivar uuid;
  v_owner_member_id uuid;
  i int;
  v_names text[] := array[
    'Sofía Reyes', 'Michael Turner', 'Abdul Al-Aziz', 'Laura Gómez', 'Carlos Méndez',
    'Ana Belén Ruiz', 'Diego Fernández', 'Julia Castro', 'Martín Suárez', 'Valentina Ortiz',
    'Pedro Salinas', 'Camila Rossi', 'Tomás Herrera', 'Renata Vidal', 'Ignacio Paredes'
  ];
  v_companies text[] := array[
    'Nimbus Labs', 'Vertex Studio', 'Bright Retail', 'Orbital Health', 'Fintra Capital',
    'Lumen Agency', 'Sequoia Foods', 'Atlas Logistics', 'Kite Software', 'Norte Real Estate'
  ];
  -- ATS demo data (docs/blueprint/07-ats.md) — each vacancy owns its own
  -- pipeline instance, unlike CRM's single global one.
  v_vacancy_design uuid;
  v_vacancy_ventas uuid;
  v_pipeline_design uuid;
  v_pipeline_ventas uuid;
  v_stage_ids_design uuid[] := array[]::uuid[];
  v_stage_ids_ventas uuid[] := array[]::uuid[];
  v_stage_id uuid;
  v_ats_stage_names text[] := array['Aplicó', 'Preclasificado', 'Entrevista', 'Oferta', 'Contratado', 'Rechazado'];
  v_candidate_contact_id uuid;
  v_candidate_id uuid;
  v_application_id uuid;
  v_candidate_names text[] := array[
    'Rocío Paz', 'Bruno Iglesias', 'Milagros Funes', 'Nicolás Ríos',
    'Agustina Molina', 'Franco Bianchi', 'Lucía Navarro', 'Tomás Aguirre'
  ];
  v_candidate_sources text[] := array['LinkedIn', 'Referido', 'Indeed', 'Web', 'LinkedIn', 'Referido', 'Indeed', 'Web'];
  j int;
begin
  -- Targets the real user's workspace specifically — NOT just "oldest
  -- workspace", because a disposable test account (claude-e2e-test@…, used
  -- to verify the auth flow end-to-end) has an even earlier one. Falls back
  -- to oldest-overall only if that email isn't found in this environment.
  select w.id into v_workspace_id
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  join auth.users u on u.id = m.user_id
  where u.email = 'alancitofeck@gmail.com'
  order by w.created_at asc
  limit 1;

  if v_workspace_id is null then
    select w.id into v_workspace_id
    from public.workspaces w
    order by w.created_at asc
    limit 1;
  end if;

  if v_workspace_id is null then
    raise notice 'No workspace found — nothing to seed.';
    return;
  end if;

  -- Enable the CRM module for this workspace (03-modules.md).
  insert into public.workspace_modules (workspace_id, module_key, enabled)
  values (v_workspace_id, 'crm', true)
  on conflict (workspace_id, module_key) do update set enabled = true;

  -- Contacts (leads) — spread over the last 90 days, several "today"/"yesterday".
  v_contact_ids := array[]::uuid[];
  for i in 1..15 loop
    insert into public.contacts (workspace_id, name, phone, email, company, source, created_at)
    values (
      v_workspace_id,
      v_names[i],
      '+549' || (100000000 + i * 7919)::text,
      lower(replace(v_names[i], ' ', '.')) || '@example.com',
      v_companies[1 + (i % array_length(v_companies, 1))],
      (array['whatsapp', 'referido', 'web', 'linkedin'])[1 + (i % 4)],
      case
        when i <= 2 then now() - (random() * interval '10 hours')          -- hoy
        when i <= 4 then now() - interval '1 day' - (random() * interval '10 hours') -- ayer
        else now() - (random() * interval '85 days') - interval '2 days'
      end
    )
    on conflict (workspace_id, phone) do update set name = excluded.name
    returning id into v_contact_id;

    v_contact_ids := array_append(v_contact_ids, v_contact_id);
  end loop;

  -- One conversation + a handful of messages per contact, spread over the range too.
  for i in 1..array_length(v_contact_ids, 1) loop
    insert into public.conversations (workspace_id, contact_id, status, mode, last_message_at, created_at)
    values (
      v_workspace_id,
      v_contact_ids[i],
      (array['open', 'open', 'pending_human', 'closed'])[1 + (i % 4)],
      'human',
      now() - (random() * interval '3 days'),
      now() - (random() * interval '85 days')
    )
    returning id into v_conversation_id;

    insert into public.messages (workspace_id, conversation_id, direction, sender_type, type, content, created_at)
    select
      v_workspace_id,
      v_conversation_id,
      case when gs % 2 = 0 then 'inbound' else 'outbound' end,
      case when gs % 2 = 0 then 'contact' else 'agent' end,
      'text',
      jsonb_build_object('body', (array[
        'Hola, quería más información sobre el plan Enterprise.',
        'Claro, te comparto los detalles ahora mismo.',
        '¿Tienen integración con WhatsApp?',
        'Sí, es justamente nuestro fuerte.',
        '¿Cuándo podríamos agendar una llamada?',
        'Te propongo mañana a las 10am, ¿te sirve?'
      ])[1 + (gs % 6)]),
      now() - (random() * interval '85 days')
    from generate_series(1, 3 + (i % 4)) as gs;
  end loop;

  -- CRM pipeline — exact stage names requested, only created once.
  select id into v_pipeline_id from public.pipelines where workspace_id = v_workspace_id and module_key = 'crm' limit 1;

  if v_pipeline_id is null then
    insert into public.pipelines (workspace_id, module_key, name) values (v_workspace_id, 'crm', 'Pipeline de ventas')
    returning id into v_pipeline_id;

    insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost) values
      (v_pipeline_id, 'Nuevo', 0, false, false) returning id into v_stage_new;
    insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost) values
      (v_pipeline_id, 'Contactado', 1, false, false) returning id into v_stage_contacted;
    insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost) values
      (v_pipeline_id, 'Interesado', 2, false, false) returning id into v_stage_interested;
    insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost) values
      (v_pipeline_id, 'Reunión', 3, false, false) returning id into v_stage_meeting;
    insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost) values
      (v_pipeline_id, 'Propuesta', 4, false, false) returning id into v_stage_proposal;
    insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost) values
      (v_pipeline_id, 'Negociación', 5, false, false) returning id into v_stage_negotiation;
    insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost) values
      (v_pipeline_id, 'Ganado', 6, true, false) returning id into v_stage_won;
    insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost) values
      (v_pipeline_id, 'Perdido', 7, false, true) returning id into v_stage_lost;

    -- One opportunity per contact, distributed across every stage, with a
    -- realistic value and a created_at spread over the last 60 days so
    -- "Ventas del mes" and the conversion rate have real numbers.
    for i in 1..array_length(v_contact_ids, 1) loop
      insert into public.opportunities (workspace_id, contact_id, title, value, owner_id, status, created_at)
      values (
        v_workspace_id,
        v_contact_ids[i],
        'Oportunidad — ' || v_names[i],
        (500 + (i * 733) % 9000)::numeric,
        null,
        case when i % 8 = 6 then 'won' when i % 8 = 7 then 'lost' else 'open' end,
        now() - (random() * interval '55 days')
      )
      returning id into v_opportunity_id;

      insert into public.pipeline_items (pipeline_id, stage_id, item_type, item_id, position)
      values (
        v_pipeline_id,
        case (i % 8)
          when 0 then v_stage_new
          when 1 then v_stage_contacted
          when 2 then v_stage_interested
          when 3 then v_stage_meeting
          when 4 then v_stage_proposal
          when 5 then v_stage_negotiation
          when 6 then v_stage_won
          else v_stage_lost
        end,
        'opportunity',
        v_opportunity_id,
        i
      )
      returning id into v_pipeline_item_id;

      update public.opportunities set pipeline_item_id = v_pipeline_item_id where id = v_opportunity_id;

      -- A note + a follow-up task on ~half the opportunities, for the detail panel and "próxima actividad".
      if i % 2 = 0 then
        insert into public.notes (workspace_id, notable_type, notable_id, body, created_at)
        values (v_workspace_id, 'opportunity', v_opportunity_id, 'Cliente pidió una demo del módulo de IA.', now() - interval '2 days');

        insert into public.tasks (workspace_id, title, related_type, related_id, due_at)
        values (v_workspace_id, 'Enviar propuesta a ' || v_names[i], 'opportunity', v_opportunity_id, now() + (random() * interval '5 days'));
      end if;
    end loop;
  end if;

  -- A few bookings — at least one today, a few upcoming, a few past.
  insert into public.bookings (workspace_id, contact_id, start_time, end_time, subject, status)
  values
    (v_workspace_id, v_contact_ids[1], date_trunc('day', now()) + interval '15 hours', date_trunc('day', now()) + interval '15 hours 30 minutes', 'Demo — plan Enterprise', 'scheduled'),
    (v_workspace_id, v_contact_ids[2], now() + interval '2 hours', now() + interval '2 hours 30 minutes', 'Llamada de seguimiento', 'scheduled'),
    (v_workspace_id, v_contact_ids[3], now() + interval '2 days', now() + interval '2 days 1 hour', 'Onboarding técnico', 'scheduled'),
    (v_workspace_id, v_contact_ids[4], now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', 'Descubrimiento', 'completed');

  -- A few standalone tasks not tied to an opportunity, for "Tareas pendientes".
  insert into public.tasks (workspace_id, title, due_at) values
    (v_workspace_id, 'Llamar a Juan', now() + interval '3 hours'),
    (v_workspace_id, 'Revisar candidatos del ATS', now() + interval '1 day'),
    (v_workspace_id, 'Responder WhatsApp pendientes', now());

  -- Tags for the Inbox — idempotent, so re-running the seed doesn't duplicate them.
  insert into public.tags (workspace_id, name, color) values (v_workspace_id, 'VIP', 'accent')
    on conflict (workspace_id, name) do update set color = excluded.color returning id into v_tag_vip;
  insert into public.tags (workspace_id, name, color) values (v_workspace_id, 'Urgente', 'error')
    on conflict (workspace_id, name) do update set color = excluded.color returning id into v_tag_urgente;
  insert into public.tags (workspace_id, name, color) values (v_workspace_id, 'Nuevo lead', 'warning')
    on conflict (workspace_id, name) do update set color = excluded.color returning id into v_tag_nuevo_lead;
  insert into public.tags (workspace_id, name, color) values (v_workspace_id, 'Precio', 'neutral')
    on conflict (workspace_id, name) do update set color = excluded.color returning id into v_tag_precio;
  insert into public.tags (workspace_id, name, color) values (v_workspace_id, 'Reactivar', 'warning')
    on conflict (workspace_id, name) do update set color = excluded.color returning id into v_tag_reactivar;

  insert into public.contact_tags (contact_id, tag_id) values
    (v_contact_ids[1], v_tag_vip), (v_contact_ids[1], v_tag_urgente),
    (v_contact_ids[2], v_tag_nuevo_lead),
    (v_contact_ids[3], v_tag_precio),
    (v_contact_ids[5], v_tag_vip),
    (v_contact_ids[6], v_tag_reactivar),
    (v_contact_ids[8], v_tag_nuevo_lead),
    (v_contact_ids[10], v_tag_precio), (v_contact_ids[10], v_tag_reactivar)
  on conflict (contact_id, tag_id) do nothing;

  -- Assign a few conversations to the workspace owner, to demo "asignado a mí".
  select m.id into v_owner_member_id
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = v_workspace_id and u.email = 'alancitofeck@gmail.com'
  limit 1;

  if v_owner_member_id is not null then
    update public.conversations
    set assigned_user_id = v_owner_member_id
    where workspace_id = v_workspace_id and contact_id = any (v_contact_ids[1:5]);
  end if;

  -- ATS module — enable it, create 2 demo vacancies (each with its own
  -- pipeline + 6 stages, only once), and 8 candidates as brand-new contacts
  -- (distinct from the CRM leads above) distributed across both boards.
  insert into public.workspace_modules (workspace_id, module_key, enabled)
  values (v_workspace_id, 'ats', true)
  on conflict (workspace_id, module_key) do update set enabled = true;

  select id into v_vacancy_design from public.vacancies
  where workspace_id = v_workspace_id and title = 'Diseñador/a UI/UX' limit 1;

  if v_vacancy_design is null then
    insert into public.pipelines (workspace_id, module_key, name)
    values (v_workspace_id, 'ats', 'Pipeline — Diseñador/a UI/UX')
    returning id into v_pipeline_design;

    for j in 1..array_length(v_ats_stage_names, 1) loop
      insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost)
      values (
        v_pipeline_design, v_ats_stage_names[j], j - 1,
        v_ats_stage_names[j] = 'Contratado', v_ats_stage_names[j] = 'Rechazado'
      )
      returning id into v_stage_id;
      v_stage_ids_design := array_append(v_stage_ids_design, v_stage_id);
    end loop;

    insert into public.vacancies (workspace_id, title, department, location, pipeline_id)
    values (v_workspace_id, 'Diseñador/a UI/UX', 'Producto', 'Remoto', v_pipeline_design)
    returning id into v_vacancy_design;
  else
    select array_agg(id order by position) into v_stage_ids_design
    from public.pipeline_stages
    where pipeline_id = (select pipeline_id from public.vacancies where id = v_vacancy_design);
  end if;

  select id into v_vacancy_ventas from public.vacancies
  where workspace_id = v_workspace_id and title = 'Setter de Ventas' limit 1;

  if v_vacancy_ventas is null then
    insert into public.pipelines (workspace_id, module_key, name)
    values (v_workspace_id, 'ats', 'Pipeline — Setter de Ventas')
    returning id into v_pipeline_ventas;

    for j in 1..array_length(v_ats_stage_names, 1) loop
      insert into public.pipeline_stages (pipeline_id, name, position, is_won, is_lost)
      values (
        v_pipeline_ventas, v_ats_stage_names[j], j - 1,
        v_ats_stage_names[j] = 'Contratado', v_ats_stage_names[j] = 'Rechazado'
      )
      returning id into v_stage_id;
      v_stage_ids_ventas := array_append(v_stage_ids_ventas, v_stage_id);
    end loop;

    insert into public.vacancies (workspace_id, title, department, location, pipeline_id)
    values (v_workspace_id, 'Setter de Ventas', 'Ventas', 'CABA, Argentina', v_pipeline_ventas)
    returning id into v_vacancy_ventas;
  else
    select array_agg(id order by position) into v_stage_ids_ventas
    from public.pipeline_stages
    where pipeline_id = (select pipeline_id from public.vacancies where id = v_vacancy_ventas);
  end if;

  for i in 1..array_length(v_candidate_names, 1) loop
    insert into public.contacts (workspace_id, name, phone, email, source)
    values (
      v_workspace_id,
      v_candidate_names[i],
      '+549' || (200000000 + i * 6421)::text,
      lower(replace(v_candidate_names[i], ' ', '.')) || '@example.com',
      v_candidate_sources[i]
    )
    on conflict (workspace_id, phone) do update set name = excluded.name
    returning id into v_candidate_contact_id;

    insert into public.candidates (workspace_id, contact_id, source)
    values (v_workspace_id, v_candidate_contact_id, v_candidate_sources[i])
    on conflict (contact_id) do update set source = excluded.source
    returning id into v_candidate_id;

    v_application_id := null;
    if i <= 4 then
      insert into public.candidate_applications (workspace_id, vacancy_id, candidate_id)
      values (v_workspace_id, v_vacancy_design, v_candidate_id)
      on conflict (vacancy_id, candidate_id) do nothing
      returning id into v_application_id;
      if v_application_id is not null then
        insert into public.pipeline_items (pipeline_id, stage_id, item_type, item_id, position)
        select (select pipeline_id from public.vacancies where id = v_vacancy_design),
               v_stage_ids_design[((i - 1) % array_length(v_stage_ids_design, 1)) + 1],
               'candidate_application', v_application_id, i
        returning id into v_pipeline_item_id;
        update public.candidate_applications set pipeline_item_id = v_pipeline_item_id where id = v_application_id;
      end if;
    else
      insert into public.candidate_applications (workspace_id, vacancy_id, candidate_id)
      values (v_workspace_id, v_vacancy_ventas, v_candidate_id)
      on conflict (vacancy_id, candidate_id) do nothing
      returning id into v_application_id;
      if v_application_id is not null then
        insert into public.pipeline_items (pipeline_id, stage_id, item_type, item_id, position)
        select (select pipeline_id from public.vacancies where id = v_vacancy_ventas),
               v_stage_ids_ventas[((i - 5) % array_length(v_stage_ids_ventas, 1)) + 1],
               'candidate_application', v_application_id, i
        returning id into v_pipeline_item_id;
        update public.candidate_applications set pipeline_item_id = v_pipeline_item_id where id = v_application_id;
      end if;
    end if;
  end loop;

  raise notice 'Seed complete for workspace %', v_workspace_id;
end $$;
