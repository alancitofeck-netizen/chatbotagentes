import {
  computeAreaMax,
  DIAGNOSTICO_RETIRO_AREAS,
  type DiagnosticoRetiroArea,
  type DiagnosticoRetiroQuestion,
  type DiagnosticoRetiroPerfil,
  type DiagnosticoRetiroRecoPool,
  type DiagnosticoRetiroThemeKey,
  type DiagnosticoRetiroThemePool,
  type DiagnosticoRetiroTier,
} from "@/lib/miniApps/diagnosticoRetiroDefaults";

/** Espejo TypeScript, server-side, de computeResults()/getRecommendations()
 * del HTML original de "Diagnóstico Financiero - Retiro" — misma
 * aritmética exacta (suma por área / máximo de esa área * 100, promedio de
 * las 4 áreas, selección de perfil por umbrales, 2 recomendaciones de las
 * áreas más bajas + 1 de tema). No es código compartido literal con el
 * cliente: igual que diagnosticoEngine.ts, el cliente de este tipo es
 * intencionalmente JS vanilla intocado (ver diagnosticoRetiroTemplate.ts),
 * así que el algoritmo vive duplicado en los dos lenguajes. Este archivo es
 * la versión AUTORITATIVA: ingest.ts nunca confía en el score/perfil/áreas
 * que manda el visitante, siempre los recalcula acá a partir de las
 * respuestas crudas. */

export interface DiagnosticoRetiroScoreResult {
  overall: number;
  areaScores: Record<DiagnosticoRetiroArea, number>;
  perfil: DiagnosticoRetiroPerfil | null;
  theme: string;
  recomendaciones: string[];
}

function tier(score: number): DiagnosticoRetiroTier {
  return score < 45 ? "low" : score < 75 ? "mid" : "high";
}

export function computeDiagnosticoRetiroScore(
  questions: DiagnosticoRetiroQuestion[],
  umbral1: number,
  umbral2: number,
  perfiles: DiagnosticoRetiroPerfil[],
  recoPool: DiagnosticoRetiroRecoPool,
  themePool: DiagnosticoRetiroThemePool,
  answers: (number | null)[],
): DiagnosticoRetiroScoreResult {
  const areaMax = computeAreaMax(questions);
  const sums: Record<DiagnosticoRetiroArea, number> = { retiro: 0, ahorro: 0, fiscal: 0, proteccion: 0 };
  let theme = "";

  questions.forEach((q, i) => {
    const answerIndex = answers[i];
    const option = answerIndex !== null && answerIndex !== undefined ? q.options[answerIndex] : undefined;
    if (!option) return;
    DIAGNOSTICO_RETIRO_AREAS.forEach((area) => {
      sums[area] += option.points[area] ?? 0;
    });
    if (option.theme) theme = option.theme;
  });

  const areaScores = {} as Record<DiagnosticoRetiroArea, number>;
  DIAGNOSTICO_RETIRO_AREAS.forEach((area) => {
    areaScores[area] = areaMax[area] > 0 ? Math.round((sums[area] / areaMax[area]) * 100) : 0;
  });
  const overall = Math.round(DIAGNOSTICO_RETIRO_AREAS.reduce((s, a) => s + areaScores[a], 0) / DIAGNOSTICO_RETIRO_AREAS.length);

  const perfil = overall < umbral1 ? (perfiles[0] ?? null) : overall < umbral2 ? (perfiles[1] ?? null) : (perfiles[2] ?? null);

  const sortedAreas = [...DIAGNOSTICO_RETIRO_AREAS].sort((a, b) => areaScores[a] - areaScores[b]);
  const recomendaciones: string[] = [];
  for (const area of sortedAreas) {
    if (recomendaciones.length >= 2) break;
    const key = `${area}_${tier(areaScores[area])}` as keyof DiagnosticoRetiroRecoPool;
    if (recoPool[key]) recomendaciones.push(recoPool[key]);
  }
  const themeText = themePool[theme as DiagnosticoRetiroThemeKey];
  if (theme && themeText) recomendaciones.push(themeText);

  return { overall, areaScores, perfil, theme, recomendaciones };
}
