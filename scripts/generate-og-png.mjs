import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const width = 1200;
const height = 630;
const scale = 7;

const glyphs = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ">": ["10000", "01000", "00100", "00010", "00100", "01000", "10000"],
  "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "a": ["00000", "01110", "00001", "01111", "10001", "10011", "01101"],
  "c": ["00000", "00000", "01111", "10000", "10000", "10000", "01111"],
  "d": ["00001", "00001", "01101", "10011", "10001", "10011", "01101"],
  "e": ["00000", "01110", "10001", "11111", "10000", "10000", "01110"],
  "h": ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  "i": ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  "l": ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  "m": ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  "n": ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  "o": ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  "p": ["00000", "11110", "10001", "10001", "11110", "10000", "10000"],
  "r": ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  "s": ["00000", "01111", "10000", "01110", "00001", "00001", "11110"],
  "t": ["00100", "00100", "11111", "00100", "00100", "00100", "00011"],
  "u": ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  "v": ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  "w": ["00000", "00000", "10001", "10001", "10101", "10101", "01010"],
  "y": ["00000", "10001", "10001", "01111", "00001", "10001", "01110"],
  "z": ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
};

const data = Buffer.alloc((width * 4 + 1) * height);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const row = y * (width * 4 + 1);
  const index = row + 1 + x * 4;
  data[index] = r;
  data[index + 1] = g;
  data[index + 2] = b;
  data[index + 3] = a;
}

function fillRect(x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, ...color);
  }
}

function roundedRect(x, y, w, h, radius, color) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const dx = xx < x + radius ? x + radius - xx : xx >= x + w - radius ? xx - (x + w - radius - 1) : 0;
      const dy = yy < y + radius ? y + radius - yy : yy >= y + h - radius ? yy - (y + h - radius - 1) : 0;
      if (dx * dx + dy * dy <= radius * radius || (dx === 0 || dy === 0)) setPixel(xx, yy, ...color);
    }
  }
}

function text(value, x, y, color, size = scale) {
  let cursor = x;
  for (const char of value) {
    const glyph = glyphs[char] || glyphs[char.toUpperCase()] || glyphs[" "];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((bit, colIndex) => {
        if (bit === "1") fillRect(cursor + colIndex * size, y + rowIndex * size, size - 1, size - 1, color);
      });
    });
    cursor += 6 * size;
  }
}

for (let y = 0; y < height; y++) {
  data[y * (width * 4 + 1)] = 0;
  for (let x = 0; x < width; x++) {
    const r = Math.round(7 + (x / width) * 18 + (y / height) * 12);
    const g = Math.round(11 + (x / width) * 12);
    const b = Math.round(26 + (y / height) * 38);
    setPixel(x, y, r, g, b);
  }
}

roundedRect(86, 72, 1028, 486, 46, [15, 23, 42]);
roundedRect(136, 122, 72, 72, 22, [79, 70, 229]);
text("RecallMate", 232, 140, [248, 250, 252], 8);
text("Study Smarter with AI", 136, 265, [248, 250, 252], 7);
text("Upload -> Learn -> Recall", 140, 352, [203, 213, 225], 6);
roundedRect(140, 432, 210, 74, 22, [79, 70, 229]);
roundedRect(380, 432, 210, 74, 22, [124, 58, 237]);
roundedRect(620, 432, 250, 74, 22, [219, 39, 119]);
text("AI Notes", 176, 456, [255, 255, 255], 4);
text("Quizzes", 425, 456, [255, 255, 255], 4);
text("Reviewers", 662, 456, [255, 255, 255], 4);

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, payload])));
  return Buffer.concat([length, name, payload, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

writeFileSync(
  "public/og-image.png",
  Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(data, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
