import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandDir = path.join(__dirname, "../public/brand");
const input = path.join(brandDir, "storm-sprinklers-logo.png");
const output = path.join(brandDir, "storm-sprinklers-logo-transparent.png");

/** Pixels at or below this RGB level become fully transparent (removes black matte). */
const THRESHOLD = 48;

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r <= THRESHOLD && g <= THRESHOLD && b <= THRESHOLD) {
    data[i + 3] = 0;
  }
}

await sharp(data, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  },
})
  .png({ compressionLevel: 9 })
  .toFile(output);

console.log(`Wrote ${output} (${info.width}x${info.height})`);
