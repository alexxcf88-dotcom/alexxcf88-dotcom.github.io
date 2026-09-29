'use strict';

/* Portada inmersiva (#inicio.ix): FONDO → NÚCLEO → COPY.
   1) Navegación en dos estados: body[data-nav-mode="hero"|"compact"]. Lo
      decide un IntersectionObserver sobre un centinela del hero, nunca un
      scroll handler; CSS hace la transición (es el mismo <nav> que cambia).
   2) Escena: vídeo en bucle (render propio del núcleo AItomat). Debajo está
      su primer fotograma como imagen, así que el vídeo aparece encima sin
      salto. Se descarga durante la intro, arranca al entrar la web y se pausa
      cuando la portada sale de pantalla. Sin vídeo con reduced motion, ahorro
      de datos, red lenta o equipos modestos: queda la imagen.
   3) Escritorio con puntero fino: parallax de la escena y luz que sigue al
      puntero (solo mientras el puntero se mueve sobre la portada).
   4) «Vuelta a la portada» al subir desde Sistema: señales de nuevo. */
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
  let yaSalio = false;
  const volverAPortada = () => {
    hero.classList.remove('ix-on');
    window.setTimeout(() => hero.classList.add('ix-on'), 160);
  };
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const nuevo = (!e.isIntersecting && e.boundingClientRect.top < 0) ? 'compact' : 'hero';
      if (nuevo === modo) return;
      modo = nuevo;
      body.dataset.navMode = nuevo;
      if (nuevo === 'compact') yaSalio = true;
      else if (yaSalio && !reduced) volverAPortada();
    }).observe(sentinel);
  }
  // La escena solo lleva la animación ligada al scroll cuando se sale de arriba del todo.
  const top = document.getElementById('ix-sentinel-top');
  if (top && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      hero.classList.toggle('ix-scrolled', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(top);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add('nav-anim')));

  alEntrar(() => {
    window.setTimeout(() => hero.classList.add('ix-on', 'ix-live'), reduced ? 0 : 600);
  });
  if (reduced) return;

  /* 3 · Parallax y luz de puntero (escritorio) */
  if (!mobile && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let frame = 0, x = 0, y = 0;
    hero.addEventListener('pointermove', (ev) => {
      x = ev.clientX / window.innerWidth * 2 - 1;
      y = ev.clientY / window.innerHeight * 2 - 1;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        hero.style.setProperty('--px', x.toFixed(3));
        hero.style.setProperty('--py', y.toFixed(3));
        frame = 0;
      });
    }, { passive: true });
  }

  /* 2 · Vídeo de la escena */
  if (!video) return;
  const red = navigator.connection || {};
  const redJusta = red.saveData === true || /(^|-)(2g|slow-2g)$/.test(red.effectiveType || '');
  const nucleos = navigator.hardwareConcurrency || 0;
  const memoria = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const modesto = (nucleos && nucleos < 4) || (memoria !== null && memoria < 2);
  if (redJusta || modesto) return;

  const base = '/features/landing/media/hero/nucleo' + (mobile ? '-movil' : '');
  // H.264 es universal y aquí pesa menos que VP9; el WebM solo para navegadores
  // sin H.264 (algunos Chromium de Linux, Electron).
  const h264 = video.canPlayType('video/mp4; codecs="avc1.640028"');
  video.src = base + (h264 ? '.mp4' : '.webm');
  video.preload = 'auto';
  video.load(); // se descarga durante la intro

  let visible = true;
  let entrado = false;
  const intentar = () => {
    if (!entrado || !visible) return;
    const p = video.play();
    if (p && p.catch) p.catch(() => {}); // autoplay bloqueado: se queda la imagen
  };
  video.addEventListener('playing', () => video.classList.add('is-on'), { once: true });
  alEntrar(() => { entrado = true; intentar(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) intentar(); else video.pause();
    }, { threshold: 0.02 }).observe(hero);
  }
})();
