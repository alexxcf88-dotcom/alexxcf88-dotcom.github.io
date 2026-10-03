'use strict';

/* La intro del logo es CSS puro y arranca con el primer pintado (ver el bloque
   .smart-preloader de index.html). Este script solo decide cuándo salir:
   1) cuando la intro ha terminado de verdad (sus animaciones, no un reloj),
   2) con los estilos críticos y el primer viewport listos,
   3) y con landing.js ya ejecutado. landing.js se descarga durante la intro
      (preload en <head>) pero se ejecuta al acabarla: su arranque (vídeo,
      observers) no compite con la animación. El runtime de Spline, en cambio,
      se compila durante la intro, donde su coste no se ve. */
(function initSmartPreloader() {
  const root = document.documentElement;
  const loader = document.getElementById('smart-preloader');
  const LANDING_JS = '/features/landing/landing.js?v=20260929-intro-v9';

  const timeout = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  let landing;
  const runLanding = () => landing || (landing = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = LANDING_JS;
    script.onload = resolve;
    script.onerror = resolve;
    document.body.appendChild(script);
  }));

  if (!loader) {
    root.classList.remove('preloader-active');
    runLanding();
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const connection = navigator.connection || {};
  const constrained = connection.saveData === true || /(^|-)(2g|slow-2g)$/.test(connection.effectiveType || '');
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const mark = loader.querySelector('.preloader-mark');

  const imageReady = (src) => new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (image.decode) image.decode().catch(() => {}).finally(resolve);
      else resolve();
    };
    image.onerror = resolve;
    image.src = src;
  });
  const styleReady = (id) => new Promise((resolve) => {
    const link = document.getElementById(id);
    if (!link || link.sheet) return resolve();
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });

  /* Fin real de la intro: todas sus animaciones finitas. Si el navegador no
     expone getAnimations, un reloj equivalente. */
  const introFallback = reduced ? 1100 : 4700;
  const cssDone = (mark && mark.getAnimations)
    ? Promise.race([
        Promise.all(mark.getAnimations({ subtree: true })
          .filter((a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity)
          .map((a) => a.finished.catch(() => {}))),
        timeout(introFallback + 400)
      ])
    : timeout(introFallback);

  const criticalStyles = Promise.all([
    styleReady('landing-styles'),
    styleReady('font-styles'),
    styleReady('refresh-styles')
  ]);
  const visualAssets = [imageReady(mobile
    ? '/features/landing/media/hero-poster-mobile.jpg'
    : '/features/landing/media/hero-poster.jpg'), imageReady(mobile
    ? '/features/landing/media/hero/olas-movil.webp'
    : '/features/landing/media/hero/olas.webp')];
  if (document.fonts && document.fonts.load) visualAssets.push(document.fonts.load('900 1em Archivo').catch(() => {}));
  /* Barra de carga: los 11 radios de la «o». Cada recurso que llega suma; un
     radio más solo cada 250 ms como mucho, para que se lea como un barrido y
     no como un parpadeo. El radio siguiente «busca» (pulso) mientras espera. */
  const t0 = performance.now();
  const rays = mark ? Array.from(mark.querySelectorAll('.pl-ray')) : [];
  const cap = (pr, ms) => Promise.race([pr, timeout(ms)]);
  const tareas = [
    styleReady('landing-styles'), styleReady('font-styles'), styleReady('refresh-styles'),
    ...visualAssets,
    new Promise((resolve) => {                 // landing.js, precargado en <head>
      if (!('PerformanceObserver' in window)) return resolve();
      const po = new PerformanceObserver((l) => {
        if (l.getEntries().some((e) => /landing\.js/.test(e.name))) { po.disconnect(); resolve(); }
      });
      try { po.observe({ type: 'resource', buffered: true }); } catch (e) { resolve(); }
    })
  ];
  const escena = document.getElementById('ix-video');
  if (escena && escena.currentSrc !== undefined && escena.getAttribute('src')) {
    tareas.push(new Promise((resolve) => {   // el vídeo de la portada, listo para reproducirse
      if (escena.readyState >= 3) return resolve();
      escena.addEventListener('canplay', resolve, { once: true });
      escena.addEventListener('error', resolve, { once: true });
    }));
  }
  let hechas = 0;
  tareas.forEach((t) => cap(t, 5000).then(() => { hechas += 1; }));
  let encendidos = 0;
  let raysResolve;
  const raysDone = new Promise((r) => { raysResolve = r; });
  const pintarRadios = (n) => {
    rays.forEach((ray, i) => {
      ray.classList.toggle('is-on', i < n);
      ray.classList.toggle('is-next', i === n);
    });
  };
  const avanzar = () => {
    const ritmo = reduced ? rays.length : Math.floor((performance.now() - t0 - 150) / 250);
    const meta = Math.min(ritmo, Math.floor(hechas / tareas.length * rays.length));
    if (meta > encendidos) { encendidos = meta; pintarRadios(encendidos); }
    if (encendidos >= rays.length) { raysResolve(); return; }
    window.setTimeout(avanzar, 80);
  };
  if (rays.length) { pintarRadios(0); avanzar(); } else raysResolve();
  const introDone = Promise.all([cssDone, raysDone]);

  const visualReady = Promise.race([
    Promise.allSettled(visualAssets),
    timeout(constrained ? 1200 : 1650)
  ]);

  /* El runtime de Spline (2,2 MB de JS) se compila aquí, detrás de la intro,
     que corre en el compositor: antes landing.js lo montaba 2,5 s después de
     entrar y congelaba la web ~0,4 s. Mismos requisitos que initVoiceSpline
     (landing.js), que reutiliza window.__splineRuntime. */
  const warmSpline = () => {
    // Solo escritorio: en móvil, 2,2 MB durante la intro compiten con lo crítico
    // en redes lentas; allí Spline conserva su carga perezosa de landing.js.
    if (reduced || constrained || mobile || window.matchMedia('(hover: none)').matches) return;
    if (window.__splineRuntime || !document.getElementById('voice-3d')) return;
    const cores = navigator.hardwareConcurrency || 0;
    const memory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
    if ((cores && cores < 4) || (memory !== null && memory < 3)) return;
    try {
      const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
      if (!gl) return;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (e) { return; }
    window.__splineRuntime = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/features/landing/spline/spline-viewer.js';
      script.onload = resolve;
      script.onerror = () => { window.__splineRuntime = null; reject(); };
      document.head.appendChild(script);
    });
    window.__splineRuntime.catch(() => {});
  };

  let left = false;
  const leave = () => {
    if (left) return;
    left = true;
    pintarRadios(rays.length); // si salta el freno absoluto, la «o» se completa
    raysResolve();
    /* El logo vuela hasta el del nav (mismo archivo, mismo tamaño al llegar)
       mientras el fondo se desvanece; al aterrizar, el del nav toma el relevo. */
    const target = !reduced && document.querySelector('.site-nav .brand-wordmark');
    const to = target && target.getBoundingClientRect();
    const from = mark && mark.getBoundingClientRect();
    let flight = 0;
    if (to && from && to.width > 0 && to.bottom > 0 && to.top < window.innerHeight) {
      mark.style.setProperty('--fx', ((to.left + to.width / 2) - (from.left + from.width / 2)) + 'px');
      mark.style.setProperty('--fy', ((to.top + to.height / 2) - (from.top + from.height / 2)) + 'px');
      mark.style.setProperty('--fs', String(to.width / from.width));
      mark.style.setProperty('--fo', '1');
      root.classList.add('preloader-flying');
      flight = 820;
    }
    loader.classList.add('is-leaving');
    root.classList.remove('preloader-active');
    root.classList.add('preloader-done');
    window.dispatchEvent(new CustomEvent('aitomat:ready'));
    /* Fuera del DOM al acabar: libera sus capas del compositor. */
    window.setTimeout(() => {
      root.classList.remove('preloader-flying');
      loader.remove();
    }, Math.max(flight, 800));
  };

  /* Sin relevo a <img> al final: las capas usan el mismo viewBox que
     logo-aitomat.svg, y cambiar de una a otra movía los bordes un subpíxel
     (se veía como un pequeño salto del logo). */

  criticalStyles.then(warmSpline);

  Promise.all([introDone, criticalStyles])
    .then(() => Promise.all([runLanding(), visualReady]))
    .then(() => timeout(reduced ? 60 : 160))
    .then(leave);

  /* Freno absoluto: ningún recurso puede retener la navegación. */
  window.setTimeout(() => {
    if (left) return;
    runLanding();
    leave();
  }, reduced ? 2600 : Math.max(5200, 6500 - performance.now()));
})();
