// KPIs → Resumen en el celular, como la referencia (cuenta QA, oscuro y claro).
// Uso: node scripts/mobile-qa/kpis-resumen.mjs  (servidor en QA_BASE_URL, por defecto :3001)
import { chromium } from "playwright";
import { ensureQaAdminUserAndPassword } from "./qaUser.mjs";
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const OUT = process.env.QA_OUT ?? "docs/mobile/kpis-resumen";
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
  await p.goto(`${BASE}/kpis`, { waitUntil: "networkidle" });
  await p.getByText("Conexiones enviadas").first().waitFor();
  await p.waitForTimeout(800);
  for (let i = 0; i < 6; i++) { const o = p.getByText(/Omitir tutorial|Saltar/).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
  await p.screenshot({ path: `${OUT}-${theme}.png` });
  if (theme === "dark") {
    const r = {};
    r.volver = await p.getByRole("button", { name: "Volver" }).isVisible();
    r.mes = await p.getByLabel("Mes").evaluate((el) => el.options[el.selectedIndex].text);
    r.sync = await p.getByText(/^Google Sheets/).first().innerText();
    r.actualizar = await p.getByRole("button", { name: "Actualizar" }).isVisible();
    r.aceptadas = await p.getByText("Aceptadas", { exact: true }).locator("xpath=../..").innerText();
    await p.getByRole("tab", { name: "Semana 2" }).click();
    await p.waitForFunction(() => document.body.innerText.includes("305"), null, { timeout: 60_000 }).catch(() => {});
    r.semana2_enviadas = await p.getByText("Conexiones enviadas", { exact: true }).locator("xpath=../..").innerText();
    await p.getByRole("tab", { name: "Mensual" }).click(); await p.waitForTimeout(1200);
    await p.getByText("Calificadas", { exact: true }).first().scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}-abajo.png` });
    r.sinScrollHorizontal = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    Object.assign(out, r);
  }
  out[`errores_${theme}`] = errors;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
