"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { ChevronRight, MessageCircle, Clock } from "lucide-react";
import type { UnansweredConversation } from "@/lib/insights/queries";

/** WhatsApp Business: la ventana de respuesta libre es de 24 h desde el último
 * mensaje del contacto. hoursWaiting es justamente esa antigüedad, así que el
 * tiempo que queda es 24 − hoursWaiting (mismo criterio que el envío en
 * src/lib/messaging/send.ts, outside_24h_window). */
const WINDOW_HOURS = 24;
/** Distancia en px que hay que arrastrar para pasar a la siguiente tarjeta. */
const SWIPE_THRESHOLD = 90;

function formatHours(hours: number) {
  if (hours < 1) return "menos de 1 h";
  if (hours < 24) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} d`;
}

/** Mazo de "Siguiente contacto": los leads sin responder, con la ventana real
 * de 24 h. Se pasa con el dedo (o con el botón). Sin ventana abierta no ofrece
 * escribir libre: sólo se puede retomar con una plantilla aprobada, así que el
 * botón lleva al inbox. */
export function LeadDeck({ conversations }: { conversations: UnansweredConversation[] }) {
  // Más urgente primero: el que más tiempo lleva esperando.
  const queue = [...conversations].sort((a, b) => b.hoursWaiting - a.hoursWaiting);
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [settling, setSettling] = useState(false);
  const startX = useRef<number | null>(null);

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

  const position = index % queue.length;
  const current = queue[position];
  const next = queue[(position + 1) % queue.length];
  const left = Math.max(0, WINDOW_HOURS - current.hoursWaiting);
  const windowOpen = left > 0;
  const hasMany = queue.length > 1;

  function advance(direction: 1 | -1) {
    setSettling(true);
    setDragX(direction * 480);
    setTimeout(() => {
      setIndex((i) => (i + direction + queue.length) % queue.length);
      setDragX(0);
      setSettling(false);
    }, 220);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!hasMany || (e.target as HTMLElement).closest("a,button")) return;
    startX.current = e.clientX;
    setSettling(false);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    setDragX(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    if (Math.abs(dragX) > SWIPE_THRESHOLD) advance(dragX > 0 ? -1 : 1);
    else {
      setSettling(true);
      setDragX(0);
      setTimeout(() => setSettling(false), 220);
    }
  }

  return (
    <section aria-labelledby="deck-title" className="flex flex-col gap-3">
      <div className="relative pb-5">
        {hasMany && (
          <div
            aria-hidden="true"
            className="navy-card absolute inset-x-3 top-0 bottom-0 translate-y-2.5 scale-[0.96] rounded-lg opacity-60"
          />
        )}
        <div
          className="navy-card relative flex touch-pan-y flex-col gap-4 rounded-lg p-5 select-none"
          style={{
            transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)`,
            transition: settling ? "transform 220ms var(--ease-out)" : "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex items-center justify-between gap-3 text-[13px] text-white/70">
            <span id="deck-title">Siguiente contacto</span>
            <span className="tabular-nums" aria-label={`${position + 1} de ${queue.length}`}>
              {position + 1} / {queue.length}
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
            {hasMany && (
              <button
                type="button"
                onClick={() => advance(1)}
                aria-label={`Ver el siguiente contacto: ${next.contactName}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
