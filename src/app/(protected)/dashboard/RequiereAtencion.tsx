import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock, UserRound } from "lucide-react";

export interface AttentionInput {
  /** Pólizas con pago vencido (collections, pagos pendientes con fecha pasada). */
  overduePolicies: number;
  /** Conversaciones sin respuesta hace 24 h o más: la ventana de WhatsApp ya cerró. */
  closedWindowChats: number;
  /** Asesor sin movimientos en el período de inactividad (solo owner). */
  inactiveAdvisor: { name: string; sentence: string } | null;
}

type Tone = "error" | "warning" | "navy";

const TONE_CLASSES: Record<Tone, { row: string; icon: string; sub: string }> = {
  error: { row: "bg-error-bg text-neutral-900", icon: "text-error-strong", sub: "text-neutral-700" },
  warning: { row: "bg-warning-bg text-neutral-900", icon: "text-warning-strong", sub: "text-neutral-700" },
  navy: { row: "navy-card text-white", icon: "text-navy", sub: "text-white/70" },
};

/** "Requiere atención": tres filas con datos reales. Si no hay nada urgente, no se muestra. */
export function RequiereAtencion({ overduePolicies, closedWindowChats, inactiveAdvisor }: AttentionInput) {
  const rows: { key: string; tone: Tone; icon: React.ReactNode; title: string; sub: string; href: string }[] = [];

  if (overduePolicies > 0) {
    rows.push({
      key: "overdue",
      tone: "error",
      icon: <AlertTriangle className="size-5" aria-hidden="true" />,
      title: `${overduePolicies} ${overduePolicies === 1 ? "póliza con pago atrasado" : "pólizas con pago atrasado"}`,
      sub: "Revisá la cobranza antes de que caigan",
      href: "/cobranza",
    });
  }
  if (closedWindowChats > 0) {
    rows.push({
      key: "window",
      tone: "warning",
      icon: <Clock className="size-5" aria-hidden="true" />,
      title: `${closedWindowChats} ${closedWindowChats === 1 ? "chat con la ventana cerrada" : "chats con la ventana cerrada"}`,
      sub: "Para retomarlos necesitás una plantilla aprobada",
      href: "/inbox",
    });
  }
  if (inactiveAdvisor) {
    rows.push({
      key: "advisor",
      tone: "navy",
      icon: <UserRound className="size-5" aria-hidden="true" />,
      title: `${inactiveAdvisor.name} no registra actividad`,
      sub: inactiveAdvisor.sentence,
      href: "/crm?tab=agents",
    });
  }

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="attention-title" className="flex flex-col gap-3">
      <h2 id="attention-title" className="text-[15px] font-semibold text-foreground">
        Requiere atención
      </h2>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <Link
            key={row.key}
            href={row.href}
            className={`flex items-center gap-3 rounded-xl p-3.5 transition-opacity hover:opacity-90 ${TONE_CLASSES[row.tone].row}`}
          >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/60 ${TONE_CLASSES[row.tone].icon}`}>{row.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{row.title}</span>
              <span className={`block truncate text-xs ${TONE_CLASSES[row.tone].sub}`}>{row.sub}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 opacity-70" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
