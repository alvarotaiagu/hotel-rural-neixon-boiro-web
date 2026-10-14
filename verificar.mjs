/* Verificación de la web de Neixón (Playwright, bajando con la rueda).
   Uso: node verificar.mjs [--capturas]   → capturas en ./pruebas/ */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8762;                 // puerto propio de esta web
const CAPTURAS = process.argv.includes('--capturas');
const DIR_CAP = path.join(RAIZ, 'pruebas');
if (CAPTURAS) fs.mkdirSync(DIR_CAP, { recursive: true });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
console.log('sirviendo en ' + BASE);

const fallos = [];
let nOk = 0;
const mal = (m) => { fallos.push(m); console.log('  FALLO  ' + m); };
const ok = (m) => { nOk++; console.log('  ok     ' + m); };
const info = (m) => console.log('  ·      ' + m);
const comprobar = (cond, m, detalle) => (cond ? ok(m) : mal(m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const cap = async (page, nombre, op) => { if (CAPTURAS) await page.screenshot({ path: path.join(DIR_CAP, nombre + '.png'), ...(op || {}) }); };
const sinCookies = () => { try { localStorage.setItem('neixon-cookies', 'si'); } catch (e) {} };

const browser = await chromium.launch({ headless: true });

/* GSAP y Lenis desde una copia local: así la cortina no depende del CDN ese día */
const CDN = {
  'gsap.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'ScrollTrigger.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
  'lenis.min.js': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
};
const CACHE = path.join(os.tmpdir(), 'neixon-cdn');
fs.mkdirSync(CACHE, { recursive: true });
for (const [n, u] of Object.entries(CDN)) {
  const f = path.join(CACHE, n);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
}
const RE_CDN = /(gsap\.min|ScrollTrigger\.min|lenis\.min)\.js$/;

async function nueva(op = {}, { cdn = 'local', script } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...op });
  if (cdn === 'local') await ctx.route(RE_CDN, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) }));
  if (cdn === 'caido') await ctx.route(RE_CDN, (r) => r.abort());
  // las letras de Google, fuera: las pruebas no dependen de la red
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (script) await ctx.addInitScript(script);
  const page = await ctx.newPage();
  page._errores = [];
  page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page._errores.push('consola: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
  return { ctx, page };
}
// baja con la rueda hasta que la sección queda en su sitio y SE ASIENTA
// (Lenis sigue frenando después de la última rueda y puede pasarse)
async function bajarA(page, sel, margen = 0) {
  const top = () => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    for (let i = 0; i < 200; i++) {
      const t = await top();
      if (Math.abs(t - margen) < 30) break;
      await page.mouse.wheel(0, Math.max(-450, Math.min(450, t - margen)));
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(800);
    if (Math.abs((await top()) - margen) < 40) break;
  }
  await page.waitForTimeout(300);
}
async function bajarTodo(page) {
  for (let i = 0; i < 220; i++) {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(50);
    if (await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4)) break;
  }
  await page.waitForTimeout(900);
}
const esperarCortina = async (page, extra = 500) => {
  await page.waitForFunction(() => { const c = document.getElementById('cortina'); return !c || getComputedStyle(c).display === 'none'; }, null, { timeout: 12000 });
  await page.waitForTimeout(extra);
};

/* ================= 0. archivos ================= */
console.log('\n0. Archivos');
for (const f of fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'))) {
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  comprobar(/<meta name="robots" content="noindex/.test(s), `${f}: noindex`);
  comprobar(!/<!--svg:/.test(s), `${f}: sin marcadores de construir.mjs sin expandir`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)].slice(0, 8));
}
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png'].every((f) => fs.existsSync(path.join(RAIZ, f))), '.nojekyll, 404, manifest, og:image y favicons');
{
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !fs.existsSync(path.join(RAIZ, r)));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);
  comprobar(/rel="preload" as="image"[^>]*fachada-800\.avif/.test(html.replace(/\n\s*/g, ' ')), 'la foto LCP (fachada) va precargada');
}
const css = fs.readFileSync(path.join(RAIZ, 'css/estilos.css'), 'utf8');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{\s*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:\s*flex/.test(css), 'cookies: display:flex solo en :not([hidden])');
comprobar(/\.cortina\[hidden\]/.test(css), 'cortina: regla [hidden] propia (es display:grid)');
comprobar(!/scroll-behavior:\s*smooth/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'sin scroll-behavior:smooth (pelearía con Lenis)');
comprobar(/height:\s*100dvh/.test(css.match(/\.menu-movil \{[^}]*\}/)?.[0] || ''), 'menú móvil con altura explícita 100dvh');
{
  const src = fs.readFileSync(path.join(RAIZ, 'index.src.html'), 'utf8');
  const js = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
  comprobar(/MANDO DE MAQUETA \(no viaja al cliente; solo con \?revision\)/.test(src) && /fin del MANDO DE MAQUETA/.test(src) && /16\. MANDO DE MAQUETA/.test(js) && /fin del MANDO DE MAQUETA/.test(js), 'receta de borrado del mando: marcas en index.src.html y main.js');
  comprobar(/cdn\.jsdelivr\.net\/npm\/@studio-freight\/lenis@1\.0\.42/.test(src), 'Lenis desde jsDelivr con versión fija (cdnjs da 404)');
}

