"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import type { OnboardingStepKey, OnboardingStatus, LearningKind, LearningStatus } from "./types";

/** Upsert on (member_id, step_key) por el cliente propio del usuario (RLS
 * "solo mi propia fila" lo restringe igual que
 * updateNotificationPreferenceAction) — nunca service-role, no hace falta. */
export async function setOnboardingStepAction(stepKey: OnboardingStepKey, status: OnboardingStatus): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  await supabase
    .from("onboarding_progress")
    .upsert({ workspace_id: workspaceId, member_id: memberId, step_key: stepKey, status, updated_at: new Date().toISOString() }, { onConflict: "member_id,step_key" });
}

/** Se llama una sola vez, al primer render del modal de bienvenida — inserta
 * las 6 filas en 'pending' si todavía no existe ninguna, así el modal deja
 * de considerarse "primera visita" sin que el usuario tenga que completar u
 * omitir nada todavía (ver isFirstVisit en queries.ts). No pisa filas que ya
 * existan (upsert con ignoreDuplicates). */
export async function markOnboardingSeenAction(): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  const steps: OnboardingStepKey[] = ["profile", "whatsapp", "manychat", "calendar", "crm", "automations"];
  await supabase
    .from("onboarding_progress")
    .upsert(
      steps.map((step_key) => ({ workspace_id: workspaceId, member_id: memberId, step_key, status: "pending" as const })),
      { onConflict: "member_id,step_key", ignoreDuplicates: true },
    );
}

/** "Reiniciar tutoriales" (Perfil → Aprendizaje) — vuelve todo a 'pending'
 * en vez de borrar filas: no hay policy de DELETE en ninguna de las dos
 * tablas (nunca hizo falta hasta ahora, "ausencia de fila = pending" ya
 * cubre el caso normal), así que un UPDATE masivo con las policies de
 * "solo mi propia fila" que ya existen alcanza sin necesitar una
 * migración nueva. */
export async function resetAllProgressAction(): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  await Promise.all([
    supabase.from("onboarding_progress").update({ status: "pending", updated_at: new Date().toISOString() }).eq("member_id", memberId),
    supabase.from("learning_progress").update({ status: "pending", completed_at: null, updated_at: new Date().toISOString() }).eq("member_id", memberId),
  ]);
}

export async function setLearningProgressAction(kind: LearningKind, itemKey: string, status: LearningStatus): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  await supabase.from("learning_progress").upsert(
    {
      workspace_id: workspaceId,
      member_id: memberId,
      kind,
      item_key: itemKey,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id,kind,item_key" },
  );
}
