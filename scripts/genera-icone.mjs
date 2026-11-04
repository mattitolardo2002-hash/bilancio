// Genera le icone PNG dell'app (tre barre blu crescenti su fondo scuro)
// senza librerie esterne. Si lancia con: npm run icone
// Le icone finiscono in public/ e vengono copiate così come sono nella build.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const SFONDO = [0x07, 0x09, 0x0c];
const BLU = [0x3b, 0x86, 0xf0];
// Mescola il blu con lo sfondo: le barre più basse sono più tenui.
const tono = (f) => BLU.map((c, i) => Math.round(SFONDO[i] + (c - SFONDO[i]) * f));

// Barre su una griglia 100×100: [x1, y1, x2, y2, colore, raggio angoli].
const FORME = [
  [24, 52, 37, 76, tono(0.55), 3],
  [43.5, 40, 56.5, 76, tono(0.8), 3],
  [63, 24, 76, 76, BLU, 3],
];

// Punto dentro un rettangolo con gli angoli arrotondati.
function dentro(x, y, [x1, y1, x2, y2, , r]) {
  if (x < x1 || x >= x2 || y < y1 || y >= y2) return false;
  const cx = Math.min(Math.max(x, x1 + r), x2 - r);
  const cy = Math.min(Math.max(y, y1 + r), y2 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Colore di un pixel: campioniamo 4×4 punti per avere bordi puliti.
function colore(px, py, lato) {
  const somma = [0, 0, 0];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = ((px + (i + 0.5) / 4) / lato) * 100;
      const y = ((py + (j + 0.5) / 4) / lato) * 100;
      const forma = FORME.find((f) => dentro(x, y, f));
      const c = forma ? forma[4] : SFONDO;
      for (let k = 0; k < 3; k++) somma[k] += c[k];
    }
  }
  return somma.map((s) => Math.round(s / 16));
}
// Tabella CRC32 richiesta dal formato PNG.
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function blocco(tipo, dati) {
  const lunghezza = Buffer.alloc(4);
  lunghezza.writeUInt32BE(dati.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dati]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([lunghezza, corpo, crc]);
}

function png(lato) {
  // Ogni riga inizia con il byte di filtro 0, poi i pixel RGB.
  const righe = Buffer.alloc(lato * (lato * 3 + 1));
  for (let y = 0; y < lato; y++) {
    const inizio = y * (lato * 3 + 1);
    for (let x = 0; x < lato; x++) {
      const c = colore(x, y, lato);
      for (let k = 0; k < 3; k++) righe[inizio + 1 + x * 3 + k] = c[k];
    }
  }
  const intestazione = Buffer.alloc(13);
  intestazione.writeUInt32BE(lato, 0);
  intestazione.writeUInt32BE(lato, 4);
  intestazione[8] = 8; // 8 bit per canale
  intestazione[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco('IHDR', intestazione),
    blocco('IDAT', deflateSync(righe)),
    blocco('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/apple-touch-icon.png', png(180));
writeFileSync('public/icona-192.png', png(192));
writeFileSync('public/icona-512.png', png(512));
console.log('Icone generate in public/ (la favicon vettoriale è public/favicon.svg)');
