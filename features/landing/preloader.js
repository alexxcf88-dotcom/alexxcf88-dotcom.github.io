'use strict';

/* El preloader cubre el trabajo síncrono inicial de la landing y espera solo
   recursos que participan en el primer viewport. Vídeo y Spline conservan sus
   decisiones lazy/capabilities en landing.js. */
(function initSmartPreloader() {
  const root = document.documentElement;
  const loader = document.getElementById('smart-preloader');
  if (!loader) {
    root.classList.remove('preloader-active');
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let repeated = false;
  try { repeated = sessionStorage.getItem('aitomat-preloader-seen') === '1'; } catch (_) {}

  const connection = navigator.connection || {};
  const constrained = connection.saveData === true || /(^|-)(2g|slow-2g)$/.test(connection.effectiveType || '');
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const duration = reduced ? 0 : (repeated ? 260 : (constrained ? 620 : 980));
  const mark = loader.querySelector('.preloader-mark');
  mark.style.setProperty('--loader-duration', duration + 'ms');

  const timeout = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
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

  const visualAssets = [];
  if (document.fonts && document.fonts.load) visualAssets.push(document.fonts.load('900 1em Archivo').catch(() => {}));
  visualAssets.push(imageReady('/brand/logo/logo-aitomat.svg'));
  visualAssets.push(imageReady(mobile
    ? '/features/landing/media/hero-poster-mobile.jpg'
    : '/features/landing/media/hero-poster.jpg'));
  const criticalStyles = Promise.all([
    styleReady('landing-styles'),
    styleReady('font-styles'),
    styleReady('refresh-styles')
  ]);
  const appReady = criticalStyles.then(() => new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = '/features/landing/landing.js?v=20260928-mobile-round3';
    script.onload = resolve;
    script.onerror = resolve;
    document.body.appendChild(script);
  }));

  let animationDone;
  if (reduced || duration === 0) animationDone = Promise.resolve();
  else animationDone = new Promise((resolve) => {
    const finish = () => resolve();
    const finalMark = loader.querySelector('.preloader-final');
    finalMark.addEventListener('animationend', finish, { once: true });
    window.setTimeout(finish, duration + 120);
  });

  requestAnimationFrame(() => loader.classList.add('is-running'));

  const visualReady = Promise.race([
    Promise.allSettled(visualAssets),
    timeout(repeated ? 520 : 1650)
  ]);
  const realReady = Promise.all([criticalStyles, visualReady, appReady]);

  Promise.all([animationDone, realReady]).then(() => {
    loader.classList.add('is-holding');
    return timeout(reduced ? 40 : (repeated ? 50 : 260));
  }).then(() => {
    loader.classList.add('is-leaving');
    root.classList.remove('preloader-active');
    root.classList.add('preloader-done');
    try { sessionStorage.setItem('aitomat-preloader-seen', '1'); } catch (_) {}
    window.dispatchEvent(new CustomEvent('aitomat:ready'));
    window.setTimeout(() => loader.remove(), reduced ? 180 : 380);
  });

  /* Freno absoluto: ningún recurso visual puede retener la navegación. */
  window.setTimeout(() => {
    if (!loader.isConnected || loader.classList.contains('is-leaving')) return;
    loader.classList.add('is-holding', 'is-leaving');
    root.classList.remove('preloader-active');
    root.classList.add('preloader-done');
    window.setTimeout(() => loader.remove(), 380);
  }, repeated ? 1500 : 4500);
})();
