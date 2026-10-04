import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnansweredLeadsCard } from "./UnansweredLeadsCard";

const render = (conversations: { id: string; contactName: string; hoursWaiting: number }[]) =>
  renderToStaticMarkup(createElement(UnansweredLeadsCard, { conversations }));

describe("UnansweredLeadsCard", () => {
  it("no ocupa espacio cuando no hay conversaciones esperando", () => {
    expect(render([])).toBe("");
  });

  it("muestra el total, la espera más antigua y solo en mobile", () => {
    const html = render([
      { id: "1", contactName: "Ana", hoursWaiting: 2 },
      { id: "2", contactName: "Beto", hoursWaiting: 5 },
    ]);
    expect(html).toContain("2 leads sin responder");
    expect(html).toContain("La más antigua lleva 5 h");
    expect(html).toContain("md:hidden");
    expect(html).toContain('href="/inbox"');
  });

  it("usa el tono crítico a partir de 24h y muestra días", () => {
    const html = render([{ id: "1", contactName: "Carla", hoursWaiting: 30 }]);
    expect(html).toContain("1 lead sin responder");
    expect(html).toContain("La más antigua lleva 1 d");
    expect(html).toContain("bg-error-bg");
  });

  it("muestra como máximo 3 contactos, los de mayor espera primero", () => {
    const html = render([
      { id: "1", contactName: "Uno", hoursWaiting: 1 },
      { id: "2", contactName: "Dos", hoursWaiting: 4 },
      { id: "3", contactName: "Tres", hoursWaiting: 2 },
      { id: "4", contactName: "Cuatro", hoursWaiting: 9 },
    ]);
    expect(html).toContain("Cuatro");
    expect(html).not.toContain("Uno");
    expect(html.indexOf("Cuatro")).toBeLessThan(html.indexOf("Dos"));
  });
});
