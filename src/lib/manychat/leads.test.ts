import { describe, expect, it } from "vitest";
import { channelBreakdown, contentRanking, detectChannel, detectStage, funnel, normalizeRows, parseDate } from "./leads";

const row = (overrides: Record<string, string>) => ({
  Fecha: "2026-10-01",
  Canal: "Instagram Reels",
  Etapa: "Nuevo",
  Contenido: "3 errores con tus impuestos",
  ...overrides,
});

describe("detectChannel", () => {
  it("reconoce canales por alias", () => {
    expect(detectChannel("Instagram Reels")).toBe("reel");
    expect(detectChannel("WhatsApp")).toBe("whatsapp");
    expect(detectChannel("")).toBe("otros");
  });

  it("sin canal explícito, mira las pistas", () => {
    expect(detectChannel("", "", "Anuncio: seguro de vida", "", "")).toBe("meta_ads");
  });
});

describe("detectStage", () => {
  it("ordena las etapas por lo más avanzado que aparezca", () => {
    expect(detectStage("Cliente")).toBe("cliente");
    expect(detectStage("Cita agendada")).toBe("cita");
    expect(detectStage("Calificado")).toBe("calificado");
    expect(detectStage("Seguimiento")).toBe("contactado");
    expect(detectStage("")).toBe("nuevo");
  });
});

describe("parseDate", () => {
  it("fecha sin hora es medianoche local", () => {
    expect(parseDate("2026-10-01")).toBe(new Date(2026, 9, 1).getTime());
  });

  it("acepta formato día/mes/año", () => {
    expect(parseDate("01/10/2026")).toBe(new Date(2026, 9, 1).getTime());
  });

  it("valor vacío o inválido no tiene fecha", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("no es fecha")).toBeNull();
  });
});

describe("normalizeRows", () => {
  it("cuenta filas sin fecha aparte", () => {
    const sheet = normalizeRows([row({}), row({ Fecha: "" })]);
    expect(sheet.leads).toHaveLength(1);
    expect(sheet.skipped).toBe(1);
  });

  it("sin columna de etapa, todos quedan como nuevos", () => {
    const sheet = normalizeRows([{ Fecha: "2026-10-01", Canal: "WhatsApp" }]);
    expect(sheet.hasStages).toBe(false);
    expect(sheet.leads[0].etapa).toBe("nuevo");
  });
});

describe("funnel", () => {
  const leads = normalizeRows([
    row({ Etapa: "Nuevo" }),
    row({ Etapa: "Contactado" }),
    row({ Etapa: "Calificado" }),
    row({ Etapa: "Cita" }),
  ]).leads;

  it("cuenta acumulado: cada etapa incluye a las más avanzadas", () => {
    const steps = funnel(leads, true);
    expect(steps.map((s) => s.count)).toEqual([4, 3, 2, 1, 0]);
  });

  it("calcula el porcentaje que pasa de una etapa a la siguiente", () => {
    const steps = funnel(leads, true);
    expect(steps[1].passRate).toBe(75);
    expect(steps[2].passRate).toBeCloseTo(66.67, 1);
  });

  it("sin datos de citas, la etapa Cita queda como no disponible", () => {
    const steps = funnel(leads, false);
    expect(steps[3].na).toBe(true);
  });
});

describe("channelBreakdown y contentRanking", () => {
  const leads = normalizeRows([
    row({ Etapa: "Cita" }),
    row({ Etapa: "Nuevo" }),
    row({ Canal: "WhatsApp", Contenido: "Botón en la bio", Etapa: "Cliente", Valor: "100" }),
  ]).leads;

  it("agrupa por canal y ordena por cantidad", () => {
    const channels = channelBreakdown(leads);
    expect(channels[0].id).toBe("reel");
    expect(channels[0].leads).toBe(2);
    expect(channels[1].clientes).toBe(1);
  });

  it("el % que pasa a cita incluye a los clientes", () => {
    const ranking = contentRanking(leads, true);
    const reel = ranking.find((r) => r.canal === "reel")!;
    expect(reel.pasaCita).toBe(50);
    const wa = ranking.find((r) => r.canal === "whatsapp")!;
    expect(wa.clientes).toBe(1);
  });
});
