// Completa una tarea desde el inicio de Tareas y comprueba que se guarda (recarga).
// Uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/tareas-completar.mjs
import { chromium } from "playwright";
import { ensureQaUserAndPassword } from "./qaUser.mjs";
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const b = await chromium.launch({ channel: "chrome", headless: true });
const { email, password } = await ensureQaUserAndPassword();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-AR" });
const p = await ctx.newPage();
const errors = []; p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${BASE}/login`); await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', password); await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login")); await p.waitForLoadState("networkidle").catch(() => {});
const abrir = async () => {
  await p.goto(`${BASE}/tasks`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) { const o = p.getByText("Omitir tutorial", { exact: true }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
};
await abrir();
const pendientes = async () => await p.locator('button[aria-label^="Completar:"]').count();
const antes = await pendientes();
await p.locator('button[aria-label^="Completar:"]').last().click();
await p.waitForTimeout(2500);
const trasClick = await pendientes();
await abrir();
const trasRecargar = await pendientes();
console.log(JSON.stringify({ antes, trasClick, trasRecargar, errors }));
await b.close();
