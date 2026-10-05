// Capturas del rediseño visual (Fase 1): Inicio y CRM a 390 y 1440, claro y oscuro.
// Uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/rediseno-shots.mjs <outDir> [rutas...]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { ensureQaUserAndPassword } from "./qaUser.mjs";
import { skipTours } from "./session.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const outDir = path.resolve(process.argv[2] ?? "docs/mobile/rediseno");
const routes = process.argv.slice(3).length ? process.argv.slice(3) : [["inicio", "/dashboard"], ["crm", "/crm"]];
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const { email, password } = await ensureQaUserAndPassword();
const sizes = [[390, 844, true], [1440, 900, false]];
for (const scheme of ["light", "dark"]) {
  for (const [w, h, mobile] of sizes) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1,
      colorScheme: scheme, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires", reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }).catch(() => {});
    for (const [name, route] of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 90000 });
      await skipTours(page);
      const ahoraNo = page.getByRole("button", { name: "Ahora no" });
      if (await ahoraNo.isVisible().catch(() => false)) await ahoraNo.click().catch(() => {});
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelectorAll("*").forEach((el) => { if (el.scrollTop > 0) el.scrollTop = 0; });
      });
      await page.waitForTimeout(600);
      const hscroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await page.screenshot({ path: path.join(outDir, `${name}-${w}-${scheme}.png`), fullPage: true });
      console.log(name, w, scheme, "hscroll px:", hscroll);
    }
    await ctx.close();
  }
}
await browser.close();
