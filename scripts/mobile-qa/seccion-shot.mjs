// Captura una ruta de la app a 390 y 1440 saltando los tutoriales (uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/seccion-shot.mjs <outDir> <nombre> <ruta> [claro|oscuro])
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { ensureQaUserAndPassword, ensureQaAdminUserAndPassword } from "./qaUser.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const [outDir, name, route, scheme = "light"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const { email, password } = process.env.QA_ACCOUNT === "admin" ? await ensureQaAdminUserAndPassword() : await ensureQaUserAndPassword();
for (const [w, h, mobile] of [[390, 844, true], [1440, 900, false]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, colorScheme: scheme === "oscuro" ? "dark" : "light", locale: "es-AR", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    const omit = page.getByText("Omitir tutorial", { exact: true }).first();
    if (!(await omit.isVisible().catch(() => false))) break;
    await omit.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(700);
  if (process.env.SCROLL) await page.evaluate((y) => { window.scrollTo(0, y); document.querySelectorAll("*").forEach((el) => { if (el.scrollHeight > el.clientHeight + 50 && getComputedStyle(el).overflowY !== "visible") el.scrollTop = y; }); }, +process.env.SCROLL);
  await page.waitForTimeout(300);
  const hs = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(outDir, `${name}-${w}.png`), fullPage: true });
  console.log(name, w, "hscroll", hs);
  await ctx.close();
}
await browser.close();
