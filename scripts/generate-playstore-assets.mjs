import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Store listing artwork is generated locally from the existing brand mark.
// No private data, screenshots, or third-party image licenses are required.
const root = process.cwd();
const source = await readFile(path.join(root, 'src/app/icon.svg'));
const output = path.join(root, 'store-assets');
await mkdir(output, { recursive: true });

const logo = await sharp(source, { density: 300 })
  .resize(230, 230, { fit: 'contain' }).png().toBuffer();

const graphic = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
<defs>
  <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0%" stop-color="#100d23"/>
    <stop offset="55%" stop-color="#241443"/>
    <stop offset="100%" stop-color="#11142f"/>
  </linearGradient>
  <radialGradient id="glow"><stop offset="0%" stop-color="#7944ff" stop-opacity=".45"/><stop offset="100%" stop-color="#7944ff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1024" height="500" fill="url(#bg)"/>
<circle cx="170" cy="240" r="320" fill="url(#glow)"/>
<circle cx="915" cy="50" r="240" fill="url(#glow)"/>
<rect x="80" y="120" width="265" height="265" rx="55" fill="#17102c" stroke="#66529a" stroke-width="2"/>
<text x="395" y="205" fill="#ffffff" font-size="76" font-weight="800" font-family="DejaVu Sans,Arial,sans-serif">WeedReset</text>
<text x="398" y="265" fill="#d9c8ff" font-size="31" font-weight="600" font-family="DejaVu Sans,Arial,sans-serif">Sua jornada, seu ritmo</text>
<text x="398" y="325" fill="#b8b2cc" font-size="21" font-family="DejaVu Sans,Arial,sans-serif">Apoio e autocuidado para mudar hábitos</text>
</svg>`;

await sharp(Buffer.from(graphic))
  .composite([{ input: logo, left: 98, top: 137 }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(output, 'feature-graphic-1024x500.png'));

const icon = await sharp(source, { density: 300 })
  .resize(420, 420, { fit: 'contain' }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#110e22' } })
  .composite([{ input: icon, left: 46, top: 46 }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(output, 'play-icon-512x512.png'));

console.log('[WeedReset] Imagens de loja geradas em store-assets/. Revise visualmente antes de publicar.');
