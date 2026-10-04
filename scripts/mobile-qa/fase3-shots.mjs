import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";
const outDir = path.resolve("docs/mobile/resultado-mobile");
const routes = [
  ["crm", "/crm"],
  ["dashboard", "/dashboard"],
  ["agenda", "/agenda"],
  ["calendar", "/calendar"],
  ["tasks", "/tasks"],
];
const { browser, context } = await launch({ width: 390, height: 844 });
try {
  const page = await loginIn(context, "admin");
  for (const [name, route] of routes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1200);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.screenshot({ path: path.join(outDir, `fase3-${name}-390x844.png`) });
    console.log(name, "hscroll", scrollW);
  }
} finally { await browser.close(); }
