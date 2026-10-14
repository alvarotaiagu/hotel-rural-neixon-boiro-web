/* Prepara las fotos de la web desde la biblioteca de medios de ruralneixon.com.
   Uso: node scripts/fotos.mjs <carpeta con las descargas por id>
   - Gradación común y sutil: algo menos de saturación (las regeneradas con IA
     vienen con el cielo y los rojos muy subidos) y un punto cálido.
   - Nunca amplía: los anchos se recortan al ancho original.
   - Escribe img/fotos/<nombre>-<ancho>.{avif,webp,jpg} y img/fotos/fotos.json. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = process.argv[2];
if (!ORIGEN) throw new Error('Falta la carpeta de descargas');
const SALIDA = path.join(RAIZ, 'img/fotos');
fs.mkdirSync(SALIDA, { recursive: true });

// nombre → id de la biblioteca de medios. ia: regenerada con IA en su web (ChatGPT-Image o PNG de 2026).
const FOTOS = [
  ['fachada', 297, false, 'P1010061-scaled.jpg'],
  ['balcon-pinar', 630, true],
  ['jacuzzi', 1485, true],
  ['suite', 591, true],
  ['suite-jacuzzi', 589, true],
  ['confort', 598, true],
  ['doble', 1148, true],
  ['duplex', 603, true],
  ['terraza', 614, true],
  ['terraza-fuera', 610, true],
  ['terraza-superior', 621, true],
  ['terraza-superior-tumbonas', 608, true],
  ['atico', 628, true],
  ['superior', 624, true],
  ['bungalow-i', 933, true],
  ['bungalow-i-chimenea', 925, true],
  ['bungalow-i-salon', 926, true],
  ['bungalow-ii', 942, true],
  ['bungalow-ii-cocina', 946, true],
  ['bungalows', 914, true],
  ['bungalows-porche', 900, true],
  ['cafeteria', 955, true],
  ['cafeteria-sala', 958, true],
  ['cafe', 959, true],
  ['cafeteria-barra', 961, true],
  ['escalera', 327, true],
];
const ANCHOS = [480, 800, 1200, 1600, 2200];

const media = JSON.parse(fs.readFileSync(path.join(RAIZ, 'ref/media.json'), 'utf8'));
const porId = new Map(media.map((m) => [m.id, m]));
const archivos = fs.readdirSync(ORIGEN);

const salida = [];
for (const [nombre, id, ia] of FOTOS) {
  const f = archivos.find((a) => a.split('.')[0] === String(id));
  if (!f) throw new Error(`Falta la descarga ${id} (${nombre})`);
  const fuente = path.join(ORIGEN, f);
  const meta = await sharp(fuente).metadata();
  const anchos = ANCHOS.filter((w) => w <= meta.width);
  if (!anchos.length || anchos[anchos.length - 1] < meta.width * 0.8) anchos.push(meta.width);
  const base = sharp(fuente).rotate().removeAlpha()
    .modulate({ saturation: ia ? 0.86 : 0.94, brightness: 1.0 })
    // un punto cálido: rojo +2 %, azul −3 %
    .recomb([[1.02, 0, 0], [0, 1, 0], [0, 0, 0.97]]);
  const buf = await base.toBuffer();
  for (const w of anchos) {
    const r = sharp(buf).resize({ width: w, withoutEnlargement: true });
    await r.clone().avif({ quality: 52, effort: 5 }).toFile(path.join(SALIDA, `${nombre}-${w}.avif`));
    await r.clone().webp({ quality: 78 }).toFile(path.join(SALIDA, `${nombre}-${w}.webp`));
    await r.clone().jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(path.join(SALIDA, `${nombre}-${w}.jpg`));
  }
  const m = porId.get(id);
  salida.push({
    nombre, origen: m ? m.url.split('/uploads/')[1] : f, ia,
    ancho: meta.width, alto: meta.height, anchos, formatos: ['avif', 'webp', 'jpg'],
  });
  console.log(nombre.padEnd(28), `${meta.width}x${meta.height}`, anchos.join(','), ia ? 'IA' : 'real');
}
fs.writeFileSync(path.join(SALIDA, 'fotos.json'), JSON.stringify(salida, null, 2));
console.log(salida.length, 'fotos');