/* ================= 1. cortina ================= */
console.log('\n1. Cortina');
{
  // fotogramas a medias: se registra en la propia página (Playwright llega tarde)
  const { ctx, page } = await nueva({}, { script: () => {
    window.__muestras = [];
    const t0 = performance.now();
    const tick = () => {
      const c = document.getElementById('cortina');
      if (c) {
        const ps = Array.from(document.querySelectorAll('#cortina-anillo path'));
        const opacas = ps.filter((p) => +getComputedStyle(p).opacity > 0.9).length;
        const muro = document.getElementById('cortina-muro');
        const logo = document.getElementById('cortina-logo');
        window.__muestras.push({ t: performance.now() - t0, vis: getComputedStyle(c).display !== 'none', opacas, total: ps.length,
          agujero: muro ? (muro.getAttribute('d') || '').split('M').length - 1 : 0,
          fondo: getComputedStyle(c).backgroundColor, trans: logo ? logo.style.transform : '',
          foto: +getComputedStyle(document.getElementById('cortina-foto')).opacity });
        if (getComputedStyle(c).display !== 'none') requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  } });
  await page.goto(BASE);
  await esperarCortina(page);
  const m = await page.evaluate(() => window.__muestras);
  comprobar(m.length > 20 && m[0].vis, 'la cortina tapa al cargar', m.length);
  const total = m[0]?.total || 0;
  comprobar(total === 71, 'el anillo de la cortina tiene las 71 piedras', total);
  const aMedias = m.find((x) => x.opacas > total * 0.2 && x.opacas < total * 0.8);
  comprobar(!!aMedias, 'hay un fotograma con el anillo a medio asentar (piedra a piedra)', aMedias && aMedias.opacas);
  comprobar(m.some((x) => x.foto > 0.9), 'la foto de la casa aparece dentro del anillo');
  comprobar(m.some((x) => /translate\(calc\(-50% \+ [1-9]/.test(x.trans) || /translate\(calc\(-50% \+ -?\d+\.?\d*px\)/.test(x.trans) && x.trans.includes('scale(1.')), 'el anillo vuela hacia el dial (translate + scale)');
  const conAgujero = m.filter((x) => x.agujero >= 2);
  comprobar(conAgujero.length > 0, 'el muro llega a tener agujero (el hueco crece)');
  comprobar(conAgujero.every((x) => x.fondo === 'rgba(0, 0, 0, 0)'), 'durante el agujero la capa no tiene fondo opaco');
  const dur = m[m.length - 1].t;
  comprobar(dur > 2000 && dur < 6200, 'la cortina dura entre 2 y 6,2 s', Math.round(dur));
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none' && document.documentElement.classList.contains('cortina-fuera')), 'la cortina desaparece de verdad (display:none)');
  // el anillo de la cortina aterriza encima del del dial
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('dial-anillo')).visibility === 'visible'), 'el anillo del dial se ve al irse la cortina');
  comprobar(await page.evaluate(() => !document.getElementById('cookies').hidden), 'el aviso de cookies sale al irse la cortina');
  await cap(page, '01-hero-1440');
  comprobar(page._errores.length === 0, 'sin errores de consola ni 404 (escritorio)', page._errores);
  await ctx.close();
}
{
  const { ctx, page } = await nueva({ reducedMotion: 'reduce' }, { script: sinCookies });
  await page.goto(BASE);
  await page.waitForTimeout(300);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'), 'movimiento reducido: la cortina no se ve ni un fotograma');
  comprobar(await page.evaluate(() => !document.documentElement.classList.contains('con-movimiento')), 'movimiento reducido: sin «con-movimiento»');
  await bajarA(page, '#habitaciones');
  comprobar(await page.evaluate(() => +getComputedStyle(document.querySelector('#habs-tit')).opacity === 1 && +getComputedStyle(document.querySelector('.muro__p')).opacity === 1), 'movimiento reducido: titulares y piedras visibles');
  await ctx.close();
}
{
  const { ctx, page } = await nueva({}, { cdn: 'caido', script: sinCookies });
  await page.goto(BASE);
  await page.waitForTimeout(3600);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).visibility === 'hidden' || getComputedStyle(document.getElementById('cortina')).display === 'none'), 'sin CDN: la cortina se va sola por CSS');
  comprobar(await page.evaluate(() => { const h = document.querySelector('.hero__tit'); return getComputedStyle(h).opacity === '1' && !h.classList.contains('es-partido'); }), 'sin CDN: el titular del hero se ve entero');
  comprobar(await page.evaluate(() => Array.from(document.querySelectorAll('[data-partir]')).every((h) => !h.classList.contains('es-partido'))), 'sin CDN: ningún titular partido (se quedarían ocultos)');
  await ctx.close();
}
{
  // CDN lento (> 2,5 s): no se anima y se retira enseguida
  const { ctx, page } = await nueva({}, { cdn: 'nada', script: sinCookies });
  await ctx.route(RE_CDN, async (r) => { await espera(3000); await r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) }); });
  await page.goto(BASE);
  await page.waitForTimeout(4200);
  comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return getComputedStyle(c).display === 'none' || getComputedStyle(c).visibility === 'hidden'; }), 'CDN lento: la cortina no se queda puesta');
  await ctx.close();
}

