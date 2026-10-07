// Prueba chips de estado y "Ver más indicadores" en /polizas (uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/polizas-filtros.mjs)
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
await p.goto(`${BASE}/polizas`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
for (let i = 0; i < 4; i++) { const o = p.getByText("Omitir tutorial", { exact: true }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
const visibles = async () => { let n = 0; for (const x of ["Prima mensual", "Prima anual", "Comisión pendiente", "Valor de cartera"]) n += (await p.getByText(x, { exact: true }).isVisible().catch(() => false)) ? 1 : 0; return n; };
const kpisAntes = await visibles();
await p.getByRole("button", { name: "Ver más indicadores" }).click(); await p.waitForTimeout(300);
const kpisDespues = await visibles();
const cards = async () => { let n = 0; for (const i of [1, 2, 3]) n += (await p.getByText(`[QA] Contacto ${i}`, { exact: true }).locator("visible=true").count()); return n; };
const todas = await cards();
await p.getByRole("button", { name: /^Activa\s*\d/ }).click(); await p.waitForTimeout(400);
const activa = await cards();
const pressed = await p.getByRole("button", { name: /^Activa\s*\d/ }).getAttribute("aria-pressed");
await p.getByRole("button", { name: /^Activa\s*\d/ }).click(); await p.waitForTimeout(400);
const vuelta = await cards();
console.log(JSON.stringify({ kpisAntes, kpisDespues, todas, activa, pressed, vuelta, errors }));
await b.close();
