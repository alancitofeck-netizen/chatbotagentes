import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";
const outDir = path.resolve("docs/mobile/resultado-mobile");
const { browser, context } = await launch({ width: 390, height: 844 });
try {
  await context.addInitScript(() => { try { localStorage.setItem("gl-theme", "dark"); } catch {} });
  const page = await loginIn(context, "admin");
  for (const [name, route] of [["dashboard", "/dashboard"], ["crm", "/crm"], ["inbox", "/inbox"], ["agenda", "/agenda"], ["tasks", "/tasks"]]) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1000);
    const isDark = await page.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark" || document.documentElement.classList.contains("dark"));
    await page.screenshot({ path: path.join(outDir, `fase5-dark-${name}-390x844.png`) });
    console.log(name, "dark", isDark);
  }
} finally { await browser.close(); }