/* ================= 2. hero y dial ================= */
console.log('\n2. Hero y dial');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page, 2600);
  const vista = () => page.evaluate(() => document.querySelector('.dial__foto.es-actual').dataset.vista);
  comprobar(await vista() === '0', 'el dial empieza en la casa');
  await page.click('#dial-sig');
  await page.waitForTimeout(1100);
  comprobar(await vista() === '1', 'flecha siguiente → vista 2', await vista());
  await page.focus('#dial-agarre');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1100);
  comprobar(await vista() === '2', 'teclado (→) con el anillo enfocado → vista 3', await vista());
  // arrastre con el ratón: un cuarto de vuelta por arriba
  const r = await page.evaluate(() => { const b = document.querySelector('.dial__marco').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width * 0.42 }; });
  const antes = await page.evaluate(() => document.getElementById('dial-anillo').style.transform);
  await page.mouse.move(r.x - r.r, r.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { const a = Math.PI + (i / 12) * (Math.PI / 2); await page.mouse.move(r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(1400);
  const despues = await page.evaluate(() => document.getElementById('dial-anillo').style.transform);
  comprobar(antes !== despues, 'arrastrar gira el anillo', [antes, despues]);
  const grados = await page.evaluate(() => parseFloat(document.getElementById('dial-anillo').style.transform.replace(/[^\d.-]/g, '')));
  comprobar(Math.abs(grados / 72 - Math.round(grados / 72)) < 0.02, 'al soltar, el anillo se asienta en una de las 5 vistas', grados);
  // la ventana del dial llena el hueco del anillo: ni lo desborda mucho (el anillo
  // la tapa) ni deja un aro de granito entre la foto y las piedras
  const geo = await page.evaluate(() => {
    const v = document.getElementById('dial-ventana').getBoundingClientRect();
    const a = document.getElementById('dial-anillo');
    const ps = Array.from(a.querySelectorAll('path[data-angulo]'));
    const cx = v.left + v.width / 2, cy = v.top + v.height / 2;
    const dists = [];
    for (const p of ps) {
      const L = p.getTotalLength(), M = p.getScreenCTM();
      let min = 1e9;
      for (let i = 0; i < 40; i++) { const q = p.getPointAtLength((i / 40) * L).matrixTransform(M); min = Math.min(min, Math.hypot(q.x - cx, q.y - cy)); }
      dists.push(min);
    }
    dists.sort((x, y) => x - y);
    // la mediana de las piedras de la fila interior marca el borde del hueco
    return { rv: +(v.width / 2).toFixed(1), min: +dists[0].toFixed(1), p10: +dists[Math.floor(dists.length * 0.1)].toFixed(1) };
  });
  comprobar(geo.min >= geo.rv * 0.93 && geo.p10 <= geo.rv * 1.06, 'la foto del dial llena el hueco del anillo sin pasarse', geo);
  comprobar(await page.evaluate(() => /^Son las \d\d:\d\d en Boiro/.test(document.getElementById('dato-vivo-txt').textContent)), 'dato en vivo: la hora de Boiro y la ventana de llegadas');
  await ctx.close();
}

/* ================= 3. muro, filtros y ficha ================= */
console.log('\n3. Habitaciones');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#habitaciones');
  const formas = await page.evaluate(() => Array.from(document.querySelectorAll('.muro__foto')).map((f) => { const m = /url\("?#([^")]+)/.exec(f.style.clipPath); return m && !!document.getElementById(m[1]); }));
  comprobar(formas.length === 10 && formas.every(Boolean), 'las 10 fotos del muro llevan forma de piedra (clipPath existente)', formas);
  await page.click('.filtro[data-filtro="jacuzzi"]');
  await page.waitForTimeout(600);
  const vis = await page.evaluate(() => Array.from(document.querySelectorAll('.muro__p')).filter((p) => !p.classList.contains('es-fuera')).map((p) => p.dataset.hab));
  comprobar(vis.length === 1 && vis[0] === 'suite', 'filtro «Con jacuzzi» → solo la Suite', vis);
  for (const [fil, n] of [['terraza', 4], ['familia', 4], ['cocina', 2], ['todas', 10]]) {
    await page.click(`.filtro[data-filtro="${fil}"]`);
    await page.waitForTimeout(150);
    const c = await page.evaluate(() => document.querySelectorAll('.muro__p:not(.es-fuera)').length);
    const rotulo = await page.evaluate((f) => document.querySelector(`.filtro[data-filtro="${f}"] span`).textContent, fil);
    comprobar(c === n && +rotulo === n, `filtro «${fil}»: ${n} y su contador dice lo mismo`, [c, rotulo]);
  }
  await page.click('.muro__p[data-hab="bungalow-i"] .muro__btn');
  await page.waitForTimeout(700);
  const ficha = await page.evaluate(() => ({ abierta: document.getElementById('ficha').open, tit: document.getElementById('ficha-tit').textContent, fotos: document.querySelectorAll('#ficha-fotos img').length, dl: document.querySelectorAll('#ficha-cuerpo dt').length }));
  comprobar(ficha.abierta && ficha.tit === 'Bungalow I' && ficha.fotos === 2 && ficha.dl >= 4, 'la ficha del Bungalow I se abre con 2 fotos y sus datos', ficha);
  await cap(page, '02-ficha');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  comprobar(await page.evaluate(() => !document.getElementById('ficha').open && document.activeElement.closest('.muro__p')?.dataset.hab === 'bungalow-i'), 'Escape cierra la ficha y el foco vuelve a su piedra');
  await page.click('.muro__p[data-hab="atico"] .muro__btn');
  await page.waitForTimeout(500);
  await page.click('#ficha-consultar');
  await page.waitForTimeout(2200);
  comprobar(await page.evaluate(() => document.getElementById('c-hab').value === 'atico'), '«Consultar fechas para esta» elige el Ático en el formulario');
  comprobar(await page.evaluate(() => Math.abs(document.getElementById('consulta').getBoundingClientRect().top) < 80), '… y lleva a la consulta');
  await ctx.close();
}

