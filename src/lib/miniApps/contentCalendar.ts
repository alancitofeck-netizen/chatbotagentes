"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireMiniAppEditAccess } from "@/lib/miniApps/access";

/**
 * Contenido de la plantilla "content_calendar" — a diferencia de las otras
 * 13 plantillas (todo su contenido vive en `mini_apps.config` jsonb), esta
 * vive en tablas relacionales (0181_mini_app_content_calendar.sql), elegido
 * explícitamente por el usuario para poder editar/reportar por pieza
 * individual. Un solo query por sección arma la misma forma
 * semanas→días→piezas que ya tenía el HTML original (feedData/historiasData),
 * para que el componente de UI sea un calco fiel del HTML adjunto.
 */

export type PieceStatus = "pendiente" | "produccion" | "listo" | "publicado";

export interface ContentCalendarPiece {
  id: string;
  tipo: "HERO" | "Support";
  formato: string;
  funcion: string;
  hora: string | null;
  idea: string;
  status: PieceStatus;
}

export interface ContentCalendarStory {
  id: string;
  tipo: string;
  text: string;
}

export interface ContentCalendarDay {
  id: string;
  dateLabel: string;
  dayOrder: number;
  pieces: ContentCalendarPiece[];
  stories: ContentCalendarStory[];
}

export interface ContentCalendarWeek {
  label: string;
  order: number;
  days: ContentCalendarDay[];
}

export interface ContentCalendarReference {
  id: string;
  creador: string | null;
  url: string | null;
  producto: string | null;
  tema: string | null;
  angulo: string | null;
  formato: string | null;
  vistas: string | null;
  comentarios: string | null;
  hook: string | null;
}

export interface ContentCalendarData {
  feedWeeks: ContentCalendarWeek[];
  historiaWeeks: ContentCalendarWeek[];
  references: ContentCalendarReference[];
}

function groupIntoWeeks(
  days: { id: string; week_label: string; week_order: number; date_label: string; day_order: number }[],
  piecesByDay: Map<string, ContentCalendarPiece[]>,
  storiesByDay: Map<string, ContentCalendarStory[]>,
): ContentCalendarWeek[] {
  const weeks = new Map<number, ContentCalendarWeek>();
  for (const d of days) {
    if (!weeks.has(d.week_order)) weeks.set(d.week_order, { label: d.week_label, order: d.week_order, days: [] });
    weeks.get(d.week_order)!.days.push({
      id: d.id,
      dateLabel: d.date_label,
      dayOrder: d.day_order,
      pieces: piecesByDay.get(d.id) ?? [],
      stories: storiesByDay.get(d.id) ?? [],
    });
  }
  return [...weeks.values()]
    .sort((a, b) => a.order - b.order)
    .map((w) => ({ ...w, days: w.days.sort((a, b) => a.dayOrder - b.dayOrder) }));
}

async function fetchContentCalendarData(supabase: SupabaseClient, miniAppId: string): Promise<ContentCalendarData> {
  const [{ data: days }, { data: pieces }, { data: stories }, { data: refs }] = await Promise.all([
    supabase
      .from("mini_app_content_days")
      .select("id, section, week_label, week_order, date_label, day_order")
      .eq("mini_app_id", miniAppId),
    supabase
      .from("mini_app_content_pieces")
      .select("id, day_id, piece_order, tipo, formato, funcion, hora, idea, status, mini_app_content_days!inner(mini_app_id)")
      .eq("mini_app_content_days.mini_app_id", miniAppId)
      .order("piece_order", { ascending: true }),
    supabase
      .from("mini_app_content_stories")
      .select("id, day_id, story_order, tipo, text, mini_app_content_days!inner(mini_app_id)")
      .eq("mini_app_content_days.mini_app_id", miniAppId)
      .order("story_order", { ascending: true }),
    supabase
      .from("mini_app_content_references")
      .select("id, creador, url, producto, tema, angulo, formato, vistas, comentarios, hook")
      .eq("mini_app_id", miniAppId)
      .order("ref_order", { ascending: true }),
  ]);

  const piecesByDay = new Map<string, ContentCalendarPiece[]>();
  for (const p of pieces ?? []) {
    const list = piecesByDay.get(p.day_id as string) ?? [];
    list.push({
      id: p.id as string,
      tipo: p.tipo as "HERO" | "Support",
      formato: p.formato as string,
      funcion: p.funcion as string,
      hora: p.hora as string | null,
      idea: p.idea as string,
      status: p.status as PieceStatus,
    });
    piecesByDay.set(p.day_id as string, list);
  }

  const storiesByDay = new Map<string, ContentCalendarStory[]>();
  for (const s of stories ?? []) {
    const list = storiesByDay.get(s.day_id as string) ?? [];
    list.push({ id: s.id as string, tipo: s.tipo as string, text: s.text as string });
    storiesByDay.set(s.day_id as string, list);
  }

  const feedDays = (days ?? []).filter((d) => d.section === "feed");
  const historiaDays = (days ?? []).filter((d) => d.section === "historias");

  return {
    feedWeeks: groupIntoWeeks(feedDays, piecesByDay, storiesByDay),
    historiaWeeks: groupIntoWeeks(historiaDays, piecesByDay, storiesByDay),
    references: (refs ?? []).map((r) => ({
      id: r.id as string,
      creador: r.creador as string | null,
      url: r.url as string | null,
      producto: r.producto as string | null,
      tema: r.tema as string | null,
      angulo: r.angulo as string | null,
      formato: r.formato as string | null,
      vistas: r.vistas as string | null,
      comentarios: r.comentarios as string | null,
      hook: r.hook as string | null,
    })),
  };
}

