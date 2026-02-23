/**
 * Generate PNG icons for PWA from a simple design.
 * Uses only Node.js built-in modules — creates minimal valid PNGs.
 * 
 * Run: node scripts/generate-icons.js
 */
import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

/** Create a minimal valid PNG with a solid rounded-rect + simple shapes. */
const createPng = (size) => {
  const pixels = Buffer.alloc(size * size * 4);

  const bgR = 76, bgG = 175, bgB = 80; // #4caf50
  const cornerRadius = Math.round(size * 0.1875); // ~96/512

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Rounded rectangle check
      let inside = true;
      if (x < cornerRadius && y < cornerRadius) {
        const dx = cornerRadius - x;
        const dy = cornerRadius - y;
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
      } else if (x >= size - cornerRadius && y < cornerRadius) {
        const dx = x - (size - cornerRadius - 1);
        const dy = cornerRadius - y;
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
      } else if (x < cornerRadius && y >= size - cornerRadius) {
        const dx = cornerRadius - x;
        const dy = y - (size - cornerRadius - 1);
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
      } else if (x >= size - cornerRadius && y >= size - cornerRadius) {
        const dx = x - (size - cornerRadius - 1);
        const dy = y - (size - cornerRadius - 1);
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
      }

      if (inside) {
        pixels[idx] = bgR;
        pixels[idx + 1] = bgG;
        pixels[idx + 2] = bgB;
        pixels[idx + 3] = 255;
      } else {
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  // Draw a simple white cart shape (thick lines)
  const cx = Math.round(size * 0.5);
  const cy = Math.round(size * 0.4);
  const scale = size / 512;

  const drawCircle = (centerX, centerY, radius) => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const px = Math.round(centerX + dx);
          const py = Math.round(centerY + dy);
          if (px >= 0 && px < size && py >= 0 && py < size) {
            const idx = (py * size + px) * 4;
            pixels[idx] = 255;
            pixels[idx + 1] = 255;
            pixels[idx + 2] = 255;
            pixels[idx + 3] = 255;
          }
        }
      }
    }
  };

  const drawLine = (x1, y1, x2, y2, thickness) => {
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const steps = Math.ceil(len * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      drawCircle(Math.round(px), Math.round(py), Math.round(thickness / 2));
    }
  };

  const lw = Math.round(10 * scale);
  // Cart handle
  drawLine(cx - 120 * scale, cy - 60 * scale, cx - 90 * scale, cy - 60 * scale, lw);
  // Cart body left
  drawLine(cx - 90 * scale, cy - 60 * scale, cx - 50 * scale, cy + 40 * scale, lw);
  // Cart bottom
  drawLine(cx - 50 * scale, cy + 40 * scale, cx + 100 * scale, cy + 40 * scale, lw);
  // Cart right side
  drawLine(cx + 100 * scale, cy + 40 * scale, cx + 120 * scale, cy - 30 * scale, lw);
  // Cart top
  drawLine(cx + 120 * scale, cy - 30 * scale, cx - 40 * scale, cy - 30 * scale, lw);
  // Wheels
  drawCircle(Math.round(cx - 30 * scale), Math.round(cy + 70 * scale), Math.round(16 * scale));
  drawCircle(Math.round(cx + 80 * scale), Math.round(cy + 70 * scale), Math.round(16 * scale));

  // "AI" text - simple block letters in lower portion
  const textY = Math.round(size * 0.72);
  const letterH = Math.round(60 * scale);
  const letterW = Math.round(40 * scale);
  const textLw = Math.round(8 * scale);

  // Letter A
  const ax = Math.round(cx - 50 * scale);
  drawLine(ax, textY + letterH, ax + letterW / 2, textY, textLw);
  drawLine(ax + letterW / 2, textY, ax + letterW, textY + letterH, textLw);
  drawLine(ax + letterW * 0.2, textY + letterH * 0.55, ax + letterW * 0.8, textY + letterH * 0.55, textLw);

  // Letter I
  const ix = Math.round(cx + 20 * scale);
  drawLine(ix + letterW / 2, textY, ix + letterW / 2, textY + letterH, textLw);
  drawLine(ix + letterW * 0.15, textY, ix + letterW * 0.85, textY, textLw);
  drawLine(ix + letterW * 0.15, textY + letterH, ix + letterW * 0.85, textY + letterH, textLw);

  // Encode as PNG
  // Add filter byte (0 = None) before each row
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rawData[y * (size * 4 + 1)] = 0; // filter: None
    pixels.copy(rawData, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const compressed = deflateSync(rawData, { level: 9 });

  const chunks = [];

  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  const writeChunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = crc32(typeAndData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0);
    chunks.push(len, typeAndData, crcBuf);
  };

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  writeChunk('IHDR', ihdr);

  // IDAT
  writeChunk('IDAT', compressed);

  // IEND
  writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat(chunks);
};

/** CRC32 for PNG chunks. */
const crc32 = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return (buf) => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
})();

// Generate icons
const sizes = [64, 192, 512];
for (const size of sizes) {
  const png = createPng(size);
  const path = join(PUBLIC, `icon-${size}x${size}.png`);
  const ws = createWriteStream(path);
  ws.write(png);
  ws.end();
  console.log(`Generated ${path} (${png.length} bytes)`);
}

console.log('Done!');
