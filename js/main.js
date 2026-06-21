/* ============================================================
   AItomat — main.js
   Lenis (scroll suave) + GSAP/ScrollTrigger/SplitText
   + WebGL hero (simplex liquid shader) + cursor custom
   + chat WhatsApp + botones magnéticos + contadores
   ============================================================ */

'use strict';

/* ── Feature detection ──────────────────────────────────── */
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH   = window.matchMedia('(hover: none)').matches;
const MOBILE  = window.innerWidth < 768;
const LOW_END = (navigator.hardwareConcurrency || 8) <= 2
             || (navigator.deviceMemory || 8) <= 1;

const hasGSAP  = typeof gsap !== 'undefined';
const hasST    = hasGSAP && typeof ScrollTrigger !== 'undefined';
const hasSplit = hasGSAP && typeof SplitText !== 'undefined';

/* Marca que el JS está vivo: activa los estados iniciales ocultos
   de los reveals (evita FOUC). Si JS falla, todo queda visible. */
if (hasGSAP && !REDUCED) document.documentElement.classList.add('js');

/* Oculta los titulares con SplitText desde ya para que no salten
   antes de que se procesen en document.fonts.ready. */
if (hasSplit && !REDUCED) {
  document.querySelectorAll('[data-split]').forEach((el) => {
    el.style.visibility = 'hidden';
  });
}

/* ── GSAP + ScrollTrigger setup ─────────────────────────── */
if (hasST) gsap.registerPlugin(ScrollTrigger);

/* ── Lenis smooth scroll (integrado con GSAP) ───────────── */
let lenis = null;
if (!REDUCED && typeof Lenis !== 'undefined') {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  if (hasST) lenis.on('scroll', ScrollTrigger.update);
  if (hasGSAP) {
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* Anchors → scroll suave con Lenis */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -20, duration: 1.3 });
    });
  });
}

/* ── Nav scrolled state ─────────────────────────────────── */
(function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  if (hasST) {
    ScrollTrigger.create({
      start: 'top -60', end: '+=1',
      onUpdate: (self) => nav.classList.toggle('scrolled', self.scroll() > 60),
    });
  } else {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }
})();

/* ── Custom cursor (punto 1:1 + anillo con lerp 0.15) ───── */
(function initCursor() {
  if (TOUCH || REDUCED) return;
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  });

  (function lerp() {
    rx += (mx - rx) * 0.15;
    ry += (my - ry) * 0.15;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(lerp);
  })();

  const interactives = document.querySelectorAll(
    'a, button, [tabindex], .bento-card, .pricing-card, input, .magnetic'
  );
  interactives.forEach((el) => {
    el.addEventListener('mouseenter', () => { dot.classList.add('hovering'); ring.classList.add('hovering'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('hovering'); ring.classList.remove('hovering'); });
  });
})();

