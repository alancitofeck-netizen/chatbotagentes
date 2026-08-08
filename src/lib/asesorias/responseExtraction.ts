/** Extrae las respuestas del Meeting OS (`meetingProject.template` +
 * `.session`, tal cual los recibe /api/asesorias/[asesoriaId]/sync en cada
 * autoguardado) a filas normalizadas para `asesoria_responses`. Puro, sin
 * I/O — el llamador (sync/route.ts) hace el upsert.
 *
 * Recorre `template.slides` y mapea por `type` según cómo el propio Meeting
 * OS (sin tocar) escribe cada respuesta — ver meetingOsTemplate.ts:
 * - textQuestion/money: `session.responses[slide.id]` tal cual.
 * - choice2: `session.responses[slide.id]` es "A"/"B" → se resuelve a
 *   optionA/optionB.text.
 * - options: `session.responses[slide.id]` es el id de la opción → se
 *   resuelve a items[].label.
 * - ranking: `session.responses[slide.id]` ya es string[] de etiquetas.
 * - feedback: texto en `session.responses[slide.id]` + `session.feedback.rating`.
 * - recapValue: dos respuestas en `session.responses[slide.id+"-q1"/"-q2"]`.
 * - criteria/decisionMakers: NO usan `session.responses` — el archivo
 *   escribe directo a `session.decisionCriteria`/`session.decisionMakers`.
 * - el resto de los tipos (cover, statement, stat, list, media, embed,
 *   twostep, summary, calendly, referralMessage, referralOffer,
 *   resourceGrid...) son de solo lectura para el prospecto, se ignoran.
 *
 * Suma 3 fuentes que no cuelgan de una diapositiva: `session.nextStep`,
 * `session.referrals`, y `session.preMeeting` (datos del cliente capturados
 * en el Meeting Router antes de empezar).
 */

export type AsesoriaAnswerType =
  | "text"
  | "money"
  | "choice"
  | "multi_choice"
  | "ranking"
  | "feedback"
  | "decision_makers"
  | "next_step"
  | "referral"
  | "prospect_field";

export interface ExtractedResponse {
  questionKey: string;
  question: string;
  answer: unknown;
  answerType: AsesoriaAnswerType;
  slideNumber: number | null;
  section: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "").trim();
}
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

const PRE_MEETING_FIELD_LABELS: Record<string, string> = {
  "general.company": "Empresa",
  "general.profession": "Profesión",
  "general.age": "Edad",
  "general.maritalStatus": "Estado civil",
  "general.dependents": "Dependientes / hijos",
  "general.location": "Ciudad / país",
  "commercial.source": "Fuente",
  "commercial.referredBy": "Referido por",
  "commercial.setter": "Setter responsable",
  "commercial.productInterest": "Producto de interés",
  "commercial.declaredObjective": "Objetivo declarado",
  "commercial.meetingReason": "Motivo de la cita",
  "financial.incomeRange": "Rango de ingresos",
  "financial.estimatedCapacity": "Capacidad estimada",
  "financial.savings": "Ahorros / inversiones",
  "financial.currentCoverage": "Coberturas actuales",
  "financial.currentProduct": "Producto actual",
  "financial.timeHorizon": "Horizonte temporal",
};

export function extractAsesoriaResponses(template: unknown, session: unknown): ExtractedResponse[] {
  const out: ExtractedResponse[] = [];
  const slides = asArray(asRecord(template).slides);
  const sessionRec = asRecord(session);
  const responses = asRecord(sessionRec.responses);

  function push(questionKey: string, question: string, answer: unknown, answerType: AsesoriaAnswerType, slideNumber: number | null, section: string | null) {
    if (isEmpty(answer)) return;
    const cleanQuestion = stripHtml(question);
    if (!cleanQuestion) return;
    out.push({ questionKey, question: cleanQuestion, answer, answerType, slideNumber, section });
  }

  slides.forEach((raw, idx) => {
    const s = asRecord(raw);
    if (s.enabled === false) return;
    const id = asString(s.id);
    if (!id) return;
    const title = asString(s.title);
    const section = typeof s.section === "string" ? s.section : null;

    switch (s.type) {
      case "textQuestion":
        push(id, title, responses[id], "text", idx, section);
        break;
      case "money":
        push(id, title, responses[id], "money", idx, section);
        break;
      case "choice2": {
        const raw2 = responses[id];
        const optionA = asRecord(s.optionA);
        const optionB = asRecord(s.optionB);
        const label = raw2 === "A" ? asString(optionA.text) : raw2 === "B" ? asString(optionB.text) : undefined;
        push(id, title, label ? stripHtml(label) : raw2, "choice", idx, section);
        break;
      }
      case "options": {
        const raw2 = responses[id];
        const item = asArray(s.items).map(asRecord).find((it) => it.id === raw2);
        push(id, title, item ? item.label : raw2, "choice", idx, section);
        break;
      }
      case "ranking":
        push(id, title, responses[id], "ranking", idx, section);
        break;
      case "feedback": {
        const text = responses[id];
        const rating = asRecord(sessionRec.feedback).rating;
        if (!isEmpty(text) || (typeof rating === "number" && rating > 0)) {
          push(id, title, { text: isEmpty(text) ? null : text, rating: typeof rating === "number" ? rating : null }, "feedback", idx, section);
        }
        break;
      }
      case "recapValue": {
        const q1 = asString(s.question1);
        const q2 = asString(s.question2);
        if (q1) push(`${id}:q1`, q1, responses[`${id}-q1`], "text", idx, section);
        if (q2) push(`${id}:q2`, q2, responses[`${id}-q2`], "text", idx, section);
        break;
      }
      case "criteria": {
        const dc = asArray(sessionRec.decisionCriteria).map(asString).filter(Boolean);
        push(id, title, dc, "multi_choice", idx, section);
        break;
      }
      case "decisionMakers": {
        const dm = asArray(sessionRec.decisionMakers);
        push(id, title, dm, "decision_makers", idx, section);
        break;
      }
      default:
        break; // diapositiva de solo lectura para el prospecto — nada que extraer
    }
  });

  const nextStep = asRecord(sessionRec.nextStep);
  if (asString(nextStep.date) || asString(nextStep.objective) || nextStep.scheduled === true) {
    push("nextStep", "Próximo paso acordado", nextStep, "next_step", null, "Próximo paso");
  }

  const referrals = asArray(sessionRec.referrals)
    .map(asRecord)
    .filter((r) => asString(r.name) || asString(r.phone));
  push("referrals", "Referidos compartidos", referrals, "referral", null, "Referidos");

  const preMeeting = asRecord(sessionRec.preMeeting);
  for (const [path, label] of Object.entries(PRE_MEETING_FIELD_LABELS)) {
    const [group, key] = path.split(".");
    const value = asRecord(preMeeting[group])[key];
    push(`preMeeting.${path}`, label, value, "prospect_field", null, "Datos del cliente");
  }
  const rawContext = asString(preMeeting.rawContext);
  if (rawContext.trim()) {
    push("preMeeting.rawContext", "Contexto previo (notas del asesor)", rawContext.trim(), "prospect_field", null, "Datos del cliente");
  }

  return out;
}
