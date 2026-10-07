/** Leads de ManyChat leídos desde la hoja del workspace, y las métricas del tablero
 * (embudo, canales y contenido). Portado del tablero HTML anterior
 * (src/lib/manychat/dashboardTemplate.ts) para que los números coincidan. Todo es
 * puro: no toca la red ni la base. */

export type StageId = "nuevo" | "contactado" | "calificado" | "cita" | "cliente";

export const STAGES: { id: StageId; label: string; color: string }[] = [
  { id: "nuevo", label: "Nuevo", color: "var(--s-nuevo)" },
  { id: "contactado", label: "Contactado", color: "var(--s-contactado)" },
  { id: "calificado", label: "Calificado", color: "var(--s-calificado)" },
  { id: "cita", label: "Cita", color: "var(--s-cita)" },
  { id: "cliente", label: "Cliente", color: "var(--s-cliente)" },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, i])) as Record<StageId, number>;

export interface ChannelDef {
  id: string;
  nombre: string;
  corto: string;
  /** Color de marca o de canal; se usa tal cual en el tablero. */
  color: string;
  alias: string[];
}

export const CHANNELS: ChannelDef[] = [
  { id: "reel", nombre: "Instagram Reels", corto: "Reels", color: "#D6246E", alias: ["reel", "reels", "instagram reel", "ig reel", "comentario reel", "comentarios"] },
  { id: "historia", nombre: "Instagram Stories", corto: "Stories", color: "#E08E00", alias: ["historia", "historias", "story", "stories", "instagram story", "instagram stories"] },
  { id: "instagram", nombre: "Instagram", corto: "Instagram", color: "#C21A6B", alias: ["instagram", "ig", "insta"] },
  { id: "dm", nombre: "DM", corto: "DM", color: "#7C3AED", alias: ["dm", "dms", "directo", "mensaje directo", "instagram dm", "keyword", "palabra clave"] },
  { id: "whatsapp", nombre: "WhatsApp", corto: "WhatsApp", color: "#1FA855", alias: ["whatsapp", "wa", "wpp", "whats app"] },
  { id: "meta_ads", nombre: "Meta Ads", corto: "Meta Ads", color: "#0866FF", alias: ["meta ads", "meta", "ads", "anuncio", "anuncios", "facebook ads", "fb ads", "ctwa", "instagram ads"] },
  { id: "tiktok", nombre: "TikTok", corto: "TikTok", color: "#0097A7", alias: ["tiktok", "tik tok"] },
  { id: "otros", nombre: "Otros", corto: "Otros", color: "#8a9aa8", alias: ["otros", "otro", "other"] },
];

export const CHANNEL_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));

/** Nombres de columna que reconoce la hoja (en minúsculas, sin acentos). */
const COLUMN_ALIASES: Record<string, string[]> = {
  id: ["id", "subscriber id", "user id", "contact id", "mc id", "manychat id"],
  fechaCita: ["fecha cita", "fecha de cita", "appointment date", "appointment", "cita"],
  ultima: ["ultima interaccion", "last interaction", "ultima actividad", "last seen", "last activity", "actualizado", "updated"],
  fecha: ["fecha", "date", "subscribed", "suscrito", "created", "creado", "fecha alta", "timestamp", "opted in"],
  nombre: ["nombre", "name", "full name", "nombre completo", "first name"],
  telefono: ["telefono", "phone", "whatsapp phone", "celular", "movil"],
  usuario: ["usuario", "username", "ig username", "instagram username", "instagram"],
  email: ["email", "correo", "e-mail", "mail"],
  notas: ["notas", "nota", "notes", "observaciones"],
  canal: ["canal", "source", "origen", "channel", "fuente"],
  campana: ["campana", "campaign", "utm campaign", "anuncio", "ad name"],
  contenido: ["contenido", "content", "post", "reel", "historia", "story", "flujo", "flow", "growth tool", "pieza", "recurso"],
  keyword: ["palabra clave", "keyword", "trigger", "disparador"],
  etapa: ["etapa", "estado", "stage", "status", "pipeline"],
  tags: ["tags", "etiquetas"],
  valor: ["valor", "monto", "amount", "value", "venta", "revenue", "ingreso"],
};

