import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { PresentationStep, PresentationStatus, PresentationPhoto, PresentationSlide, PersonalInfo, CommercialInfo } from "@/lib/presentations/constants";

export type { PresentationStep, PresentationStatus };

export interface PresentationListItem {
  id: string;
  title: string;
  clientLabel: string | null;
  ownerName: string | null;
  status: PresentationStatus;
  currentStep: PresentationStep;
  shareSlug: string | null;
  shareViewsCount: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const LIST_SELECT =
  "id, title, client_label, owner_id, status, current_step, share_slug, share_views_count, started_at, updated_at, completed_at";

export async function getPresentationList(workspaceId: string): Promise<PresentationListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("presentations").select(LIST_SELECT).eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
  const rows = data ?? [];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter((id): id is string => Boolean(id)))];
  const { data: memberNames } = ownerIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>((memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]));

  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    clientLabel: r.client_label as string | null,
    ownerName: r.owner_id ? (nameByMember.get(r.owner_id as string) ?? null) : null,
    status: r.status as PresentationStatus,
    currentStep: r.current_step as PresentationStep,
    shareSlug: r.share_slug as string | null,
    shareViewsCount: r.share_views_count as number,
    startedAt: r.started_at as string,
    updatedAt: r.updated_at as string,
    completedAt: r.completed_at as string | null,
  }));
}

export interface PresentationDetail {
  id: string;
  workspaceId: string;
  ownerId: string | null;
  ownerName: string | null;
  title: string;
  clientLabel: string | null;
  status: PresentationStatus;
  currentStep: PresentationStep;
  personalInfo: PersonalInfo;
  photos: PresentationPhoto[];
  commercialInfo: CommercialInfo;
  aiContent: Record<string, unknown> | null;
  slides: PresentationSlide[];
  shareSlug: string | null;
  shareViewsCount: number;
  pdfStoragePath: string | null;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

const DETAIL_SELECT =
  "id, workspace_id, owner_id, title, client_label, status, current_step, personal_info, photos, commercial_info, ai_content, slides, share_slug, share_views_count, pdf_storage_path, started_at, completed_at, updated_at";

export async function getPresentationById(workspaceId: string, presentationId: string): Promise<PresentationDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("presentations").select(DETAIL_SELECT).eq("workspace_id", workspaceId).eq("id", presentationId).maybeSingle();
  if (!data) return null;

  let ownerName: string | null = null;
  if (data.owner_id) {
    const { data: memberNames } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
    ownerName = ((memberNames ?? []) as { member_id: string; full_name: string }[]).find((m) => m.member_id === data.owner_id)?.full_name ?? null;
  }

  return {
    id: data.id as string,
    workspaceId: data.workspace_id as string,
    ownerId: data.owner_id as string | null,
    ownerName,
    title: data.title as string,
    clientLabel: data.client_label as string | null,
    status: data.status as PresentationStatus,
    currentStep: data.current_step as PresentationStep,
    personalInfo: (data.personal_info as PersonalInfo | null) ?? {},
    photos: (data.photos as PresentationPhoto[] | null) ?? [],
    commercialInfo: (data.commercial_info as CommercialInfo | null) ?? {},
    aiContent: (data.ai_content as Record<string, unknown> | null) ?? null,
    slides: (data.slides as PresentationSlide[] | null) ?? [],
    shareSlug: data.share_slug as string | null,
    shareViewsCount: data.share_views_count as number,
    pdfStoragePath: data.pdf_storage_path as string | null,
    startedAt: data.started_at as string,
    completedAt: data.completed_at as string | null,
    updatedAt: data.updated_at as string,
  };
}

export interface PresentationsKpis {
  totalCreated: number;
  lastCreatedTitle: string | null;
  lastCreatedAt: string | null;
  sharedCount: number;
  lastEditedAt: string | null;
  avgCreationMinutes: number | null;
  mostViewed: { title: string; viewsCount: number } | null;
}

