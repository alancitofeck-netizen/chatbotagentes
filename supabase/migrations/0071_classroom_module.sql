-- Classroom: Skool-inspired e-learning module. Unlike every other module in
-- this app, its content is a GLOBAL catalog — one shared curriculum teaching
-- Growth Link itself (CRM/LinkedIn/IA/WhatsApp/Ventas/Onboarding/Recursos/
-- Novedades), the same for every workspace — confirmed explicitly with the
-- user rather than assumed. None of these catalog tables carry a
-- workspace_id, so the usual core.has_workspace_role(ws_id, roles) pattern
-- doesn't apply to writes; core.is_owner_or_admin() below checks the role
-- across ALL of a user's workspace_members rows instead of one specific
-- workspace. Known simplification, accepted explicitly by the user: any
-- workspace's owner/admin can edit the one shared catalog — there is no
-- per-workspace content isolation for Classroom.
--
-- Progress/comments/likes ARE user-scoped (auth.uid()), not workspace-scoped,
-- since the same catalog serves every workspace a user belongs to.
--
-- Not gated by workspace_modules — Classroom behaves like Inbox/Calendar/
-- Documents/KPIs (always visible), not like Tasks/Mini Apps (per-workspace
-- enable/disable). No changes needed to provisionDefaultWorkspaceIfNeeded.

create or replace function core.is_owner_or_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.workspace_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  )
$function$;

-- ---------------------------------------------------------------------------
-- Catalog tables (global — no workspace_id)
-- ---------------------------------------------------------------------------

create table public.classroom_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text not null default '📚',
  color text not null default 'accent' check (color in ('neutral', 'accent', 'success', 'warning', 'error', 'info')),
  cover_image_url text,
  position integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classroom_categories_position_idx on public.classroom_categories (position);

create table public.classroom_courses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.classroom_categories (id) on delete restrict,
  title text not null,
  slug text not null unique,
  description text,
  objectives text[] not null default '{}',
  cover_image_url text,
  color text not null default 'accent' check (color in ('neutral', 'accent', 'success', 'warning', 'error', 'info')),
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- Manual curated flag — the v1 stand-in for the deferred CRM-behavior
  -- recommendation engine ("Recomendados para vos" reads this for now).
  is_featured boolean not null default false,
  position integer not null default 0,
  -- References auth.users directly, not workspace_members — a global course
  -- has one author identity, but the same person has one workspace_members
  -- row per workspace, so workspace_members.id would be ambiguous here.
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classroom_courses_category_idx on public.classroom_courses (category_id, position);
create index classroom_courses_status_idx on public.classroom_courses (status);
create index classroom_courses_featured_idx on public.classroom_courses (is_featured) where is_featured;

