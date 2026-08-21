"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAgencyWorkspaceAccessForCurrentUser } from "@/lib/auth/roles";
import { resolveOpenRouterApiKey, complete, type OpenRouterToolDef } from "@/lib/integrations/openrouter";
import { getAgencyKpiEntries, type AgencyKpiEntryRow } from "@/lib/kpis/agencyPerformance";
import { totalsFromEntries } from "@/lib/kpis/queries";
import { agendas, conversionRate } from "@/lib/kpis/formulas";
import { groupBySetter, previousPeriodMonth, previousWeek, weekLabel, monthLabel } from "@/lib/kpis/periodHelpers";
import { detectFunnelBottleneck, compareToTeamAverage, detectPeriodAnomalies, determineRendimiento } from "./analysis";

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

/** Todas las acciones de este archivo devuelven { ok:false, error } en vez
 * de tirar (nunca `throw`) — un Error cruzando el límite de un Server Action
 * en este proyecto ya se comprobó en producción que puede llegar al cliente
 * como un "Server Components render" genérico e ilegible en vez del mensaje
 * real (mismo bug ya documentado en openrouter.ts:68-79 y pisado dos veces
 * hoy en /agenda y Mini Apps) — devolver el error como dato lo evita de raíz. */
async function requireAgencyAccessOrError(): Promise<{ ok: true; workspaceId: string } | { ok: false; error: string }> {
  await requireActiveWorkspace();
  const workspaceId = await getAgencyWorkspaceAccessForCurrentUser();
  if (!workspaceId) return { ok: false, error: "No tenés permiso para hacer esto." };
  return { ok: true, workspaceId };
}

async function getCurrentAndPreviousEntries(periodMonth: string, weekNumber?: number): Promise<{ current: AgencyKpiEntryRow[]; previous: AgencyKpiEntryRow[] }> {
  const months = [previousPeriodMonth(periodMonth), periodMonth];
  const entries = await getAgencyKpiEntries(months);
  if (weekNumber) {
    const prev = previousWeek(periodMonth, weekNumber);
    return {
      current: entries.filter((e) => e.periodMonth === periodMonth && e.weekNumber === weekNumber),
      previous: entries.filter((e) => e.periodMonth === prev.periodMonth && e.weekNumber === prev.weekNumber),
    };
  }
  return {
    current: entries.filter((e) => e.periodMonth === periodMonth),
    previous: entries.filter((e) => e.periodMonth === previousPeriodMonth(periodMonth)),
  };
}

export interface AiFinding {
  id: string;
  type: "atencion" | "oportunidad" | "tendencia";
  agentName: string | null;
  contextLines: string[];
}

/** Arma los hallazgos determinísticos (ver aiManager/analysis.ts) — hasta 2
 * setters en "atención", el mejor en "oportunidad", y una tendencia de
 * equipo si hay alguna caída significativa. Nunca más de 4 en total, mismo
 * criterio visual que el mockup (3-4 tarjetas + "Ver todas"). */
function buildFindings(currentEntries: AgencyKpiEntryRow[], previousEntries: AgencyKpiEntryRow[]): AiFinding[] {
  const teamTotals = totalsFromEntries(currentEntries);
  const previousTeamTotals = totalsFromEntries(previousEntries);
  const bySetter = groupBySetter(currentEntries);

  const findings: AiFinding[] = [];
  const setterEvals = [...bySetter.entries()].map(([setterId, bucket]) => {
    const totals = totalsFromEntries(bucket.rows);
    return { setterId, name: bucket.setterName, advisorName: bucket.advisorName, totals, status: determineRendimiento(totals, teamTotals) };
  });

  const bajos = setterEvals.filter((s) => s.status === "bajo").slice(0, 2);
  for (const s of bajos) {
    const bottleneck = detectFunnelBottleneck(s.totals);
    const comparisons = compareToTeamAverage(s.totals, teamTotals)
      .filter((c) => c.diffPct !== null && c.diffPct <= -15)
      .map((c) => `${c.metricLabel}: ${c.setterValue}% (equipo: ${c.teamAverage}%, ${c.diffPct}% vs. equipo)`);
    findings.push({
      id: `atencion-${s.setterId}`,
      type: "atencion",
      agentName: s.name,
      contextLines: [
        `Asesor: ${s.advisorName}`,
        `Métricas por debajo del promedio del equipo:\n${comparisons.join("\n") || "sin datos suficientes"}`,
        bottleneck ? `Cuello de botella detectado: ${bottleneck.label} (${bottleneck.rate}%)` : "Sin datos suficientes para detectar cuello de botella.",
      ],
    });
  }

  const buenos = setterEvals.filter((s) => s.status === "bueno").sort((a, b) => conversionRate(b.totals) - conversionRate(a.totals));
  const best = buenos[0];
  if (best && bajos.length < setterEvals.length) {
    const comparisons = compareToTeamAverage(best.totals, teamTotals)
      .filter((c) => c.diffPct !== null && c.diffPct >= 15)
      .map((c) => `${c.metricLabel}: ${c.setterValue}% (equipo: ${c.teamAverage}%, +${c.diffPct}% vs. equipo)`);
    if (comparisons.length > 0) {
      findings.push({
        id: `oportunidad-${best.setterId}`,
        type: "oportunidad",
        agentName: best.name,
        contextLines: [`Asesor: ${best.advisorName}`, `Métricas por encima del promedio del equipo:\n${comparisons.join("\n")}`],
      });
    }
  }

  const teamAnomalies = detectPeriodAnomalies(teamTotals, previousTeamTotals);
  if (teamAnomalies.length > 0) {
    const worst = teamAnomalies.reduce((min, a) => (a.deltaPct < min.deltaPct ? a : min), teamAnomalies[0]);
    findings.push({
      id: "tendencia-equipo",
      type: "tendencia",
      agentName: null,
      contextLines: [
        `${worst.metricLabel} del equipo completo: ${worst.currentValue} este período vs. ${worst.previousValue} el período anterior (${worst.deltaPct}%).`,
        `Conexiones totales del equipo: ${teamTotals.conexion} (período anterior: ${previousTeamTotals.conexion}) — usar para juzgar si la caída es por menor volumen o por peor conversión.`,
      ],
    });
  }

  return findings.slice(0, 4);
}

