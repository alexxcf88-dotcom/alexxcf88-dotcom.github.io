'use strict';

/* Hero · apertura de la mano.
   La mano abierta es un <img> normal (mano.webp / mano-movil.webp): nítida,
   ligera y visible aunque este script no llegue. La apertura es una tira de
   28 fotogramas del mismo render 3D que se reproduce por pasos (CSS, 1,25 s)
   justo cuando la web aparece tras la intro, y al acabar cede el sitio a la
   imagen nítida con una flotación lenta.
   La tira solo se pide si el dispositivo lo aguanta; si no, o si no llega a
   tiempo, la mano entra con un fundido y ya. Con reduced motion, quieta. */
(function initHeroHand() {
  const visual = document.getElementById('hx-visual');
  const seq = visual && visual.querySelector('.hx-seq');
  if (!visual || !seq) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const red = navigator.connection || {};
  const redJusta = red.saveData === true || /(^|-)(2g|slow-2g|3g)$/.test(red.effectiveType || '');
  const nucleos = navigator.hardwareConcurrency || 0;
  const memoria = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const modesto = (nucleos && nucleos < 4) || (memoria !== null && memoria < 2);

  // Se llama en cuanto la web empieza a aparecer (o ya, si no hay intro).
  const alEntrar = (fn) => {
    if (root.classList.contains('preloader-active')) window.addEventListener('aitomat:ready', fn, { once: true });
    else fn();
  };
  const DEMORA = 280; // con el fondo de la intro ya fundiéndose
  const reposo = () => visual.classList.add('is-idle');
  const entrarSinTira = () => {
    visual.classList.add('is-entering');
    window.setTimeout(reposo, DEMORA + 950);
  };

  if (redJusta || modesto) { alEntrar(entrarSinTira); return; }

  /* La tira se descarga durante la intro. La mano fija sigue pintada debajo
     de la intro (es el LCP: 44 KB con prioridad alta); solo al empezar la
     salida, aún tapada, se cambia a la tira. Si la tira no ha llegado para
     entonces, entrada suave con la imagen fija. */
  const src = mobile
    ? '/features/landing/media/hero/mano-apertura-movil.webp'
    : '/features/landing/media/hero/mano-apertura.webp';
  let lista = false;
  const tira = new Image();
  tira.decoding = 'async';
  if ('fetchPriority' in tira) tira.fetchPriority = 'low';
  tira.src = src;
  (tira.decode ? tira.decode() : new Promise((ok, ko) => { tira.onload = ok; tira.onerror = ko; }))
    .then(() => { seq.style.backgroundImage = `url("${src}")`; lista = true; }, () => {});

  alEntrar(() => {
    if (!lista) { entrarSinTira(); return; }
    visual.classList.add('is-armed');
    const fin = (e) => {
      if (e.animationName !== 'hxSeq') return;
      seq.removeEventListener('animationend', fin);
      visual.classList.remove('is-armed', 'is-playing');
      reposo();
    };
    seq.addEventListener('animationend', fin);
    window.setTimeout(() => visual.classList.add('is-playing'), DEMORA);
  });
})();
