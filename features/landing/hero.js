'use strict';

/* Portada v4 (#inicio.ix): LA PANTALLA QUE MIRA.
   1) Navegación en dos estados: body[data-nav-mode="hero"|"compact"]. Lo
      decide un IntersectionObserver sobre un centinela del hero, nunca un
      scroll handler; CSS hace la transición (es el mismo <nav> que cambia).
   2) body.ix-hero-on mientras la portada ocupa la pantalla: el fondo fijo de
      la web no se pinta debajo.
   3) La pantalla de tubo (#tv): gira hacia el puntero, las pupilas lo siguen
      y pestañea sola.
   4) La tarjeta de llamada en vivo (antes, sección Voz) está en la portada;
      durante la llamada real la pantalla reacciona a la voz. */
(function initImmersiveHero() {
  const hero = document.getElementById('inicio');
  if (!hero) return;

  const root = document.documentElement;
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const alEntrar = (fn) => {
    if (root.classList.contains('preloader-active')) window.addEventListener('ditbo:ready', fn, { once: true });
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
  body.classList.add('ix-hero-on');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      enPortada = e.intersectionRatio > 0.06;
      body.classList.toggle('ix-hero-on', enPortada);
    }, { threshold: [0, 0.06, 0.1] }).observe(hero);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add('nav-anim')));

  /* 3 · La pantalla que mira (portada v4).
     La cabeza gira hacia el puntero y las pupilas (el punto de cada «o») lo
     siguen; pestañea sola cada pocos segundos. Sin ratón (móvil) mira a donde
     se toca y, en reposo, echa vistazos alrededor. Un solo bucle rAF que se
     duerme cuando la cabeza ya llegó a su sitio o la portada no se ve. */
  const tv = document.getElementById('tv');
  const eyes = document.getElementById('tv-eyes');
  if (!tv) return;

  const rect = () => tv.getBoundingClientRect();
  // Objetivo (t*) y valor actual (c*), en -1…1 respecto al centro de la pantalla.
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, ultimoGesto = 0;
  const MAX_Y = 18, MAX_X = 11; // grados de giro de la cabeza

  const pintar = () => {
    hero.style.setProperty('--ry', (cx * MAX_Y).toFixed(2) + 'deg');
    hero.style.setProperty('--rx', (-cy * MAX_X).toFixed(2) + 'deg');
    hero.style.setProperty('--lx', cx.toFixed(3));
    hero.style.setProperty('--ly', cy.toFixed(3));
  };
  const paso = () => {
    raf = 0;
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    pintar();
    if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) raf = requestAnimationFrame(paso);
  };
  const mirarA = (x, y) => {
    const r = rect();
    const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    // Alcance: a media pantalla de distancia ya mira «del todo».
    const ax = Math.max(window.innerWidth * 0.5, 320), ay = Math.max(window.innerHeight * 0.5, 280);
    tx = Math.max(-1, Math.min(1, (x - ox) / ax));
    ty = Math.max(-1, Math.min(1, (y - oy) / ay));
    if (!raf && enPortada) raf = requestAnimationFrame(paso);
  };
  const alCentro = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(paso); };

  if (!reduced) {
    window.addEventListener('pointermove', (ev) => {
      if (!enPortada) return;
      ultimoGesto = performance.now();
      mirarA(ev.clientX, ev.clientY);
    }, { passive: true });
    document.addEventListener('pointerleave', alCentro);
    window.addEventListener('blur', alCentro);

    // En reposo (o en móvil) echa vistazos: elige un punto, lo mira y vuelve.
    const vistazo = () => {
      const quieto = performance.now() - ultimoGesto > 3500;
      if (enPortada && quieto && !tv.classList.contains('is-call')) {
        const r = Math.random();
        if (r < 0.35) { tx = 0; ty = 0; }
        else { tx = (Math.random() * 2 - 1) * 0.8; ty = (Math.random() * 2 - 1) * 0.5; }
        if (!raf) raf = requestAnimationFrame(paso);
      }
      setTimeout(vistazo, 1800 + Math.random() * 2600);
    };
    alEntrar(() => setTimeout(vistazo, 2500));

    // Pestañeo: cada 2,5–6 s, a veces doble.
    if (eyes) {
      const pestanear = () => {
        eyes.classList.remove('is-blink');
        void eyes.offsetWidth;
        eyes.classList.add('is-blink');
      };
      eyes.addEventListener('animationend', () => eyes.classList.remove('is-blink'));
      const siguiente = () => {
        setTimeout(() => {
          if (enPortada && !document.hidden) {
            pestanear();
            if (Math.random() < 0.22) setTimeout(pestanear, 260);
          }
          siguiente();
        }, 2500 + Math.random() * 3500);
      };
      alEntrar(() => setTimeout(() => { pestanear(); siguiente(); }, 900));
    }
  }

  /* «i»: barras de nivel. En reposo, como en el logo (4 de 6); mientras
     «habla» (la frase que se escribe o la voz de la llamada) suben y bajan. */
  const barras = Array.from(tv.querySelectorAll('.tv-bar')).reverse(); // de abajo arriba
  const nivel = (n) => barras.forEach((b, i) => { b.style.opacity = i < n ? '1' : '.26'; });
  nivel(4);
  let hablando = 0;
  const parlotear = (ms) => {
    if (reduced || !barras.length) return;
    clearInterval(hablando);
    const fin = performance.now() + ms;
    hablando = setInterval(() => {
      if (performance.now() > fin) { clearInterval(hablando); hablando = 0; nivel(4); return; }
      nivel(2 + Math.floor(Math.random() * 5));
    }, 110);
  };

  /* 4 · La llamada real (landing.js, Vapi) se lanza desde la tarjeta de la
     portada. La pantalla la escucha por el evento «ditbo:voz»: en llamada te
     mira de frente, enciende el piloto en rojo y los ojos laten con la voz. */
  window.addEventListener('ditbo:voz', (ev) => {
    const d = ev.detail || {};
    if (d.tipo === 'boton' && estado) {
      estado.textContent = d.colgando ? 'en llamada contigo · pulsa Colgar para terminar' : (d.ocupado ? 'conectando…' : 'esperando tu respuesta');
    }
    if (d.tipo === 'boton') {
      tv.classList.toggle('is-call', !!d.colgando);
      hero.classList.toggle('is-call', !!d.colgando);
      if (d.colgando) alCentro();
      else { hero.style.setProperty('--vol', '0'); nivel(4); }
    } else if (d.tipo === 'nivel') {
      const v = Math.min(1, Number(d.nivel || 0) * 2.2);
      hero.style.setProperty('--vol', v.toFixed(3));
      if (!hablando) nivel(Math.max(1, Math.round(1 + v * 5)));
    }
  });

  /* 5 · La frase de la izquierda se escribe sola, con cursor de bloque. El
     texto completo está en el HTML (lo lee Google y el lector de pantalla). */
  const say = document.getElementById('ix-say');
  const estado = document.getElementById('ix-speaker-state');
  // Al acabar el saludo, Cristina queda a la espera y se señala cómo contestarle.
  const terminado = () => {
    if (estado) estado.textContent = 'esperando tu respuesta';
    const chip = document.getElementById('ix-chip-voz');
    if (chip) chip.classList.add('is-ready');
  };
  if (say && reduced) terminado();
  if (say && !reduced) {
    // El texto entero ocupa su sitio desde el principio (sin saltos de
    // maquetación): lo escrito se ve, el resto es transparente y el cursor va
    // entre medias.
    const completo = say.textContent;
    const h1 = say.parentElement;
    const caret = h1.querySelector('.ix-caret');
    h1.setAttribute('aria-label', completo);
    const resto = document.createElement('span');
    resto.className = 'ix-say-rest';
    resto.setAttribute('aria-hidden', 'true');
    say.setAttribute('aria-hidden', 'true');
    say.textContent = '';
    resto.textContent = completo;
    if (caret) h1.insertBefore(caret, null);
    h1.append(resto);
    if (caret) h1.insertBefore(caret, resto);
    alEntrar(() => {
      let i = 0;
      const escribir = () => {
        i += 1;
        say.textContent = completo.slice(0, i);
        resto.textContent = completo.slice(i);
        if (i < completo.length) setTimeout(escribir, /[.?¿,]/.test(completo[i - 1]) ? 260 : 38 + Math.random() * 40);
        else terminado();
      };
      setTimeout(() => { parlotear(completo.length * 62 + 700); escribir(); }, 450);
    });
  }

  /* 6 · «Hablar conmigo»: si la llamada real está disponible, la lanza; si
     no, el enlace baja a la tarjeta de la llamada. */
  const chipVoz = document.getElementById('ix-chip-voz');
  if (chipVoz) {
    chipVoz.addEventListener('click', (ev) => {
      const b = document.getElementById('voice-call-btn');
      if (!(window.ditboVoz && window.ditboVoz.disponible) || !b || b.disabled) return;
      ev.preventDefault();
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      b.click();
    });
  }

})();