export function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const hasWord = (text: string, word: string) => (` ${text} `).includes(` ${word} `);

export function mapColumns(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  const pairs = headers.map((h) => [h, norm(h)] as const);
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const hit = pairs.find(([h, n]) => !used.has(h) && aliases.includes(n));
    if (hit) {
      map[key] = hit[0];
      used.add(hit[0]);
    }
  }
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (map[key]) continue;
    const hit = pairs.find(([h, n]) => !used.has(h) && aliases.some((a) => hasWord(n, a) || n.startsWith(a)));
    if (hit) {
      map[key] = hit[0];
      used.add(hit[0]);
    }
  }
  return map;
}

export function detectChannel(canal: string, ...hints: string[]): string {
  const t = norm(canal);
  if (t) {
    for (const c of CHANNELS) if (c.alias.includes(t) || t === c.id.replace("_", " ")) return c.id;
    for (const c of CHANNELS) if (c.alias.some((a) => hasWord(t, a))) return c.id;
    return "otros";
  }
  const h = norm(hints.join(" "));
  for (const id of ["tiktok", "meta_ads", "whatsapp", "reel", "historia", "dm"]) {
    if (CHANNEL_BY_ID[id].alias.some((a) => hasWord(h, a))) return id;
  }
  return "otros";
}

export function detectStage(value: string, tags?: string): StageId {
  const t = norm(`${value} ${tags ?? ""}`);
  if (/cliente|client|compr|vendid|venta cerrada|won|ganad|pagad/.test(t)) return "cliente";
  if (/\bcita\b|agendad|appointment|meeting|reunion|booked|llamada/.test(t)) return "cita";
  if (/calific|qualif|interesad|\bhot\b|caliente|oportunidad/.test(t)) return "calificado";
  if (/contact|seguimiento|follow|respond|conversacion/.test(t)) return "contactado";
  return "nuevo";
}

