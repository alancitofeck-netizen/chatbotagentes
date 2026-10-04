import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";
const outDir = path.resolve("docs/mobile/resultado-mobile");
for (const [w, h, tag] of [[390, 844, "mobile"], [1440, 900, "desktop"]]) {
  const { browser, context } = await launch({ width: w, height: h });
  try {
    const page = await loginIn(context, "admin");
    await page.goto(`${BASE_URL}/polizas`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1500);
    const pol = await page.evaluate(() => document.body.innerText.includes("QA Aseguradora") || document.body.innerText.includes("QA-POL-001"));
    await page.screenshot({ path: path.join(outDir, `qa-polizas-${tag}.png`) });
    await page.goto(`${BASE_URL}/cobranza`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1500);
    const tabBtn = page.locator('[data-tour="collections.table-view"]').first();
    if (await tabBtn.isVisible().catch(() => false)) await tabBtn.click({ force: true });
    await page.waitForTimeout(800);
    const cob = await page.evaluate(() => document.body.innerText.includes("QA Aseguradora") || document.body.innerText.includes("Cobro") );
    const hs = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.screenshot({ path: path.join(outDir, `qa-cobranza-${tag}.png`) });
    console.log(tag, "polizas datos visibles:", pol, "| cobranza:", cob, "| hscroll", hs);
  } finally { await browser.close(); }
}
