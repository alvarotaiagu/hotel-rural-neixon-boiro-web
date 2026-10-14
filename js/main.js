/* ------------------------------------------------------------------
   Neixón · Hotel Rural · «El castro»
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const hayGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fino = matchMedia('(pointer: fine)').matches;
  // «con-movimiento» SOLO con GSAP y sin movimiento reducido: si no, los
  // titulares partidos y las entradas se quedarían escondidos.
  const motion = hayGSAP && !quieto;
  if (motion) raiz.classList.add('con-movimiento');
  if (hayGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    // el resize lo gestionamos nosotros (la barra del móvil no rehace nada)
    ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load', ignoreMobileResize: true });
  }

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const f = (n) => Math.round(n * 100) / 100;
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => !fino && innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. titulares partidos en palabras ============ */
  function partir(h) {
    if (h.classList.contains('es-partido')) return;
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    let n = 0;
    const envolver = (nodo) => {
      if (nodo.nodeType === 3) {
        const frag = document.createDocumentFragment();
        nodo.textContent.split(/([\s]+)/).forEach((t) => {
          if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
          const pal = document.createElement('span');
          pal.className = 'pal';
          pal.setAttribute('aria-hidden', 'true');
          const i = document.createElement('i');
          i.textContent = t;
          i.style.setProperty('--n', n++);
          pal.appendChild(i);
          frag.appendChild(pal);
        });
        nodo.replaceWith(frag);
      } else if (nodo.nodeType === 1) {
        Array.from(nodo.childNodes).forEach(envolver);
      }
    };
    Array.from(h.childNodes).forEach(envolver);
    h.classList.add('es-partido');
  }
  const vistos = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  if (motion) {
    $$('[data-partir]').forEach((h) => {
      if (h.closest('.hero')) return;     // el del hero, al abrirse la cortina
      partir(h);
      vistos.observe(h);
    });
    // entradas suaves: fotos, piedras del muro, opiniones
    const revelar = (sel, escalon) => $$(sel).forEach((el, i) => {
      el.setAttribute('data-revela', '');
      if (escalon) el.style.setProperty('--d', i % escalon);
      vistos.observe(el);
    });
    revelar('.muro__p', 3);
    revelar('.opi__item', 2);
    revelar('.bung__foto, .cafe__foto, .cifras li, .lamina, .form, .mapa');
  }

  /* ============ 2. Lenis ============ */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, lerp: 0.12 });
    if (hayGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
    } else {
      const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
  }
  const irA = (sel) => {
    const el = $(sel);
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - (sel === '#consulta' ? 0 : 60);
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };

  /* ============ 3. el anillo: geometría común ============
     Todos los SVG del anillo (marca/anillo.svg) llevan el mismo viewBox
     cuadrado y centrado en el anillo (lo deja así scripts/marca.mjs), así que
     la geometría se mide una vez y vale para la cortina, el dial y el pie. */
  const GEO = window.GEO_ANILLO || { cx: 0.5, cy: 0.5, ri: 0.315, ro: 0.5 };
  const piedrasDe = (svg) => (svg ? $$('path[data-angulo]', svg) : []);

  // lo que está fuera de la pantalla y mide cajas de SVG se monta en un rato
  // libre, con la cortina ya fuera (si no, sus tareas largas la entrecortan)
  const tardias = [];
  let tardiasLanzadas = false;
  const lanzarTardias = () => {
    if (tardiasLanzadas) return;
    tardiasLanzadas = true;
    const libre = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
    setTimeout(() => tardias.forEach((fn) => libre(fn)), 400);
  };

  // formas de piedra para las fotos del muro: clipPath en objectBoundingBox
  // con la piedra escalada a su propia caja (no hace falta reescribir el trazado)
  tardias.push(function formasDelMuro() {
    const fuente = $('#dial-anillo');
    const piedras = piedrasDe(fuente);
    const fotos = $$('.muro__foto');
    if (!piedras.length || !fotos.length) return;
    const NS = 'http://www.w3.org/2000/svg';
    const cajas = piedras.map((p) => ({ p, b: p.getBBox() }))
      .filter(({ b }) => b.width > 0 && b.height > 0)
      .map((o) => ({ ...o, ar: o.b.width / o.b.height, area: o.b.width * o.b.height }));
    // las más grandes y no muy alargadas: se leen como piedra a cualquier tamaño
    const buenas = cajas.filter((o) => o.ar > 0.72 && o.ar < 1.7).sort((a, b) => b.area - a.area);
    if (buenas.length < 3) return;
    const defs = document.createElementNS(NS, 'svg');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    defs.setAttribute('aria-hidden', 'true');
    defs.style.position = 'absolute';
    const d = document.createElementNS(NS, 'defs');
    defs.appendChild(d);
    fotos.forEach((foto, i) => {
      const o = buenas[(i * 3) % Math.min(buenas.length, 18)];
      const cp = document.createElementNS(NS, 'clipPath');
      cp.id = 'forma-' + i;
      cp.setAttribute('clipPathUnits', 'objectBoundingBox');
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', o.p.getAttribute('d'));
      // un poco de margen para que las fotos no queden demasiado mordidas
      const m = 0.015;
      path.setAttribute('transform', `translate(${-m} ${-m}) scale(${f(1e4 * (1 + 2 * m) / o.b.width) / 1e4} ${f(1e4 * (1 + 2 * m) / o.b.height) / 1e4}) translate(${f(-o.b.x)} ${f(-o.b.y)})`);
      cp.appendChild(path);
      d.appendChild(cp);
      foto.style.clipPath = `url(#forma-${i})`;
      foto.classList.add('es-piedra');
    });
    document.body.appendChild(defs);
  });

  // hileras: una fila de piedras del anillo como separador de secciones
  tardias.push(function hileras() {
    const fuente = $('#dial-anillo');
    const piedras = piedrasDe(fuente);
    if (!piedras.length) return;
    const NS = 'http://www.w3.org/2000/svg';
    $$('.hilera').forEach((h, k) => {
      const svg = document.createElementNS(NS, 'svg');
      const H = 34;
      let x = 0;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('fill', 'currentColor');
      for (let i = 0; x < 1400; i++) {
        const p = piedras[(i * 7 + k * 11) % piedras.length];
        const b = p.getBBox();
        if (!b.width) continue;
        const s = (H * (0.62 + ((i * 37) % 10) / 40)) / b.height;
        const w = b.width * s;
        const u = document.createElementNS(NS, 'path');
        u.setAttribute('d', p.getAttribute('d'));
        const y = (H - b.height * s) / 2;
        u.setAttribute('transform', `translate(${f(x)} ${f(y)}) scale(${f(s * 1000) / 1000}) translate(${f(-b.x)} ${f(-b.y)})`);
        g.appendChild(u);
        x += w + 5;
      }
      svg.setAttribute('viewBox', `0 0 ${f(x)} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.setAttribute('aria-hidden', 'true');
      svg.appendChild(g);
      h.appendChild(svg);
    });
  });

  /* ============ 4. dial del hero: girar el anillo ============ */
  const dial = (function () {
    const marco = $('.dial__marco');
    const anillo = $('#dial-anillo');
    const agarre = $('#dial-agarre');
    if (!marco || !anillo || !agarre) return null;
    marco.style.setProperty('--ri', (GEO.ri * 100) + '%');
    marco.style.setProperty('--cx', (GEO.cx * 100) + '%');
    marco.style.setProperty('--cy', (GEO.cy * 100) + '%');
    anillo.style.transformOrigin = `${GEO.cx * 100}% ${GEO.cy * 100}%`;
    const fotos = $$('.dial__foto');
    const N = fotos.length;
    const PASO = 360 / N;
    const NOMBRES = ['La casa', 'El balcón al pinar', 'El jacuzzi de la suite', 'La chimenea del bungalow', 'La cafetería'];
    const num = $('#dial-num'), txt = $('#dial-txt');
    let rot = 0, actual = 0, tween = null, movido = false;
    const mod = (a, n) => ((a % n) + n) % n;
    function pintar() {
      anillo.style.transform = `rotate(${f(rot)}deg)`;
      const i = mod(Math.round(rot / PASO), N);
      if (i !== actual) {
        fotos[actual].classList.remove('es-actual');
        fotos[i].classList.add('es-actual');
        actual = i;
        num.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
        txt.textContent = NOMBRES[i] || '';
      }
    }
    function ir(destino, dur) {
      if (tween) tween.kill();
      if (!motion) { rot = destino; pintar(); return; }
      const o = { r: rot };
      tween = gsap.to(o, { r: destino, duration: dur || 0.9, ease: 'power3.out', onUpdate: () => { rot = o.r; pintar(); } });
    }
    const paso = (d) => ir(Math.round(rot / PASO) * PASO + d * PASO);
    $('#dial-sig').addEventListener('click', () => paso(1));
    $('#dial-ant').addEventListener('click', () => paso(-1));
    agarre.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); paso(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); paso(-1); }
    });
    // arrastre: el ángulo del dedo respecto al centro del anillo
    let arrastrando = false, a0 = 0, r0 = 0, ultimos = [];
    const angulo = (e) => {
      const r = marco.getBoundingClientRect();
      const cx = r.left + r.width * GEO.cx, cy = r.top + r.height * GEO.cy;
      return Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    };
    agarre.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      arrastrando = true; movido = false;
      if (tween) tween.kill();
      a0 = angulo(e); r0 = rot; ultimos = [{ t: performance.now(), r: rot }];
      agarre.setPointerCapture(e.pointerId);
    });
    agarre.addEventListener('pointermove', (e) => {
      if (!arrastrando) return;
      let d = angulo(e) - a0;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      if (Math.abs(d) > 2) movido = true;
      // el paso por ±180 se acumula: el giro sigue al dedo vuelta tras vuelta
      a0 += d; r0 += d; rot = r0;
      ultimos.push({ t: performance.now(), r: rot });
      if (ultimos.length > 6) ultimos.shift();
      pintar();
    });
    const soltar = () => {
      if (!arrastrando) return;
      arrastrando = false;
      const a = ultimos[0], b = ultimos[ultimos.length - 1];
      const v = b && a && b.t > a.t ? (b.r - a.r) / (b.t - a.t) : 0;   // grados por ms
      const lanzado = rot + Math.max(-1, Math.min(1, v)) * 260;          // inercia
      ir(Math.round(lanzado / PASO) * PASO, 1.1);
    };
    agarre.addEventListener('pointerup', soltar);
    agarre.addEventListener('pointercancel', soltar);
    agarre.addEventListener('click', () => { if (!movido) paso(1); });
    // el gesto se enseña solo una vez, al abrirse la cortina (sin guardar nada)
    function ensenar() {
      if (!motion || movido) return;
      const o = { r: 0 };
      gsap.timeline({ delay: 0.9 })
        .to(o, { r: 16, duration: 0.55, ease: 'power2.out', onUpdate: () => { if (!arrastrando) { rot = o.r; pintar(); } } })
        .to(o, { r: 0, duration: 0.9, ease: 'elastic.out(1, .5)', onUpdate: () => { if (!arrastrando) { rot = o.r; pintar(); } } });
    }
    return { ensenar };
  })();

  /* ============ 5. cortina: el anillo se asienta y vuela al dial ============ */
  const cortina = $('#cortina');
  let heroEntrado = false;
  function entradaHero() {
    if (heroEntrado) return;
    heroEntrado = true;
    const h1 = $('.hero__tit');
    if (motion) {
      partir(h1);
      requestAnimationFrame(() => requestAnimationFrame(() => h1.classList.add('es-visto')));
      gsap.from(['.hero .eti', '.hero__entra', '.hero__acc', '.hero__dato', '.dial__pie', '.hero__coord'], { opacity: 0.02, y: 18, duration: 0.9, ease: 'power3.out', stagger: 0.07, delay: 0.2, immediateRender: true });
      if (dial) dial.ensenar();
    }
  }

  function retirarCortina() {
    if (!cortina || cortina.hidden) return;
    cortina.hidden = true;
    raiz.classList.add('cortina-fuera');
    document.body.style.removeProperty('overflow');
    if (lenis) lenis.start();
    if (hayGSAP) { gsap.ticker.lagSmoothing(0); ScrollTrigger.refresh(); }
    entradaHero();
    mostrarCookies();
    lanzarTardias();
  }

  clearTimeout(window.__redCortina);
  const tarde = performance.now() > 2500;     // GSAP llegó tarde del CDN: no se anima
  const dialAnillo = $('#dial-anillo');
  if (cortina && motion && !tarde && dialAnillo) {
    raiz.classList.add('cortina-js');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    const red = setTimeout(retirarCortina, 6000);         // red de seguridad

    const W = innerWidth, H = innerHeight;
    const lienzo = $('#cortina-lienzo');
    lienzo.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const muro = $('#cortina-muro');
    const logo = $('#cortina-logo');
    const piedras = piedrasDe($('#cortina-anillo'));
    const texto = $('#cortina-texto');
    const txt = $('#cortina-txt');
    // la foto del dial, dentro del anillo de la cortina: viaja con él y al
    // llegar casa con la de debajo (misma caja, mismo encuadre)
    const foto = $('#cortina-foto');
    const fotoDial = $('.dial__foto.es-actual');
    if (foto && fotoDial) {
      const r = GEO.ri * 100;
      Object.assign(foto.style, { left: (GEO.cx * 100 - r) + '%', top: (GEO.cy * 100 - r) + '%', width: 2 * r + '%', height: 2 * r + '%' });
      foto.style.backgroundImage = `url("${fotoDial.currentSrc || fotoDial.src}")`;
      foto.style.backgroundPosition = getComputedStyle(fotoDial).objectPosition;
    }

    // de dónde sale y adónde va el anillo
    const a = logo.getBoundingClientRect();
    const b = dialAnillo.getBoundingClientRect();
    const sFin = b.width / a.width;
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    // centro y radio del hueco en pantalla, para un avance t del vuelo
    const hueco = (t, extra) => {
      const s = 1 + (sFin - 1) * t;
      const w = a.width * s;
      const x0 = a.left + a.width / 2 + dx * t - w / 2;
      const y0 = a.top + a.height / 2 + dy * t - w / 2;
      return { x: x0 + w * GEO.cx, y: y0 + w * GEO.cy, r: w * GEO.ri * 0.985 + (extra || 0) };
    };
    const rect = `M-10,-10H${W + 10}V${H + 10}H-10Z`;
    const circulo = (c) => `M${f(c.x - c.r)},${f(c.y)}a${f(c.r)},${f(c.r)} 0 1,0 ${f(2 * c.r)},0a${f(c.r)},${f(c.r)} 0 1,0 ${f(-2 * c.r)},0Z`;
    const pintaMuro = (c) => muro.setAttribute('d', c ? rect + circulo(c) : rect);
    pintaMuro(null);
    cortina.classList.add('es-muro');     // desde aquí el fondo lo pone el muro (agujero de verdad)

    // radio que cubre toda la pantalla desde el centro del dial
    const fin = hueco(1);
    const rCubre = Math.hypot(Math.max(fin.x, W - fin.x), Math.max(fin.y, H - fin.y)) + 40;

    const est = { t: 0, r: 0 };
    const tl = gsap.timeline({ onComplete: () => { clearTimeout(red); retirarCortina(); } });
    // 1) las piedras se asientan en sentido horario, desde el extremo izquierdo de la abertura
    tl.to(piedras, { opacity: 1, duration: 0.28, ease: 'power2.out', stagger: { each: Math.min(0.016, 1.0 / Math.max(piedras.length, 1)) } })
      // 2) el nombre y el lugar
      .to(texto, { opacity: 1, duration: 0.45, ease: 'power2.out' }, '-=0.25')
      .fromTo(txt, { opacity: 0, letterSpacing: '1em' }, { opacity: 1, letterSpacing: '.5em', duration: 0.7, ease: 'power3.out', immediateRender: false }, '<')
      .to([texto, txt], { opacity: 0, duration: 0.3, ease: 'power1.in' }, '+=0.3')
      // 3) dentro del anillo aparece la casa
      .fromTo(foto, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out', immediateRender: false }, '<0.05')
      // 4) el anillo vuela a su sitio en el dial, con la casa dentro, y se aclara (va a quedar sobre granito)
      .to(est, {
        t: 1, duration: 1.0, ease: 'expo.inOut', autoRound: false,
        onUpdate: () => {
          const s = 1 + (sFin - 1) * est.t;
          logo.style.transform = `translate(calc(-50% + ${f(dx * est.t)}px), calc(-50% + ${f(dy * est.t)}px)) scale(${f(s * 1000) / 1000})`;
        },
      }, '-=0.3')
      .to(logo, { color: '#e7e4dd', duration: 0.6, ease: 'power1.inOut' }, '-=0.45')
      .add(() => entradaHero(), '-=0.35')
      // 5) el hueco crece desde el dial hasta destapar la pantalla
      .add(() => pintaMuro(hueco(1)), '-=0.15')
      .to(est, {
        r: 1, duration: 0.9, ease: 'expo.inOut', autoRound: false,
        onUpdate: () => {
          const c = hueco(1);
          c.r = c.r + (rCubre - c.r) * est.r;
          pintaMuro(c);
        },
      }, '-=0.15');
  } else if (cortina) {
    cortina.hidden = true;
    raiz.classList.add('cortina-fuera');
    if (hayGSAP) gsap.ticker.lagSmoothing(0);
    entradaHero();
    lanzarTardias();
  } else {
    if (hayGSAP) gsap.ticker.lagSmoothing(0);
    entradaHero();
    lanzarTardias();
  }

  /* ============ 6. dato en vivo: hora de llegadas (hora de Galicia) ============ */
  (function datoVivo() {
    const el = $('#dato-vivo'), t = $('#dato-vivo-txt');
    if (!el || !t) return;
    const pintar = () => {
      let hm;
      try {
        hm = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
      } catch (e) { return; }
      const [h, m] = hm.split(':').map(Number);
      const min = h * 60 + m;
      const abierto = min >= 17 * 60 && min < 22 * 60;
      el.classList.toggle('es-abierto', abierto);
      if (abierto) t.textContent = `Son las ${hm} en Boiro: hora de llegadas, hasta las 22:00`;
      else if (min < 17 * 60) t.textContent = `Son las ${hm} en Boiro · hoy, llegadas de 17:00 a 22:00`;
      else t.textContent = `Son las ${hm} en Boiro · llegadas de 17:00 a 22:00; si llega más tarde, avísenos`;
    };
    pintar();
    setInterval(pintar, 30000);
  })();

  /* ============ 7. el muro: filtros y ficha ============ */
  const selHab = $('#c-hab');
  (function muro() {
    const piezas = $$('.muro__p');
    const estado = $('#filtro-estado');
    $$('.filtros:not(.filtros--lugares) .filtro').forEach((b) => b.addEventListener('click', () => {
      const fil = b.dataset.filtro;
      $$('.filtros:not(.filtros--lugares) .filtro').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      let n = 0;
      piezas.forEach((p) => {
        const si = fil === 'todas' || (p.dataset.tags || '').split(' ').includes(fil);
        p.classList.toggle('es-fuera', !si);
        p.querySelector('.muro__btn').setAttribute('aria-disabled', String(!si));
        if (si) n++;
      });
      estado.textContent = fil === 'todas' ? 'Se muestran los diez alojamientos.' : `${n} de 10 alojamientos cumplen el filtro.`;
      if (hayGSAP) ScrollTrigger.refresh();
    }));

    const ficha = $('#ficha');
    if (!ficha || typeof ficha.showModal !== 'function') return;
    const fotos = $('#ficha-fotos'), cuerpo = $('#ficha-cuerpo');
    let actualHab = '';
    piezas.forEach((p) => p.querySelector('.muro__btn').addEventListener('click', () => {
      actualHab = p.dataset.hab;
      $('#ficha-tit').textContent = p.querySelector('.muro__nom').textContent;
      $('#ficha-num').textContent = 'Alojamiento ' + p.querySelector('.muro__num').textContent + ' de 10';
      fotos.innerHTML = '';
      const pics = [p.querySelector('.muro__foto picture'), ...$$('.ficha-datos picture', p)].filter(Boolean);
      pics.forEach((pic, i) => {
        const c = pic.cloneNode(true);
        const img = c.querySelector('img');
        img.removeAttribute('loading');
        img.sizes = '(max-width: 699px) 90vw, 520px';
        if (!img.alt) img.alt = i === 0 ? 'Foto de ' + $('#ficha-tit').textContent : '';
        fotos.appendChild(c);
      });
      cuerpo.innerHTML = '';
      $$('.ficha-datos > :not(picture)', p).forEach((n) => cuerpo.appendChild(n.cloneNode(true)));
      if (lenis) lenis.stop();
      ficha.showModal();
    }));
    const cerrar = () => ficha.close();
    $('#ficha-cerrar').addEventListener('click', cerrar);
    ficha.addEventListener('click', (e) => { if (e.target === ficha) cerrar(); });
    ficha.addEventListener('close', () => { if (lenis) lenis.start(); });
    $('#ficha-consultar').addEventListener('click', (e) => {
      e.preventDefault();
      if (selHab) selHab.value = actualHab;
      cerrar();
      setTimeout(() => { irA('#consulta'); setTimeout(() => $('#c-entrada').focus({ preventScroll: true }), 900); }, 60);
    });
  })();
  $$('[data-elige]').forEach((a) => a.addEventListener('click', () => { if (selHab) selHab.value = a.dataset.elige; }));

  /* ============ 8. consulta → WhatsApp o correo ============ */
  (function consulta() {
    const form = $('#form-consulta');
    if (!form) return;
    const ent = $('#c-entrada'), sal = $('#c-salida'), nom = $('#c-nombre'), err = $('#form-error');
    const hoy = new Date();
    const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    ent.min = iso(hoy);
    sal.min = iso(new Date(hoy.getTime() + 864e5));
    ent.addEventListener('change', () => {
      if (!ent.value) return;
      const d = new Date(ent.value + 'T12:00');
      const manana = iso(new Date(d.getTime() + 864e5));
      sal.min = manana;
      if (!sal.value || sal.value <= ent.value) sal.value = manana;
    });
    const fecha = (v) => { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; };
    let via = 'whatsapp';
    $$('button[type="submit"]', form).forEach((b) => b.addEventListener('click', () => { via = b.dataset.via; }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fallos = [];
      [ent, sal, nom].forEach((c) => c.removeAttribute('aria-invalid'));
      if (!ent.value) { fallos.push('la fecha de llegada'); ent.setAttribute('aria-invalid', 'true'); }
      if (!sal.value) { fallos.push('la fecha de salida'); sal.setAttribute('aria-invalid', 'true'); }
      if (!nom.value.trim()) { fallos.push('su nombre'); nom.setAttribute('aria-invalid', 'true'); }
      if (ent.value && sal.value && sal.value <= ent.value) { fallos.push('una salida posterior a la llegada'); sal.setAttribute('aria-invalid', 'true'); }
      if (fallos.length) {
        err.textContent = 'Falta ' + fallos.join(', ') + '.';
        err.hidden = false;
        const primero = form.querySelector('[aria-invalid="true"]');
        if (primero) primero.focus();
        return;
      }
      err.hidden = true;
      const noches = Math.round((new Date(sal.value + 'T12:00') - new Date(ent.value + 'T12:00')) / 864e5);
      const hab = $('#c-hab');
      const nombreHab = hab.value ? hab.options[hab.selectedIndex].text : 'el que esté libre';
      const ad = $('#c-adultos').value, ni = $('#c-ninos').value;
      const nota = $('#c-nota').value.trim();
      const lineas = [
        'Hola, quería consultar disponibilidad en Neixón Hotel Rural:',
        `· Llegada: ${fecha(ent.value)}`,
        `· Salida: ${fecha(sal.value)} (${noches} ${noches === 1 ? 'noche' : 'noches'})`,
        `· ${ad} ${ad === '1' ? 'adulto' : 'adultos'}${ni !== '0' ? `, ${ni} ${ni === '1' ? 'niño' : 'niños'}` : ''}`,
        `· Alojamiento: ${nombreHab}`,
      ];
      if (nota) lineas.push(`· ${nota}`);
      lineas.push('', `${nom.value.trim()}`);
      const msg = lineas.join('\n');
      const url = via === 'correo'
        ? `mailto:info@ruralneixon.com?subject=${encodeURIComponent(`Consulta: ${fecha(ent.value)} a ${fecha(sal.value)}`)}&body=${encodeURIComponent(msg)}`
        : `https://wa.me/34680882702?text=${encodeURIComponent(msg)}`;
      if (via === 'correo') location.href = url;
      else window.open(url, '_blank', 'noopener');
    });
  })();

  /* ============ 9. pie: el anillo se cierra con «Consultar» ============ */
  (function pie() {
    const svg = $('#pie-logo');
    const btn = $('#pie-cierre');
    const caja = $('#pie-anillo');
    if (!svg || !btn || !caja) return;
    const piedras = piedrasDe(svg);
    // el botón va en la abertura: entre la primera piedra y la última (sentido horario)
    if (piedras.length > 1) {
      const vb = svg.viewBox.baseVal;
      const b1 = piedras[0].getBBox(), b2 = piedras[piedras.length - 1].getBBox();
      const x = ((b1.x + b1.width / 2 + b2.x + b2.width / 2) / 2 - vb.x) / vb.width;
      const y = ((b1.y + b1.height / 2 + b2.y + b2.height / 2) / 2 - vb.y) / vb.height;
      caja.style.setProperty('--hueco-y', f(y * 100) + '%');
      btn.style.left = f(x * 100) + '%';
    }
    if (!motion || !piedras.length) return;
    gsap.set(piedras, { opacity: 0.12 });
    gsap.set(btn, { scale: 0.6, opacity: 0 });
    const tl = gsap.timeline({ scrollTrigger: { trigger: '#pie', start: 'top 85%', end: 'top 30%', scrub: 0.6 } });
    tl.to(piedras, { opacity: 1, duration: 1, stagger: { each: 1 / piedras.length } })
      .to(btn, { scale: 1, opacity: 1, duration: 4, ease: 'back.out(2)' }, '>-0.5');
  })();

  /* ============ 10. cabecera, menú y anclas ============ */
  const cab = $('#cab');
  const oscuras = $$('.hero, .cafe, .consulta, .pie');
  let pendienteCab = 0;
  const alScroll = () => {
    pendienteCab = 0;
    cab.classList.toggle('sc', scrollY > 24);
    const y = cab.offsetHeight / 2;
    cab.classList.toggle('es-oscura', oscuras.some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; }));
  };
  addEventListener('scroll', () => { if (!pendienteCab) pendienteCab = requestAnimationFrame(alScroll); }, { passive: true });
  alScroll();

  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });
  $$('a[href^="#"]').forEach((a) => {
    const destino = a.getAttribute('href');
    if (destino.length < 2) return;
    a.addEventListener('click', (e) => {
      if (!$(destino) || a.id === 'ficha-consultar') return;
      e.preventDefault();
      cerrarMenu();
      irA(destino);
      // el foco viaja con el scroll: el siguiente Tab sigue desde allí
      setTimeout(() => {
        if (destino === '#consulta') { $('#c-entrada').focus({ preventScroll: true }); return; }
        const t = $(destino);
        if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      }, 900);
    });
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); }
  });

  /* ============ 11. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'neixon-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });
  if (!cortina || cortina.hidden) mostrarCookies();

  /* ============ 12. barra fija en el móvil ============
     Solo con observadores: ningún resize (ni el de la barra del navegador) la toca. */
  (function barraMovil() {
    const barra = $('#barra');
    if (!barra) return;
    const movil = matchMedia('(max-width: 999px)');
    const dentro = { hero: true, consulta: false, pie: false };
    const pintar = () => {
      const ver = movil.matches && !dentro.hero && !dentro.consulta && !dentro.pie
        && !document.body.classList.contains('menu') && ck.hidden;
      barra.classList.toggle('es-visible', ver);
      barra.setAttribute('aria-hidden', String(!ver));
      $$('a', barra).forEach((a) => a.tabIndex = ver ? 0 : -1);
      raiz.classList.toggle('con-barra', ver);
    };
    const io = new IntersectionObserver((es) => { es.forEach((e) => { dentro[e.target.dataset.barra] = e.isIntersecting; }); pintar(); });
    [['hero', '.hero'], ['consulta', '#consulta'], ['pie', '#pie']].forEach(([k, s]) => { const el = $(s); if (el) { el.dataset.barra = k; io.observe(el); } });
    const mo = new MutationObserver(pintar);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    mo.observe(ck, { attributes: true, attributeFilter: ['hidden'] });
    movil.addEventListener('change', pintar);
    pintar();
  })();

  /* ============ 13. mapa de Google solo al pedirlo ============ */
  $('#mapa-btn').addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('42.66718,-8.84409 (Neixón Hotel Rural)') + '&z=14&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con el Hotel Rural Neixón en Boiro';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 16. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === raiz.classList.contains('densidad-sobria'))));
    botones.forEach((b) => b.addEventListener('click', () => {
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (hayGSAP) ScrollTrigger.refresh();
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 17. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      if (hayGSAP) ScrollTrigger.refresh();
    }, 200);
  });
  addEventListener('load', () => { if (hayGSAP) ScrollTrigger.refresh(); });
})();
