// Regenerates this app's logo files. The results are committed, so this only needs to run when the logo changes:
//   node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import sharp from "sharp";

const GLYPH = `
    <g transform="rotate(-45 256 256)">
      <rect x="150" y="232" width="212" height="48" rx="10" fill="url(#g)"/>
      <rect x="66" y="176" width="44" height="160" rx="16" fill="url(#g)"/>
      <rect x="116" y="136" width="58" height="240" rx="18" fill="url(#g)"/>
      <rect x="338" y="136" width="58" height="240" rx="18" fill="url(#g)"/>
      <rect x="402" y="176" width="44" height="160" rx="16" fill="url(#g)"/>
    </g>
    <path d="M132 62l15 45 45 15-45 15-15 45-15-45-45-15 45-15z" fill="#22d3ee"/>
    <path d="M386 342l11 33 33 11-33 11-11 33-11-33-33-11 33-11z" fill="#f472b6"/>
  `;

// scale shrinks the symbol inside the tile. rounded leaves see-through corners, for browsers. iOS and
// Android crop icons themselves, so theirs stay square.
const svg = (scale, rounded) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#241a3d"/><stop offset="1" stop-color="#0a0a12"/></radialGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="0.5" stop-color="#a855f7"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 104 : 0}" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${GLYPH}</g>
</svg>`);

const OUT = [["public/icons/icon-192.png", 192, "any"], ["public/icons/icon-512.png", 512, "any"], ["public/icons/apple-touch-icon.png", 180, "full"], ["public/icons/icon-maskable-512.png", 512, "mask"]];
for (const [file, size, kind] of OUT) {
  mkdirSync(dirname(file), { recursive: true });
  const scale = kind === "mask" ? 0.66 : 0.82;
  await sharp(svg(scale, kind === "any")).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(file);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/logo.svg", svg(0.82, true));
