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
  await page.locator('[data-tour="collections.table-view"]').first().click({ force: true });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector("ul li")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "qa-cobranza-tabla-mobile.png") });
  const items = await page.evaluate(() => document.body.innerText.includes("QA-POL") || document.body.innerText.includes("Vence"));
  console.log("tabla mobile con datos:", items);
} finally { await browser.close(); }