/** Fecha en ms. Sin hora se asume medianoche, como en el tablero anterior. */
export function parseDate(value: unknown): number | null {
  if (!value) return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
  }
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = new Date(+year, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function parseNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  let s = String(value).replace(/[^\d,.\-]/g, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

export interface Lead {
  id: string;
  canal: string;
  contenido: string;
  campana: string;
  etapa: StageId;
  creado: number;
  valor: number;
}

export interface NormalizedSheet {
  leads: Lead[];
  skipped: number;
  hasStages: boolean;
  hasCitas: boolean;
}

/** Convierte las filas (`{encabezado: valor}`) en leads. Las filas sin fecha válida se cuentan aparte. */
export function normalizeRows(rows: Record<string, string>[]): NormalizedSheet {
  if (rows.length === 0) return { leads: [], skipped: 0, hasStages: false, hasCitas: false };
  const cols = mapColumns(Object.keys(rows[0]));
  let skipped = 0;
  const leads: Lead[] = [];
  rows.forEach((row, index) => {
    const get = (key: string) => (cols[key] ? String(row[cols[key]] ?? "").trim() : "");
    const creado = parseDate(get("fecha"));
    if (creado === null) {
      skipped += 1;
      return;
    }
    const contenido = get("contenido") || get("campana") || (get("keyword") ? `Palabra clave: ${get("keyword")}` : "Sin identificar");
    leads.push({
      id: get("id") || `row-${index}`,
      canal: detectChannel(get("canal"), get("tags"), contenido, get("keyword"), get("campana")),
      contenido,
      campana: get("contenido") ? get("campana") : "",
      etapa: detectStage(get("etapa"), get("tags")),
      creado,
      valor: parseNumber(get("valor")),
    });
  });
  return {
    leads,
    skipped,
    hasStages: Boolean(cols.etapa || cols.tags),
    hasCitas: Boolean(cols.fechaCita) || leads.some((l) => l.etapa === "cita"),
  };
}

export function reached(lead: Lead, stage: StageId): boolean {
  return STAGE_INDEX[lead.etapa] >= STAGE_INDEX[stage];
}

export function ratio(part: number, whole: number): number {
  return whole ? (part / whole) * 100 : 0;
}

export interface FunnelStep {
  id: StageId;
  label: string;
  count: number;
  /** % de la etapa anterior que llega a esta. Null en la primera. */
  passRate: number | null;
  /** % del total de leads. */
  share: number;
  na: boolean;
}

/** Embudo acumulado: cada etapa cuenta a los que llegaron a ella. Sin etapa "cita" en la fuente, se marca como sin datos. */
export function funnel(leads: Lead[], hasCitas: boolean): FunnelStep[] {
  const total = leads.length;
  const steps: FunnelStep[] = [];
  let previous: number | null = null;
  for (const stage of STAGES) {
    const na = stage.id === "cita" && !hasCitas;
    const count = na ? 0 : leads.filter((l) => reached(l, stage.id)).length;
    steps.push({
      id: stage.id,
      label: stage.label,
      count,
      passRate: na || previous === null ? null : ratio(count, previous),
      share: ratio(count, total),
      na,
    });
    if (!na) previous = count;
  }
  return steps;
}

export interface ChannelStat {
  id: string;
  nombre: string;
  color: string;
  leads: number;
  clientes: number;
  /** Cantidad de leads por etapa actual (para la barra apilada). */
  porEtapa: Record<StageId, number>;
}

/** Leads por canal, con la etapa en la que están hoy. Ordenado por cantidad. */
export function channelBreakdown(leads: Lead[]): ChannelStat[] {
  const byChannel = new Map<string, Lead[]>();
  for (const lead of leads) {
    byChannel.set(lead.canal, [...(byChannel.get(lead.canal) ?? []), lead]);
  }
  return [...byChannel.entries()]
    .map(([id, list]) => {
      const porEtapa = Object.fromEntries(STAGES.map((s) => [s.id, 0])) as Record<StageId, number>;
      for (const l of list) porEtapa[l.etapa] += 1;
      const def = CHANNEL_BY_ID[id] ?? CHANNEL_BY_ID.otros;
      return { id, nombre: def.nombre, color: def.color, leads: list.length, clientes: list.filter((l) => l.etapa === "cliente").length, porEtapa };
    })
    .sort((a, b) => b.leads - a.leads);
}

export interface ContentStat {
  key: string;
  contenido: string;
  canal: string;
  canalNombre: string;
  canalColor: string;
  leads: number;
  citas: number;
  clientes: number;
  /** % de leads que llegan a cita (la métrica de "pasa a cita" de la referencia). */
  pasaCita: number;
  conversion: number;
}

/** Ranking de contenido (reel, historia, palabra clave, anuncio, flujo), agrupado por pieza y canal. */
export function contentRanking(leads: Lead[], hasCitas: boolean): ContentStat[] {
  const agg = new Map<string, { contenido: string; canal: string; leads: number; citas: number; clientes: number }>();
  for (const l of leads) {
    const key = `${l.contenido}|${l.canal}`;
    const row = agg.get(key) ?? { contenido: l.contenido, canal: l.canal, leads: 0, citas: 0, clientes: 0 };
    row.leads += 1;
    if (hasCitas && reached(l, "cita")) row.citas += 1;
    if (l.etapa === "cliente") row.clientes += 1;
    agg.set(key, row);
  }
  return [...agg.entries()].map(([key, r]) => {
    const def = CHANNEL_BY_ID[r.canal] ?? CHANNEL_BY_ID.otros;
    return {
      key,
      contenido: r.contenido,
      canal: r.canal,
      canalNombre: def.nombre,
      canalColor: def.color,
      leads: r.leads,
      citas: r.citas,
      clientes: r.clientes,
      pasaCita: ratio(r.citas, r.leads),
      conversion: ratio(r.clientes, r.leads),
    };
  });
}
