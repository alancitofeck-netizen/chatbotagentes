import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { getManychatStatus } from "@/lib/integrations/manychat";
import { getGoogleCalendarStatus } from "@/lib/integrations/googleCalendar";
import { ONBOARDING_STEPS, type OnboardingState, type OnboardingStepKey, type OnboardingStatus, type LearningStatus } from "./types";

/** Ausencia de fila = 'pending' (mismo convenio que notification_preferences,
 * 0081) — nunca hace falta sembrar las 6 filas al crear un miembro nuevo.
 * Para whatsapp/manychat/calendar, además de lo guardado a mano, se
 * verifica la conexión real: si ya está conectado, el paso se muestra
 * completado aunque el miembro nunca haya tocado el checklist — nunca al
 * revés (una conexión real jamás se "des-completa" acá). */
export async function getOnboardingState(): Promise<OnboardingState> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);

  const steps = Object.fromEntries(ONBOARDING_STEPS.map((k) => [k, "pending" as OnboardingStatus])) as Record<OnboardingStepKey, OnboardingStatus>;
  const learning: Record<string, LearningStatus> = {};

  if (!memberId) {
    // Modo Supervisor: no hay fila de workspace_members real que sea dueña
    // de progreso — el checklist/tours simplemente no se muestran.
    return { memberId: null, steps, isFirstVisit: false, learning };
  }

  const supabase = await createClient();
  const [{ data: onboardingRows }, { data: learningRows }] = await Promise.all([
    supabase.from("onboarding_progress").select("step_key, status").eq("member_id", memberId),
    supabase.from("learning_progress").select("kind, item_key, status").eq("member_id", memberId),
  ]);

  const isFirstVisit = !onboardingRows || onboardingRows.length === 0;

  for (const row of onboardingRows ?? []) {
    steps[row.step_key as OnboardingStepKey] = row.status as OnboardingStatus;
  }
  for (const row of learningRows ?? []) {
    learning[`${row.kind}:${row.item_key}`] = row.status as LearningStatus;
  }

  // Solo se molesta en pedir el estado real si el paso todavía no está
  // completado/omitido — evita 2 queries extra en cada carga de página una
  // vez que el usuario ya terminó el onboarding.
  const checks: Promise<void>[] = [];
  if (steps.manychat !== "completed" && steps.manychat !== "skipped") {
    checks.push(
      getManychatStatus(workspaceId).then((s) => {
        if (s.connected) steps.manychat = "completed";
      }),
    );
  }
  if (steps.calendar !== "completed" && steps.calendar !== "skipped") {
    checks.push(
      getGoogleCalendarStatus(workspaceId).then((s) => {
        if (s.connected) steps.calendar = "completed";
      }),
    );
  }
  await Promise.all(checks);

  return { memberId, steps, isFirstVisit, learning };
}
