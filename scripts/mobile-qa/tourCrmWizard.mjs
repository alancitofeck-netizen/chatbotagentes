import { launch, loginIn, BASE_URL } from "./session.mjs";
// Recorre el wizard de crear lead como lo haría el tour, sin guardar nada.
const { browser, context } = await launch({ width: 390, height: 844 });
const vis = (page, s) => page.evaluate((sel) => { const el = document.querySelector(`[data-tour="${sel}"]`); if (!el) return "NO EXISTE"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" ? `visible ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` : `oculto`; }, s);
try {
  const page = await loginIn(context, "admin");
  await page.goto(`${BASE_URL}/crm`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1000);
  await page.locator('[data-tour="crm.new-lead-button"]').first().click();
  await page.waitForTimeout(1000);
  await page.locator('[data-tour="crm.lead-name-input"] input, input[data-tour="crm.lead-name-input"]').first().fill("Prueba Tour QA");
  await page.locator('[data-tour="crm.lead-phone-input"] input, input[data-tour="crm.lead-phone-input"]').first().fill("+5215511112222");
  await page.locator('[data-tour="crm.lead-source-input"] button').first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-tour="crm.wizard-step1-continue"]').first().click();
  await page.waitForTimeout(900);
  console.log("step2 continue:", await vis(page, "crm.wizard-step2-continue"));
  await page.getByPlaceholder("Ej. Plan premium").fill("Oportunidad QA tour");
  await page.getByRole("spinbutton").first().fill("1500");
  await page.locator('[data-tour="crm.wizard-step2-continue"]').first().click();
  await page.waitForTimeout(900);
  console.log("save button:", await vis(page, "crm.lead-save-button"));
  await page.screenshot({ path: "docs/mobile/resultado-mobile/tour-crm-wizard-step3-390x844.png" });
  await page.keyboard.press("Escape");
} finally { await browser.close(); }
