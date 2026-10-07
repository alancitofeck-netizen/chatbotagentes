// Prueba chips de tipo y de vista en /documents (celular).
// Uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/documentos-filtros.mjs
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
await p.goto(`${BASE}/documents`, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
for (let i = 0; i < 4; i++) { const o = p.getByText("Omitir tutorial", { exact: true }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
const tarjetas = async () => await p.getByText(/^\[QA\] .*\.(pdf|jpg|xlsx)$/).count();
const todas = await tarjetas();
const orden = await p.locator('[aria-label="Tipo de documento"] button').evaluateAll((els) => els.map((e) => e.textContent.trim()));
await p.locator('[aria-label="Tipo de documento"] button', { hasText: "PDF de póliza" }).click(); await p.waitForTimeout(500);
const polizas = await tarjetas();
await p.locator('[aria-label="Tipo de documento"] button', { hasText: "PDF de póliza" }).click(); await p.waitForTimeout(500);
const vuelta = await tarjetas();
await p.locator('[aria-label="Vista"] button', { hasText: "Papelera" }).click(); await p.waitForTimeout(8000);
await p.screenshot({ path: process.env.DBG ?? "dbg.png" });
const url = p.url();
const enPapelera = await tarjetas();
console.log(JSON.stringify({ todas, orden, polizas, vuelta, urlPapelera: url.split("?")[1], enPapelera, errors }));
await b.close();
