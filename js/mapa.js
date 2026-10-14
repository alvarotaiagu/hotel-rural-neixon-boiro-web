/* ------------------------------------------------------------------
   Neixón · la lámina del Barbanza
   Costa, carreteras y ríos de OpenStreetMap (js/barbanza.js, en metros
   desde la puerta del hotel) dibujados en canvas como una carta antigua:
   la costa se traza desde el hotel hacia fuera y, por el lado del agua,
   lleva ondas grabadas. En OSM la tierra queda siempre a la IZQUIERDA del
   sentido del trazo de costa: así se sabe de qué lado está el mar.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const B = window.BARBANZA;
  const lienzo = document.getElementById('lamina-lienzo');
  const lista = document.getElementById('lugares-lista');
  if (!B || !lienzo || !lista) return;

  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fino = matchMedia('(pointer: fine)').matches;
  const css = getComputedStyle(document.documentElement);
  const C = {
    tierra: css.getPropertyValue('--cal').trim() || '#f4f1ea',
    costa: '#2c3a33',
    agua: css.getPropertyValue('--ria').trim() || '#2f4c58',
    carretera: 'rgba(28, 31, 28, .30)',
    principal: 'rgba(28, 31, 28, .55)',
    rio: 'rgba(47, 76, 88, .55)',
    tinta: css.getPropertyValue('--tinta').trim() || '#1c1f1c',
    musgo: css.getPropertyValue('--musgo').trim() || '#3e5a3a',
    teja: css.getPropertyValue('--teja').trim() || '#b65a36',
  };
  const TIPOS = { playa: 'playa', castro: 'castro', patrimonio: 'castro', naturaleza: 'excursion', excursion: 'excursion', ciudad: 'pueblo' };
  const TXT_TIPO = { playa: 'Playa', castro: 'Castro', patrimonio: 'Patrimonio', naturaleza: 'Naturaleza', excursion: 'Excursión', ciudad: 'Pueblo' };
  // lo que el tiempo en coche no cuenta (de las notas de datos/barbanza.json)
  const MATIZ = {
    cortegada: 'en coche hasta O Carril; a la isla, en barco',
    barona: 'el último tramo, a pie',
    corrubedo: 'el último tramo, a pie',
  };
  // fuera: «Ruta das Mámoas» no existe como ruta en OSM y su tiempo (43 min
  // para 16 km por pistas) no es fiable; se queda en datos/ como duda
  const FUERA = new Set(['mamoas']);

  // los lugares que caben en la lámina (Santiago y el aeropuerto van en «Cómo llegar»)
  const caja = B.caja;
  const dentro = (l) => l.x >= caja.x0 && l.x <= caja.x1 && l.y >= caja.y0 && l.y <= caja.y1;
  const lugares = (B.lugares || [])
    .filter((l) => !FUERA.has(l.id) && dentro(l) && l.coche)
    .sort((a, b) => (a.coche.min - b.coche.min) || (a.coche.km - b.coche.km));

  /* ---------- la lista (accesible, y la que manda) ---------- */
  lista.innerHTML = '';
  lugares.forEach((l, i) => {
    l.n = i + 1;
    const li = document.createElement('li');
    li.className = 'lugar';
    li.dataset.tipo = TIPOS[l.tipo] || 'excursion';
    li.dataset.i = i;
    const pie = (l.pie && l.pie.km < 3 ? `<small>${l.pie.min} min a pie</small>` : '') + (MATIZ[l.id] ? `<small>${MATIZ[l.id]}</small>` : '');
    const gl = l.nombreGl && l.nombreGl !== l.nombre ? `<span class="lugar__gl">${l.nombreGl} · ${TXT_TIPO[l.tipo] || ''}</span>` : `<span class="lugar__gl">${TXT_TIPO[l.tipo] || ''}</span>`;
    li.innerHTML = `<span class="lugar__n">${String(l.n).padStart(2, '0')}</span><span class="lugar__nom">${l.nombre}${gl}</span><span class="lugar__dist">${l.coche.min} min en coche${pie}<small>${String(l.coche.km).replace('.', ',')} km</small></span>`;
    li.tabIndex = 0;
    li.setAttribute('aria-label', `${l.nombre}: ${l.coche.min} minutos en coche, ${String(l.coche.km).replace('.', ',')} kilómetros${l.pie && l.pie.km < 3 ? `, ${l.pie.min} minutos a pie` : ''}${MATIZ[l.id] ? `; ${MATIZ[l.id]}` : ''}`);
    const activar = () => resaltar(i);
    li.addEventListener('mouseenter', activar);
    li.addEventListener('focus', activar);
    li.addEventListener('mouseleave', () => resaltar(-1));
    li.addEventListener('blur', () => resaltar(-1));
    lista.appendChild(li);
  });
  const items = Array.from(lista.children);

  // filtros por tipo
  const filtros = Array.from(document.querySelectorAll('.filtros--lugares .filtro'));
  let tipoActivo = 'todos';
  filtros.forEach((b) => b.addEventListener('click', () => {
    tipoActivo = b.dataset.tipo;
    filtros.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    items.forEach((li) => li.classList.toggle('es-fuera', tipoActivo !== 'todos' && li.dataset.tipo !== tipoActivo));
    pintarFinal();
  }));
  const visible = (l) => tipoActivo === 'todos' || (TIPOS[l.tipo] || 'excursion') === tipoActivo;

  /* ---------- el lienzo ---------- */
  const ctx = lienzo.getContext('2d');
  let W = 0, H = 0, dpr = 1, esc = 1, ox = 0, oy = 0, gf = 1;
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  const P = (x, y) => [ox + x * esc, oy + y * esc];

  function medir() {
    const r = lienzo.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [lienzo, base]) { c.width = W * dpr; c.height = H * dpr; }
    // encuadre: la caja entera con margen, centrada
    const m = 22;
    const cw = caja.x1 - caja.x0, ch = caja.y1 - caja.y0;
    esc = Math.min((W - 2 * m) / cw, (H - 2 * m) / ch);
    ox = (W - cw * esc) / 2 - caja.x0 * esc;
    oy = (H - ch * esc) / 2 - caja.y0 * esc;
    gf = Math.max(0.75, Math.min(1.6, W / 620));   // grosor según el ancho: a 1440 no se ve lavado
  }

  // distancia al hotel (el origen) de cada vértice, para el frente que crece
  const dist = (x, y) => Math.hypot(x, y);
  const radioMax = Math.max(...[[caja.x0, caja.y0], [caja.x1, caja.y0], [caja.x0, caja.y1], [caja.x1, caja.y1]].map(([x, y]) => dist(x, y)));

  // traza una polilínea plana [x,y,x,y…] hasta el radio «frente» (en metros)
  function trazo(c, p, frente) {
    let dentroAnt = false, empezado = false;
    for (let i = 0; i < p.length; i += 2) {
      const d = dist(p[i], p[i + 1]);
      const si = frente === undefined || d <= frente;
      const [x, y] = P(p[i], p[i + 1]);
      if (si) {
        if (!empezado || !dentroAnt) { c.moveTo(x, y); empezado = true; } else c.lineTo(x, y);
      }
      dentroAnt = si;
    }
  }
  // ondas del lado del agua: la misma costa desplazada a la derecha del trazo
  function ondas(c, p, frente, sep) {
    let empezado = false, dentroAnt = false;
    for (let i = 0; i < p.length; i += 2) {
      const d = dist(p[i], p[i + 1]);
      const si = frente === undefined || d <= frente;
      const j0 = Math.max(0, i - 2), j1 = Math.min(p.length - 2, i + 2);
      const [ax, ay] = P(p[j0], p[j0 + 1]);
      const [bx, by] = P(p[j1], p[j1 + 1]);
      let nx = -(by - ay), ny = bx - ax;           // derecha del trazo en pantalla (y hacia abajo)
      const L = Math.hypot(nx, ny) || 1;
      nx /= L; ny /= L;
      const [x, y] = P(p[i], p[i + 1]);
      const X = x + nx * sep, Y = y + ny * sep;
      if (si) { if (!empezado || !dentroAnt) { c.moveTo(X, Y); empezado = true; } else c.lineTo(X, Y); }
      dentroAnt = si;
    }
  }

  function pintarMapa(c, frente) {
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.fillStyle = C.tierra;
    c.fillRect(0, 0, W, H);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // ríos
    c.strokeStyle = C.rio; c.lineWidth = 1.1 * gf;
    c.beginPath(); (B.rios || []).forEach((p) => trazo(c, p, frente)); c.stroke();
    // carreteras: secundarias y principales
    (B.carreteras || []).forEach((r) => {
      const prin = r.nivel === 'motorway' || r.nivel === 'trunk' || r.nivel === 'primary';
      c.strokeStyle = prin ? C.principal : C.carretera;
      c.lineWidth = (prin ? 1.5 : 0.9) * gf;
      c.beginPath(); trazo(c, r.p, frente); c.stroke();
    });
    // ondas del agua: tres líneas cada vez más tenues
    [[3.2, 0.42], [6.6, 0.26], [10.5, 0.14]].forEach(([s, a]) => {
      c.strokeStyle = `rgba(47, 76, 88, ${a})`;
      c.lineWidth = 0.9 * gf;
      c.beginPath(); (B.costa || []).forEach((p) => ondas(c, p, frente, s * gf)); c.stroke();
    });
    // la costa
    c.strokeStyle = C.costa; c.lineWidth = 1.7 * gf;
    c.beginPath(); (B.costa || []).forEach((p) => trazo(c, p, frente)); c.stroke();
    c.restore();
  }

  // una piedrecita (canto rodado) para cada lugar
  function piedra(c, x, y, r, color, i) {
    const k = 0.18;
    c.beginPath();
    for (let a = 0; a <= 6; a++) {
      const t = (a / 6) * Math.PI * 2;
      const rr = r * (1 + k * Math.sin(t * 2 + i) * 0.6 + k * Math.cos(t * 3 + i * 1.7) * 0.4);
      const px = x + Math.cos(t) * rr * 1.18, py = y + Math.sin(t) * rr * 0.92;
      if (a === 0) c.moveTo(px, py); else c.quadraticCurveTo(x + Math.cos(t - Math.PI / 6) * rr * 1.3, y + Math.sin(t - Math.PI / 6) * rr * 1.05, px, py);
    }
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }

  let activo = -1;
  function chapas(c, frente) {
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ocupado = [];
    const choca = (r) => r.x < 4 || r.y < 4 || r.x + r.w > W - 4 || r.y + r.h > H - 22 || ocupado.some((o) => !(r.x + r.w < o.x || o.x + o.w < r.x || r.y + r.h < o.y || o.y + o.h < r.y));
    // el hotel
    const [hx, hy] = P(0, 0);
    c.strokeStyle = C.teja; c.lineWidth = 2 * gf;
    c.beginPath(); c.arc(hx, hy, 7.5 * gf, 0.62 * Math.PI, 2.38 * Math.PI); c.stroke();   // un anillo abierto por abajo, como el logo
    c.fillStyle = C.teja; c.beginPath(); c.arc(hx, hy, 2.6 * gf, 0, Math.PI * 2); c.fill();
    c.font = `700 ${Math.round(11.5 * Math.min(gf, 1.25))}px Figtree, system-ui, sans-serif`;
    const tH = 'Neixón · el hotel';
    const wH = c.measureText(tH).width + 12;
    const rH = { x: hx + 12 * gf, y: hy - 9, w: wH, h: 18 };
    if (choca(rH)) { rH.x = hx - 12 * gf - wH; }
    ocupado.push({ x: hx - 10, y: hy - 10, w: 20, h: 20 }, rH);
    c.fillStyle = 'rgba(244, 241, 234, .92)';
    c.fillRect(rH.x, rH.y, rH.w, rH.h);
    c.fillStyle = C.teja; c.fillText(tH, rH.x + 6, rH.y + 13);

    const puestas = [];
    // primero el activo (si lo hay), para que su etiqueta gane
    const orden = lugares.map((l, i) => i).sort((a, b) => (b === activo) - (a === activo));
    c.font = `600 ${Math.round(11 * Math.min(gf, 1.2))}px Figtree, system-ui, sans-serif`;
    orden.forEach((i) => {
      const l = lugares[i];
      if (!visible(l)) return;
      if (frente !== undefined && dist(l.x, l.y) > frente) return;
      const [x, y] = P(l.x, l.y);
      const es = i === activo;
      piedra(c, x, y, (es ? 6.5 : 4.6) * gf, es ? C.teja : C.musgo, i);
      const t = `${l.n} · ${l.nombre}`;
      const w = c.measureText(t).width + 10, h = 17;
      const cand = [[x + 9 * gf, y - h / 2], [x - 9 * gf - w, y - h / 2], [x - w / 2, y - 9 * gf - h], [x - w / 2, y + 9 * gf]];
      let r = null;
      for (const [cx, cy] of cand) { const q = { x: cx, y: cy, w, h }; if (!choca(q)) { r = q; break; } }
      if (!r && es) r = { x: cand[0][0], y: cand[0][1], w, h };
      ocupado.push({ x: x - 6, y: y - 6, w: 12, h: 12 });
      if (!r) return;
      ocupado.push(r);
      puestas.push({ i, ...r });
      c.fillStyle = es ? C.tinta : 'rgba(244, 241, 234, .9)';
      c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = es ? '#f4f1ea' : C.tinta;
      c.fillText(t, r.x + 5, r.y + 12.5);
    });
    lienzo.__chapas = puestas;   // para las pruebas: que no se pisen

    // rosa de los vientos y escala, arriba a la izquierda (abajo va la fuente)
    c.fillStyle = C.tinta; c.strokeStyle = C.tinta; c.lineWidth = 1;
    const nx = 26, ny = 30;
    c.beginPath(); c.moveTo(nx, ny - 14); c.lineTo(nx + 5, ny + 4); c.lineTo(nx, ny); c.lineTo(nx - 5, ny + 4); c.closePath(); c.fill();
    c.font = '700 10px Figtree, system-ui, sans-serif'; c.fillText('N', nx - 3.5, ny + 17);
    const km = 5, px = km * 1000 * esc;
    const sx = 48, sy = 30;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + px, sy); c.moveTo(sx, sy - 4); c.lineTo(sx, sy + 4); c.moveTo(sx + px, sy - 4); c.lineTo(sx + px, sy + 4); c.stroke();
    c.fillText(`${km} km`, sx + px / 2 - 12, sy - 7);
    c.restore();
  }

  function pintarFinal() {
    if (!W) medir();
    pintarMapa(bctx, undefined);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(base, 0, 0);
    chapas(ctx, undefined);
  }
  function resaltar(i) {
    activo = i;
    items.forEach((li, k) => li.classList.toggle('es-activo', k === i));
    if (hecho) pintarFinal();
  }

  /* ---------- el trazado: desde el hotel hacia fuera ---------- */
  let hecho = false, arrancado = false;
  function arrancar() {
    if (arrancado) return;
    arrancado = true;
    medir();
    if (quieto) { hecho = true; pintarFinal(); return; }
    const t0 = performance.now(), DUR = 2600;
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - t0) / DUR);
      const e = 1 - Math.pow(1 - t, 2.4);                       // frena al final
      const frente = 1500 + e * radioMax;                         // el primer fotograma ya enseña el entorno del hotel
      pintarMapa(ctx, frente);
      chapas(ctx, frente);
      if (t < 1) requestAnimationFrame(paso);
      else { hecho = true; pintarFinal(); }
    };
    requestAnimationFrame(paso);
  }
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { arrancar(); io.disconnect(); }
  }, { rootMargin: '0px 0px -15% 0px' });
  io.observe(lienzo);

  // en táctil no hay «pasar el ratón»: con la lámina fija arriba, se resalta en
  // el mapa el lugar que se está leyendo (el que cruza el primer tercio de lo
  // que queda de pantalla bajo la lámina). Solo lee posiciones: no rehace nada.
  if (!fino) {
    const lamina = lienzo.parentElement;
    let pendiente = 0, actual = -1;
    const leer = () => {
      pendiente = 0;
      if (!hecho) return;
      const rl = lamina.getBoundingClientRect();
      const rLista = lista.getBoundingClientRect();
      let elegido = -1;
      if (rLista.top < innerHeight && rLista.bottom > rl.bottom) {
        const linea = rl.bottom + (innerHeight - rl.bottom) * 0.35;
        let mejor = Infinity;
        items.forEach((li, k) => {
          if (li.classList.contains('es-fuera')) return;
          const r = li.getBoundingClientRect();
          if (r.bottom < rl.bottom) return;               // ya pasó por debajo de la lámina
          const d = Math.abs((r.top + r.bottom) / 2 - linea);
          if (d < mejor) { mejor = d; elegido = k; }
        });
      }
      if (elegido !== actual) { actual = elegido; resaltar(elegido); }
    };
    addEventListener('scroll', () => { if (!pendiente) pendiente = requestAnimationFrame(leer); }, { passive: true });
  }

  // resize de verdad (no el de la barra del móvil): se vuelve a medir y a pintar
  let aw = innerWidth, ah = innerHeight, tr = 0;
  addEventListener('resize', () => {
    if (!fino && innerWidth === aw && Math.abs(innerHeight - ah) < 160) return;
    clearTimeout(tr);
    tr = setTimeout(() => { aw = innerWidth; ah = innerHeight; if (hecho) { medir(); pintarFinal(); } }, 200);
  });
  window.__lamina = { lugares, pintarFinal, resaltar };
})();
