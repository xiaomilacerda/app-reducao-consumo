import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const source = path.join(process.cwd(), 'src/app/icon.svg');
const output = path.join(process.cwd(), 'public/icons');
const svg = await readFile(source, 'utf8');
await mkdir(output, { recursive: true });

for (const size of [192, 512]) {
  // Original SVG declares 32 CSS pixels; increase vector raster size.
  const scaled = svg.replace(/width="32"\s+height="32"/, 'width="' + size + '" height="' + size + '"');
  if (scaled === svg) throw new Error('Brand SVG dimensions unexpectedly changed');
  const target = path.join(output, 'icon-' + size + '.png');
  await sharp(Buffer.from(scaled), { density: 300 })
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toFile(target);

  if (size === 512) {
    await sharp(Buffer.from(scaled), { density: 300 })
      .resize(size, size, { fit: 'contain' })
      .flatten({ background: '#110e22' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(output, 'icon-512-maskable.png'));
  }
}

console.log('[WeedReset] PWA PNG icons created from the existing brand SVG.');