/* ── WebGL Hero — gradiente líquido con ruido simplex ───── */
(function initWebGL() {
  const canvas   = document.getElementById('hero-canvas');
  const fallback = document.querySelector('.hero-gradient-fallback');
  const hero     = document.getElementById('hero');
  if (!canvas) return;

  function useFallback() {
    canvas.style.display = 'none';
    if (fallback) fallback.classList.add('active');
  }

  if (REDUCED || LOW_END || !window.THREE || !window.WebGLRenderingContext) {
    useFallback(); return;
  }

  const vertexShader = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
  `;

  /* Ashima 2D simplex noise (public domain) + composición de gradiente */
  const fragmentShader = /* glsl */`
    precision mediump float;
    uniform float uTime;
    uniform vec2  uResolution;
    uniform vec2  uMouse;     /* posición de cursor suavizada (-1..1) */
    varying vec2  vUv;

    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}

    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                         -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                              + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    /* fbm de baja resolución (3 octavas) sobre simplex */
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) {
        v += a * snoise(p);
        p = p * 1.9 + vec2(2.3, 1.7);
        a *= 0.55;
      }
      return v;
    }

    void main(){
      vec2 uv = vUv;
      float asp = uResolution.x / max(uResolution.y, 1.0);
      vec2 p = vec2(uv.x * asp, uv.y);
      float t = uTime * 0.06;

      /* distorsión que sigue al cursor */
      vec2 m = uMouse * 0.5;
      float dCursor = length(p - vec2((m.x * 0.5 + 0.5) * asp, m.y * 0.5 + 0.5));
      vec2 warp = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 5.2)) * 0.35;
      warp += (m * 0.12) / (dCursor * 3.0 + 0.6);

      float n  = fbm(p * 1.7 + warp + t);
      float n2 = fbm(p * 1.1 - warp + vec2(3.1, 1.4) - t * 0.7);

      /* paleta: casi negro → azul profundo → aqua tenue */
      vec3 base  = vec3(0.012, 0.027, 0.051);   /* #03070d aprox */
      vec3 deep  = vec3(0.020, 0.072, 0.128);   /* azul profundo */
      vec3 teal  = vec3(0.012, 0.110, 0.118);   /* teal */
      vec3 aqua  = vec3(0.090, 0.300, 0.290);   /* aqua tenue, contenido */

      vec3 col = base;
      col = mix(col, deep, smoothstep(-0.2, 0.7, n));
      col = mix(col, teal, smoothstep(0.0, 0.9, n2) * 0.75);
      /* hilo de aqua sólo en las crestas del ruido — <5% de superficie */
      float crest = smoothstep(0.72, 0.95, n + n2 * 0.4);
      col = mix(col, aqua, crest * 0.55);
      /* halo suave alrededor del cursor */
      col += aqua * (0.06 / (dCursor * 6.0 + 1.0));

      /* grano fino para que no quede plano */
      col += (snoise(uv * 300.0) ) * 0.006;

      /* viñeta radial */
      float vig = 1.0 - length(uv - 0.5) * 0.6;
      col *= clamp(vig, 0.0, 1.0);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  let renderer, material, animId = null;
  let tmx = 0, tmy = 0, cmx = 0, cmy = 0; /* target / current mouse */

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); /* cap 2 */
    const w0 = canvas.offsetWidth || window.innerWidth;
    const h0 = canvas.offsetHeight || window.innerHeight;
    renderer.setSize(w0, h0, false);

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(w0, h0) },
        uMouse:      { value: new THREE.Vector2(0, 0) },
      },
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    document.addEventListener('mousemove', (e) => {
      tmx =  (e.clientX / window.innerWidth)  * 2 - 1;
      tmy = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    let rsz;
    window.addEventListener('resize', () => {
      clearTimeout(rsz);
      rsz = setTimeout(() => {
        const w = canvas.offsetWidth || window.innerWidth;
        const h = canvas.offsetHeight || window.innerHeight;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h, false);
        material.uniforms.uResolution.value.set(w, h);
      }, 150);
    });

    /* pausa cuando el hero sale de pantalla (ahorra GPU) */
    let visible = true;
    if ('IntersectionObserver' in window && hero) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible && !animId) loop();
        else if (!visible && animId) { cancelAnimationFrame(animId); animId = null; }
      }, { threshold: 0.01 }).observe(hero);
    }

    function loop(t) {
      if (!visible) { animId = null; return; }
      animId = requestAnimationFrame(loop);
      cmx += (tmx - cmx) * 0.04;   /* lerp del cursor */
      cmy += (tmy - cmy) * 0.04;
      material.uniforms.uTime.value = (t || 0) / 1000;
      material.uniforms.uMouse.value.set(cmx, cmy);
      renderer.render(scene, camera);
    }
    loop();
  } catch (err) {
    console.warn('[AItomat] WebGL falló, usando gradiente CSS.', err);
    useFallback();
  }
})();

/* ── Reveals de texto envueltos en document.fonts.ready ─── */
function splitReveal(el, { scroll = false } = {}) {
  if (hasSplit) {
    const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    el.style.visibility = 'visible';
    gsap.set(split.lines, { yPercent: 100 });
    const anim = {
      yPercent: 0, duration: 0.8, stagger: 0.1, ease: 'expo.out',
    };
    if (scroll) {
      anim.scrollTrigger = { trigger: el, start: 'top 85%', once: true };
    }
    gsap.to(split.lines, anim);
  } else {
    /* Fallback sin SplitText */
    el.style.visibility = 'visible';
    const anim = { opacity: 0, y: 36, duration: 0.9, ease: 'power3.out' };
    if (scroll) anim.scrollTrigger = { trigger: el, start: 'top 82%', once: true };
    gsap.from(el, anim);
  }
}

