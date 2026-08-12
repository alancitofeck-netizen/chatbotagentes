/** Extraído de resumen/page.tsx — mismo criterio que ClientTimelineList.tsx:
 * se comparte en cuanto aparece un segundo consumidor (Agenda/Operación/KPIs). */
export function DeltaLabel({ pct, footnote }: { pct: number | null; footnote?: string }) {
  if (pct === null) return footnote ? <p className="text-xs text-neutral-500">{footnote}</p> : null;
  return (
    <p className={`text-xs font-medium ${pct >= 0 ? "text-success-strong" : "text-error-strong"}`}>
      {pct >= 0 ? "+" : ""}
      {pct}% vs mes anterior
    </p>
  );
}
