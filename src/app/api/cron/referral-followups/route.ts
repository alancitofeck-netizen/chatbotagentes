import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notify } from "@/lib/notifications/service";
import { logActivity } from "@/lib/activity/log";

export const maxDuration = 60;

interface FollowupRow {
  id: string;
  workspace_id: string;
  referral_id: string;
  conversation_id: string;
  agent_id: string | null;
  attempt_number: number;
  scheduled_at: string;
}

/**
 * Dispara los seguimientos programados de Agentes IA de Referidos
 * (referral_followups, 0167) — cierre de la decisión pendiente de la Fase
 * 4. Pedido explícito del usuario: NO reintentar solo mandando un segundo
 * mensaje. En su lugar, crea una TAREA en el módulo de Tareas ya existente
 * para que el asesor la mande a mano con un clic — mismo criterio exacto
 * que ya usa policy-automations/route.ts para renovaciones de pólizas
 * (nunca auto-envía WhatsApp fuera de la ventana de 24h porque eso exige
 * plantilla aprobada por Meta que no podemos confirmar que exista).
 *
 * `ai_agents.referral_followup_mode` ya tiene la arquitectura lista para un
 * futuro modo 'automatic' (el agente reintenta solo) — a propósito NO
 * implementado todavía: si algún agente tuviera ese valor (hoy imposible,
 * ninguna UI lo expone), este cron igual cae al camino manual en vez de
 * fingir un envío automático que no existe.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: due, error: dueError } = await supabase
    .from("referral_followups")
    .select("id, workspace_id, referral_id, conversation_id, agent_id, attempt_number, scheduled_at")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString());
  if (dueError) {
    console.error("[cron/referral-followups] failed to load due followups:", dueError.message);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }

  let tasksCreated = 0;
  let cancelled = 0;
  let skipped = 0;

  for (const followup of (due ?? []) as FollowupRow[]) {
    try {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("mode, contact_id, last_message_at")
        .eq("id", followup.conversation_id)
        .maybeSingle();

      // Re-chequeo defensivo al momento del disparo (además de la
      // cancelación reactiva ya cableada en ingest.ts/inbox/actions.ts): si
      // el asesor tomó o pausó la conversación DESPUÉS de programarse este
      // seguimiento pero la cancelación reactiva no llegó a correr por
      // algún motivo, acá se corrige antes de crear la tarea. Punto 11:
      // "si el bot está pausado, no crear nuevos seguimientos automáticos".
      if (!conversation || conversation.mode === "human" || conversation.mode === "paused") {
        await supabase
          .from("referral_followups")
          .update({ status: "cancelled", cancelled_reason: conversation?.mode === "paused" ? "paused" : "human_takeover" })
          .eq("id", followup.id);
        cancelled++;
        continue;
      }

      const { data: referral } = await supabase
        .from("asesoria_referrals")
        .select("id, name, phone, status, advisor_id, updated_at")
        .eq("id", followup.referral_id)
        .maybeSingle();
      if (!referral) {
        await supabase.from("referral_followups").update({ status: "cancelled", cancelled_reason: "referral_not_found" }).eq("id", followup.id);
        cancelled++;
        continue;
      }
      // Estados terminales del referido — no tiene sentido insistir.
      if (referral.status === "convertido" || referral.status === "no_interesado") {
        await supabase.from("referral_followups").update({ status: "cancelled", cancelled_reason: `referral_${referral.status}` }).eq("id", followup.id);
        cancelled++;
        continue;
      }

      // Mismo criterio que policy-automations: sin un dueño concreto no
      // hay a quién asignarle la tarea — se marca "sent" (el intento se
      // consumió, cuenta para el tope de 3) pero no se crea nada más.
      if (!referral.advisor_id) {
        await supabase.from("referral_followups").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", followup.id);
        skipped++;
        continue;
      }

      const { data: agent } = followup.agent_id ? await supabase.from("ai_agents").select("name").eq("id", followup.agent_id).maybeSingle() : { data: null };

      const digits = referral.phone.replace(/\D/g, "");
      const message = `Hola ${referral.name}, ¿pudiste ver mi mensaje anterior? Quedo atento.`;
      const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
      const lastContactLabel = conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleString("es") : "sin registro";

      const description = [
        `Referido: ${referral.name}`,
        `Teléfono: +${digits}`,
        `Último contacto: ${lastContactLabel}`,
        `Motivo: el referido no respondió al mensaje del Agente IA de Referidos.`,
        `Seguimiento N°: ${followup.attempt_number}`,
        `Agente responsable: ${(agent?.name as string | undefined) ?? "—"}`,
        `Fecha/hora recomendada: ${new Date(followup.scheduled_at).toLocaleString("es")}`,
        "",
        `Enviar por WhatsApp: ${waLink}`,
      ].join("\n");

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          workspace_id: followup.workspace_id,
          title: `Seguimiento #${followup.attempt_number} — ${referral.name} no respondió`,
          description,
          related_type: "conversation",
          related_id: followup.conversation_id,
          assigned_to: referral.advisor_id,
          priority: "medium",
          due_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (taskError || !task) throw new Error(taskError?.message ?? "task_insert_failed");
      tasksCreated++;

      await supabase.from("task_relations").insert([
        { workspace_id: followup.workspace_id, task_id: task.id, related_type: "referral", related_id: followup.referral_id },
        { workspace_id: followup.workspace_id, task_id: task.id, related_type: "contact", related_id: conversation.contact_id },
      ]);

      await notify({
        workspaceId: followup.workspace_id,
        memberId: referral.advisor_id,
        eventType: "referral_followup_task_created",
        title: "Seguimiento de referido",
        message: `${referral.name} no respondió — seguimiento #${followup.attempt_number} listo para enviar.`,
        actionUrl: `/tasks/${task.id}`,
      });

      await supabase.from("referral_followups").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", followup.id);
      await logActivity(supabase, followup.workspace_id, null, "referral_followup", followup.id, "referral_followup_task_created", {
        taskId: task.id,
        referralId: followup.referral_id,
        attemptNumber: followup.attempt_number,
      });
    } catch (err) {
      console.error(`[cron/referral-followups] failed for followup ${followup.id}:`, err);
    }
  }

  return NextResponse.json({ tasksCreated, cancelled, skipped }, { status: 200 });
}