function runTextReveals() {
  if (REDUCED || !hasGSAP) return;

  /* Hero headline — reveal inmediato por líneas */
  const heroH = document.querySelector('#hero [data-split]');
  if (heroH) splitReveal(heroH, { scroll: false });

  /* Hero: label, sub, actions, trust, demo — fade-up encadenado.
     CSS los deja en opacity:0; aquí los traemos a su sitio. */
  const heroFades = document.querySelectorAll('#hero .reveal-fade');
  gsap.set(heroFades, { y: 18 });
  gsap.to(heroFades, {
    opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
    stagger: 0.12, delay: 0.25,
  });

  /* Títulos de sección con data-split — reveal por scroll */
  document.querySelectorAll('section:not(#hero) [data-split]').forEach((el) => {
    splitReveal(el, { scroll: true });
  });

  if (hasST) ScrollTrigger.refresh();
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(runTextReveals);
} else {
  window.addEventListener('load', runTextReveals);
}

/* ── Problema — reveal palabra a palabra al scroll ──────── */
(function initProblemReveal() {
  const el = document.querySelector('[data-words]');
  if (!el || REDUCED || !hasGSAP) return;

  const words = el.textContent.trim().split(/\s+/);
  /* atenúa las dos últimas palabras para dar foco */
  el.innerHTML = words.map((w, i) => {
    const dim = i >= words.length - 4 ? ' w-dim' : '';
    return `<span class="w-mask"><span class="w-inner${dim}">${w}</span></span>`;
  }).join(' ');

  const inners = el.querySelectorAll('.w-inner');
  gsap.set(inners, { yPercent: 110 });

  /* Las palabras suben ligadas al scroll (tipografía cinética) */
  gsap.to(inners, {
    yPercent: 0, ease: 'none', stagger: 0.5,
    scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 28%', scrub: 1 },
  });
})();

/* ── Reveals genéricos por scroll ───────────────────────── */
(function initReveals() {
  if (REDUCED || !hasGSAP) return;

  /* .reveal-up (fuera del hero): y:40, opacity:0, power3.out, top 82% */
  document.querySelectorAll('.reveal-up').forEach((el) => {
    gsap.set(el, { opacity: 0, y: 40 });
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 82%', once: true },
    });
  });

  /* Entrada cinética de tarjetas: escala + opacidad + giro sutil,
     escalonada. clearProps:'transform' al terminar devuelve el control
     al CSS (hover, scale de la tarjeta destacada). El carácter varía
     por sección para que no sea el mismo reflejo en todas. */
  const batch = (sel, vars) => {
    const els = gsap.utils.toArray(sel);
    if (!els.length) return;
    els.forEach((el) => el.classList.add('anim-card'));
    /* transition:none durante la entrada para que el transition:transform
       del hover (CSS) no pelee con el transform que escribe GSAP. Al
       terminar, clearProps lo devuelve al CSS (hover, scale destacado). */
    gsap.set(els, {
      opacity: 0,
      y: vars.y ?? 44,
      scale: vars.scale ?? 0.94,
      rotateZ: vars.rotate || 0,
      transformOrigin: vars.origin || '50% 100%',
      transition: 'none',
    });
    gsap.to(els, {
      opacity: 1, y: 0, scale: 1, rotateZ: 0,
      duration: vars.duration || 0.9, ease: vars.ease || 'expo.out',
      stagger: vars.stagger || 0.08,
      clearProps: 'transform,transition',
      scrollTrigger: { trigger: vars.trigger, start: 'top 82%', once: true },
    });
  };

  batch('.bento-card',   { trigger: '.bento-grid',   y: 48, scale: 0.91, rotate: -1.2, stagger: 0.08 });
  batch('.pricing-card', { trigger: '.pricing-grid', y: 52, scale: 0.93,              stagger: 0.12, duration: 0.85 });
  batch('.stat-item',    { trigger: '.stats-grid',   y: 30, scale: 0.96,              stagger: 0.1,  duration: 0.75, ease: 'power3.out' });
  batch('.testi-card',   { trigger: '.testi-grid',   y: 46, scale: 0.92, rotate: 1.6, stagger: 0.1,  duration: 0.85 });
  batch('.faq-item',     { trigger: '.faq-list',     y: 24, scale: 0.98,              stagger: 0.07, duration: 0.7,  ease: 'power3.out' });
  /* .compare-col y .step se animan en initStorytelling (scrub cinemático) */
})();

