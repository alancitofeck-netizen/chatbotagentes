// Prueba semanas y setter en /kpis (celular). Uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/kpis-filtros.mjs
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
await p.goto(`${BASE}/kpis`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
for (let i = 0; i < 4; i++) { const o = p.getByText("Omitir tutorial", { exact: true }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
const conexion = async () => (await p.getByText("Conexión", { exact: true }).first().locator("xpath=preceding-sibling::p").first().innerText()).trim();
const mensual = await conexion();
await p.getByRole("tab", { name: "Semana 1" }).click().catch(async () => p.getByText("Semana 1", { exact: true }).click());
await p.waitForTimeout(3000);
const semana1 = await conexion();
await p.locator("select").first().selectOption({ index: 1 }); await p.waitForTimeout(3000);
const conSetter = await conexion();
console.log(JSON.stringify({ mensual, semana1, conSetter, errors }));
await b.close();