/* ================= 4. consulta ================= */
console.log('\n4. Consulta');
{
  const { ctx, page } = await nueva({}, { script: () => { try { localStorage.setItem('neixon-cookies', 'si'); } catch (e) {} window.open = (u) => { window.__abierto = u; return null; }; } });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#consulta');
  await page.click('button[data-via="whatsapp"]');
  await page.waitForTimeout(200);
  const err = await page.evaluate(() => ({ vis: !document.getElementById('form-error').hidden, txt: document.getElementById('form-error').textContent, foco: document.activeElement.id }));
  comprobar(err.vis && /llegada/.test(err.txt) && err.foco === 'c-entrada', 'sin datos: error visible y foco en el primer campo', err);
  const d = new Date(Date.now() + 20 * 864e5); const iso = d.toISOString().slice(0, 10);
  await page.fill('#c-entrada', iso);
  await page.dispatchEvent('#c-entrada', 'change');
  comprobar(await page.evaluate(() => document.getElementById('c-salida').value > document.getElementById('c-entrada').value), 'al poner la llegada, la salida pasa al día siguiente');
  await page.fill('#c-nombre', 'Prueba');
  await page.selectOption('#c-hab', 'suite');
  await page.click('button[data-via="whatsapp"]');
  await page.waitForTimeout(200);
  const url = await page.evaluate(() => window.__abierto || '');
  const txt = decodeURIComponent(url.split('text=')[1] || '');
  comprobar(url.startsWith('https://wa.me/34680882702?text='), 'WhatsApp al 680 882 702', url.slice(0, 40));
  comprobar(/Llegada: \d\d\/\d\d\/\d{4}/.test(txt) && /1 noche/.test(txt) && /Suite/.test(txt) && /Prueba/.test(txt), 'el mensaje lleva fechas, noches, alojamiento y nombre', txt);
  const tam = await page.evaluate(() => Array.from(document.querySelectorAll('.campo input, .campo select, .campo textarea')).map((c) => parseFloat(getComputedStyle(c).fontSize)));
  comprobar(tam.every((t) => t >= 16), 'ningún campo baja de 16 px (iOS no hace zoom)', tam);
  await ctx.close();
}