/* ── Parallax suave en elementos decorativos ────────────── */
(function initParallax() {
  if (REDUCED || !hasST) return;
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const dist = parseFloat(el.dataset.parallax) || 40;
    gsap.fromTo(el, { y: -dist }, {
      y: dist, ease: 'none',
      scrollTrigger: {
        trigger: el.closest('section') || el,
        start: 'top bottom', end: 'bottom top', scrub: true,
      },
    });
  });
})();

/* ── Líneas que se dibujan al entrar ────────────────────── */
(function initDrawLines() {
  if (REDUCED || !hasST) return;
  document.querySelectorAll('.draw-line').forEach((el) => {
    gsap.set(el, { scaleX: 0 });
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(el, { scaleX: 1, duration: 0.9, ease: 'expo.out' }),
    });
  });
  /* La línea conectora de "cómo funciona" y las barras del panel
     se animan ligadas al scroll en initStorytelling. */
})();

/* ── FAQ — acordeón accesible ───────────────────────────── */
(function initFAQ() {
  const items = document.querySelectorAll('.faq-item');
  if (!items.length) return;

  const close = (item) => {
    item.classList.remove('open');
    item.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
    item.querySelector('.faq-a').style.maxHeight = null;
  };
  const open = (item) => {
    const a = item.querySelector('.faq-a');
    item.classList.add('open');
    item.querySelector('.faq-q').setAttribute('aria-expanded', 'true');
    a.style.maxHeight = a.scrollHeight + 'px';
  };

  items.forEach((item) => {
    const q = item.querySelector('.faq-q');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((it) => it !== item && close(it));
      isOpen ? close(item) : open(item);
    });
  });

  /* recalcula altura del abierto al cambiar el viewport */
  let rT;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      const openItem = document.querySelector('.faq-item.open .faq-a');
      if (openItem) openItem.style.maxHeight = openItem.scrollHeight + 'px';
    }, 150);
  }, { passive: true });
})();

/* ── Formulario de captación (#cta) — POST a /api/lead ──── */
(function initLeadForm() {
  const form = document.getElementById('lead-form');
  if (!form) return;

  const status = form.querySelector('.lead-status');
  const btn    = form.querySelector('button[type="submit"]');
  const label  = btn && btn.querySelector('.btn-label');
  const labelText = label ? label.textContent : '';

  const setStatus = (msg, kind) => {
    status.className = 'lead-status' + (kind ? ' ' + kind : '');
    status.textContent = msg;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', '');

    if (!form.consent.checked) {
      setStatus('Acepta la política de privacidad para continuar.', 'err');
      return;
    }

    const data = {
      nombre:   form.nombre.value.trim(),
      clinica:  form.clinica.value.trim(),
      whatsapp: form.whatsapp.value.trim(),
      consent:  form.consent.checked,
      web:      form.web.value,   /* honeypot */
    };

    btn.disabled = true;
    if (label) label.textContent = 'Enviando…';

    try {
      const resp = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!resp.ok) throw new Error('bad status');
      setStatus('Recibido. Te escribimos hoy mismo por WhatsApp.', 'ok');
      form.reset();
    } catch (err) {
      setStatus('No se pudo enviar. Inténtalo de nuevo o escríbenos a hola@aitomat.com.', 'err');
    } finally {
      btn.disabled = false;
      if (label) label.textContent = labelText;
    }
  });
})();

/* ── Contadores animados desde 0 ────────────────────────── */
(function initCounters() {
  if (REDUCED || !hasST) return;
  document.querySelectorAll('.counter').forEach((el) => {
    const target = parseInt(el.dataset.target, 10);
    if (isNaN(target) || target === 0) return; /* el "—" se queda */
    const obj = { val: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(obj, {
        val: target, duration: 1.6, ease: 'power2.out',
        onUpdate() { el.textContent = Math.round(obj.val); },
        onComplete() { el.textContent = target; },
      }),
    });
  });
})();

/* ── Botones magnéticos (factor 0.3) ────────────────────── */
(function initMagnetic() {
  if (TOUCH || REDUCED || !hasGSAP) return;
  document.querySelectorAll('.magnetic').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top  + r.height / 2;
      gsap.to(btn, {
        x: (e.clientX - cx) * 0.3,
        y: (e.clientY - cy) * 0.3,
        duration: 0.3, ease: 'power2.out', overwrite: 'auto',
      });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
    });
  });
})();

