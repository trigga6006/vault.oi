/**
 * Convert icon.svg → icon.png (256x256) and icon.ico (multi-size ICO for Windows).
 * Run: node scripts/build-icon.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, '..', 'src', 'assets', 'app');
const svgBuf = readFileSync(resolve(ASSETS, 'icon.svg'));

// Generate PNGs at standard icon sizes
const sizes = [16, 32, 48, 64, 128, 256, 512];

async function main() {
  // Main 256px PNG for Electron
  await sharp(svgBuf, { density: 300 })
    .resize(256, 256)
    .png()
    .toFile(resolve(ASSETS, 'icon.png'));
  console.log('  icon.png (256x256)');

  // 512px PNG for macOS
  await sharp(svgBuf, { density: 300 })
    .resize(512, 512)
    .png()
    .toFile(resolve(ASSETS, 'icon-512.png'));
  console.log('  icon-512.png (512x512)');

  // Build ICO (Windows) — ICO is just a container of BMP/PNG images
  // We'll build a minimal ICO with 16, 32, 48, 64, 128, 256 sizes
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    icoSizes.map((s) =>
      sharp(svgBuf, { density: 300 }).resize(s, s).png().toBuffer()
    )
  );

  const ico = buildIco(pngBuffers, icoSizes);
  writeFileSync(resolve(ASSETS, 'icon.ico'), ico);
  console.log('  icon.ico (multi-size)');

  console.log('Done.');
}

/** Build a minimal ICO file from PNG buffers */
function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * count;
  let dataOffset = headerSize + dirSize;

  // ICO header: reserved(2) + type(2) + count(2)
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type: 1 = ICO
  header.writeUInt16LE(count, 4);  // image count

  const dirEntries = [];
  const dataChunks = [];

  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i];
    const s = sizes[i];
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(s >= 256 ? 0 : s, 0);   // width (0 = 256)
    entry.writeUInt8(s >= 256 ? 0 : s, 1);   // height
    entry.writeUInt8(0, 2);                    // color palette
    entry.writeUInt8(0, 3);                    // reserved
    entry.writeUInt16LE(1, 4);                 // color planes
    entry.writeUInt16LE(32, 6);                // bits per pixel
    entry.writeUInt32LE(png.length, 8);        // data size
    entry.writeUInt32LE(dataOffset, 12);       // data offset
    dirEntries.push(entry);
    dataChunks.push(png);
    dataOffset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...dataChunks]);
}

main().catch((err) => { console.error(err); process.exit(1); });
