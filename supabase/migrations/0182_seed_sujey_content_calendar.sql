-- Seed: Mini App "Cronograma de Contenido — Sujey Urías" (content_calendar)
-- Datos exactos del HTML adjunto por el usuario (feedData/historiasData/referencias)
-- — sin inventar ni omitir contenido. is_private=true, sin ninguna fila en
-- mini_app_access todavía (Sujey/Cecilia no son miembros de ningún workspace
-- aún) — visible solo para Owner/Admin hasta que el usuario las invite y
-- use "Gestionar acceso".
--
-- workspace_id: el de "Alan Feck" (047afecb…) — confirmado explícitamente
-- por el usuario como el workspace real del equipo (donde están los demás
-- asesores), después de que la primera aplicación de esta migración la
-- hubiera puesto en el workspace personal de Adriel por error de inferencia.

do $$
declare
  v_workspace_id uuid := '047afecb-b549-422f-bad9-066140d5cf0a';
  v_mini_app_id uuid;
  v_day_id uuid;
  -- md5() en vez de digest()/pgcrypto: esta Mini App nunca va a recibir
  -- leads por su API key (es un panel interno de contenido), así que no
  -- hace falta un hash criptográfico real — md5() es nativo de Postgres,
  -- sin depender de que la extensión pgcrypto esté habilitada.
  v_api_key_hash text := md5(gen_random_uuid()::text);
begin