create table public.classroom_chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.classroom_courses (id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classroom_chapters_course_idx on public.classroom_chapters (course_id, position);

create table public.classroom_lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.classroom_chapters (id) on delete cascade,
  -- Denormalized from chapter_id — same reasoning as mini_app_leads.origen_app
  -- (0061_mini_apps_module.sql): avoids a double join (lesson->chapter->course)
  -- in every RLS check and in any query needing "all lessons in this course".
  course_id uuid not null references public.classroom_courses (id) on delete cascade,
  title text not null,
  description text,
  -- Raw pasted URL only — the provider (YouTube/Vimeo/Bunny/Cloudflare/Mux/
  -- direct file) is detected at render time by detectProvider()
  -- (src/lib/classroom/video.ts), never persisted as a derived column.
  video_url text,
  duration_seconds integer,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classroom_lessons_chapter_idx on public.classroom_lessons (chapter_id, position);
create index classroom_lessons_course_idx on public.classroom_lessons (course_id);

create table public.classroom_lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.classroom_lessons (id) on delete cascade,
  label text not null,
  file_url text not null,
  file_type text,
  file_size_bytes bigint,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index classroom_lesson_resources_lesson_idx on public.classroom_lesson_resources (lesson_id, position);

-- ---------------------------------------------------------------------------
-- Per-user tables (auth.uid()-scoped). No classroom_enrollments table —
-- every authenticated user already has access to everything, so there's no
-- opt-in step to model; a lesson's first watch implicitly creates its
-- progress row. Course/category completion % is never stored, always
-- derived live from these rows, same "no second source of truth" principle
-- as getGroupStats (src/lib/tasks/groups/queries.ts).
-- ---------------------------------------------------------------------------

create table public.classroom_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.classroom_lessons (id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz,
  -- Only ever meaningfully populated for direct-MP4 lessons — no reliable
  -- cross-origin timeupdate exists for a plain iframe without each
  -- provider's own JS SDK, which the video-embed design deliberately avoids.
  resume_position_seconds integer not null default 0,
  last_watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index classroom_lesson_progress_user_idx on public.classroom_lesson_progress (user_id, last_watched_at desc);
create index classroom_lesson_progress_lesson_idx on public.classroom_lesson_progress (lesson_id);

create table public.classroom_comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.classroom_lessons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classroom_comments_lesson_idx on public.classroom_comments (lesson_id, is_pinned desc, created_at desc);

create table public.classroom_comment_likes (
  comment_id uuid not null references public.classroom_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.classroom_categories enable row level security;
alter table public.classroom_courses enable row level security;
alter table public.classroom_chapters enable row level security;
alter table public.classroom_lessons enable row level security;
alter table public.classroom_lesson_resources enable row level security;
alter table public.classroom_lesson_progress enable row level security;
alter table public.classroom_comments enable row level security;
alter table public.classroom_comment_likes enable row level security;

create policy "classroom_categories_select" on public.classroom_categories
  for select to authenticated using (true);
create policy "classroom_categories_write" on public.classroom_categories
  for all using (core.is_owner_or_admin()) with check (core.is_owner_or_admin());

create policy "classroom_courses_select" on public.classroom_courses
  for select to authenticated using (status = 'published' or core.is_owner_or_admin());
create policy "classroom_courses_write" on public.classroom_courses
  for all using (core.is_owner_or_admin()) with check (core.is_owner_or_admin());

create policy "classroom_chapters_select" on public.classroom_chapters
  for select to authenticated using (
    exists (
      select 1 from public.classroom_courses c
      where c.id = course_id and (c.status = 'published' or core.is_owner_or_admin())
    )
  );
create policy "classroom_chapters_write" on public.classroom_chapters
  for all using (core.is_owner_or_admin()) with check (core.is_owner_or_admin());

create policy "classroom_lessons_select" on public.classroom_lessons
  for select to authenticated using (
    exists (
      select 1 from public.classroom_courses c
      where c.id = course_id and (c.status = 'published' or core.is_owner_or_admin())
    )
  );
create policy "classroom_lessons_write" on public.classroom_lessons
  for all using (core.is_owner_or_admin()) with check (core.is_owner_or_admin());

create policy "classroom_lesson_resources_select" on public.classroom_lesson_resources
  for select to authenticated using (
    exists (
      select 1 from public.classroom_lessons l
      join public.classroom_courses c on c.id = l.course_id
      where l.id = lesson_id and (c.status = 'published' or core.is_owner_or_admin())
    )
  );
create policy "classroom_lesson_resources_write" on public.classroom_lesson_resources
  for all using (core.is_owner_or_admin()) with check (core.is_owner_or_admin());

-- Progress: strictly self-scoped. No admin visibility in v1 — the owner/
-- admin analytics dashboard is a deferred phase; it will need either a
-- broader SELECT policy or a SECURITY DEFINER aggregate RPC, neither of
-- which exists yet.
create policy "classroom_lesson_progress_all_own" on public.classroom_lesson_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Comments: any authenticated user can read (if the lesson is visible to
-- them), create their own, edit their own; owner/admin can moderate
-- (delete/pin any comment) — enforced here AND re-checked in the Server
-- Action layer for pin/delete-of-others, same defense-in-depth posture as
-- Mini Apps' regenerate-key gate.
create policy "classroom_comments_select" on public.classroom_comments
  for select to authenticated using (
    exists (
      select 1 from public.classroom_lessons l
      join public.classroom_courses c on c.id = l.course_id
      where l.id = lesson_id and (c.status = 'published' or core.is_owner_or_admin())
    )
  );
create policy "classroom_comments_insert" on public.classroom_comments
  for insert to authenticated with check (user_id = auth.uid());
create policy "classroom_comments_update_own" on public.classroom_comments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "classroom_comments_moderate" on public.classroom_comments
  for all using (core.is_owner_or_admin()) with check (core.is_owner_or_admin());

create policy "classroom_comment_likes_select" on public.classroom_comment_likes
  for select to authenticated using (true);
create policy "classroom_comment_likes_own" on public.classroom_comment_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage — two public buckets. Policies below are written correctly but are
-- currently DECORATIVE, not load-bearing: this project's Storage service
-- doesn't verify its own current JWT signing key and silently authenticates
-- every direct-from-browser request as Postgres role `anon`, so any RLS
-- check depending on auth.uid() (directly or via core.is_owner_or_admin())
-- always rejects real users at the Storage layer (fully diagnosed in
-- 0070_task_group_covers_final.sql). Real enforcement for uploads happens in
-- the Route Handlers (src/app/api/classroom/{covers,resources}/route.ts),
-- which check the caller's role in application code and write via the
-- service-role client, bypassing Storage's RLS entirely.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('classroom-covers', 'classroom-covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('classroom-resources', 'classroom-resources', true)
on conflict (id) do nothing;

create policy "classroom_covers_storage_select" on storage.objects
  for select using (bucket_id = 'classroom-covers');
create policy "classroom_covers_storage_write" on storage.objects
  for all
  using (bucket_id = 'classroom-covers' and core.is_owner_or_admin())
  with check (bucket_id = 'classroom-covers' and core.is_owner_or_admin());

create policy "classroom_resources_storage_select" on storage.objects
  for select using (bucket_id = 'classroom-resources');
create policy "classroom_resources_storage_write" on storage.objects
  for all
  using (bucket_id = 'classroom-resources' and core.is_owner_or_admin())
  with check (bucket_id = 'classroom-resources' and core.is_owner_or_admin());
