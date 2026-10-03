'use strict';

/* Portada v3 (#inicio.ix): FONDO > GIRO > TEXTO.
   1) Navegación en dos estados: body[data-nav-mode="hero"|"compact"]. Lo
      decide un IntersectionObserver sobre un centinela del hero, nunca un
      scroll handler; CSS hace la transición (es el mismo <nav> que cambia).
   2) body.ix-hero-on mientras la portada ocupa la pantalla: el fondo fijo de
      la web no se pinta debajo del vídeo.
   3) Escena: vídeo en bucle (render propio). Debajo está su primer fotograma
      como imagen, así que el vídeo aparece encima sin salto. Se descarga
      durante la intro, arranca al entrar la web y se pausa cuando de la
      portada queda menos de un 6 % (justo cuando vuelve el fondo fijo).
      Sin vídeo con reduced motion, ahorro de datos, red lenta o equipos
      modestos: queda la imagen.
   4) El punto blanco de la «o» se pinta encima del vídeo y mira hacia el
      puntero dentro del buje (escritorio con ratón).
   La capa de vídeo nunca se mueve: eso era lo que tiraba los FPS (medido:
   51 → 59 fps al moverse el ratón sin ello). */
(function initImmersiveHero() {
  const hero = document.getElementById('inicio');
  const video = document.getElementById('ix-video');
  if (!hero) return;

  const root = document.documentElement;
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 760px)').matches;

  const alEntrar = (fn) => {
    if (root.classList.contains('preloader-active')) window.addEventListener('aitomat:ready', fn, { once: true });
    else fn();
  };

  /* 1 · Navegación */
  const sentinel = document.getElementById('ix-sentinel');
  let modo = 'hero';
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const nuevo = (!e.isIntersecting && e.boundingClientRect.top < 0) ? 'compact' : 'hero';
      if (nuevo === modo) return;
      modo = nuevo;
      body.dataset.navMode = nuevo;
    }).observe(sentinel);
  }

  /* 2 · Arriba del todo: el texto solo se anima con el scroll al salir de arriba */
  const top = document.getElementById('ix-sentinel-top');
  if (top && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      hero.classList.toggle('ix-scrolled', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(top);
  }
  /* Mientras quede más de un 6 % de portada en pantalla, el fondo fijo de la
     web no se pinta: vídeo + fondo fijo a la vez hundían el scroll (23 → 60 fps). */
  let enPortada = true;
  let alCambiar = () => {};
  body.classList.add('ix-hero-on');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      enPortada = e.intersectionRatio > 0.06;
      body.classList.toggle('ix-hero-on', enPortada);
      alCambiar();
    }, { threshold: [0, 0.06, 0.1] }).observe(hero);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add('nav-anim')));

  /* 4 · El punto blanco de la «o». Dónde cae el centro del dial en el vídeo
     (fracción del ancho/alto del fotograma, medida en el píxel del render) y cómo lo
     coloca object-fit: cover con su object-position. */
  const eye = document.getElementById('ix-eye');
  const DIAL = mobile
    ? { ar: [9, 16], pos: [0.5, 0.4], x: 0.4962, y: 0.4067, core: 0.0272, hub: 0.06529 }
    : { ar: [16, 9], pos: [0.58, 0.5], x: 0.5702, y: 0.3300, core: 0.01406, hub: 0.03368 };
  let cx = 0, cy = 0, viaje = 0;
  const colocar = () => {
    if (!eye) return;
    const W = hero.clientWidth, H = hero.clientHeight;
    const s = Math.max(W / DIAL.ar[0], H / DIAL.ar[1]);
    const rw = DIAL.ar[0] * s, rh = DIAL.ar[1] * s;
    cx = (W - rw) * DIAL.pos[0] + DIAL.x * rw;
    cy = (H - rh) * DIAL.pos[1] + DIAL.y * rh;
    const er = DIAL.core * rw;
    // Recorrido corto: el punto mira hacia el cursor sin salir del centro del buje.
    viaje = Math.max(0, (DIAL.hub * rw - er * 1.4) * 0.5);
    eye.style.setProperty('--ex', cx.toFixed(1) + 'px');
    eye.style.setProperty('--ey', cy.toFixed(1) + 'px');
    eye.style.setProperty('--er', er.toFixed(1) + 'px');
    eye.classList.add('is-ready');
  };
  colocar();
  window.addEventListener('resize', colocar, { passive: true });
  if (eye && !reduced && !mobile && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let frame = 0, px = 0, py = 0;
    hero.addEventListener('pointermove', (ev) => {
      const r = hero.getBoundingClientRect();
      px = ev.clientX - r.left; py = ev.clientY - r.top;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const vx = px - cx, vy = py - cy, d = Math.hypot(vx, vy) || 1;
        const k = viaje * Math.min(1, d / 320) / d;
        eye.style.setProperty('--dx', (vx * k).toFixed(1) + 'px');
        eye.style.setProperty('--dy', (vy * k).toFixed(1) + 'px');
      });
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      eye.style.setProperty('--dx', '0px'); eye.style.setProperty('--dy', '0px');
    });
  }
  if (reduced || !video) return;

  /* 3 · Vídeo de la escena */
  const red = navigator.connection || {};
  const redJusta = red.saveData === true || /(^|-)(2g|slow-2g)$/.test(red.effectiveType || '');
  const nucleos = navigator.hardwareConcurrency || 0;
  const memoria = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const modesto = (nucleos && nucleos < 4) || (memoria !== null && memoria < 2);
  if (redJusta || modesto) return;

  const base = '/features/landing/media/hero/olas' + (mobile ? '-movil' : '');
  // H.264 es universal y aquí pesa menos; WebM solo para navegadores sin H.264.
  const h264 = video.canPlayType('video/mp4; codecs="avc1.640028"');
  video.src = base + (h264 ? '.mp4' : '.webm');
  video.preload = 'auto';
  video.load(); // se descarga durante la intro

  let entrado = false;
  const intentar = () => {
    if (!entrado || !enPortada) return;
    const p = video.play();
    if (p && p.catch) p.catch(() => {}); // autoplay bloqueado: se queda la imagen
  };
  video.addEventListener('playing', () => video.classList.add('is-on'), { once: true });
  alEntrar(() => { entrado = true; intentar(); });
  // Mismo umbral que el fondo fijo: el vídeo se pausa justo cuando este vuelve.
  alCambiar = () => { if (enPortada) intentar(); else video.pause(); };
})();
