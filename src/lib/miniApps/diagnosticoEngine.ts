import type { DiagnosticoQuestion, DiagnosticoLevel } from "@/lib/miniApps/diagnosticoDefaults";

/** Espejo TypeScript, server-side, del `computeScore()`/`levelFor()` del
 * HTML original de "Diagnóstico Interactivo Financiero" — misma aritmética
 * exacta (Math.round((raw/maxRaw)*100), suma por área, level lookup por
 * rango). No es código compartido literal con el cliente: a diferencia de
 * financialEngine.ts/brechaEngine.ts (donde el cliente es React y puede
 * importar el mismo engine), el cliente de este tipo es intencionalmente
 * JS vanilla intocado (ver diagnosticoTemplate.ts) — por eso el algoritmo
 * vive duplicado en los dos lenguajes. Este archivo es la versión
 * AUTORITATIVA: ingest.ts nunca confía en el score/nivel que manda el
 * visitante, siempre lo recalcula acá a partir de las respuestas crudas. */

export interface DiagnosticoScoreResult {
  pct: number;
  areas: { name: string; pct: number; count: number }[];
  level: DiagnosticoLevel | null;
}

export function computeDiagnosticoScore(
  questions: DiagnosticoQuestion[],
  levels: DiagnosticoLevel[],
  answers: (number | null)[],
): DiagnosticoScoreResult {
  let raw = 0;
  let maxRaw = 0;
  const areaSums = new Map<string, { sum: number; max: number }>();

  questions.forEach((q, i) => {
    const answerIndex = answers[i];
    const option = answerIndex !== null && answerIndex !== undefined ? q.options[answerIndex] : undefined;
    const w = option?.w ?? 0;
    raw += w;
    maxRaw += 3;
    const area = areaSums.get(q.area) ?? { sum: 0, max: 0 };
    area.sum += w;
    area.max += 3;
    areaSums.set(q.area, area);
  });

  const pct = maxRaw > 0 ? Math.round((raw / maxRaw) * 100) : 0;
  const areas = [...areaSums.entries()].map(([name, v]) => ({
    name,
    pct: v.max > 0 ? Math.round((v.sum / v.max) * 100) : 0,
    count: v.sum,
  }));
  const level = levels.find((l) => pct >= l.min && pct <= l.max) ?? levels[0] ?? null;

  return { pct, areas, level };
}