/* ================= 5. cabecera, cookies, pie, mapa ================= */
console.log('\n5. Cabecera, cookies, pie');
{
  const { ctx, page } = await nueva();
  await page.goto(BASE);
  await esperarCortina(page);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display === 'flex'), 'cookies visibles en la primera visita');
  await page.click('#ck-si');
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display === 'none' && localStorage.getItem('neixon-cookies') === 'si'), 'aceptar oculta el aviso y lo recuerda');
  comprobar(await page.evaluate(() => document.querySelector('.saltar').getBoundingClientRect().bottom <= 0), '«Saltar al contenido» fuera de la vista hasta que se enfoca');
  comprobar(await page.evaluate(() => document.getElementById('mando').hidden && getComputedStyle(document.getElementById('mando')).display === 'none'), 'sin ?revision el mando no está');
  await page.mouse.move(720, 450);
  await bajarA(page, '#cafeteria', 0);
  {
    const c = await page.evaluate(() => ({ cls: document.getElementById('cab').className, top: Math.round(document.getElementById('cafeteria').getBoundingClientRect().top) }));
    comprobar(/es-oscura/.test(c.cls), 'la cabecera se vuelve granito sobre la cafetería', c);
  }
  await bajarA(page, '#habitaciones', 0);
  comprobar(await page.evaluate(() => !document.getElementById('cab').classList.contains('es-oscura') && document.getElementById('cab').classList.contains('sc')), 'y vuelve a cal sobre las habitaciones');
  await bajarTodo(page);
  await page.waitForTimeout(1200);
  const pie = await page.evaluate(() => {
    const ps = Array.from(document.querySelectorAll('#pie-logo path[data-angulo]'));
    const b = document.getElementById('pie-cierre').getBoundingClientRect();
    const a = ps[0].getBoundingClientRect(), z = ps[ps.length - 1].getBoundingClientRect();
    return { op: ps.map((p) => +getComputedStyle(p).opacity), btnOp: +getComputedStyle(document.getElementById('pie-cierre')).opacity,
      cx: b.left + b.width / 2, entre: [a.right, z.left], cy: b.top + b.height / 2, alto: [Math.min(a.top, z.top), Math.max(a.bottom, z.bottom)] };
  });
  comprobar(pie.op.every((o) => o > 0.95) && pie.btnOp > 0.95, 'al final del todo, el anillo del pie está completo y el botón puesto');
  comprobar(pie.cx > pie.entre[0] - 10 && pie.cx < pie.entre[1] + 10 && pie.cy > pie.alto[0] - 30 && pie.cy < pie.alto[1] + 30, '«Consultar fechas» cierra la abertura del anillo', pie);
  await cap(page, '03-pie');
  // el mapa de Google solo al pedirlo
  comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'sin iframe de Google hasta pulsar «Ver el mapa»');
  comprobar(page._errores.filter((e) => !/google/.test(e)).length === 0, 'sin errores al recorrer la página', page._errores);
  await ctx.close();
}

