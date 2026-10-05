"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageCircle, Clock } from "lucide-react";
import type { UnansweredConversation } from "@/lib/insights/queries";

/** WhatsApp Business: la ventana de respuesta libre es de 24 h desde el último
 * mensaje del contacto. hoursWaiting es justamente esa antigüedad, así que el
 * tiempo que queda es 24 − hoursWaiting (mismo criterio que el envío en
 * src/lib/messaging/send.ts, outside_24h_window). */
const WINDOW_HOURS = 24;

function formatHours(hours: number) {
  if (hours < 1) return "menos de 1 h";
  if (hours < 24) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} d`;
}

/** Mazo de "Siguiente contacto": los leads sin responder, con la ventana real
 * de 24 h. Sin ventana abierta no ofrece escribir libre: sólo se puede
 * retomar con una plantilla aprobada, así que el botón lleva al inbox. */
export function LeadDeck({ conversations }: { conversations: UnansweredConversation[] }) {
  // Más urgente primero: el que más tiempo lleva esperando, y el que tiene
  // ventana abierta más corta, es el que hay que responder antes.
  const queue = [...conversations].sort((a, b) => b.hoursWaiting - a.hoursWaiting);
  const [index, setIndex] = useState(0);

  if (queue.length === 0) {
    return (
      <section aria-labelledby="deck-title" className="navy-card flex flex-col gap-3 rounded-lg p-5">
        <h2 id="deck-title" className="font-display text-[22px] font-semibold tracking-[-0.02em] text-white">
          Bandeja al día
        </h2>
        <p className="text-sm text-white/70">No hay leads esperando respuesta.</p>
      </section>
    );
  }

  const current = queue[index % queue.length];
  const left = Math.max(0, WINDOW_HOURS - current.hoursWaiting);
  const windowOpen = left > 0;
  const next = () => setIndex((i) => (i + 1) % queue.length);

  return (
    <section aria-labelledby="deck-title" className="flex flex-col gap-3">
      <div className="navy-card flex flex-col gap-4 rounded-lg p-5">
        <div className="flex items-center justify-between gap-3 text-[13px] text-white/70">
          <span id="deck-title">Siguiente contacto</span>
          <span className="tabular-nums" aria-label={`${(index % queue.length) + 1} de ${queue.length}`}>
            {(index % queue.length) + 1} / {queue.length}
          </span>
        </div>

        <div className="min-w-0">
          <p className="truncate font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white">
            {current.contactName}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
            <Clock className="size-4" aria-hidden="true" />
            Esperando hace {formatHours(current.hoursWaiting)}
          </p>
        </div>

        <p className="text-sm text-white/80">
          {windowOpen
            ? `Quedan ${formatHours(left)} para responder dentro de la ventana de 24 h.`
            : "La ventana de 24 h ya cerró. Para retomarlo necesitás una plantilla aprobada."}
        </p>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Link
            href={`/inbox?conversation=${current.id}`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent-600 text-sm font-medium text-[var(--on-accent)] hover:bg-accent-700"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {windowOpen ? "Escribir" : "Ver en Inbox"}
          </Link>
          {queue.length > 1 && (
            <button
              type="button"
              onClick={next}
              aria-label="Ver el siguiente contacto"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
