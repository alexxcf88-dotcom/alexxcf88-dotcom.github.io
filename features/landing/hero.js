'use strict';

/* Portada inmersiva (#inicio.ix).
   1) Navegación en dos estados: body[data-nav-mode="hero"|"compact"]. Lo
      decide un IntersectionObserver sobre un centinela del hero, nunca un
      scroll handler; CSS hace la transición (es el mismo <nav> que cambia).
   2) Apertura de la mano: tira de fotogramas en rejilla (render 3D propio)
      que se descarga durante la intro y se reproduce por pasos al aparecer la
      web; después cede el sitio a la imagen fija nítida. Sin tira en reduced
      motion, red lenta o equipos modestos: entrada suave con la imagen fija.
   3) Señales de producto que aparecen al abrirse la mano, y «vuelta a la
      portada» (brillo de la palma y señales de nuevo) al subir desde Sistema.
   4) Escritorio con puntero fino: parallax de unos px (mano y aurora), solo
      mientras el puntero se mueve sobre la portada. */
(function initImmersiveHero() {
  const hero = document.getElementById('inicio');
  const hand = document.getElementById('hx-visual');
  const seq = hand && hand.querySelector('.hx-seq');
  if (!hero || !hand || !seq) return;

  const root = document.documentElement;
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stacked = window.matchMedia('(max-width: 900px)').matches;

  const alEntrar = (fn) => {
    if (root.classList.contains('preloader-active')) window.addEventListener('aitomat:ready', fn, { once: true });
    else fn();
  };

  /* 1 · Navegación */
  const sentinel = document.getElementById('ix-sentinel');
  let modo = 'hero';
  let yaSalio = false;
  const volverAPortada = () => {
    if (reduced) return;
    hero.classList.remove('ix-return', 'ix-on');
    void hero.offsetWidth; // reinicia las animaciones de vuelta
    hero.classList.add('ix-return');
    window.setTimeout(() => hero.classList.add('ix-on'), 180);
    window.setTimeout(() => hero.classList.remove('ix-return'), 1900);
  };
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const nuevo = (!e.isIntersecting && e.boundingClientRect.top < 0) ? 'compact' : 'hero';
      if (nuevo === modo) return;
      modo = nuevo;
      body.dataset.navMode = nuevo;
      if (nuevo === 'compact') yaSalio = true;
      else if (yaSalio) volverAPortada();
    }).observe(sentinel);
  }
  // Transiciones de la nav solo tras el primer estado real (sin animar al cargar).
  requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add('nav-anim')));

  const senales = (demora) => window.setTimeout(() => hero.classList.add('ix-on'), demora);
  if (reduced) { hero.classList.add('ix-on'); return; }

  /* 4 · Parallax de puntero (escritorio) */
  if (!stacked && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
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

  /* 2 · Apertura de la mano */
  const red = navigator.connection || {};
  const redJusta = red.saveData === true || /(^|-)(2g|slow-2g|3g)$/.test(red.effectiveType || '');
  const nucleos = navigator.hardwareConcurrency || 0;
  const memoria = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const modesto = (nucleos && nucleos < 4) || (memoria !== null && memoria < 2);
  const DEMORA = 280; // con el fondo de la intro ya fundiéndose
  const reposo = () => { if (!stacked) hand.classList.add('is-idle'); };
  const entrarSinTira = () => {
    hand.classList.add('is-entering');
    senales(DEMORA + 700);
    window.setTimeout(reposo, DEMORA + 1000);
  };
  if (redJusta || modesto) { alEntrar(entrarSinTira); return; }

  /* La tira se descarga durante la intro. La mano fija sigue pintada debajo
     de la intro (es el LCP); solo al empezar la salida, aún tapada, se cambia
     a la tira. Si no ha llegado para entonces, entrada suave con la fija. */
  const src = stacked
    ? '/features/landing/media/hero/mano-v2-apertura-movil.webp'
    : '/features/landing/media/hero/mano-v2-apertura.webp';
  let lista = false;
  const tira = new Image();
  tira.decoding = 'async';
  if ('fetchPriority' in tira) tira.fetchPriority = 'low';
  tira.src = src;
  (tira.decode ? tira.decode() : new Promise((ok, ko) => { tira.onload = ok; tira.onerror = ko; }))
    .then(() => { seq.style.backgroundImage = `url("${src}")`; lista = true; }, () => {});

  alEntrar(() => {
    if (!lista) { entrarSinTira(); return; }
    hand.classList.add('is-armed');
    const fin = (e) => {
      if (!/^ixSeq/.test(e.animationName)) return;
      seq.removeEventListener('animationend', fin);
      hand.classList.remove('is-armed', 'is-playing');
      seq.style.backgroundImage = ''; // libera la tira decodificada
      reposo();
    };
    seq.addEventListener('animationend', fin);
    window.setTimeout(() => hand.classList.add('is-playing'), DEMORA);
    senales(DEMORA + 950);
  });
})();