/* ================= 6. lámina del Barbanza ================= */
console.log('\n6. Lámina del Barbanza');
{
  const hayDatos = fs.existsSync(path.join(RAIZ, 'js/barbanza.js'));
  comprobar(hayDatos, 'existe js/barbanza.js (datos de OSM)');
  if (hayDatos) {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(BASE);
    await esperarCortina(page);
    await bajarA(page, '#entorno', 0);
    await page.waitForTimeout(3200);
    const r = await page.evaluate(() => {
      const c = document.getElementById('lamina-lienzo');
      const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const f = [x[0], x[1], x[2]];
      let dist = 0;
      for (let i = 0; i < x.length; i += 16) if (Math.abs(x[i] - f[0]) + Math.abs(x[i + 1] - f[1]) + Math.abs(x[i + 2] - f[2]) > 30) dist++;
      const ch = c.__chapas || [];
      let pisan = 0;
      for (let i = 0; i < ch.length; i++) for (let j = i + 1; j < ch.length; j++) { const a = ch[i], b = ch[j]; if (!(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)) pisan++; }
      return { pct: dist / (x.length / 16), chapas: ch.length, pisan, lista: document.querySelectorAll('#lugares-lista .lugar').length, lugares: window.__lamina ? window.__lamina.lugares.length : 0 };
    });
    comprobar(r.pct > 0.04, 'la lámina dibuja (píxeles que se salen del fondo)', r.pct);
    comprobar(r.lista > 5 && r.lista === r.lugares, 'la lista tiene un lugar por cada punto del mapa', r);
    comprobar(r.pisan === 0, 'las etiquetas del mapa no se pisan', r.pisan);
    await page.click('.filtros--lugares .filtro[data-tipo="playa"]');
    await page.waitForTimeout(200);
    const pl = await page.evaluate(() => Array.from(document.querySelectorAll('.lugar:not(.es-fuera)')).every((l) => l.dataset.tipo === 'playa'));
    comprobar(pl, 'filtro «Playas» deja solo playas');
    await cap(page, '04-lamina');
    await page.click('.filtros--lugares .filtro[data-tipo="todos"]');
    // con el último lugar de la lista en pantalla, la lámina sigue entera a la vista
    await bajarA(page, '#lugares-lista .lugar:last-child', 600);
    const fija = await page.evaluate(() => { const r = document.getElementById('lamina').getBoundingClientRect(); const u = document.querySelector('#lugares-lista .lugar:last-child').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), alto: innerHeight, ultimo: Math.round(u.top) }; });
    comprobar(fija.top >= 60 && fija.bottom <= fija.alto && fija.ultimo < fija.alto, 'al leer los últimos lugares, la lámina sigue a la vista (sticky)', fija);
    await cap(page, '04b-lamina-fija');
    await ctx.close();
    // móvil: la lámina fija arriba y el lugar que se lee, resaltado
    {
      const { ctx, page } = await nueva({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { script: sinCookies });
      await page.goto(BASE);
      await esperarCortina(page);
      await bajarA(page, '#lugares-lista .lugar:nth-child(9)', 560);
      await page.waitForTimeout(3000);
      await page.mouse.wheel(0, 40);
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => { const r = document.getElementById('lamina').getBoundingClientRect(); const a = document.querySelector('.lugar.es-activo'); return { top: Math.round(r.top), bottom: Math.round(r.bottom), activo: a ? a.querySelector('.lugar__nom').firstChild.textContent : null, activoTop: a ? Math.round(a.getBoundingClientRect().top) : null }; });
      comprobar(m.top >= 60 && m.top < 120 && m.bottom < 844 * 0.5, 'móvil: la lámina queda fija bajo la cabecera, en la mitad de arriba', m);
      comprobar(!!m.activo && m.activoTop > m.bottom, 'móvil: el lugar que se está leyendo se resalta en el mapa', m);
      await cap(page, '04c-lamina-movil');
      await ctx.close();
    }
  }
}