/* ── Scroll storytelling cinemático (GSAP ScrollTrigger) ──── */
(function initStorytelling() {
  if (REDUCED || !hasST) return;
  const mm = gsap.matchMedia();

  /* COMPARATIVA — las dos recepciones entran desde lados opuestos
     (refuerza el contraste antes/después). */
  (function compare() {
    const grid = document.querySelector('.compare-grid');
    if (!grid) return;
    const before = grid.querySelector('.compare-before');
    const after  = grid.querySelector('.compare-after');
    const vs     = grid.querySelector('.compare-vs');
    const st = { trigger: grid, start: 'top 88%', end: 'top 46%', scrub: 1 };
    if (before) gsap.from(before, { xPercent: -7, autoAlpha: 0, ease: 'none', scrollTrigger: st });
    if (after)  gsap.from(after,  { xPercent:  7, autoAlpha: 0, ease: 'none', scrollTrigger: st });
    if (vs) {
      gsap.set(vs, { scale: 0, autoAlpha: 0 });
      ScrollTrigger.create({
        trigger: grid, start: 'top 60%', once: true,
        onEnter: () => gsap.to(vs, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'expo.out' }),
      });
    }
  })();

  /* CÓMO FUNCIONA — la línea conectora se llena y cada paso se
     enciende en secuencia, ligado al scroll (narrativa de proceso). */
  (function steps() {
    const wrap = document.querySelector('.steps-wrap');
    if (!wrap) return;
    const line = wrap.querySelector('.steps-line');
    const stepsEls = gsap.utils.toArray('.steps-wrap .step');
    const vertical = MOBILE;
    if (line) gsap.set(line, vertical ? { scaleY: 0, transformOrigin: 'top' } : { scaleX: 0, transformOrigin: 'left' });
    gsap.set(stepsEls, { autoAlpha: 0.3, y: 18 });
    const tl = gsap.timeline({ scrollTrigger: { trigger: wrap, start: 'top 80%', end: 'bottom 78%', scrub: 1 } });
    if (line) tl.to(line, vertical ? { scaleY: 1, ease: 'none' } : { scaleX: 1, ease: 'none' }, 0);
    stepsEls.forEach((s, i) => tl.to(s, { autoAlpha: 1, y: 0, ease: 'power2.out' }, i * 0.28));
  })();

  /* PANEL — tour del producto: en desktop con sitio de sobra se FIJA
     (pin) y se va montando pieza a pieza con el scroll. Si no hay
     altura suficiente, montaje al entrar sin pin (nunca se corta). */
  const buildDash = (tl) => {
    tl.from('.dash-window',    { yPercent: 5, scale: 0.95, autoAlpha: 0.35, ease: 'none' }, 0)
      .from('.dash-kpi',       { y: 26, autoAlpha: 0, stagger: 0.18, ease: 'power2.out' }, 0.15)
      .from('.dash-bars span', { scaleY: 0, transformOrigin: 'bottom', stagger: 0.07, ease: 'power2.out' }, 0.32)
      .from('.dash-appt-list li', { x: 24, autoAlpha: 0, stagger: 0.1, ease: 'power2.out' }, 0.45);
  };
  mm.add('(min-width: 769px) and (min-height: 860px)', () => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#dashboard', start: 'top top', end: '+=115%',
        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
      },
    });
    buildDash(tl);
  });
  mm.add('(max-width: 768px), (max-height: 859px)', () => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: '#dashboard', start: 'top 75%', end: 'top 22%', scrub: 1 },
    });
    buildDash(tl);
  });
})();

