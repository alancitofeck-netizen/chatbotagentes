import { describe, expect, it } from "vitest";
import { computeReplyActivity, dayKey, type OutboundMessage } from "./replyActivity";

// Buenos Aires es UTC-3 sin horario de verano: 12:00 local = 15:00 UTC.
const now = new Date("2026-10-06T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo: number, conversationId = "c1"): OutboundMessage => ({
  conversationId,
  createdAt: new Date(now.getTime() - daysAgo * DAY).toISOString(),
});

describe("computeReplyActivity", () => {
  it("sin mensajes: nada respondido y racha en 0", () => {
    expect(computeReplyActivity([], now)).toEqual({ answeredToday: 0, streakDays: 0 });
  });

  it("cuenta contactos distintos respondidos hoy, no mensajes", () => {
    const messages = [at(0, "a"), at(0, "a"), at(0, "b")];
    expect(computeReplyActivity(messages, now).answeredToday).toBe(2);
  });

  it("racha de días seguidos incluyendo hoy", () => {
    const messages = [at(0), at(1), at(2), at(3)];
    expect(computeReplyActivity(messages, now).streakDays).toBe(4);
  });

  it("si hoy todavía no respondiste, la racha sigue desde ayer", () => {
    const messages = [at(1), at(2)];
    expect(computeReplyActivity(messages, now)).toEqual({ answeredToday: 0, streakDays: 2 });
  });

  it("un hueco corta la racha", () => {
    const messages = [at(0), at(2), at(3)];
    expect(computeReplyActivity(messages, now).streakDays).toBe(1);
  });

  it("el día se cuenta en hora de Buenos Aires", () => {
    // 02:00 UTC del 6 es todavía el 5 en Buenos Aires.
    const late = new Date("2026-10-06T02:00:00Z");
    expect(dayKey(late)).toBe("2026-10-05");
  });
});
