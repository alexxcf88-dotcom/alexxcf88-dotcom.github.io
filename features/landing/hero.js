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

  /* 3 · Cristina viva: la foto entera, en una sola pieza. Un solo bucle rAF
     mientras la portada se ve:
     · Respiración con ritmo que varía un poco y un balanceo lento e
       irregular (suma de senos de periodos que no se repiten), como quien
       está de pie quieto.
     · Todo el bloque se orienta en 3D hacia el puntero con algo de retraso;
       en reposo echa vistazos.
     · Ojos: las pupilas siguen al puntero dentro de la pantalla.
     Todo es transform/opacity (compositor): no repinta la página. */
  const tv = document.getElementById('tv');
  const eyes = document.getElementById('tv-eyes');
  const fig = document.getElementById('ix-fig');
  if (!tv) return;

  const rect = () => tv.getBoundingClientRect();
  // Objetivo (t*) y valor actual (c*), en -1…1 respecto al centro de la cabeza.
  let tx = 0, ty = 0, cx = 0, cy = 0, ex = 0, ey = 0, ultimoGesto = 0;
  const mirarA = (x, y) => {
    const r = rect();
    const ox = r.left + r.width / 2, oy = r.top + r.height * 0.45;
    const ax = Math.max(window.innerWidth * 0.5, 320), ay = Math.max(window.innerHeight * 0.5, 280);
    tx = Math.max(-1, Math.min(1, (x - ox) / ax));
    ty = Math.max(-1, Math.min(1, (y - oy) / ay));
  };
  const alCentro = () => { tx = 0; ty = 0; };

  let fase = Math.random() * 10, respira = 0, ultimo = 0, bucle = 0, ojoX = '', ojoY = '', scrollHasta = 0;
  // Mientras se hace scroll, el cuerpo se queda quieto (la portada se está
  // oscureciendo y así el scroll va más fino); retoma al parar.
  window.addEventListener('scroll', () => { scrollHasta = performance.now() + 180; }, { passive: true });
  const vivir = (ahora) => {
    bucle = 0;
    if (!enPortada || document.hidden) return; // se reanuda al volver
    if (ahora < scrollHasta) { ultimo = ahora; bucle = requestAnimationFrame(vivir); return; }
    const dt = Math.min(0.05, ultimo ? (ahora - ultimo) / 1000 : 0.016);
    ultimo = ahora;
    const t = ahora / 1000;
    // Respiración: ~15 por minuto, con un periodo que deriva despacio.
    fase += dt * (2 * Math.PI) / (4.1 + 0.5 * Math.sin(t * 0.07));
    respira = 0.5 - 0.5 * Math.cos(fase);
    // Balanceo de cuerpo de pie (px de la foto y grados).
    const bx = 2.4 * Math.sin(t * 0.31) + 1.1 * Math.sin(t * 0.77 + 1.3) + 0.45 * Math.sin(t * 1.9 + 0.4);
    const by = -respira * 2.4 + 0.5 * Math.sin(t * 0.53 + 2.1);
    const br = 0.32 * Math.sin(t * 0.23 + 0.7) + 0.12 * Math.sin(t * 0.61);
    // Todo el bloque (cuerpo, cuello, cables y televisor) es una sola pieza:
    // respira, se balancea y se orienta en 3D hacia el puntero con algo de
    // retraso. Así nada se separa ni se desconecta.
    cx += (tx - cx) * Math.min(1, dt * 2.6);
    cy += (ty - cy) * Math.min(1, dt * 2.6);
    ex += (tx - ex) * Math.min(1, dt * 9); // los ojos llegan antes que el cuerpo
    ey += (ty - ey) * Math.min(1, dt * 9);
    const ry = cx * 6 + 0.6 * Math.sin(t * 0.29 + 4);
    const rx = -cy * 3.5 + 0.4 * Math.sin(t * 0.37 + 1);
    // Estado compartido con la Cristina 3D (cristina3d.js).
    const vivo = window.ditboVivo || (window.ditboVivo = {});
    vivo.cx = cx; vivo.cy = cy; vivo.ex = ex; vivo.ey = ey; vivo.respira = respira; vivo.bx = bx; vivo.br = br;
    if (fig && hero.classList.contains('has-3d')) {
      // Con Cristina en 3D, todo el movimiento (respirar, cabeza, cuello) lo
      // hace la escena: la figura no se transforma (más fluido).
      if (fig.style.transform) fig.style.transform = '';
    } else if (fig) fig.style.transform = `perspective(1800px) translate3d(${(bx + cx * 10).toFixed(2)}px,${(by + cy * 4).toFixed(2)}px,0) rotateY(${ry.toFixed(3)}deg) rotateX(${rx.toFixed(3)}deg) rotate(${br.toFixed(3)}deg) scale(1,${(1 + respira * 0.005).toFixed(4)})`;
    // Las pupilas solo se tocan si se han movido de verdad.
    const lx = ex.toFixed(3), ly = ey.toFixed(3);
    if (lx !== ojoX || ly !== ojoY) { ojoX = lx; ojoY = ly; tv.style.setProperty('--lx', lx); tv.style.setProperty('--ly', ly); }
    bucle = requestAnimationFrame(vivir);
  };
  const despertar = () => { if (!bucle && !reduced) { ultimo = 0; bucle = requestAnimationFrame(vivir); } };
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { if (e.isIntersecting) despertar(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) despertar(); });
  despertar();

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
        if (r < 0.4) { tx = 0; ty = 0; }
        else { tx = (Math.random() * 2 - 1) * 0.7; ty = (Math.random() * 2 - 1) * 0.4; }
      }
      setTimeout(vistazo, 1800 + Math.random() * 3200);
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
  const tuEl = document.getElementById('ix-tu');
  const tuTxt = tuEl && tuEl.querySelector('span');
  let ultimoRol = '', textoCristina = '', textoTu = '';
  let saludoParado = false; // la llamada real corta el saludo escrito
  // Une trozos de transcripción quitando el solape («…inteligencia artificial»
  // + «artificial. ¿En qué…» → sin repetir la palabra).
  const limpia = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const unir = (a, b) => {
    if (!a) return b.trim();
    const A = a.trim().split(/\s+/), B = b.trim().split(/\s+/);
    for (let k = Math.min(6, A.length, B.length); k > 0; k--) {
      if (A.slice(-k).map(limpia).join(' ') === B.slice(0, k).map(limpia).join(' ')) return [...A.slice(0, -k), ...B].join(' '); // se queda la versión nueva (con su puntuación)
    }
    return a.trim() + ' ' + b.trim();
  };
  // Lo último dicho, cortado en frase entera si es largo.
  const cola = (t, max) => {
    if (t.length <= max) return t;
    const r = t.slice(-max), i = r.search(/[.?!¿¡]\s/);
    return (i >= 0 && i < max * 0.6 ? r.slice(i + 1) : '…' + r.slice(r.indexOf(' ') + 1)).trim();
  };
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
        textoTu = ultimoRol === 'paciente' ? unir(textoTu, d.texto) : d.texto.trim();
        if (tuEl && tuTxt) { tuTxt.textContent = cola(textoTu, 150); tuEl.hidden = false; }
      } else {
        textoCristina = ultimoRol === 'asistente' ? unir(textoCristina, d.texto) : d.texto.trim();
        // Si la voz repite una palabra seguida («artificial… artificial»), se lee una vez.
        textoCristina = textoCristina.replace(/(\p{L}{3,})[\s.,…]+\1(?=[\s.,…?!]|$)/giu, '$1');
        sayEl.textContent = cola(textoCristina, 150);
        parlotear(1500);
      }
      ultimoRol = d.rol;
    }
    if (d.tipo === 'boton' && !d.colgando && !d.ocupado && ultimoRol) {
      ultimoRol = ''; textoCristina = ''; textoTu = '';
      if (tuEl) { tuEl.hidden = true; if (tuTxt) tuTxt.textContent = ''; }
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
      else { tv.style.setProperty('--vol', '0'); nivel(4); if (window.ditboVivo) window.ditboVivo.vol = 0; }
    } else if (d.tipo === 'nivel') {
      const v = Math.min(1, Number(d.nivel || 0) * 2.2);
      (window.ditboVivo || (window.ditboVivo = {})).vol = v;
      tv.style.setProperty('--vol', v.toFixed(3));
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
     un fundido oscurece el borde de abajo. Se escribe la opacidad de dos
     capas sueltas (sin variables heredadas, sin recalcular la portada). */
  const veloEl = document.getElementById('ix-veil');
  const fundido = document.getElementById('ix-fade');
  let velo = 0, altoHero = hero.offsetHeight || window.innerHeight;
  window.addEventListener('resize', () => { altoHero = hero.offsetHeight || window.innerHeight; }, { passive: true });
  const pintarVelo = () => {
    velo = 0;
    const t = Math.max(0, Math.min(1, window.scrollY / (altoHero * 0.9)));
    if (veloEl) veloEl.style.opacity = (t * 0.9).toFixed(3);
    if (fundido) fundido.style.opacity = Math.min(1, t * 6).toFixed(3);
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
      // La voz de Cristina en la llamada es Azure Arabella (multilingüe, acento
      // castellano). Si el navegador la tiene (Edge), se usa esa; si no, Elvira,
      // la más parecida.
      const puntos = (v) => (/arabella/i.test(v.name) ? 80 : 0) + (/elvira/i.test(v.name) ? 40 : 0)
        + (/es-ES/i.test(v.lang) ? 4 : 0)
        + (/natural|neural|online/i.test(v.name) ? 4 : 0)
        + (/ximena|helena|laura|lucia|monica|paulina|dalia|google español$/i.test(v.name) ? 2 : 0)
        + (/pablo|jorge|alvaro|raul|diego/i.test(v.name) ? -3 : 0);
      return voces.sort((a, b) => puntos(b) - puntos(a))[0] || null;
    };
    let hablandoVoz = false, yaSono = false;
    const texto = (t) => { if (sonidoTxt) sonidoTxt.textContent = t; };
    const callar = () => { sintetizador.cancel(); };
    // Las voces de Edge (Elvira incluida) llegan con retraso: si aún no están,
    // se espera a que lleguen (máx. 1,2 s) antes de hablar.
    const conVoces = (fn) => {
      if (sintetizador.getVoices().some((v) => /^es/i.test(v.lang))) return fn();
      let hecho = false;
      const ir = () => { if (!hecho) { hecho = true; fn(); } };
      sintetizador.addEventListener('voiceschanged', ir, { once: true });
      setTimeout(ir, 1200);
    };
    const decir = () => conVoces(() => {
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
    });
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
    sintetizador.getVoices(); // pide la lista ya, para que esté al primer toque
    // Al empezar una llamada real, la voz del saludo se calla.
    window.addEventListener('ditbo:voz', (ev) => { const d = ev.detail || {}; if (d.tipo === 'boton' && (d.colgando || d.ocupado)) { callar(); sonido.hidden = true; } else if (d.tipo === 'boton') sonido.hidden = false; });
  }

  /* 9 · Cristina en 3D. Se carga cuando la web ya ha entrado y el navegador
     está libre; hasta entonces (y sin WebGL, con ahorro de datos o con
     movimiento reducido) se queda la foto. Al estar lista, la foto se funde. */
  const lienzo3d = document.getElementById('ix-3d');
  const soportaGL = () => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  };
  const red3d = navigator.connection || {};
  const sin3d = reduced || red3d.saveData === true || /(^|-)(2g|slow-2g)$/.test(red3d.effectiveType || '') || !soportaGL();
  if (lienzo3d && !sin3d) {
    const cargar3d = () => {
      // El cuerpo sin televisor se descarga antes: el cambio de foto y el
      // primer fotograma 3D ocurren a la vez, sin parpadeo.
      const cuerpo = new Image();
      cuerpo.src = '/features/landing/media/hero/cristina-cuerpo.webp?v=5';
      return Promise.all([import('/features/landing/cristina3d.js?v=18'), cuerpo.decode()])
        .then(([m]) => m.montar({ hero, lienzo: lienzo3d, alListo: () => {
          const img = hero.querySelector('.ix-body');
          if (img) img.src = cuerpo.src;
          hero.classList.add('has-3d');
        } }))
        .catch((err) => console.warn('[portada] 3D no disponible, se queda la foto', err));
    };
    alEntrar(() => ('requestIdleCallback' in window ? requestIdleCallback(cargar3d, { timeout: 1500 }) : setTimeout(cargar3d, 300)));
  }
})();