insert into public.mini_apps (
  workspace_id, name, description, template_key, slug, is_private, status,
  api_key_hash, api_key_last4, branding, config
) values (
  v_workspace_id,
  'Cronograma de Contenido — Sujey Urías',
  'Estrategia y calendario de contenido de Instagram — Septiembre 2026.',
  'content_calendar',
  'cronograma-sujey-urias-septiembre-2026',
  true,
  'active',
  v_api_key_hash,
  right(v_api_key_hash, 4),
  '{"primaryColor":"#1B2A4A","secondaryColor":"#C9A227"}'::jsonb,
  '{}'::jsonb
) returning id into v_mini_app_id;

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Previa (1–6/9)', 0, 'Mar 1/9', 0) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'Carrusel educativo', 'Educación / guardados', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Previa (1–6/9)', 0, 'Mié 2/9', 1) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Sketch / doble personaje', 'Descubrimiento', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Previa (1–6/9)', 0, 'Jue 3/9', 2) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'B-roll + texto', 'Alcance / identificación', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Previa (1–6/9)', 0, 'Vie 4/9', 3) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Reacción o Storytelling', 'Descubrimiento / autoridad', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Previa (1–6/9)', 0, 'Sáb 5/9', 4) returning id into v_day_id;

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Previa (1–6/9)', 0, 'Dom 6/9', 5) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'Carrusel / autoridad', 'Confianza', '12:00', '');
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 1, 'HERO', 'Talking Head / Storytelling', 'Autoridad + conversión', '20:00', '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 1 (7–13/9)', 1, 'Lun 7/9', 0) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Talking Head + números', 'Descubrimiento', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 1 (7–13/9)', 1, 'Mar 8/9', 1) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'Carrusel educativo', 'Educación / guardados', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 1 (7–13/9)', 1, 'Mié 9/9', 2) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Sketch / doble personaje', 'Descubrimiento', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 1 (7–13/9)', 1, 'Jue 10/9', 3) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'B-roll + texto', 'Alcance / identificación', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 1 (7–13/9)', 1, 'Vie 11/9', 4) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Reacción o Storytelling', 'Descubrimiento / autoridad', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 1 (7–13/9)', 1, 'Sáb 12/9', 5) returning id into v_day_id;

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 1 (7–13/9)', 1, 'Dom 13/9', 6) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'Carrusel / autoridad', 'Confianza', '12:00', '');
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 1, 'HERO', 'Talking Head / Storytelling', 'Autoridad + conversión', '20:00', '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 2 (14–20/9)', 2, 'Lun 14/9', 0) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Talking Head + números', 'Descubrimiento', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 2 (14–20/9)', 2, 'Mar 15/9', 1) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'Carrusel educativo', 'Educación / guardados', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 2 (14–20/9)', 2, 'Mié 16/9', 2) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Sketch / doble personaje', 'Descubrimiento', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 2 (14–20/9)', 2, 'Jue 17/9', 3) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'B-roll + texto', 'Alcance / identificación', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 2 (14–20/9)', 2, 'Vie 18/9', 4) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Reacción o Storytelling', 'Descubrimiento / autoridad', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 2 (14–20/9)', 2, 'Sáb 19/9', 5) returning id into v_day_id;

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 2 (14–20/9)', 2, 'Dom 20/9', 6) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'Carrusel / autoridad', 'Confianza', '12:00', '');
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 1, 'HERO', 'Talking Head / Storytelling', 'Autoridad + conversión', '20:00', '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 3 (21–27/9)', 3, 'Lun 21/9', 0) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Talking Head + números', 'Descubrimiento', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 3 (21–27/9)', 3, 'Mar 22/9', 1) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'Carrusel educativo', 'Educación / guardados', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 3 (21–27/9)', 3, 'Mié 23/9', 2) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Sketch / doble personaje', 'Descubrimiento', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 3 (21–27/9)', 3, 'Jue 24/9', 3) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'B-roll + texto', 'Alcance / identificación', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 3 (21–27/9)', 3, 'Vie 25/9', 4) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Reacción o Storytelling', 'Descubrimiento / autoridad', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 3 (21–27/9)', 3, 'Sáb 26/9', 5) returning id into v_day_id;

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Semana 3 (21–27/9)', 3, 'Dom 27/9', 6) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'Carrusel / autoridad', 'Confianza', '12:00', '');
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 1, 'HERO', 'Talking Head / Storytelling', 'Autoridad + conversión', '20:00', '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Cierre (28–30/9)', 4, 'Lun 28/9', 0) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Talking Head + números', 'Descubrimiento', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Cierre (28–30/9)', 4, 'Mar 29/9', 1) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'Support', 'Carrusel educativo', 'Educación / guardados', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'feed', 'Cierre (28–30/9)', 4, 'Mié 30/9', 2) returning id into v_day_id;
insert into public.mini_app_content_pieces (day_id, piece_order, tipo, formato, funcion, hora, idea)
  values (v_day_id, 0, 'HERO', 'Sketch / doble personaje', 'Descubrimiento', null, '');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Previa (1–6/9)', 0, 'Mar 1/9', 0) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — PPR', 'Story 1: “Si hoy pudieras empezar a construir un retiro aparte de tu AFORE…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — PPR', 'Story 2: “¿Te interesaría saber cuánto tendrías que aportar según tu edad?” → Sí, quiero saber / Me da curiosidad');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Previa (1–6/9)', 0, 'Mié 2/9', 1) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Caja de preguntas', 'Story 1: “Hoy respondo dudas sobre retiro, PPR y beneficios fiscales.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Caja de preguntas', 'Story 2: Caja → “¿Qué te gustaría preguntarme?”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Caja de preguntas', 'Story 3-5: Sujey responde 2-3 preguntas en video.');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Previa (1–6/9)', 0, 'Jue 3/9', 2) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Awareness / Win', 'Story 1: “Después de 16 años asesorando personas, hay una frase que escucho muchísimo…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Awareness / Win', 'Story 2: « Todavía falta mucho para mi retiro ».');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Awareness / Win', 'Story 3: “El problema es que empezar 5 o 10 años después cambia muchísimo el esfuerzo que necesitás hacer.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 3, 'Awareness / Win', 'Story 4: Explicación breve de Sujey frente a cámara.');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Previa (1–6/9)', 0, 'Vie 4/9', 3) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — SAT', 'Story 1: “¿Pagás impuestos todos los meses?” → Sí / No estoy seguro');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — SAT', 'Story 2: “Ahora otra…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Hand Raiser — SAT', 'Story 3: “¿Sabías que existen estrategias de retiro que pueden tener beneficios fiscales?” → Sí / Quiero entenderlo');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Previa (1–6/9)', 0, 'Sáb 5/9', 4) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Awareness / Win', 'Story 1: foto/video trabajando → “Algo que veo constantemente asesorando familias…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Awareness / Win', 'Story 2: “Pensamos muchísimo en cuánto queremos ganar hoy, pero casi nunca en cuánto queremos cobrar cuando dejemos de trabajar.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Awareness / Win', 'Story 3: “Tu retiro no empieza a los 65. Se construye muchos años antes.”');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Previa (1–6/9)', 0, 'Dom 6/9', 5) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — retiro', 'Story 1: “Imaginate llegar a los 60-65 y poder elegir si querés seguir trabajando.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — retiro', 'Story 2: “No porque necesites el ingreso. Porque realmente querés.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Hand Raiser — retiro', 'Story 3: “¿Te gustaría que te explique cómo empezar a construir ese escenario?” → Sí / Quiero aprender');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 1 (7–13/9)', 1, 'Lun 7/9', 0) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Encuesta', 'Story 1: “Pregunta seria: ¿sabés aproximadamente cuánto vas a recibir cuando te retirés?” → Sí / Ni idea');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Encuesta', 'Story 2: “La mayoría empieza a averiguarlo demasiado tarde.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Encuesta', 'Story 3: “Esta semana les voy a mostrar cómo calcularlo de una forma muy sencilla.”');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 1 (7–13/9)', 1, 'Mar 8/9', 1) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — PPR', 'Story 1: “Si hoy pudieras empezar a construir un retiro aparte de tu AFORE…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — PPR', 'Story 2: “¿Te interesaría saber cuánto tendrías que aportar según tu edad?” → Sí, quiero saber / Me da curiosidad');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 1 (7–13/9)', 1, 'Mié 9/9', 2) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Caja de preguntas', 'Story 1: “Hoy respondo dudas sobre retiro, PPR y beneficios fiscales.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Caja de preguntas', 'Story 2: Caja → “¿Qué te gustaría preguntarme?”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Caja de preguntas', 'Story 3-5: Sujey responde 2-3 preguntas en video.');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 1 (7–13/9)', 1, 'Jue 10/9', 3) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Awareness / Win', 'Story 1: “Después de 16 años asesorando personas, hay una frase que escucho muchísimo…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Awareness / Win', 'Story 2: « Todavía falta mucho para mi retiro ».');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Awareness / Win', 'Story 3: “El problema es que empezar 5 o 10 años después cambia muchísimo el esfuerzo que necesitás hacer.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 3, 'Awareness / Win', 'Story 4: Explicación breve de Sujey frente a cámara.');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 1 (7–13/9)', 1, 'Vie 11/9', 4) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — SAT', 'Story 1: “¿Pagás impuestos todos los meses?” → Sí / No estoy seguro');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — SAT', 'Story 2: “Ahora otra…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Hand Raiser — SAT', 'Story 3: “¿Sabías que existen estrategias de retiro que pueden tener beneficios fiscales?” → Sí / Quiero entenderlo');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 1 (7–13/9)', 1, 'Sáb 12/9', 5) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Awareness / Win', 'Story 1: foto/video trabajando → “Algo que veo constantemente asesorando familias…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Awareness / Win', 'Story 2: “Pensamos muchísimo en cuánto queremos ganar hoy, pero casi nunca en cuánto queremos cobrar cuando dejemos de trabajar.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Awareness / Win', 'Story 3: “Tu retiro no empieza a los 65. Se construye muchos años antes.”');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 1 (7–13/9)', 1, 'Dom 13/9', 6) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — retiro', 'Story 1: “Imaginate llegar a los 60-65 y poder elegir si querés seguir trabajando.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — retiro', 'Story 2: “No porque necesites el ingreso. Porque realmente querés.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Hand Raiser — retiro', 'Story 3: “¿Te gustaría que te explique cómo empezar a construir ese escenario?” → Sí / Quiero aprender');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 2 (14–20/9)', 2, 'Lun 14/9', 0) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Encuesta', 'Story 1: “Pregunta seria: ¿sabés aproximadamente cuánto vas a recibir cuando te retirés?” → Sí / Ni idea');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Encuesta', 'Story 2: “La mayoría empieza a averiguarlo demasiado tarde.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Encuesta', 'Story 3: “Esta semana les voy a mostrar cómo calcularlo de una forma muy sencilla.”');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 2 (14–20/9)', 2, 'Mar 15/9', 1) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — PPR', 'Story 1: “Si hoy pudieras empezar a construir un retiro aparte de tu AFORE…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — PPR', 'Story 2: “¿Te interesaría saber cuánto tendrías que aportar según tu edad?” → Sí, quiero saber / Me da curiosidad');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 2 (14–20/9)', 2, 'Mié 16/9', 2) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Caja de preguntas', 'Story 1: “Hoy respondo dudas sobre retiro, PPR y beneficios fiscales.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Caja de preguntas', 'Story 2: Caja → “¿Qué te gustaría preguntarme?”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Caja de preguntas', 'Story 3-5: Sujey responde 2-3 preguntas en video.');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 2 (14–20/9)', 2, 'Jue 17/9', 3) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Awareness / Win', 'Story 1: “Después de 16 años asesorando personas, hay una frase que escucho muchísimo…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Awareness / Win', 'Story 2: « Todavía falta mucho para mi retiro ».');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Awareness / Win', 'Story 3: “El problema es que empezar 5 o 10 años después cambia muchísimo el esfuerzo que necesitás hacer.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 3, 'Awareness / Win', 'Story 4: Explicación breve de Sujey frente a cámara.');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 2 (14–20/9)', 2, 'Vie 18/9', 4) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — SAT', 'Story 1: “¿Pagás impuestos todos los meses?” → Sí / No estoy seguro');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — SAT', 'Story 2: “Ahora otra…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Hand Raiser — SAT', 'Story 3: “¿Sabías que existen estrategias de retiro que pueden tener beneficios fiscales?” → Sí / Quiero entenderlo');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 2 (14–20/9)', 2, 'Sáb 19/9', 5) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Awareness / Win', 'Story 1: foto/video trabajando → “Algo que veo constantemente asesorando familias…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Awareness / Win', 'Story 2: “Pensamos muchísimo en cuánto queremos ganar hoy, pero casi nunca en cuánto queremos cobrar cuando dejemos de trabajar.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Awareness / Win', 'Story 3: “Tu retiro no empieza a los 65. Se construye muchos años antes.”');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 2 (14–20/9)', 2, 'Dom 20/9', 6) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — retiro', 'Story 1: “Imaginate llegar a los 60-65 y poder elegir si querés seguir trabajando.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — retiro', 'Story 2: “No porque necesites el ingreso. Porque realmente querés.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Hand Raiser — retiro', 'Story 3: “¿Te gustaría que te explique cómo empezar a construir ese escenario?” → Sí / Quiero aprender');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 3 (21–27/9)', 3, 'Lun 21/9', 0) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Encuesta', 'Story 1: “Pregunta seria: ¿sabés aproximadamente cuánto vas a recibir cuando te retirés?” → Sí / Ni idea');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Encuesta', 'Story 2: “La mayoría empieza a averiguarlo demasiado tarde.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Encuesta', 'Story 3: “Esta semana les voy a mostrar cómo calcularlo de una forma muy sencilla.”');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 3 (21–27/9)', 3, 'Mar 22/9', 1) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — PPR', 'Story 1: “Si hoy pudieras empezar a construir un retiro aparte de tu AFORE…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — PPR', 'Story 2: “¿Te interesaría saber cuánto tendrías que aportar según tu edad?” → Sí, quiero saber / Me da curiosidad');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 3 (21–27/9)', 3, 'Mié 23/9', 2) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Caja de preguntas', 'Story 1: “Hoy respondo dudas sobre retiro, PPR y beneficios fiscales.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Caja de preguntas', 'Story 2: Caja → “¿Qué te gustaría preguntarme?”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Caja de preguntas', 'Story 3-5: Sujey responde 2-3 preguntas en video.');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 3 (21–27/9)', 3, 'Jue 24/9', 3) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Awareness / Win', 'Story 1: “Después de 16 años asesorando personas, hay una frase que escucho muchísimo…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Awareness / Win', 'Story 2: « Todavía falta mucho para mi retiro ».');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Awareness / Win', 'Story 3: “El problema es que empezar 5 o 10 años después cambia muchísimo el esfuerzo que necesitás hacer.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 3, 'Awareness / Win', 'Story 4: Explicación breve de Sujey frente a cámara.');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 3 (21–27/9)', 3, 'Vie 25/9', 4) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — SAT', 'Story 1: “¿Pagás impuestos todos los meses?” → Sí / No estoy seguro');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — SAT', 'Story 2: “Ahora otra…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Hand Raiser — SAT', 'Story 3: “¿Sabías que existen estrategias de retiro que pueden tener beneficios fiscales?” → Sí / Quiero entenderlo');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 3 (21–27/9)', 3, 'Sáb 26/9', 5) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Awareness / Win', 'Story 1: foto/video trabajando → “Algo que veo constantemente asesorando familias…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Awareness / Win', 'Story 2: “Pensamos muchísimo en cuánto queremos ganar hoy, pero casi nunca en cuánto queremos cobrar cuando dejemos de trabajar.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Awareness / Win', 'Story 3: “Tu retiro no empieza a los 65. Se construye muchos años antes.”');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Semana 3 (21–27/9)', 3, 'Dom 27/9', 6) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — retiro', 'Story 1: “Imaginate llegar a los 60-65 y poder elegir si querés seguir trabajando.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — retiro', 'Story 2: “No porque necesites el ingreso. Porque realmente querés.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Hand Raiser — retiro', 'Story 3: “¿Te gustaría que te explique cómo empezar a construir ese escenario?” → Sí / Quiero aprender');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Cierre (28–30/9)', 4, 'Lun 28/9', 0) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Encuesta', 'Story 1: “Pregunta seria: ¿sabés aproximadamente cuánto vas a recibir cuando te retirés?” → Sí / Ni idea');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Encuesta', 'Story 2: “La mayoría empieza a averiguarlo demasiado tarde.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Encuesta', 'Story 3: “Esta semana les voy a mostrar cómo calcularlo de una forma muy sencilla.”');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Cierre (28–30/9)', 4, 'Mar 29/9', 1) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Hand Raiser — PPR', 'Story 1: “Si hoy pudieras empezar a construir un retiro aparte de tu AFORE…”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Hand Raiser — PPR', 'Story 2: “¿Te interesaría saber cuánto tendrías que aportar según tu edad?” → Sí, quiero saber / Me da curiosidad');

