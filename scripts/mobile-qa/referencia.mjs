import path from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "./session.mjs";

const outDir = path.resolve("docs/mobile/referencia");
const file = pathToFileURL(path.resolve("docs/mobile/growthlink-movil.html")).href;

const SHOTS = [
  ["01-inicio", `setTab('dashboard')`],
  ["02-inbox", `setTab('inbox')`],
  ["03-chat", `setTab('inbox'); go('chat', 1)`],
  ["04-crm", `setTab('crm')`],
  ["05-mover-etapa", `setTab('crm'); document.querySelector('[data-action=move]').click()`],
  ["06-ficha-lead", `setTab('crm'); go('lead', 1)`],
  ["07-agenda", `setTab('agenda')`],
  ["08-tareas", `setTab('mas'); go('mod', 'tasks')`],
  ["09-mas", `setTab('mas')`],
  ["10-modulo-generico", `setTab('mas'); go('mod', 'advisors')`],
];

const { browser, context } = await launch({ width: 390, height: 844 });
try {
  const page = await context.newPage();
  await page.goto(file, { waitUntil: "load" });
  await page.waitForTimeout(800);
  for (const [name, script] of SHOTS) {
    await page.evaluate(script);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(outDir, `${name}-390x844.png`) });
    console.log("saved", name);
  }
} finally {
  await browser.close();
}