/* ================= 7. móvil ================= */
console.log('\n7. Móvil');
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
  const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page, 2400);
  const m = await page.evaluate(() => {
    const d = document.querySelector('.dial__pie').getBoundingClientRect();
    const t = document.querySelector('.hero__texto').getBoundingClientRect();
    const tit = document.querySelector('.hero__tit').getBoundingClientRect();
    return { solape: d.bottom > t.top + 2, desborde: document.documentElement.scrollWidth - innerWidth, titVisible: tit.top < innerHeight };
  });
  comprobar(!m.solape, `${w}×${h}: el dial no pisa el texto del hero`, m);
  comprobar(m.desborde <= 0, `${w}×${h}: sin scroll horizontal`, m.desborde);
  if (w === 390) {
    await cap(page, '05-hero-390');
    // menú
    await page.tap('#menu-btn');
    await page.waitForTimeout(500);
    const menu = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { h: r.height, ih: innerHeight, vis: getComputedStyle(document.getElementById('menu-movil')).visibility }; });
    comprobar(menu.vis === 'visible' && Math.abs(menu.h - menu.ih) < 2, 'menú móvil a pantalla completa', menu);
    await page.tap('#menu-movil a[href="#habitaciones"]');
    await page.waitForTimeout(1600);
    comprobar(await page.evaluate(() => !document.body.classList.contains('menu') && Math.abs(document.getElementById('habitaciones').getBoundingClientRect().top) < 120), 'un enlace del menú lo cierra y lleva a su sección');
    comprobar(await page.evaluate(() => document.getElementById('barra').classList.contains('es-visible')), 'la barra de «Consultar» aparece al dejar el hero');
    // el carril del muro: cada piedra entera y deslizable
    const carril = await page.evaluate(() => { const u = document.getElementById('muro'); return { sw: u.scrollWidth, cw: u.clientWidth, ox: getComputedStyle(u).overflowX }; });
    comprobar(carril.ox === 'auto' && carril.sw > carril.cw * 3, 'en móvil, el muro es un carril que se desliza', carril);
    // la barra del navegador no rehace nada: 0 refresh de ScrollTrigger
    await page.evaluate(() => { window.__refrescos = 0; ScrollTrigger.addEventListener('refresh', () => window.__refrescos++); });
    for (let i = 0; i < 6; i++) { await page.setViewportSize({ width: 390, height: i % 2 ? 844 : 900 }); await page.waitForTimeout(260); }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    comprobar(await page.evaluate(() => window.__refrescos) === 0, 'la barra del móvil sube y baja: 0 refresh', await page.evaluate(() => window.__refrescos));
  }
  await ctx.close();
}

/* ================= 8. versión «Sobria» (?revision) ================= */
console.log('\n8. Densidades');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE + '?revision');
  await esperarCortina(page);
  comprobar(await page.evaluate(() => !document.getElementById('mando').hidden), 'con ?revision se ve el mando');
  await page.click('#mando button[data-densidad="sobria"]');
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => ({
    tabla: getComputedStyle(document.getElementById('tabla-habs')).display,
    galeria: getComputedStyle(document.getElementById('galeria')).display,
    clip: getComputedStyle(document.querySelector('.muro__foto')).clipPath,
    url: location.search,
  }));
  comprobar(s.tabla === 'block' && s.galeria === 'block', '«Sobria» añade la tabla de alojamientos y la galería', s);
  comprobar(s.clip === 'none', '«Sobria»: las fotos del muro, rectas', s.clip);
  comprobar(/densidad=sobria/.test(s.url), 'la URL recuerda la densidad (sin guardar nada)', s.url);
  await ctx.close();
}

/* ================= 9. contraste ================= */
console.log('\n9. Contraste');
{
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const v = (n) => (css.match(new RegExp(`--${n}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
  for (const [t, f, min] of [['tinta', 'cal', 7], ['tinta-2', 'cal', 4.5], ['tinta-2', 'papel', 4.5], ['musgo', 'cal', 4.5], ['piedra', 'granito', 7], ['piedra-2', 'granito', 4.5], ['piedra-tenue', 'granito', 4.5], ['piedra-tenue', 'granito-2', 4.5], ['musgo-claro', 'granito', 4.5], ['tinta', 'musgo-claro', 4.5], ['tinta', 'piedra', 7]]) {
    const r = ratio(v(t), v(f));
    comprobar(r >= min, `${t} sobre ${f}: ${r.toFixed(2)}:1 (mín. ${min})`);
  }
}

await browser.close();
servidor.close();
console.log(`\n${nOk} bien, ${fallos.length} fallos`);
if (fallos.length) { console.log(fallos.map((f) => ' - ' + f).join('\n')); process.exit(1); }
