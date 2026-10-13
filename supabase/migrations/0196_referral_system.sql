-- Asesorías → "Sistema de Referidos": el HTML de cierre con referidos que pasó el usuario
-- (src/lib/asesorias/referralSystemTemplate.ts), privado para un grupo de cuentas que lo
-- comparten todo (pedido explícito: "privada, alojada en 2 cuentas, la de Sujey y la de
-- adripuc, que los dos vean lo mismo, mismos leads, todo").
--
-- Justificación contra 02-database.md: se reutiliza el modelo de Asesorías tal cual (una
-- fila de `asesorias` por sesión con un prospecto, `state` = meetingProject, referidos en
-- `asesoria_referrals`) en vez de crear tablas paralelas. Lo nuevo es mínimo:
--
--  1. asesorias.kind: distingue el Meeting OS de siempre ('meeting_os') del Sistema de
--     Referidos ('referidos'). /frame sirve un HTML u otro según esto, y los listados de
--     Presentación siguen mostrando solo 'meeting_os'.
--  2. asesorias.mirror_of: la copia de una sesión en la otra cuenta del grupo, mismo patrón
--     que mini_apps.mirror_of (0194). Cada cuenta tiene su propia fila (y sus propios
--     referidos/contactos, RLS por workspace intacta); /sync actualiza todas las filas del
--     grupo a la vez. Borrar la original borra las copias.
--  3. referral_system_partners: qué cuentas tienen el Sistema de Referidos (privado) y con
--     quién lo comparten (mismo group_id). Sin fila = la cuenta no lo ve.
--  4. referral_system_templates: la plantilla editada ("Guardar" en el editor del HTML),
--     una sola por grupo, con la que arrancan las sesiones nuevas de todas sus cuentas.
--
-- Las filas de partners se cargan aparte (datos, no esquema). La escritura cruzada entre
-- cuentas la hace el servidor con service-role, después de verificar que quien llama es
-- miembro de una de las cuentas del grupo; por eso 3 y 4 no tienen políticas de escritura.

alter table public.asesorias
  add column kind text not null default 'meeting_os' check (kind in ('meeting_os', 'referidos'));

alter table public.asesorias
  add column mirror_of uuid references public.asesorias (id) on delete cascade;
alter table public.asesorias
  add constraint asesorias_mirror_not_self check (mirror_of is null or mirror_of <> id);
create index asesorias_mirror_of_idx on public.asesorias (mirror_of) where mirror_of is not null;

create table public.referral_system_partners (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  group_id uuid not null,
  created_at timestamptz not null default now()
);
create index referral_system_partners_group_idx on public.referral_system_partners (group_id);

alter table public.referral_system_partners enable row level security;
-- Cada cuenta puede saber si tiene el Sistema de Referidos (para mostrar la tarjeta).
create policy referral_system_partners_select on public.referral_system_partners
  for select using (core.is_workspace_member(workspace_id));

create table public.referral_system_templates (
  group_id uuid primary key,
  template jsonb not null,
  theme jsonb not null default '{}'::jsonb,
  brand jsonb not null default '{}'::jsonb,
  updated_by_workspace uuid references public.workspaces (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.referral_system_templates enable row level security;
-- Sin políticas: solo el servidor (service-role) la lee y escribe, después de validar el grupo.
