/**
 * Business-hours gate for `ai_agents.business_hours`. No timezone library
 * exists in package.json (no date-fns-tz/luxon) — computing "is it business
 * hours right now" correctly for an arbitrary IANA timezone needs either a
 * new dependency or a small fixed-offset lookup. Given this product's real
 * usage is realistically single-country-per-workspace and none of the
 * timezones below observe DST, a static offset map is enough — same
 * simplification already used in src/lib/ai/tools/agendaConfig.ts.
 * Unrecognized timezone strings fall back to NOT gating (never crash the
 * Decision Engine over a bad config value), logged so it's visible.
 */

export interface BusinessHours {
  enabled: boolean;
  timezone: string;
  days: number[]; // 0=Sun..6=Sat, matches Date#getUTCDay()
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

const TIMEZONE_UTC_OFFSET_HOURS: Record<string, number> = {
  "America/Argentina/Buenos_Aires": -3,
  "America/Santiago": -4,
  "America/Sao_Paulo": -3,
  "America/Bogota": -5,
  "America/Mexico_City": -6,
  "America/New_York": -5,
  "America/Los_Angeles": -8,
  UTC: 0,
};

function parseHm(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function isOutsideBusinessHours(raw: unknown, now: Date = new Date()): boolean {
  const config = raw as Partial<BusinessHours> | null;
  if (!config?.enabled) return false;

  const offsetHours = config.timezone ? TIMEZONE_UTC_OFFSET_HOURS[config.timezone] : undefined;
  if (offsetHours === undefined) {
    console.warn(`[businessHours] unrecognized timezone "${config.timezone}" — not gating.`);
    return false;
  }

  const start = parseHm(config.start ?? "");
  const end = parseHm(config.end ?? "");
  if (!start || !end) return false;

  const localMs = now.getTime() + offsetHours * 60 * 60 * 1000;
  const local = new Date(localMs);
  const weekday = local.getUTCDay();
  const days = config.days ?? [1, 2, 3, 4, 5];
  if (!days.includes(weekday)) return true;

  const minutesNow = local.getUTCHours() * 60 + local.getUTCMinutes();
  const minutesStart = start.hour * 60 + start.minute;
  const minutesEnd = end.hour * 60 + end.minute;
  return minutesNow < minutesStart || minutesNow >= minutesEnd;
}
