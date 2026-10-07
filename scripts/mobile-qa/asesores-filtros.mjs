// Prueba chips de estado y alertas en /asesores (celular, cuenta admin).
// Uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/asesores-filtros.mjs
import { chromium } from "playwright";
import { ensureQaAdminUserAndPassword } from "./qaUser.mjs";
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const b = await chromium.launch({ channel: "chrome", headless: true });
const { email, password } = await ensureQaAdminUserAndPassword();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-AR" });
const p = await ctx.newPage();
const errors = []; p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${BASE}/login`); await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', password); await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login")); await p.waitForLoadState("networkidle").catch(() => {});
await p.goto(`${BASE}/asesores`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
for (let i = 0; i < 4; i++) { const o = p.getByText("Omitir tutorial", { exact: true }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
const NOMBRES = ["QA Mobile", "Paula Benítez", "Leonardo Magaña", "Daniela Ortiz", "Ricardo Peña", "Mariana Solís"];
const tarjetas = async () => { await p.waitForTimeout(600); const t = await p.locator("body").innerText(); return NOMBRES.filter((n) => t.includes(n)); };
const todos = await tarjetas();
await p.locator('[aria-label="Estado"] button', { hasText: "Activos" }).click(); await p.waitForTimeout(500);
const activos = await tarjetas();
await p.locator('[aria-label="Estado"] button', { hasText: "Todos" }).click(); await p.waitForTimeout(400);
await p.getByRole("button", { name: /Contratos por vencer/ }).click(); await p.waitForTimeout(500);
const porVencer = await tarjetas();
const marcado = await p.getByRole("button", { name: /Contratos por vencer/ }).getAttribute("aria-pressed");
console.log(JSON.stringify({ todos, activos, porVencer, marcado, errors }));
await b.close();
