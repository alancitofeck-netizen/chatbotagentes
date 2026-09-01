-- Contenido de la plantilla "content_calendar" (Cronograma de Contenido) en
-- tablas relacionales — decisión explícita del usuario sobre la alternativa
-- más simple de un solo JSON en `mini_apps.config` (que es como viven las
-- otras 13 plantillas), para poder editar/reportar por pieza individual.
--
-- Un día (mini_app_content_days) agrupa 0-2 piezas de Feed & Reels o varios
-- bullets de Historias, según `section`. Las referencias (swipe file de
-- competencia) no tienen ningún campo editable en el HTML original (sin
-- contenteditable) — se guardan igual en su propia tabla para no quedar
-- hardcodeadas en JS, pero sin necesidad de RLS de escritura para viewers.

create table public.mini_app_content_days (
  id uuid primary key default gen_random_uuid(),
  mini_app_id uuid not null references public.mini_apps (id) on delete cascade,
  section text not null check (section in ('feed', 'historias')),
  week_label text not null,
  week_order int not null,
  date_label text not null,
  day_order int not null,
  created_at timestamptz not null default now(),
  unique (mini_app_id, section, week_order, day_order)
);
create index mini_app_content_days_mini_app_idx on public.mini_app_content_days (mini_app_id);

create table public.mini_app_content_pieces (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.mini_app_content_days (id) on delete cascade,
  piece_order int not null,
  tipo text not null check (tipo in ('HERO', 'Support')),
  formato text not null,
  funcion text not null,
  hora text,
  idea text not null default '',
  status text not null default 'pendiente' check (status in ('pendiente', 'produccion', 'listo', 'publicado')),
  updated_at timestamptz not null default now(),
  unique (day_id, piece_order)
);
create index mini_app_content_pieces_day_idx on public.mini_app_content_pieces (day_id);

create table public.mini_app_content_stories (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.mini_app_content_days (id) on delete cascade,
  story_order int not null,
  tipo text not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  unique (day_id, story_order)
);
create index mini_app_content_stories_day_idx on public.mini_app_content_stories (day_id);

create table public.mini_app_content_references (
  id uuid primary key default gen_random_uuid(),
  mini_app_id uuid not null references public.mini_apps (id) on delete cascade,
  ref_order int not null,
  creador text,
  url text,
  producto text,
  tema text,
  angulo text,
  formato text,
  vistas text,
  comentarios text,
  hook text,
  created_at timestamptz not null default now(),
  unique (mini_app_id, ref_order)
);
create index mini_app_content_references_mini_app_idx on public.mini_app_content_references (mini_app_id);

alter table public.mini_app_content_days enable row level security;
alter table public.mini_app_content_pieces enable row level security;
alter table public.mini_app_content_stories enable row level security;
alter table public.mini_app_content_references enable row level security;

-- Mismo criterio condicional que mini_apps_select: la visibilidad de estas
-- 4 tablas sigue exactamente la de su Mini App padre (respeta is_private +
-- mini_app_access) — nunca abierta a todo el workspace de forma independiente,
-- ya que cuelgan de una mini app que puede ser privada.
create policy "mini_app_content_days_select" on public.mini_app_content_days
  for select using (
    exists (
      select 1 from public.mini_apps a
      where a.id = mini_app_id
        and core.is_workspace_member(a.workspace_id)
        and (
          not a.is_private
          or core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
          or exists (
            select 1 from public.mini_app_access ma
            join public.workspace_members m on m.id = ma.member_id
            where ma.mini_app_id = a.id and m.user_id = auth.uid()
          )
        )
    )
  );
create policy "mini_app_content_days_write" on public.mini_app_content_days
  for all
  using (
    exists (
      select 1 from public.mini_apps a
      where a.id = mini_app_id
        and (
          core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
          or exists (
            select 1 from public.mini_app_access ma
            join public.workspace_members m on m.id = ma.member_id
            where ma.mini_app_id = a.id and m.user_id = auth.uid() and ma.role = 'editor'
          )
        )
    )
  );

create policy "mini_app_content_pieces_select" on public.mini_app_content_pieces
  for select using (
    exists (
      select 1 from public.mini_app_content_days d
      join public.mini_apps a on a.id = d.mini_app_id
      where d.id = day_id
        and core.is_workspace_member(a.workspace_id)
        and (
          not a.is_private
          or core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
          or exists (
            select 1 from public.mini_app_access ma
            join public.workspace_members m on m.id = ma.member_id
            where ma.mini_app_id = a.id and m.user_id = auth.uid()
          )
        )
    )
  );
create policy "mini_app_content_pieces_write" on public.mini_app_content_pieces
  for all
  using (
    exists (
      select 1 from public.mini_app_content_days d
      join public.mini_apps a on a.id = d.mini_app_id
      where d.id = day_id
        and (
          core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
          or exists (
            select 1 from public.mini_app_access ma
            join public.workspace_members m on m.id = ma.member_id
            where ma.mini_app_id = a.id and m.user_id = auth.uid() and ma.role = 'editor'
          )
        )
    )
  );

create policy "mini_app_content_stories_select" on public.mini_app_content_stories
  for select using (
    exists (
      select 1 from public.mini_app_content_days d
      join public.mini_apps a on a.id = d.mini_app_id
      where d.id = day_id
        and core.is_workspace_member(a.workspace_id)
        and (
          not a.is_private
          or core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
          or exists (
            select 1 from public.mini_app_access ma
            join public.workspace_members m on m.id = ma.member_id
            where ma.mini_app_id = a.id and m.user_id = auth.uid()
          )
        )
    )
  );
create policy "mini_app_content_stories_write" on public.mini_app_content_stories
  for all
  using (
    exists (
      select 1 from public.mini_app_content_days d
      join public.mini_apps a on a.id = d.mini_app_id
      where d.id = day_id
        and (
          core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
          or exists (
            select 1 from public.mini_app_access ma
            join public.workspace_members m on m.id = ma.member_id
            where ma.mini_app_id = a.id and m.user_id = auth.uid() and ma.role = 'editor'
          )
        )
    )
  );

create policy "mini_app_content_references_select" on public.mini_app_content_references
  for select using (
    exists (
      select 1 from public.mini_apps a
      where a.id = mini_app_id
        and core.is_workspace_member(a.workspace_id)
        and (
          not a.is_private
          or core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
          or exists (
            select 1 from public.mini_app_access ma
            join public.workspace_members m on m.id = ma.member_id
            where ma.mini_app_id = a.id and m.user_id = auth.uid()
          )
        )
    )
  );
create policy "mini_app_content_references_write" on public.mini_app_content_references
  for all
  using (
    exists (
      select 1 from public.mini_apps a
      where a.id = mini_app_id
        and (
          core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
          or exists (
            select 1 from public.mini_app_access ma
            join public.workspace_members m on m.id = ma.member_id
            where ma.mini_app_id = a.id and m.user_id = auth.uid() and ma.role = 'editor'
          )
        )
    )
  );
