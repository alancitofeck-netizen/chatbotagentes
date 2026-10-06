// Clasifica los targets táctiles menores a 44px que reporta audit.mjs.
// Criterio (ver docs/mobile/paridad.md, "Targets táctiles: desglose"):
//  - oculto-hover: opacidad 0 en el elemento o un ancestro (sólo aparece en hover).
//  - aria-hidden: el elemento está dentro de un subárbol aria-hidden (decorativo).
//  - grip: cursor de arrastre (ns-resize / grab); es un control de arrastre, no una acción.
//  - sin-nombre: interactivo sin aria-label, title ni texto (botón de sólo ícono).
//  - real: interactivo con nombre accesible y visible; hay que llevarlo a 44px.
import fs from "node:fs";
const file = process.argv[2] ?? "docs/mobile/resultado-mobile/audit-targets/audit-390-admin.json";
const j = JSON.parse(fs.readFileSync(file, "utf8"));
const list = Array.isArray(j) ? j : Object.entries(j).map(([k, v]) => ({ route: k, ...v }));
// Área de toque efectiva: el audit mide el rectángulo del elemento; estas
// clases agregan un ::before transparente que completa el área (ver globals.css
// y el kanban). Sin esto, un control ampliado seguiría contando como pequeño.
function effective(s) {
  let w = s.w, h = s.h;
  const c = s.cls || "";
  if (/touch-hit-8/.test(c)) { w += 16; h += 16; }
  if (/touch-hit-10/.test(c)) { w += 20; h += 20; }
  if (/before:-inset-[19px]/.test(c)) { w += 38; h += 38; }
  if (/before:-inset-[10px]/.test(c)) { h += 20; }
  return { w, h };
}
const cat = {};
const examples = {};
function classify(s) {
  const e = effective(s);
  if (e.w >= 44 && e.h >= 44) return "ampliado-ok";
  if (s.op === 0) return "oculto-hover";
  if (s.hiddenAria) return "aria-hidden";
  if (/ns-resize|grab/.test(s.cursor || "")) return "grip";
  if (!s.name) return "sin-nombre";
  return "real";
}
let total = 0;
for (const r of list) {
  for (const s of r.measure?.smallTargets ?? []) {
    total++;
    const c = classify(s);
    cat[c] = (cat[c] || 0) + 1;
    (examples[c] ||= []).push(`${r.route} | ${s.tag}${s.role ? "[" + s.role + "]" : ""} | ${(s.name || "(sin nombre)").slice(0, 36)} | ${s.w}x${s.h}`);
  }
}
console.log(`total ${total}`);
for (const [k, v] of Object.entries(cat).sort((a, b) => b[1] - a[1])) {
  console.log(`${v}\t${k}`);
  if (process.argv.includes("--all") || k === "real" || k === "sin-nombre") for (const e of examples[k]) console.log("   ", e);
}
