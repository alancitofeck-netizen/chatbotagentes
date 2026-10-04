import { MessageSquareWarning, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { UnansweredConversation } from "@/lib/insights/queries";

const SHOWN = 3;

function formatWait(hours: number) {
  if (hours < 1) return "menos de 1 h";
  if (hours < 24) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} d`;
}

/** Tarjeta destacada de leads sin responder: lo primero que ve el usuario
 * en el dashboard cuando hay mensajes esperando respuesta. Usa la misma
 * lista que el motor de insights (ya cargada en page.tsx), sin consultas
 * nuevas. Si no hay pendientes no ocupa espacio. */
export function UnansweredLeadsCard({ conversations }: { conversations: UnansweredConversation[] }) {
  if (conversations.length === 0) return null;

  const oldest = Math.max(...conversations.map((c) => c.hoursWaiting));
  const critical = oldest >= 24;
  const top = [...conversations].sort((a, b) => b.hoursWaiting - a.hoursWaiting).slice(0, SHOWN);
  const count = conversations.length;

  return (
    <section
      aria-labelledby="unanswered-leads-title"
      className={`flex flex-col gap-3 rounded-xl border p-4 md:hidden ${
        critical ? "border-error-strong/40 bg-error-bg" : "border-warning-strong/40 bg-warning-bg"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-1 ${
            critical ? "text-error-strong" : "text-warning-strong"
          }`}
        >
          <MessageSquareWarning className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="unanswered-leads-title" className="text-[15px] font-semibold text-foreground">
            {count} {count === 1 ? "lead sin responder" : "leads sin responder"}
          </h2>
          <p className="text-[13px] text-neutral-600">
            La más antigua lleva {formatWait(oldest)} esperando respuesta.
          </p>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-border-default rounded-lg bg-surface-1">
        {top.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="min-w-0 truncate font-medium text-foreground">{c.contactName}</span>
            <span className="shrink-0 text-xs text-neutral-500">hace {formatWait(c.hoursWaiting)}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/inbox"
        className="flex min-h-11 items-center justify-center gap-1 rounded-lg bg-foreground text-sm font-medium text-surface-1 hover:opacity-90"
      >
        Responder ahora
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