insert into public.mini_app_content_days (mini_app_id, section, week_label, week_order, date_label, day_order)
  values (v_mini_app_id, 'historias', 'Cierre (28–30/9)', 4, 'Mié 30/9', 2) returning id into v_day_id;
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 0, 'Caja de preguntas', 'Story 1: “Hoy respondo dudas sobre retiro, PPR y beneficios fiscales.”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 1, 'Caja de preguntas', 'Story 2: Caja → “¿Qué te gustaría preguntarme?”');
insert into public.mini_app_content_stories (day_id, story_order, tipo, text)
  values (v_day_id, 2, 'Caja de preguntas', 'Story 3-5: Sujey responde 2-3 preguntas en video.');

insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 0, 'emivillarreale', 'https://www.instagram.com/emivillarreale/reel/DRf99l_DZcn/', 'PPR', 'Beneficios fiscales del PPR', 'Ganarle al SAT / recuperar impuestos mientras ahorras para el retiro', 'Talking Head / Diálogo consigo mismo / doble personaje', '5 millones', '13.000', '(El SAT quiere quedarse con parte de tu sueldo) Ya vi que estas ganando 50mil pesos al mes, entonces me voy a quedar con 10mil pesos, todos los meses');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 1, 'emivillarreale', 'https://www.instagram.com/emivillarreale/reel/DS6DapcDXCR/', 'PPR', 'Beneficios fiscales del PPR', 'Recuperar impuestos del SAT mientras construyes tu retiro', 'Sketch / diálogo personificando al SAT', '3 millones', '9.700', '“Ganas $30.000 mensuales, me voy a quedar con $6.300 de tu sueldo…”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 2, 'emivillarreale', 'https://www.instagram.com/emivillarreale/reel/DLgWgBQx3zw/', 'PPR', 'Alternativas para construir el retiro', 'Comparación AFORE vs. plan privado de retiro', 'Sketch / diálogo / comparación de alternativas', '750 mil', '2.800', '“Oye, Afore, con eso de que ya no tenemos pensiones, si quiero ahorrar contigo $3.000 mensuales, ¿cuánto dinero tendría para mi retiro?”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 3, 'emivillarreale', 'https://www.instagram.com/emivillarreale/reel/DX-f9A-tIHa/', 'Ninguno, Marca personal, se puede usar como descubrimiento', 'Bloqueo/inmovilización de cuentas bancarias en México', 'Una decisión del gobierno podría afectar directamente tu dinero…', 'Reacción a un fragmento/noticia', '200 mil', '1.500', 'Reacción a un fragmento/noticia + “Nadie está entendiendo esto que dijo la presidenta, así que pon mucha atención.”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 4, 'rafael  Ojeda', 'https://www.instagram.com/rafael.ojeda96/reel/DTozTeDDUpr/', 'PPR / Plan Personal de Retiro', 'Construcción de una pensión privada', 'Empezar antes te permite invertir menos para alcanzar el mismo retiro…', 'Talking Head / explicación con simulación numérica', '1.7 millones', '500', '¿Realmente puedes crear una pensión privada de $100,000 pesos mensuales en un plan personal de retiro?”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 5, 'rafael  Ojeda', 'https://www.instagram.com/rafael.ojeda96/reel/DTozTeDDUpr/', 'Seguro de vida', 'Herencia / protección patrimonial familiar', '“Crear la herencia que tus padres no pudieron dejarte”', 'B-roll / Lifestyle + texto en pantalla', '1.7 millones', '500', '“Si tus papás no te van a dejar una herencia, cómprales un seguro de vida, ponte de beneficiario y cóbralo cuando ya no estén.”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 6, 'danvalenciaa', 'https://www.instagram.com/danvalenciaa/reel/DIfr7i4AxJp/', 'PPR / Plan Personal de Retiro', 'Invertir para el retiro aprovechando beneficios fiscales', '“Invertir y hacer que el SAT te regrese dinero”', 'Talking Head', '3.6 millones', '1.000', '“Hack para invertir y que el SAT te regrese dinero por hacerlo.”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 7, 'danvalenciaa', 'https://www.instagram.com/danvalenciaa/reel/DO6U6R-DhSP/', 'PPR / Plan Personal de Retiro', 'Reducción de impuestos mediante PPR', 'Si tienes ingresos altos, podrías estar pagando más impuestos de los necesarios…', 'Talking Head', '2.5 millones', '11', '¿Ganas más de $50,000 pesos al mes y sientes que pagas demasiado de impuestos?”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 8, 'danvalenciaa', 'https://www.instagram.com/danvalenciaa/reel/DLShxiIgCyy/', 'PPR / Plan de retiro privado', 'Construcción de una pensión privada de $100.000 MXN mensuales', '“Cómo construir una pensión privada de $100.000 al mes”', 'Talking Head', '500.000', '40', '“Esto es lo que hago para garantizarle a mis clientes un plan de retiro privado de $100 mil pesos al mes de por vida.”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 9, 'elsrpromotor', 'https://www.instagram.com/elsrpromotor/reel/DaojtmygyyJ/', 'Educación financiera / Lead Magnet', 'Organización del dinero según el nivel de ingresos', '“Usa tu salario para calcular cuánto deberías ahorrar, invertir y gastar”', 'Talking Head + lista progresiva + cálculos simples', '8.2 millones', '34.700', '“Toma tu salario y multiplícalo por 150.”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 10, 'elsrpromotor', 'https://www.instagram.com/elsrpromotor/reel/DaO1GaXJuP5/', 'Seguro de Vida', 'Herencia / protección patrimonial familiar', 'Seguro de vida como herencia / evitar heredar deudas', 'B-roll cotidiano + texto en pantalla / Reel sin voz', '6.6 millones', '49.400', '“Si tus papás no te van a dejar herencia, haz lo que yo…”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 11, 'elsrpromotor', 'https://www.instagram.com/elsrpromotor/reel/DZzEscUAerV/', 'Seguro de Vida', 'Protección financiera ante el fallecimiento de los padres', '“Comprar un seguro de vida a tus padres también es una forma de protegerlos y protegerte”', 'Storytelling personal + opinión controversial / Talking Head', '851.300', '7.300', 'Esto que voy a decir se va a malinterpretar y va a incomodar a varios, pero la verdad no me importa. Cómprale un seguro de vida a tus papás y ponte como beneficiario.”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 12, 'aseguraenvita', 'https://www.instagram.com/aseguraenvita/reel/DYBYcVjCatv/', 'PPR / Plan de retiro privado', 'Insuficiencia de la pensión para el retiro', '“Trabajar toda tu vida y descubrir que tu pensión no alcanza para vivir”', 'Sketch / diálogo entre trabajador y sistema de pensiones', '2 millones', '1300', '“Psst, ¿tú? ¿Cuántos años llevas trabajando?”');
insert into public.mini_app_content_references (mini_app_id, ref_order, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook)
  values (v_mini_app_id, 13, 'aseguraenvita', 'https://www.instagram.com/aseguraenvita/reel/DZtRpwVCj1q/', 'Seguro de Gastos Médicos Mayores', 'Beneficios de una póliza aunque no tengas una emergencia médica', '“Tu seguro no es dinero desperdiciado aunque no te enfermes”', 'Sketch / diálogo cliente vs. asesor', '250.000', '628', '¡Felicidades por no accidentarte ni enfermarte!”');

end $$;

