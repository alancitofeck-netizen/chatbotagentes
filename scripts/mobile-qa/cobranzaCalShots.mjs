import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";
const outDir = path.resolve("docs/mobile/resultado-mobile");
const { browser, context } = await launch({ width: 390, height: 844 });
try {
  const page = await loginIn(context, "admin");
  await page.goto(`${BASE_URL}/cobranza`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  const omit = page.getByRole("button", { name: "Omitir tutorial" });
  if (await omit.isVisible().catch(() => false)) await omit.click();
  await page.waitForTimeout(500);
  const hs = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.evaluate(() => document.querySelector("h3.capitalize")?.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "qa-cobranza-calendario-mobile.png") });
  console.log("hscroll", hs);
} finally { await browser.close(); }
