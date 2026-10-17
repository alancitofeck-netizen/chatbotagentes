/** Lógica pura (sin Supabase ni red) para interpretar una fila de la hoja de agendas — la usan
 * tanto el runner (sync real) como la vista previa del panel "Conectar hoja de agendas", así las
 * dos cuentan exactamente lo mismo. Testeada en rowParsing.test.ts. */

/** Solo dígitos, sin espacios, guiones ni "+" — la clave para no duplicar leads (pedido explícito). */
export function phoneDigits(raw: string | undefined | null): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** Variantes con las que un mismo número puede estar guardado en `contacts.phone` (con o sin "+",
 * y el "1" de celular mexicano que WhatsApp/YCloud a veces agregan) — para buscar el contacto
 * existente sin importar con qué formato entró por otro canal. */
export function phoneLookupCandidates(digits: string): string[] {
  if (!digits) return [];
  const forms = new Set<string>([digits]);
  if (digits.length === 13 && digits.startsWith("521")) forms.add(`52${digits.slice(3)}`);
  if (digits.length === 12 && digits.startsWith("52")) forms.add(`521${digits.slice(2)}`);
  if (digits.length === 10) {
    forms.add(`52${digits}`);
    forms.add(`521${digits}`);
  }
  return [...forms].flatMap((d) => [d, `+${d}`]);
}

export interface ParsedSheetDate {
  /** Instante UTC de la cita (00:00 local del día si `sinHora`). */
  date: Date;
  sinHora: boolean;
}

function parseTime(raw: string): { hour: number; minute: number } | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const serial = Number(trimmed);
  if (!Number.isNaN(serial) && serial >= 0 && serial < 1) {
    const totalMinutes = Math.round(serial * 24 * 60);
    return { hour: Math.floor(totalMinutes / 60) % 24, minute: totalMinutes % 60 };
  }
  const m = trimmed.match(/^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?|hs?|hrs?)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const suffix = m[3]?.replace(/[\s.]/g, "");
  if (!m[2] && !suffix) return null; // "10" solo es ambiguo — no se inventa una hora
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Fecha (serial de Sheets, dd/mm/aaaa, dd/mm sin año, aaaa-mm-dd) + hora (HH:MM, "4 pm", fracción
 * de día). `utcOffsetMinutes` sigue la convención de Date#getTimezoneOffset (México = 360,
 * Argentina = 180): la hora de la hoja es hora local de quien la carga. dd/mm sin año → año de
 * `now`. Hora vacía o ilegible → `sinHora` (nunca se inventa un horario). Fecha inválida → null. */
export function parseSheetDate(dateValue: string, timeValue: string | undefined, utcOffsetMinutes: number, now: Date = new Date()): ParsedSheetDate | null {
  const trimmed = String(dateValue ?? "").trim();
  if (!trimmed) return null;

  let year: number;
  let month: number; // 0-based
  let day: number;
  let embeddedTime: { hour: number; minute: number } | null = null;

  const serial = Number(trimmed);
  if (!Number.isNaN(serial) && serial > 20000 && serial < 80000) {
    const wholeDays = Math.floor(serial);
    const epoch = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86400000);
    year = epoch.getUTCFullYear();
    month = epoch.getUTCMonth();
    day = epoch.getUTCDate();
    const fraction = serial - wholeDays;
    if (fraction > 0) embeddedTime = parseTime(String(fraction));
  } else {
    const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
    const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
    if (ymd) {
      year = Number(ymd[1]);
      month = Number(ymd[2]) - 1;
      day = Number(ymd[3]);
    } else if (dmy) {
      day = Number(dmy[1]);
      month = Number(dmy[2]) - 1;
      const y = dmy[3];
      year = y ? Number(y.length === 2 ? `20${y}` : y) : now.getFullYear();
    } else {
      return null;
    }
  }

  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  // Rechaza fechas que JS "corrige" solo (31/02 → 3 de marzo).
  const check = new Date(Date.UTC(year, month, day));
  if (check.getUTCMonth() !== month || check.getUTCDate() !== day) return null;

  const time = (timeValue ? parseTime(String(timeValue)) : null) ?? embeddedTime;
  const utcMs = Date.UTC(year, month, day, time?.hour ?? 0, time?.minute ?? 0, 0) + utcOffsetMinutes * 60000;
  return { date: new Date(utcMs), sinHora: !time };
}

/** "Sí"/"x"/"✓"/"contactado" → true, "No" → false, cualquier otra cosa (o vacío) → null. */
export function parseContactado(raw: string | undefined): boolean | null {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!v) return null;
  if (["si", "s", "x", "✓", "✔", "true", "yes", "1", "contactado", "contactada", "ok"].includes(v)) return true;
  if (["no", "n", "false", "0", "pendiente"].includes(v)) return false;
  return null;
}

/** Identidad estable de una cita de la hoja: teléfono + día. No se usa el número de fila como
 * identidad porque borrar una fila corre todas las de abajo (pisaría la cita de otra persona);
 * el número de fila se guarda aparte, solo para escribir el estado de vuelta. */
export function appointmentRowKey(digits: string, date: Date, utcOffsetMinutes: number): string {
  const local = new Date(date.getTime() - utcOffsetMinutes * 60000);
  return `k:${digits}|${local.toISOString().slice(0, 10)}`;
}