/* ── Chat de WhatsApp en loop ───────────────────────────── */
(function initWAChat() {
  const container = document.getElementById('wa-messages');
  if (!container) return;

  const script = [
    { role: 'patient', text: 'Hola, llamé hace un rato por una limpieza', pause: 600 },
    { role: 'bot',     text: 'Le atiendo por aquí. Tengo hueco mañana a las 18:30 o el viernes a las 10:00. ¿Cuál le viene mejor?', typing: 1300, pause: 900 },
    { role: 'patient', text: 'Mañana a las 18:30', pause: 700 },
    { role: 'bot',     text: 'Perfecto. ¿Me confirma nombre y teléfono para dejar la cita reservada?', typing: 1500, pause: 900 },
    { role: 'patient', text: 'Laura Pérez, 611 234 890', pause: 700 },
    { role: 'bot',     text: 'Cita confirmada: mañana, 18:30. Le enviaremos recordatorio 24 h antes para evitar ausencias.', typing: 1700, pause: 3400 },
  ];

  const now = () => { const d = new Date(); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function addTyping() {
    const el = document.createElement('div');
    el.className = 'wa-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }
  function addMessage(role, text) {
    const el = document.createElement('div');
    el.className = `wa-msg ${role}`;
    el.innerHTML = `${text}<span class="wa-msg-time">${now()}</span>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  async function runLoop() {
    container.innerHTML = '';
    await sleep(800);
    for (const step of script) {
      await sleep(step.pause || 600);
      if (step.role === 'bot') {
        const typing = addTyping();
        await sleep(REDUCED ? 300 : (step.typing || 1200));
        typing.remove();
        addMessage('bot', step.text);
      } else {
        addMessage('patient', step.text);
      }
    }
    await sleep(1600);
    container.style.transition = 'opacity 0.6s';
    container.style.opacity = '0';
    await sleep(700);
    container.style.transition = '';
    container.style.opacity = '1';
    runLoop();
  }

  setTimeout(runLoop, 1200);
})();

/* ── Barra de progreso de scroll (aqua, finita) ─────────── */
(function initScrollProgress() {
  const bar = document.querySelector('.scroll-progress');
  if (!bar || REDUCED) return;
  if (hasST) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
    });
  } else {
    const upd = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight || 1;
      bar.style.transform = `scaleX(${Math.min(1, h.scrollTop / max)})`;
    };
    window.addEventListener('scroll', upd, { passive: true });
    upd();
  }
})();

/* ── Tilt 3D sutil en mockups (sigue al ratón) ──────────── */
(function initTilt() {
  if (TOUCH || REDUCED || !hasGSAP) return;
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const max = parseFloat(el.dataset.tiltMax) || 8;

    let glare = null;
    if ('tiltGlare' in el.dataset) {
      glare = document.createElement('div');
      glare.className = 'tilt-glare';
      el.appendChild(glare);
    }

    gsap.set(el, { transformPerspective: 1000, transformOrigin: 'center' });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.55, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.55, ease: 'power3.out' });

    el.addEventListener('pointerenter', () => el.classList.add('tilting'));
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      ry((px - 0.5) * max * 2);
      rx((0.5 - py) * max * 2);
      if (glare) {
        glare.style.setProperty('--gx', (px * 100) + '%');
        glare.style.setProperty('--gy', (py * 100) + '%');
      }
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('tilting');
      rx(0); ry(0);
    });
  });
})();

/* Spotlight suave del centro operativo AItomat */
(function initOpsSpotlight() {
  const stage = document.querySelector('.motion-ops-stage');
  if (!stage || TOUCH || REDUCED) return;

  stage.addEventListener('pointermove', (event) => {
    const rect = stage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    stage.style.setProperty('--spot-x', `${x}%`);
    stage.style.setProperty('--spot-y', `${y}%`);
  });

  stage.addEventListener('pointerleave', () => {
    stage.style.setProperty('--spot-x', '50%');
    stage.style.setProperty('--spot-y', '45%');
  });
})();

/* ── Parallax por capas: profundidad real al hacer scroll ── */
(function initDepthParallax() {
  if (REDUCED || !hasST) return;

  const layer = (sel, vars, st) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return;
    gsap.to(el, Object.assign({ ease: 'none' }, vars, { scrollTrigger: st }));
  };

  /* Campo de orbes: deriva global lenta — el fondo se queda atrás */
  layer('.ambient', { yPercent: 14 }, { start: 0, end: 'max', scrub: 1.2 });

  /* HERO en capas: el fondo WebGL y la viñeta van más lentos que el
     contenido (que scrollea a 1x), creando profundidad al salir. */
  const heroST = { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true };
  layer('#hero-canvas',   { yPercent: 16 }, heroST);
  layer('.hero-vignette', { yPercent: 10 }, heroST);
  layer('.phone-glow',    { yPercent: 28 }, heroST);

  /* Glow de la franja de stats: velocidad propia (usa inset, no
     translate, así que el parallax no rompe ningún centrado). */
  layer('.stats-banner-grid', { yPercent: 20 },
    { trigger: '#stats', start: 'top bottom', end: 'bottom top', scrub: true });
})();
