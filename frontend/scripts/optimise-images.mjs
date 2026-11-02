/**
 * Generates responsive AVIF + WebP versions of the clinic photos in public/images/original
 * into public/images/opt, plus a manifest (intrinsic size + generated widths) that the
 * <Picture> component uses to emit srcset, width and height (no layout shift).
 * Run: pnpm --filter @edc/frontend images
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public/images/original');
const output = path.join(root, 'public/images/opt');
const manifestFile = path.join(root, 'app/lib/images.generated.json');
const WIDTHS = [400, 640, 960, 1280];

await mkdir(output, { recursive: true });
const manifest = {};

for (const file of (await readdir(source)).filter((name) => /\.(jpe?g|png)$/i.test(name))) {
  const name = file.replace(/\.[^.]+$/, '');
  const image = sharp(path.join(source, file));
  const { width, height } = await image.metadata();
  const widths = [...new Set([...WIDTHS.filter((w) => w < width), width])];
  for (const w of widths) {
    const resized = image.clone().resize({ width: w });
    await resized
      .clone()
      .avif({ quality: 55, effort: 5 })
      .toFile(path.join(output, `${name}-${w}.avif`));
    await resized
      .clone()
      .webp({ quality: 75 })
      .toFile(path.join(output, `${name}-${w}.webp`));
  }
  manifest[name] = { width, height, widths };
}

await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Optimised ${Object.keys(manifest).length} images\n`);