const INSIGHTS_TOOL: OpenRouterToolDef = {
  type: "function",
  function: {
    name: "write_insight_cards",
    description: "Redacta el texto de cada alerta del AI Manager a partir de hallazgos ya calculados.",
    parameters: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              findingId: { type: "string", description: "El id del hallazgo que estás redactando, tal cual te lo pasé." },
              title: { type: "string", description: "Título corto, 5-8 palabras." },
              body: { type: "string", description: "1-2 oraciones explicando el hallazgo con los números reales que te pasé." },
              recommendation: { type: "string", description: "Una recomendación concreta y accionable, 1 oración." },
            },
            required: ["findingId", "title", "body", "recommendation"],
          },
        },
      },
      required: ["cards"],
    },
  },
};

export interface AiInsightCard {
  id: string;
  type: "atencion" | "oportunidad" | "tendencia";
  agentName: string | null;
  title: string;
  body: string;
  recommendation: string;
}

export type AiManagerResult = { ok: true; cards: AiInsightCard[]; generatedAt: string; cached: boolean } | { ok: false; error: string };

async function writeCardsWithAI(apiKey: string, findings: AiFinding[]): Promise<AiInsightCard[]> {
  const context = findings
    .map((f) => `Hallazgo ${f.id} (tipo: ${f.type}${f.agentName ? `, agente: ${f.agentName}` : ""}):\n${f.contextLines.join("\n")}`)
    .join("\n\n");

  const result = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0.4,
    tools: [INSIGHTS_TOOL],
    messages: [
      {
        role: "system",
        content:
          "Sos el AI Manager de un CRM de seguros — analizás el rendimiento de setters (agentes de ventas) para el owner/admin de la agencia. Te paso hallazgos YA CALCULADOS (nunca recalcules ni inventes un número que no esté ahí) y para cada uno llamás a write_insight_cards con un título, un cuerpo de 1-2 oraciones y una recomendación concreta. Tono directo y profesional, en español.",
      },
      { role: "user", content: context },
    ],
  });

  const call = result.toolCalls[0];
  if (!call) return findings.map((f) => ({ id: f.id, type: f.type, agentName: f.agentName, title: f.type, body: f.contextLines.join(" "), recommendation: "" }));

  let parsed: { cards?: { findingId: string; title: string; body: string; recommendation: string }[] };
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    parsed = { cards: [] };
  }

  const byFindingId = new Map((parsed.cards ?? []).map((c) => [c.findingId, c]));
  return findings.map((f) => {
    const card = byFindingId.get(f.id);
    return { id: f.id, type: f.type, agentName: f.agentName, title: card?.title ?? f.type, body: card?.body ?? f.contextLines.join(" "), recommendation: card?.recommendation ?? "" };
  });
}

/** Solo lectura del caché (kpi_ai_insights) — NUNCA dispara una llamada a
 * OpenRouter. La pestaña Performance llama esto al cargar; el análisis se
 * genera solo con el botón "Actualizar análisis" (generateAiManagerInsightsAction). */
export async function getCachedAiManagerInsightsAction(periodMonth: string, weekNumber?: number): Promise<AiManagerResult> {
  const access = await requireAgencyAccessOrError();
  if (!access.ok) return access;

  const supabase = await createClient();
  let query = supabase.from("kpi_ai_insights").select("insights, generated_at").eq("workspace_id", access.workspaceId).eq("period_month", periodMonth);
  query = weekNumber ? query.eq("week_number", weekNumber) : query.is("week_number", null);
  const { data } = await query.maybeSingle();

  if (!data) return { ok: true, cards: [], generatedAt: "", cached: false };
  return { ok: true, cards: (data.insights as AiInsightCard[]) ?? [], generatedAt: data.generated_at as string, cached: true };
}