export async function getPresentationsKpis(workspaceId: string): Promise<PresentationsKpis> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("presentations")
    .select("title, share_slug, share_views_count, started_at, completed_at, updated_at, created_at")
    .eq("workspace_id", workspaceId);
  const rows = data ?? [];

  if (rows.length === 0) {
    return { totalCreated: 0, lastCreatedTitle: null, lastCreatedAt: null, sharedCount: 0, lastEditedAt: null, avgCreationMinutes: null, mostViewed: null };
  }

  const byCreatedDesc = [...rows].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
  const lastCreated = byCreatedDesc[0];

  const sharedCount = rows.filter((r) => r.share_slug).length;

  const byUpdatedDesc = [...rows].sort((a, b) => new Date(b.updated_at as string).getTime() - new Date(a.updated_at as string).getTime());
  const lastEditedAt = byUpdatedDesc[0]?.updated_at as string | null;

  const completedDurations = rows
    .filter((r) => r.completed_at)
    .map((r) => (new Date(r.completed_at as string).getTime() - new Date(r.started_at as string).getTime()) / 60_000);
  const avgCreationMinutes = completedDurations.length ? Math.round(completedDurations.reduce((s, v) => s + v, 0) / completedDurations.length) : null;

  const byViewsDesc = [...rows].sort((a, b) => (b.share_views_count as number) - (a.share_views_count as number));
  const topViewed = byViewsDesc[0];
  const mostViewed = topViewed && (topViewed.share_views_count as number) > 0 ? { title: topViewed.title as string, viewsCount: topViewed.share_views_count as number } : null;

  return {
    totalCreated: rows.length,
    lastCreatedTitle: lastCreated?.title as string | null,
    lastCreatedAt: lastCreated?.created_at as string | null,
    sharedCount,
    lastEditedAt,
    avgCreationMinutes,
    mostViewed,
  };
}

export interface PublicPresentation {
  workspaceId: string;
  id: string;
  title: string;
  status: PresentationStatus;
  personalInfo: PersonalInfo;
  photos: PresentationPhoto[];
  slides: PresentationSlide[];
  pdfStoragePath: string | null;
}

/** Para la página pública (src/app/presentaciones/[slug]/page.tsx) — mismo
 * criterio que resolveMiniAppBySlug (ingest.ts): visitante anónimo, sin
 * sesión/contexto RLS, así que se resuelve siempre vía service-role, nunca
 * expone workspace_id/presentation_id en la URL. Solo resuelve
 * presentaciones en status "lista". */
export async function getPublicPresentationBySlug(slug: string): Promise<PublicPresentation | null> {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("presentations")
    .select("workspace_id, id, title, status, personal_info, photos, slides, pdf_storage_path")
    .eq("share_slug", slug)
    .eq("status", "lista")
    .maybeSingle();
  if (!data) return null;

  return {
    workspaceId: data.workspace_id as string,
    id: data.id as string,
    title: data.title as string,
    status: data.status as PresentationStatus,
    personalInfo: (data.personal_info as PersonalInfo | null) ?? {},
    photos: (data.photos as PresentationPhoto[] | null) ?? [],
    slides: (data.slides as PresentationSlide[] | null) ?? [],
    pdfStoragePath: data.pdf_storage_path as string | null,
  };
}

/** Best-effort — nunca debe romper la carga de la página pública. */
export async function incrementPresentationViews(presentationId: string): Promise<void> {
  try {
    const service = createServiceRoleClient();
    const { data } = await service.from("presentations").select("share_views_count").eq("id", presentationId).maybeSingle();
    const current = (data?.share_views_count as number | undefined) ?? 0;
    await service.from("presentations").update({ share_views_count: current + 1 }).eq("id", presentationId);
  } catch (err) {
    console.error(`[presentations] incrementPresentationViews failed for ${presentationId}:`, err);
  }
}
