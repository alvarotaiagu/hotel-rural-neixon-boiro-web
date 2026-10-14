/* Deja anillo.svg, texto.svg y logo.svg con el MISMO viewBox cuadrado,
   centrado en el centro del anillo (de marca/piedras.json), para que la
   cortina, el dial y el pie casen al píxel. Escribe también js/geometria.js
   (centro y radios en fracción de la caja) y los favicons.
   Uso: node scripts/marca.mjs  (idempotente: parte siempre de piedras.json) */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = (f) => path.join(RAIZ, 'marca', f);
const geo = JSON.parse(fs.readFileSync(M('piedras.json'), 'utf8'));
const [cx, cy] = geo.centro;
const ro = geo.radioExterior || geo.radioMedio * 1.2;
const ri = geo.radioInterior || geo.radioMedio * 0.8;
const pad = ro * 0.02;
const R = ro + pad;
const vb = [cx - R, cy - R, 2 * R, 2 * R].map((n) => Math.round(n * 10) / 10);
const lado = vb[2];

for (const f of ['anillo.svg', 'texto.svg', 'logo.svg']) {
  let s = fs.readFileSync(M(f), 'utf8');
  s = s.replace(/<svg\b([^>]*)>/, (m, a) => {
    a = a.replace(/\s(viewBox|width|height)="[^"]*"/g, '');
    return `<svg${a} viewBox="${vb.join(' ')}">`;
  });
  fs.writeFileSync(M(f), s);
  console.log(f, 'viewBox', vb.join(' '));
}

const r4 = (n) => Math.round(n * 1e4) / 1e4;
const G = {
  cx: r4((cx - vb[0]) / lado),
  cy: r4((cy - vb[1]) / lado),
  ri: r4(ri / lado),
  ro: r4(ro / lado),
  piedras: geo.piedras.length,
};
fs.writeFileSync(path.join(RAIZ, 'js/geometria.js'),
  `/* generado por scripts/marca.mjs: centro y radios del anillo en fracción de su caja */\nwindow.GEO_ANILLO = ${JSON.stringify(G)};\n`);
console.log('geometria', G);

// favicons: el anillo en granito (claro en modo oscuro)
const anillo = fs.readFileSync(M('anillo.svg'), 'utf8');
const cuerpo = anillo.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"><style>g{color:#171a17}@media (prefers-color-scheme:dark){g{color:#e7e4dd}}</style>${cuerpo.replace(/\sid="[^"]*"/g, '')}</svg>\n`;
fs.writeFileSync(M('favicon.svg'), fav);
const conFondo = (px) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb[0] - R * 0.18} ${vb[1] - R * 0.18} ${lado + R * 0.36} ${lado + R * 0.36}" width="${px}" height="${px}"><rect x="${vb[0] - R * 0.18}" y="${vb[1] - R * 0.18}" width="${lado + R * 0.36}" height="${lado + R * 0.36}" fill="#171a17"/><g style="color:#e7e4dd">${cuerpo.replace(/\sid="[^"]*"/g, '')}</g></svg>`;
await sharp(Buffer.from(conFondo(32))).png().toFile(M('favicon-32.png'));
await sharp(Buffer.from(conFondo(180))).png().toFile(M('apple-touch-icon.png'));
// imagen para compartir: logo claro sobre granito con la fachada al lado
const logo = fs.readFileSync(M('logo.svg'), 'utf8').replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#171a17"/><svg x="70" y="65" width="500" height="500" viewBox="${vb.join(' ')}"><g style="color:#e7e4dd">${logo.replace(/\sid="[^"]*"/g, '')}</g></svg></svg>`;
const foto = await sharp(path.join(RAIZ, 'img/fotos/fachada-1200.jpg')).resize(560, 630, { fit: 'cover', position: 'left' }).toBuffer();
await sharp(Buffer.from(og)).composite([{ input: foto, left: 640, top: 0 }]).jpeg({ quality: 82 }).toFile(path.join(RAIZ, 'img/og.jpg'));
console.log('favicons y og.jpg');
