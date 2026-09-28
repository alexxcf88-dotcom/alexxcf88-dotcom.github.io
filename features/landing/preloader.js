'use strict';

/* La intro del logo es CSS puro y arranca con el primer pintado (ver el bloque
   .smart-preloader de index.html). Este script solo decide cuándo salir:
   1) cuando la intro ha terminado de verdad (sus animaciones, no un reloj),
   2) con los estilos críticos y el primer viewport listos,
   3) y con landing.js ya ejecutado. landing.js se descarga durante la intro
      (preload en <head>) pero se ejecuta al acabarla: su arranque (vídeo,
      Spline, observers) no compite con la animación. */
(function initSmartPreloader() {
  const root = document.documentElement;
  const loader = document.getElementById('smart-preloader');
  const LANDING_JS = '/features/landing/landing.js?v=20260928-mobile-round3';

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
  const introFallback = reduced ? 1100 : 3300;
  const introDone = (mark && mark.getAnimations)
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
    : '/features/landing/media/hero-poster.jpg')];
  if (document.fonts && document.fonts.load) visualAssets.push(document.fonts.load('900 1em Archivo').catch(() => {}));
  const visualReady = Promise.race([
    Promise.allSettled(visualAssets),
    timeout(constrained ? 1200 : 1650)
  ]);

  let left = false;
  const leave = () => {
    if (left) return;
    left = true;
    loader.classList.add('is-leaving');
    root.classList.remove('preloader-active');
    root.classList.add('preloader-done');
    window.dispatchEvent(new CustomEvent('aitomat:ready'));
    /* Fuera del DOM al acabar el fundido: libera sus capas del compositor. */
    window.setTimeout(() => loader.remove(), 420);
  };

  /* El estado final es el archivo del logo, no las capas: se cambia solo si ya
     está decodificado (si no, las capas son idénticas y se quedan). */
  const logo = loader.querySelector('.pl-logo');
  const logoReady = logo && logo.decode ? logo.decode().then(() => true, () => false) : Promise.resolve(false);
  introDone.then(() => Promise.race([logoReady, timeout(0).then(() => false)]))
    .then((ok) => { if (ok && mark) mark.classList.add('is-final'); });

  Promise.all([introDone, criticalStyles])
    .then(() => Promise.all([runLanding(), visualReady]))
    .then(() => timeout(reduced ? 60 : 160))
    .then(leave);

  /* Freno absoluto: ningún recurso puede retener la navegación. */
  window.setTimeout(() => {
    if (left) return;
    runLanding();
    leave();
  }, reduced ? 2200 : Math.max(3800, 5200 - performance.now()));
})();
