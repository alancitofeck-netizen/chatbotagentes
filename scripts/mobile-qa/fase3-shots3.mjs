import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";
const outDir = path.resolve("docs/mobile/resultado-mobile");
const { browser, context } = await launch({ width: 390, height: 844 });
try {
  const page = await loginIn(context, "admin");
  await page.goto(`${BASE_URL}/crm`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  const card = page.locator("div.group").filter({ has: page.getByRole("button", { name: "Crear tarea" }) }).first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await card.boundingBox();
  await page.screenshot({ path: path.join(outDir, "fase3-crm-card-390x844.png"), clip: { x: 0, y: Math.max(0, box.y - 20), width: 390, height: Math.min(260, box.height + 40) } });
  const sizes = await card.evaluate((el) => [...el.querySelectorAll("button, a")].filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().height)));
  console.log("control heights:", sizes.join(","));
} finally { await browser.close(); }
