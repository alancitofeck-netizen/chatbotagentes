// Inicio de Tareas en el celular, como la referencia (cuenta QA, modo oscuro y claro).
// Uso: node scripts/mobile-qa/tareas-inicio.mjs  (servidor en QA_BASE_URL, por defecto :3001)
import { chromium } from "playwright";
import { ensureQaAdminUserAndPassword } from "./qaUser.mjs";
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const OUT = process.env.QA_OUT ?? "docs/mobile/tareas-inicio";
const b = await chromium.launch({ channel: "chrome", headless: true });
const { email, password } = await ensureQaAdminUserAndPassword();
const out = {};

for (const theme of ["dark", "light"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-AR" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("gl-theme", t); } catch {} }, theme);
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  p.setDefaultTimeout(120_000);
  await p.goto(`${BASE}/login`); await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', password); await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login")); await p.waitForLoadState("networkidle").catch(() => {});
  await p.goto(`${BASE}/tasks`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) { const o = p.getByText(/Omitir tutorial|Saltar/, { exact: false }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
  await p.screenshot({ path: `${OUT}-${theme}.png` });

  if (theme === "dark") {
    const r = {};
    r.titulo = await p.getByRole("heading", { level: 1, name: "Tareas" }).isVisible();
    r.barraModuloOculta = !(await p.getByRole("button", { name: "Abrir grupos de tareas" }).isVisible());
    r.chips = await p.locator('[role="group"] button').allInnerTexts();
    await p.getByRole("button", { name: "Pendientes", exact: true }).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}-lista.png` });
    // Chip "Completadas" y vuelta a "Pendientes".
    await p.getByRole("button", { name: "Completadas", exact: true }).click(); await p.waitForTimeout(300);
    r.completadasPresionado = await p.getByRole("button", { name: "Completadas", exact: true }).getAttribute("aria-pressed");
    await p.getByRole("button", { name: "Pendientes", exact: true }).click();
    // Sugerencias IA abre el panel como hoja inferior.
    await p.getByRole("button", { name: "Sugerencias IA" }).click(); await p.waitForTimeout(400);
    r.panelIA = await p.getByRole("complementary").getByText("Asistente IA").isVisible();
    await p.screenshot({ path: `${OUT}-ia.png` });
    await p.getByRole("button", { name: "Cerrar panel de IA" }).last().click(); await p.waitForTimeout(300);
    // El FAB abre el menú de crear, con el ítem del tour.
    await p.getByRole("button", { name: "Crear" }).click(); await p.waitForTimeout(400);
    r.fabNuevoGrupo = await p.locator('[data-tour="tasks.new-group-item"]').isVisible();
    await p.getByRole("button", { name: "Nueva tarea" }).last().click(); await p.waitForTimeout(600);
    r.formularioNuevaTarea = await p.locator('[data-tour="tasks.task-title-input"]').isVisible();
    await p.screenshot({ path: `${OUT}-nueva-tarea.png` });
    // Sin scroll horizontal.
    r.sinScrollHorizontal = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    Object.assign(out, r);
  }
  out[`errores_${theme}`] = errors;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