/** Panel interno (protegido) — cliente de sesión, la RLS de
 * mini_app_content_* ya filtra según is_private/mini_app_access. */
export async function getContentCalendarData(miniAppId: string): Promise<ContentCalendarData> {
  const supabase = await createClient();
  return fetchContentCalendarData(supabase, miniAppId);
}

export async function getContentCalendarDataAction(miniAppId: string): Promise<ContentCalendarData> {
  await requireActiveWorkspace();
  return getContentCalendarData(miniAppId);
}

/** Versión pública (/apps/[slug]) — mismo criterio que getPublicMiniAppBySlug:
 * service-role, sin sesión de visitante anónimo. La ruta pública nunca
 * respeta is_private/mini_app_access (mismo criterio que las 13 plantillas
 * existentes: la página pública es intencionalmente sin auth) — solo
 * lectura, nunca expone acciones de edición. */
export async function getPublicContentCalendarData(miniAppId: string): Promise<ContentCalendarData> {
  const supabase = createServiceRoleClient();
  return fetchContentCalendarData(supabase, miniAppId);
}

async function resolveMiniAppIdForPiece(supabase: Awaited<ReturnType<typeof createClient>>, pieceId: string): Promise<string | null> {
  const { data } = await supabase
    .from("mini_app_content_pieces")
    .select("mini_app_content_days(mini_app_id)")
    .eq("id", pieceId)
    .maybeSingle();
  const day = data?.mini_app_content_days as { mini_app_id: string } | { mini_app_id: string }[] | null;
  if (!day) return null;
  return Array.isArray(day) ? (day[0]?.mini_app_id ?? null) : day.mini_app_id;
}

async function resolveMiniAppIdForStory(supabase: Awaited<ReturnType<typeof createClient>>, storyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("mini_app_content_stories")
    .select("mini_app_content_days(mini_app_id)")
    .eq("id", storyId)
    .maybeSingle();
  const day = data?.mini_app_content_days as { mini_app_id: string } | { mini_app_id: string }[] | null;
  if (!day) return null;
  return Array.isArray(day) ? (day[0]?.mini_app_id ?? null) : day.mini_app_id;
}

export async function updateContentPieceAction(pieceId: string, patch: { idea?: string; status?: PieceStatus }): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  const supabase = await createClient();

  const miniAppId = await resolveMiniAppIdForPiece(supabase, pieceId);
  if (!miniAppId) throw new Error("Pieza no encontrada.");
  await requireMiniAppEditAccess(workspaceId, miniAppId, role);

  const { error } = await supabase
    .from("mini_app_content_pieces")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", pieceId);
  if (error) throw new Error("No se pudo guardar el cambio.");
  revalidatePath(`/mini-apps/${miniAppId}`);
}

export async function updateContentStoryAction(storyId: string, patch: { text: string }): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  const supabase = await createClient();

  const miniAppId = await resolveMiniAppIdForStory(supabase, storyId);
  if (!miniAppId) throw new Error("Historia no encontrada.");
  await requireMiniAppEditAccess(workspaceId, miniAppId, role);

  const { error } = await supabase
    .from("mini_app_content_stories")
    .update({ text: patch.text, updated_at: new Date().toISOString() })
    .eq("id", storyId);
  if (error) throw new Error("No se pudo guardar el cambio.");
  revalidatePath(`/mini-apps/${miniAppId}`);
}
