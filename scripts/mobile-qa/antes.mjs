import fs from "node:fs";
import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";

const width = Number(process.argv[2] ?? 1440);
const height = Number(process.argv[3] ?? 900);
const outDir = path.resolve(process.argv[4] ?? "docs/mobile/antes-desktop");
fs.mkdirSync(outDir, { recursive: true });

const PROTECTED = [
  "/advisors", "/advisors/import", "/agenda", "/agentes-ia", "/agentes-ia/nuevo", "/analizador-cartera",
  "/aseguradoras", "/asesores", "/asesores/agendas", "/asesores/operaciones", "/asesores/performance",
  "/asesorias", "/asesorias/cierre", "/asesorias/presentacion", "/asesorias/referidos", "/asistente",
  "/ats", "/automations", "/automatizaciones", "/calendar", "/classroom", "/classroom/admin", "/cobranza",
  "/crm", "/dashboard", "/documents", "/extraccion-polizas", "/importar-exportar", "/inbox",
  "/inbox/contactos", "/inbox/etiquetas", "/inbox/plantillas", "/kpis", "/metas", "/mini-apps",
  "/operaciones", "/polizas", "/polizas/posibles-polizas", "/presentaciones", "/profile", "/settings",
  "/tasks", "/tasks/agenda", "/tasks/archived", "/tasks/favorites",
  // Dinámicas con datos disponibles en el workspace QA (o público/global)
  "/crm/agents/8fbb3aec-c256-4661-b4d2-a15159054f70",
  "/tasks/f3048840-104d-42b1-9411-5dc12bb044c8",
  "/classroom/cursos/como-crear-la-app-para-gancho",
  "/classroom/cursos/como-crear-la-app-para-gancho/29cc51c9-4c94-406c-b75e-afe46bcfa046",
  "/presentaciones/9ed887d5-9433-4186-81b5-2ca62c3c79b8",
];

const PUBLIC = [
  "/login", "/register", "/forgot-password", "/reset-password", "/confirm-email?email=qa@example.com",
  "/access-denied", "/apps/caballo-de-troya-7f3ca2", "/apps/cotizador-gmm-luis-morelos-94f13b",
];

function fileName(route) {
  const base = route.split("?")[0].replace(/^\//, "").replace(/[\/\[\]]+/g, "_").replace(/_+$/, "") || "home";
  return `${base}-${width}x${height}.png`;
}

async function shoot(page, route, log) {
  const entry = { route };
  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    for (let k = 0; k < 4; k++) {
      const skip = page.getByText("Omitir tutorial", { exact: true }).first();
      if (!(await skip.isVisible().catch(() => false))) break;
      await skip.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
    entry.landed = new URL(page.url()).pathname;
    entry.file = fileName(route);
    await page.screenshot({ path: path.join(outDir, entry.file), fullPage: false });
  } catch (e) {
    entry.error = e.message.slice(0, 160);
  }
  log.push(entry);
  console.log(route, "->", entry.landed ?? "ERROR", entry.error ? `(${entry.error.slice(0, 60)})` : "");
}

const log = [];
{
  const { browser, context } = await launch({ width, height });
  try {
    const page = await loginIn(context, "admin");
    for (const r of PROTECTED) await shoot(page, r, log);
  } finally {
    await browser.close();
  }
}
{
  const { browser, context } = await launch({ width, height });
  try {
    const page = await context.newPage();
    for (const r of PUBLIC) await shoot(page, r, log);
  } finally {
    await browser.close();
  }
}
fs.writeFileSync(path.join(outDir, `index-${width}x${height}.json`), JSON.stringify(log, null, 2));
console.log("done", log.length, "routes");
