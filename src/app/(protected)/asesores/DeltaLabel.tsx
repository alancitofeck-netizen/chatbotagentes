/** Extraído de resumen/page.tsx — mismo criterio que ClientTimelineList.tsx:
 * se comparte en cuanto aparece un segundo consumidor (Agenda/Operación/KPIs).
 * `suffix` es opcional (default "vs mes anterior", igual que siempre) —
 * Asesores → Agendas lo pisa con "vs semana/mes/período anterior" según el
 * período seleccionado, ya que ahí "mes anterior" no siempre es correcto. */
export function DeltaLabel({ pct, footnote, suffix = "vs mes anterior" }: { pct: number | null; footnote?: string; suffix?: string }) {
  if (pct === null) return footnote ? <p className="text-xs text-neutral-500">{footnote}</p> : null;
  return (
    <p className={`text-xs font-medium ${pct >= 0 ? "text-success-strong" : "text-error-strong"}`}>
      {pct >= 0 ? "+" : ""}
      {pct}% {suffix}
    </p>
  );
}
