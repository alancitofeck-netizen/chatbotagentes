/**
 * Hardcoded business-hours config for `check_agenda_availability` — no
 * `business_hours` table exists (scope cut flagged in the Motor de IA plan,
 * not silently assumed). Argentina doesn't observe DST since 2009 (fixed
 * UTC-3 year-round), so a plain numeric offset is correct here without a
 * full IANA timezone conversion.
 */
export const BUSINESS_UTC_OFFSET_HOURS = 3; // America/Argentina/Buenos_Aires = UTC-3
export const BUSINESS_HOURS_START = 9;
export const BUSINESS_HOURS_END = 18;
export const BUSINESS_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri (Date#getUTCDay(): 0=Sun)
export const SLOT_STEP_MINUTES = 30;
export const DEFAULT_DURATION_MINUTES = 30;
