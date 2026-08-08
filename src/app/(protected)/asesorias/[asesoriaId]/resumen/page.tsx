import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { createClient } from "@/lib/supabase/server";
import { getAsesoriaById, getAsesoriaResponses, type AsesoriaResponseRow, type AsesoriaStatus } from "@/lib/asesorias/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Resumen de Asesoría — Growth Link" };

const STATUS_VARIANT: Record<AsesoriaStatus, "success" | "warning" | "neutral"> = {
  no_iniciada: "neutral",
  en_progreso: "warning",
  finalizada: "success",
};
const STATUS_LABEL: Record<AsesoriaStatus, string> = { no_iniciada: "No iniciada", en_progreso: "En progreso", finalizada: "Finalizada" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderAnswer(row: AsesoriaResponseRow) {
  const a = row.answer;
  switch (row.answerType) {
    case "text":
    case "money":
    case "choice":
    case "prospect_field":
      return <p className="text-sm text-foreground">{String(a)}</p>;
    case "multi_choice":
    case "ranking":
      return Array.isArray(a) && a.length > 0 ? (
        <ol className="flex flex-col gap-1 text-sm text-foreground">
          {a.map((item, i) => (
            <li key={i}>
              {row.answerType === "ranking" ? `${i + 1}. ` : "• "}
              {String(item)}
            </li>
          ))}
        </ol>
      ) : null;
    case "feedback": {
      const obj = (a ?? {}) as { text?: string | null; rating?: number | null };
      return (
        <div className="flex flex-col gap-1 text-sm text-foreground">
          {obj.text && <p>{obj.text}</p>}
          {typeof obj.rating === "number" && <p className="text-warning-strong">{"★".repeat(obj.rating)}{"☆".repeat(5 - obj.rating)}</p>}
        </div>
      );
    }
    case "decision_makers": {
      const list = Array.isArray(a) ? (a as { type?: string; name?: string; relation?: string }[]) : [];
      return (
        <ul className="flex flex-col gap-1 text-sm text-foreground">
          {list.map((dm, i) => (
            <li key={i}>
              {dm.type === "otro" ? [dm.name, dm.relation].filter(Boolean).join(" — ") || "Otra persona" : DECISION_MAKER_LABEL[dm.type ?? ""] || dm.type}
            </li>
          ))}
        </ul>
      );
    }
    case "next_step": {
      const ns = (a ?? {}) as Record<string, unknown>;
      const parts = [
        [ns.date, ns.time].filter(Boolean).join(" · "),
        ns.meetingType,
        ns.participants ? `Participantes: ${ns.participants}` : null,
        ns.objective ? `Objetivo: ${ns.objective}` : null,
      ].filter(Boolean);
      return (
        <ul className="flex flex-col gap-1 text-sm text-foreground">
          {parts.map((p, i) => (
            <li key={i}>{String(p)}</li>
          ))}
        </ul>
      );
    }
    case "referral": {
      const list = Array.isArray(a) ? (a as { name?: string; cc?: string; phone?: string }[]) : [];
      return (
        <ul className="flex flex-col gap-1 text-sm text-foreground">
          {list.map((r, i) => (
            <li key={i}>
              {r.name} {r.cc || ""} {r.phone}
            </li>
          ))}
        </ul>
      );
    }
    default:
      return <p className="text-sm text-foreground">{typeof a === "string" ? a : JSON.stringify(a)}</p>;
  }
}

const DECISION_MAKER_LABEL: Record<string, string> = {
  solo: "Decide personalmente",
  pareja: "Necesita sumar a su pareja",
  socio: "Necesita sumar a un socio",
  familiar: "Necesita sumar a un familiar",
};

export default async function AsesoriaResumenPage({ params }: { params: Promise<{ asesoriaId: string }> }) {
  const { asesoriaId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "asesorias");

  const [asesoria, responses] = await Promise.all([getAsesoriaById(workspaceId, asesoriaId), getAsesoriaResponses(workspaceId, asesoriaId)]);
  if (!asesoria) notFound();

  let contactName: string | null = null;
  let advisorName: string | null = null;
  {
    const supabase = await createClient();
    if (asesoria.contactId) {
      const { data } = await supabase.from("contacts").select("name").eq("id", asesoria.contactId).maybeSingle();
      contactName = (data?.name as string | undefined) ?? null;
    }
    if (asesoria.advisorId) {
      const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
      advisorName = ((data ?? []) as { member_id: string; full_name: string }[]).find((m) => m.member_id === asesoria.advisorId)?.full_name ?? null;
    }
  }

  const sections: { name: string; rows: AsesoriaResponseRow[] }[] = [];
  for (const row of responses) {
    const sectionName = row.section ?? "General";
    let group = sections.find((s) => s.name === sectionName);
    if (!group) {
      group = { name: sectionName, rows: [] };
      sections.push(group);
    }
    group.rows.push(row);
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <Link href={`/asesorias/${asesoriaId}`} className="flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground">
          <ArrowLeft size={14} aria-hidden="true" />
          Volver a la asesoría
        </Link>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Resumen de la asesoría</h1>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Cliente</p>
            <p className="mt-1 text-sm text-foreground">{contactName ?? "Sin contacto"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Fecha</p>
            <p className="mt-1 text-sm text-foreground">{formatDateTime(asesoria.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Asesor</p>
            <p className="mt-1 text-sm text-foreground">{advisorName ?? "Sin asignar"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Estado</p>
            <Badge variant={STATUS_VARIANT[asesoria.status]} className="mt-1">
              {STATUS_LABEL[asesoria.status]}
            </Badge>
          </div>
        </div>
      </Card>

      {responses.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Todavía no hay respuestas registradas para esta asesoría.</p>
        </Card>
      ) : (
        sections.map((section) => (
          <Card key={section.name}>
            <CardHeader title={section.name} />
            <div className="flex flex-col gap-4">
              {section.rows.map((row) => (
                <div key={row.questionKey}>
                  <p className="text-sm font-medium text-foreground">{row.question}</p>
                  <div className="mt-1">{renderAnswer(row)}</div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
