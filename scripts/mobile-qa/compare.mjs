import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const [beforeDir, afterDir] = process.argv.slice(2);
const files = fs.readdirSync(beforeDir).filter((f) => f.endsWith(".png"));

async function raw(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

let allEqual = true;
for (const name of files) {
  const a = await raw(path.join(beforeDir, name));
  const bPath = path.join(afterDir, name);
  if (!fs.existsSync(bPath)) {
    console.log("MISSING after:", name);
    allEqual = false;
    continue;
  }
  const b = await raw(bPath);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    console.log(`SIZE DIFF ${name}: ${a.info.width}x${a.info.height} vs ${b.info.width}x${b.info.height}`);
    allEqual = false;
    continue;
  }
  let diff = 0;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const w = a.info.width;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) {
      diff++;
      const px = i / 4;
      const x = px % w, y = Math.floor(px / w);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (diff === 0) {
    console.log(`IDENTICAL ${name}`);
  } else {
    allEqual = false;
    console.log(`DIFF ${name}: ${diff} px differ, bbox x=${minX}-${maxX} y=${minY}-${maxY}`);
  }
}
console.log(allEqual ? "RESULT: all identical" : "RESULT: differences found");