/** Genera (o regenera) el análisis y lo cachea — única función de este
 * archivo que llama a OpenRouter. Gateada a owner/admin real de la agencia. */
export async function generateAiManagerInsightsAction(periodMonth: string, weekNumber?: number): Promise<AiManagerResult> {
  const access = await requireAgencyAccessOrError();
  if (!access.ok) return access;

  const serviceClient = createServiceRoleClient();
  const credentials = await resolveOpenRouterApiKey(serviceClient, access.workspaceId, "generar el análisis del AI Manager");
  if (!credentials.ok) return { ok: false, error: credentials.error };

  const { current, previous } = await getCurrentAndPreviousEntries(periodMonth, weekNumber);
  const findings = buildFindings(current, previous);

  const cards: AiInsightCard[] =
    findings.length === 0
      ? [{ id: "sin-alertas", type: "tendencia", agentName: null, title: "Sin alertas por ahora", body: "El equipo está funcionando dentro de parámetros normales para este período — ninguna métrica muestra una caída ni una diferencia significativa vs. el equipo.", recommendation: "" }]
      : await writeCardsWithAI(credentials.apiKey, findings);

  const generatedAt = new Date().toISOString();
  await serviceClient
    .from("kpi_ai_insights")
    .upsert(
      { workspace_id: access.workspaceId, period_month: periodMonth, week_number: weekNumber ?? null, insights: cards, generated_at: generatedAt },
      { onConflict: weekNumber ? "workspace_id,period_month,week_number" : "workspace_id,period_month" },
    );

  return { ok: true, cards, generatedAt, cached: false };
}

export type AskAiResult = { ok: true; answer: string } | { ok: false; error: string };

/** "Preguntale a Growth AI" — sin tool-calling de escritura, sin memoria de
 * conversación (pregunta-respuesta simple). El contexto es SIEMPRE el
 * ranking real ya calculado del período pedido, nunca datos inventados. */
export async function askGrowthAiAction(question: string, periodMonth: string, weekNumber?: number): Promise<AskAiResult> {
  const access = await requireAgencyAccessOrError();
  if (!access.ok) return access;
  if (!question.trim()) return { ok: false, error: "Escribí una pregunta." };

  const serviceClient = createServiceRoleClient();
  const credentials = await resolveOpenRouterApiKey(serviceClient, access.workspaceId, "usar Growth AI");
  if (!credentials.ok) return { ok: false, error: credentials.error };

  const { current, previous } = await getCurrentAndPreviousEntries(periodMonth, weekNumber);
  const teamTotals = totalsFromEntries(current);
  const previousTeamTotals = totalsFromEntries(previous);
  const bySetter = groupBySetter(current);

  const ranking = [...bySetter.entries()]
    .map(([, bucket]) => {
      const t = totalsFromEntries(bucket.rows);
      return { name: bucket.setterName, advisor: bucket.advisorName, ...t, conversion: conversionRate(t), agendas: agendas(t) };
    })
    .sort((a, b) => b.conversion - a.conversion);

  const periodLabel = weekNumber ? weekLabel(periodMonth, weekNumber) : monthLabel(periodMonth);
  const context = [
    `Período: ${periodLabel}`,
    `Totales del equipo: conexiones ${teamTotals.conexion}, aceptadas ${teamTotals.conexionesAceptadas}, respuestas ${teamTotals.respuestasPrimerMensaje}, en conversación ${teamTotals.enConversacion}, agendas ${agendas(teamTotals)}, calificadas ${teamTotals.calificadas} (período anterior: conexiones ${previousTeamTotals.conexion}, calificadas ${previousTeamTotals.calificadas}).`,
    `Ranking por setter (conversión = calificadas/aceptadas):`,
    ...ranking.map((r) => `- ${r.name} (asesor: ${r.advisor}): conexiones ${r.conexion}, aceptadas ${r.conexionesAceptadas}, respuestas ${r.respuestasPrimerMensaje}, agendas ${r.agendas}, calificadas ${r.calificadas}, conversión ${r.conversion}%`),
  ].join("\n");

  const result = await complete({
    apiKey: credentials.apiKey,
    models: MODEL_CHAIN,
    temperature: 0.3,
    tools: [],
    messages: [
      {
        role: "system",
        content:
          "Sos Growth AI, el analista de performance de un CRM de seguros. Respondés preguntas del owner/admin de la agencia sobre el rendimiento de sus setters, usando EXCLUSIVAMENTE los datos reales que te paso — nunca inventes nombres, números ni conclusiones que no se desprendan directamente de esos datos. Si la pregunta no se puede responder con los datos disponibles, decilo explícitamente en vez de inventar. Respuesta corta (2-4 oraciones), en español.",
      },
      { role: "user", content: `Datos disponibles:\n${context}\n\nPregunta: ${question.trim()}` },
    ],
  });

  const answer = result.message?.content?.trim();
  if (!answer) return { ok: false, error: "No se pudo generar una respuesta ahora — probá de nuevo." };
  return { ok: true, answer };
}
