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
  const mostrarVoz = () => { const c = document.getElementById('ix-chip-voz'); if (c) c.hidden = false; };
  if (window.ditboVoz && window.ditboVoz.disponible) mostrarVoz();
  // En llamada, la conversación se lee arriba: Cristina en el texto grande y
  // lo que dice la persona, debajo. Al colgar vuelve el saludo.
  const sayEl = document.getElementById('ix-say');
  const introEl = document.getElementById('ix-intro');
  const introOriginal = introEl ? introEl.textContent : '';
  let ultimoRol = '', textoCristina = '', textoTu = '';
  let saludoParado = false; // la llamada real corta el saludo escrito
  window.addEventListener('ditbo:voz', (ev) => {
    const d = ev.detail || {};
    if (d.tipo === 'disponible') mostrarVoz();
    if ((d.tipo === 'linea' || (d.tipo === 'boton' && (d.colgando || d.ocupado))) && !saludoParado) {
      saludoParado = true;
      const c = sayEl && sayEl.parentElement.querySelector('.ix-caret');
      if (c) c.hidden = true;
    }
    if (d.tipo === 'linea' && sayEl) {
      const rest = sayEl.parentElement.querySelector('.ix-say-rest');
      if (rest) rest.textContent = '';
      if (d.rol === 'paciente') {
        textoTu = ultimoRol === 'paciente' ? textoTu + ' ' + d.texto : d.texto;
        if (introEl) introEl.textContent = 'Tú: ' + textoTu.slice(-200);
      } else {
        textoCristina = ultimoRol === 'asistente' ? textoCristina + ' ' + d.texto : d.texto;
        sayEl.textContent = textoCristina.slice(-160);
        parlotear(1500);
      }
      ultimoRol = d.rol;
    }
    if (d.tipo === 'boton' && !d.colgando && !d.ocupado && ultimoRol) {
      ultimoRol = ''; textoCristina = ''; textoTu = '';
      if (introEl) introEl.textContent = introOriginal;
      if (sayEl) sayEl.textContent = sayEl.parentElement.getAttribute('aria-label') || sayEl.textContent;
    }
    if (d.tipo === 'boton' && estado) {
      const t = document.getElementById('ix-chip-voz-txt');
      if (t) t.textContent = d.colgando ? 'Colgar' : (d.ocupado ? 'Conectando…' : 'Responder hablando');
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
        if (saludoParado) return;
        i += 1;
        say.textContent = completo.slice(0, i);
        resto.textContent = completo.slice(i);
        if (i < completo.length) setTimeout(escribir, /[.?¿,]/.test(completo[i - 1]) ? 260 : 38 + Math.random() * 40);
        else terminado();
      };
      setTimeout(() => { parlotear(completo.length * 62 + 700); escribir(); }, 450);
    });
  }

  /* 6 · «Responder hablando»: solo aparece si la llamada real está
     disponible, y la lanza. */
  const chipVoz = document.getElementById('ix-chip-voz');
  if (chipVoz) {
    chipVoz.addEventListener('click', (ev) => {
      const b = document.getElementById('voice-call-btn');
      ev.preventDefault();
      if (!b || b.disabled) return;
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      b.click();
    });
  }


  /* 7 · Paso fluido a la parte oscura: un velo negro crece con el scroll y
     cubre la portada entera (foto incluida). Por JS para que funcione en
     todos los navegadores, no solo en los que tienen scroll-timeline. */
  let velo = 0;
  const pintarVelo = () => {
    velo = 0;
    const alto = hero.offsetHeight || window.innerHeight;
    const t = Math.max(0, Math.min(1, window.scrollY / (alto * 0.9)));
    hero.style.setProperty('--veil', (t * 0.9).toFixed(3));
    hero.style.setProperty('--fade', Math.min(1, t * 6).toFixed(3));
  };
  if (!reduced) window.addEventListener('scroll', () => { if (!velo) velo = requestAnimationFrame(pintarVelo); }, { passive: true });

  /* 8 · La voz de Cristina. Los navegadores no dejan sonar nada hasta que
     la persona toca la página, así que el saludo suena con el primer toque o
     tecla (en cualquier sitio), y el aviso lo deja claro desde el principio.
     Usa la mejor voz española del sistema (en Edge, las neuronales de
     Microsoft). Se puede silenciar y volver a oír. */
  const sonido = document.getElementById('ix-sound');
  const sonidoTxt = document.getElementById('ix-sound-txt');
  const sintetizador = window.speechSynthesis;
  if (sonido && sintetizador && 'SpeechSynthesisUtterance' in window && sayEl) {
    const saludo = (sayEl.parentElement.getAttribute('aria-label') || sayEl.textContent).trim();
    const elegirVoz = () => {
      const voces = sintetizador.getVoices().filter((v) => /^es(-|_|$)/i.test(v.lang));
      const puntos = (v) => (/es-ES/i.test(v.lang) ? 4 : 0)
        + (/natural|neural|online/i.test(v.name) ? 4 : 0)
        + (/elvira|arabella|ximena|helena|laura|lucia|monica|paulina|dalia|google español$/i.test(v.name) ? 2 : 0)
        + (/pablo|jorge|alvaro|raul|diego/i.test(v.name) ? -3 : 0);
      return voces.sort((a, b) => puntos(b) - puntos(a))[0] || null;
    };
    let hablandoVoz = false, yaSono = false;
    const texto = (t) => { if (sonidoTxt) sonidoTxt.textContent = t; };
    const callar = () => { sintetizador.cancel(); };
    const decir = () => {
      if (saludoParado) return; // ya hay una llamada real
      callar();
      const u = new SpeechSynthesisUtterance(saludo);
      const voz = elegirVoz();
      if (voz) u.voice = voz;
      u.lang = (voz && voz.lang) || 'es-ES';
      u.rate = 1;
      u.onstart = () => {
        hablandoVoz = true; yaSono = true;
        sonido.classList.add('is-on');
        texto('Cristina está hablando · pulsa para silenciar');
        if (estado) estado.textContent = 'está hablando…';
        parlotear(saludo.length * 70);
      };
      const fin = () => {
        hablandoVoz = false;
        sonido.classList.remove('is-on');
        texto('Volver a oír a Cristina');
        if (estado && !saludoParado) estado.textContent = 'esperando tu respuesta';
        clearInterval(hablando); hablando = 0; nivel(4);
      };
      u.onend = fin;
      u.onerror = fin;
      sintetizador.speak(u);
    };
    sonido.hidden = false;
    sonido.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (hablandoVoz) callar(); else decir();
    });
    // Primer toque o tecla en cualquier parte: suena el saludo (una vez).
    const primerGesto = (ev) => {
      if (sonido.contains(ev.target)) return;
      ['pointerdown', 'keydown'].forEach((t) => window.removeEventListener(t, primerGesto, true));
      if (!yaSono) decir();
    };
    ['pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, primerGesto, true));
    if (sintetizador.onvoiceschanged !== undefined) sintetizador.onvoiceschanged = () => {};
    // Al empezar una llamada real, la voz del saludo se calla.
    window.addEventListener('ditbo:voz', (ev) => { const d = ev.detail || {}; if (d.tipo === 'boton' && (d.colgando || d.ocupado)) { callar(); sonido.hidden = true; } else if (d.tipo === 'boton') sonido.hidden = false; });
  }
})();

