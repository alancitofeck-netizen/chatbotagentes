import { habloAsesorFullPhrase } from "@/lib/miniApps/qualificationOptions";

interface CodeLabel {
  code: string;
  label: string;
}

interface RetirementQualificationShape {
  preocupacion: CodeLabel | null;
  habloAsesor: CodeLabel | null;
  objetivo: CodeLabel | null;
  cuandoEmpezar: CodeLabel | null;
}

interface RetirementDiagnosisShape {
  preparationLevel: string;
  stars: number;
  preparationLabel: string;
  strengths: string[];
  opportunities: string[];
  diagnosisSummary: string;
}

/** Detects the new structured shape written by ingest.ts's
 * appendMiniAppLeadQualification (data.diagnosis) — false for leads created
 * before this redesign (flat preocupacion_principal-style keys, no
 * data.diagnosis) or leads with no qualification answer saved yet, both of
 * which should fall back to ContactDetailPanel's existing generic dump. */
export function isRetirementDiagnosisShape(data: Record<string, unknown>): boolean {
  const diagnosis = data.diagnosis;
  return !!diagnosis && typeof diagnosis === "object" && typeof (diagnosis as Record<string, unknown>).preparationLevel === "string";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function BulletBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{title}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((text) => (
          <li key={text} className="text-xs text-foreground">
            • {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Structured "Diagnóstico del simulador" panel for the retirement
 * simulator template — a deliberate, explained exception to
 * ContactDetailPanel's usual "fully generic, no per-template hardcoding"
 * dump, since the requested structure (labeled fields, bullet lists, a
 * full generated paragraph) is inherently specific to this template. Same
 * criterion templateCatalog.ts already uses: a small, per-template surface
 * that grows as new templates are added, rather than forcing every
 * template through one generic renderer. */
export function RetirementDiagnosisSummary({ data }: { data: Record<string, unknown> }) {
  const qualification = data.qualification as Partial<RetirementQualificationShape> | undefined;
  const diagnosis = data.diagnosis as RetirementDiagnosisShape;

  return (
    <div className="mt-2 rounded-md bg-surface-2 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Diagnóstico del simulador</p>
      <dl className="mt-2 flex flex-col gap-1.5 text-xs">
        <Row label="Escenario" value="Moderado" />
        <Row label="Nivel de preparación" value={`${diagnosis.preparationLabel} (${"⭐".repeat(diagnosis.stars)})`} />
        <Row label="Objetivo" value={qualification?.objetivo?.label ?? "Sin responder"} />
        <Row label="Mayor preocupación" value={qualification?.preocupacion?.label ?? "Sin responder"} />
        <Row label="Urgencia" value={qualification?.cuandoEmpezar?.label ?? "Sin responder"} />
        <Row label="Experiencia previa" value={habloAsesorFullPhrase(qualification?.habloAsesor?.code ?? null)} />
      </dl>
      <BulletBlock title="Fortalezas detectadas" items={diagnosis.strengths ?? []} />
      <BulletBlock title="Aspectos a mejorar" items={diagnosis.opportunities ?? []} />
      {diagnosis.diagnosisSummary && (
        <div className="mt-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Resumen generado automáticamente</p>
          <p className="mt-1 text-xs text-foreground">{diagnosis.diagnosisSummary}</p>
        </div>
      )}
    </div>
  );
}
