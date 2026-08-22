'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchDevice = window.matchMedia('(hover: none)').matches;
const mobileViewport = window.matchMedia('(max-width: 760px)').matches;
const lowEndDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  || (navigator.deviceMemory && navigator.deviceMemory <= 2);
const lightweightMotion = reduceMotion || touchDevice || mobileViewport || lowEndDevice;

(function initHeroEnhancements() {
  const hero = document.querySelector('[data-spotlight]');
  const words = Array.from(document.querySelectorAll('#hero-rotator .hero-rotator-word'));

  if (words.length > 1 && !reduceMotion) {
    let index = 0;
    window.setInterval(() => {
      const current = words[index];
      const nextIndex = (index + 1) % words.length;
      const next = words[nextIndex];
      current.classList.add('is-exiting');
      current.classList.remove('is-active');
      next.classList.add('is-active');
      window.setTimeout(() => current.classList.remove('is-exiting'), 560);
      index = nextIndex;
    }, 2200);
  }

  if (!hero || reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;
  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    hero.style.setProperty('--spotlight-x', `${x.toFixed(2)}%`);
    hero.style.setProperty('--spotlight-y', `${y.toFixed(2)}%`);
  });
})();

// Escenarios alineados con las 4 cards (Consulta capturada > Hueco propuesto >
// Ausencia evitada > Paciente recuperado). Cada burbuja: [quien, texto, hora].
const phoneScenarios = [
  {
    status: 'preguntando disponibilidad...',
    action: 'Consulta cualificada',
    time: 'Limpieza · datos confirmados',
    bubbles: [
      ['patient', 'Hola, quería pedir cita para una limpieza. Mejor por la tarde.', '9:40'],
      ['ai', 'Hola, le atiende el asistente de la clínica. ¿Es una limpieza rutinaria o tiene alguna molestia?', '9:40'],
      ['patient', 'Rutinaria, sin dolor. Ya he ido otras veces.', '9:41'],
      ['ai', 'Perfecto. ¿Me indica su nombre para localizar la ficha?', '9:41'],
      ['patient', 'Laura Pérez.', '9:42'],
      ['ai', 'Gracias, Laura. Dejo anotada limpieza rutinaria y preferencia de tarde. Recepción le confirma el hueco disponible.', '9:42'],
    ],
  },
  {
    status: 'en línea',
    action: 'Cita preconfirmada',
    time: 'Pendiente de confirmación final',
    bubbles: [
      ['patient', 'Si tienen algo esta semana a última hora, me vendría bien.', '9:43'],
      ['ai', 'Lo anoto. Antes de pasarlo a recepción: ¿sigue usando el teléfono terminado en 214?', '9:43'],
      ['patient', 'Sí, correcto.', '9:44'],
      ['ai', 'Perfecto. Recepción revisa agenda y le confirma la opción de última hora que encaje mejor.', '9:44'],
      ['patient', 'Gracias.', '9:45'],
      ['ai', 'Gracias a usted. Si necesita cambiarla después, puede responder a este mismo chat.', '9:45'],
    ],
  },
  {
    status: 'en línea',
    action: 'Cambio preparado',
    time: 'Recepción avisada',
    bubbles: [
      ['ai', 'Hola, Ana. Le recordamos su cita de mañana a las 10:15. ¿Puede confirmarnos si acudirá?', '8:02'],
      ['patient', 'Uy, creo que no voy a poder.', '8:03'],
      ['ai', 'De acuerdo. ¿Quiere que intentemos moverla esta semana o prefiere dejarla para más adelante?', '8:03'],
      ['patient', 'Esta semana, si puede ser por la tarde.', '8:04'],
      ['ai', 'Anoto preferencia de tarde y aviso para liberar el hueco de mañana. Recepción le confirma la nueva cita.', '8:04'],
    ],
  },
  {
    status: 'en línea',
    action: 'Interés recuperado',
    time: 'Revisión solicitada',
    bubbles: [
      ['ai', 'Hola, Javier. Le escribimos de la clínica porque tiene pendiente la revisión anual. ¿Quiere que le pasemos opciones?', 'Lun'],
      ['patient', 'Sí, se me pasó. ¿Hay algo esta semana?', 'Lun'],
      ['ai', 'Lo revisa recepción. Para orientar la búsqueda: ¿le viene mejor mañana o tarde?', 'Lun'],
      ['patient', 'Tardes, por favor.', 'Lun'],
      ['ai', 'Anotado. Recepción le confirmará un hueco de tarde si hay disponibilidad esta semana.', 'Lun'],
    ],
  },
];

// true cuando el visitante ha activado el chat de demo REAL: la animacion
// guionizada deja de repintar el movil (los pasos del scroll ya no mandan).
let demoLive = false;
// Ping a /demo/estado (lo crea initDemoChat). Resuelve a true si hay backend:
// entonces el movil ofrece elegir entre ver la animacion o escribir de verdad.
let demoEstadoPromise = null;
// La define initDemoChat: enseña el pill "Escribir yo" sobre el movil (V2:
// el guion corre de fondo y el CTA flota encima).
let demoMostrarCTA = null;
// true cuando hay una llamada de voz REAL en curso: el guion de #voice-chat para.
let vozLive = false;
// La define el guion de voz: detiene su bucle (la usa la llamada real).
let vozPararGuion = null;
// La define el guion de voz: arranca el bucle (se retoma al colgar).
let vozArrancarGuion = null;

// Base de la API del backend: mismo origen en local, api.aitomat.es en produccion.
const DEMO_API_BASE = window.AITOMAT_API
  || (['localhost', '127.0.0.1'].includes(location.hostname) ? '' : 'https://api.aitomat.es');

// Modo presentacion (solo Alex): si la URL trae ?demo_key=XXXX, se guarda y se
// borra de la barra al instante; a partir de ahi se adjunta a las llamadas de la
// API para saltar el limite por IP (backend: DEMO_BYPASS_KEY). El JUEGO publico
// no lleva clave, asi que sigue con su limite. La clave NO se hardcodea aqui:
// solo se reenvia la que el propio Alex mete en la URL, asi el repo publico no
// filtra ningun secreto. Va como query param (no cabecera) para no disparar el
// preflight CORS (allow_headers solo permite content-type).
const DEMO_KEY_STORE = 'aitomat-demo-key';
(function capturarDemoKey() {
  try {
    const p = new URLSearchParams(location.search);
    const k = p.get('demo_key');
    if (!k) return;
    localStorage.setItem(DEMO_KEY_STORE, k); // persiste (chat + voz, aguanta reload)
    p.delete('demo_key');
    const q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    console.log('[demo] modo presentacion activo (clave guardada, URL limpiada)');
  } catch (e) { /* nada */ }
})();
function conClave(url) {
  let k = null;
  try { k = localStorage.getItem(DEMO_KEY_STORE); } catch (e) { /* nada */ }
  if (!k) return url;
  return url + (url.includes('?') ? '&' : '?') + 'demo_key=' + encodeURIComponent(k);
}

// Burbuja de chat compartida entre la animacion guionizada y la demo real.
function makeWaBubble(kind, text, time) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${kind}`;
  const body = document.createElement('span');
  body.className = 'b-text';
  body.textContent = text;
  const meta = document.createElement('span');
  meta.className = 'b-meta';
  meta.textContent = time || '';
  bubble.appendChild(body);
  bubble.appendChild(meta);
  return bubble;
}

function renderPhone(chatEl, statusEl, scenario) {
  if (!chatEl || !scenario || demoLive) return;
  if (chatEl._bubbleTimers) {
    chatEl._bubbleTimers.forEach((timer) => clearTimeout(timer));
  }
  chatEl._bubbleTimers = [];
  chatEl.innerHTML = '';

  function appendOutcome() {
    const chip = document.createElement('div');
    const label = document.createElement('b');
    const detail = document.createElement('span');

    chip.className = 'wa-system';
    label.textContent = scenario.action;
    detail.textContent = scenario.time;
    chip.appendChild(label);
    chip.appendChild(detail);
    chatEl.appendChild(chip);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  // Sin animacion: pinta todo de golpe.
  if (reduceMotion) {
    if (statusEl) statusEl.textContent = 'en l\u00ednea';
    scenario.bubbles.forEach(([kind, text, time]) => chatEl.appendChild(makeWaBubble(kind, text, time)));
    appendOutcome();
    return;
  }

  let elapsed = 70;
  let typingBubble = null;

  function clearTyping() {
    if (typingBubble) { typingBubble.remove(); typingBubble = null; }
  }
  function appendBubble(kind, text, time) {
    clearTyping();
    chatEl.appendChild(makeWaBubble(kind, text, time));
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  function showTyping(kind) {
    clearTyping();
    typingBubble = document.createElement('div');
    typingBubble.className = `bubble ${kind} typing`;
    typingBubble.innerHTML = '<span></span><span></span><span></span>';
    chatEl.appendChild(typingBubble);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  scenario.bubbles.forEach(([kind, text, time], index) => {
    if (statusEl && kind === 'ai') {
      chatEl._bubbleTimers.push(setTimeout(() => { statusEl.textContent = 'escribiendo...'; }, Math.max(0, elapsed - 70)));
    }
    if (index > 0) {
      chatEl._bubbleTimers.push(setTimeout(() => showTyping(kind), elapsed));
      elapsed += 170;
    }
    chatEl._bubbleTimers.push(setTimeout(() => {
      appendBubble(kind, text, time);
      if (statusEl) statusEl.textContent = 'en l\u00ednea';
    }, elapsed));
    elapsed += kind === 'patient' ? 360 : 460;
  });
  chatEl._bubbleTimers.push(setTimeout(appendOutcome, elapsed + 320));
}

(function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  const nav = document.querySelector('.site-nav');
  const processStage = document.getElementById('process-stage');
  const processFill = document.getElementById('process-line-fill');
  const processCards = Array.from(document.querySelectorAll('[data-process-card]'));
  let ticking = false;

  function update() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, window.scrollY / max));
    if (bar) bar.style.setProperty('--scroll-progress', `${progress * 100}%`);
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);

    if (processStage && processCards.length) {
      const rect = processStage.getBoundingClientRect();
      const local = Math.max(0, Math.min(1, (window.innerHeight * 0.72 - rect.top) / Math.max(1, rect.height)));
      const active = Math.min(processCards.length - 1, Math.floor(local * processCards.length));
      processCards.forEach((card, index) => card.classList.toggle('active', index <= active));
      if (processFill) processFill.style.setProperty('--process-progress', `${((active + 1) / processCards.length) * 100}%`);
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  if (lightweightMotion) {
    canvas.hidden = true;
    return;
  }
  const ctx = canvas.getContext('2d');
  let dots = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const count = Math.min(95, Math.floor((canvas.width * canvas.height) / 22000));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.5 + 0.35,
      a: Math.random() * 0.42 + 0.12,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dots.forEach((dot) => {
      dot.x += dot.vx;
      dot.y += dot.vy;
      if (dot.x < 0) dot.x = canvas.width;
      if (dot.x > canvas.width) dot.x = 0;
      if (dot.y < 0) dot.y = canvas.height;
      if (dot.y > canvas.height) dot.y = 0;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${dot.a})`;
      ctx.fill();
    });
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();

(function initBackgroundParallax() {
  const video = document.getElementById('bg-video');
  const tint = document.getElementById('bg-tint');
  if (!video && !tint) return;
  if (lightweightMotion) {
    // El vídeo ambiental SÍ se queda en móvil/táctil (sin él la página
    // "pierde el fondo"): sigue en bucle con autoplay, solo se salta el
    // parallax. Únicamente se retira con reduced-motion o equipo flojo.
    if (video && (reduceMotion || lowEndDevice)) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.hidden = true;
    }
    return;
  }

  let ticking = false;
  function update() {
    const y = window.scrollY || 0;
    const vh = window.innerHeight || 1;
    if (video) {
      const shift = Math.min(y * 0.12, 130);
      const scale = 1 + Math.min(y / vh, 1) * 0.06;
      video.style.transform = `translate3d(0, ${shift}px, 0) scale(${scale})`;
    }
    if (tint) tint.style.opacity = String(1 + Math.min(y / (vh * 1.25), 1) * 0.32);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
})();

(function initDiscovery() {
  const board = document.getElementById('discovery-board');
  if (!board) return;

  const data = {
    llamadas: {
      kicker: 'Llamadas perdidas',
      title: 'Recupera oportunidades aunque nadie coja el tel\u00e9fono.',
      copy: 'Cuando entra una llamada perdida, AItomat prepara respuesta, prioridad y seguimiento para que no quede en el aire.',
      lines: ['68%', '76%', '48%'],
      detected: 'Llamada perdida sin seguimiento',
      decision: 'Priorizar por horario y motivo probable',
      next: 'Enviar mensaje de recuperaci\u00f3n',
    },
    agenda: {
      kicker: 'Agenda viva',
      title: 'Mueve citas y protege los huecos buenos.',
      copy: 'Propone alternativas, evita solapes y prepara los cambios que recepción debe confirmar.',
      lines: ['74%', '88%', '52%'],
      detected: 'Hueco disponible en agenda',
      decision: 'Cruzar preferencia del paciente con disponibilidad',
      next: 'Proponer dos opciones cerradas',
    },
    noshows: {
      kicker: 'No-shows',
      title: 'Actúa antes de que el hueco se pierda.',
      copy: 'Detecta citas sin confirmar, prepara recordatorios por plantilla y escala los casos que necesitan una persona.',
      lines: ['62%', '80%', '42%'],
      detected: 'Cita sin confirmar',
      decision: 'Medir riesgo y activar recordatorio',
      next: 'Recordar con plantilla aprobada',
    },
    reactivacion: {
      kicker: 'Pacientes dormidos',
      title: 'Vuelve a llenar agenda sin perseguir a mano.',
      copy: 'Segmenta revisiones pendientes y prepara reactivacion con plantilla aprobada por Meta.',
      lines: ['86%', '54%', '66%'],
      detected: 'Paciente 8 meses sin volver',
      decision: 'Preparar motivo y oferta de revisi\u00f3n',
      next: 'Preparar plantilla de reactivacion',
    },
    whatsapp: {
      kicker: 'Mensaje sin responder',
      title: 'Convierte mensajes en citas reales.',
      copy: 'Detecta motivo, urgencia y disponibilidad, y pregunta lo necesario antes de proponer el siguiente hueco.',
      lines: ['82%', '58%', '70%'],
      detected: 'Paciente pide limpieza fuera de horario',
      decision: 'Confirmar datos y buscar hueco real',
      next: 'Responder + preparar cita',
    },
  };

  const els = {
    kicker: document.getElementById('discovery-kicker'),
    title: document.getElementById('discovery-title'),
    copy: document.getElementById('discovery-copy'),
    lines: document.getElementById('discovery-lines'),
    detected: document.getElementById('system-detected'),
    decision: document.getElementById('system-decision'),
    next: document.getElementById('system-next'),
    nodes: Array.from(board.querySelectorAll('[data-discovery]')),
  };

  function select(key) {
    const item = data[key] || data.whatsapp;
    els.kicker.textContent = item.kicker;
    els.title.textContent = item.title;
    els.copy.textContent = item.copy;
    els.lines.innerHTML = item.lines.map((w) => `<span style="--w:${w}"></span>`).join('');
    if (els.detected) els.detected.textContent = item.detected;
    if (els.decision) els.decision.textContent = item.decision;
    if (els.next) els.next.textContent = item.next;
    els.nodes.forEach((node) => node.classList.toggle('active', node.dataset.discovery === key));
  }

  els.nodes.forEach((node) => {
    node.addEventListener('mouseenter', () => select(node.dataset.discovery));
    node.addEventListener('focus', () => select(node.dataset.discovery));
    node.addEventListener('click', () => select(node.dataset.discovery));
  });

  board.addEventListener('pointermove', (event) => {
    const rect = board.getBoundingClientRect();
    board.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    board.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  });
})();

(function initStoryScroll() {
  const section = document.getElementById('flujo');
  const phone = document.getElementById('story-phone');
  const stage = section ? section.querySelector('.story-phone-pin') : null;
  const chat = document.getElementById('story-phone-chat');
  if (!section || !phone || !chat) return;
  const status = document.getElementById('story-status');
  const notes = document.querySelector('.story-notes');
  const steps = Array.from(document.querySelectorAll('[data-story-step]'));
  let active = -1;
  // El chat NO se pinta al cargar la web: se difiere hasta que el telefono entra
  // en pantalla, para que la 1a conversacion se empiece a escribir al llegar a la
  // seccion (antes setStep(0) lo renderizaba en el init y ya llegabas con todo escrito).
  let entered = false;

  function setStep(index) {
    if (index === active) return;
    active = index;
    steps.forEach((step, i) => {
      step.classList.toggle('active', i === index);
      step.classList.toggle('revealed', i <= index);
    });
    if (entered) renderPhone(chat, status, phoneScenarios[index]);
  }
  function startChat() {
    if (entered || demoLive) { entered = true; return; }
    entered = true;
    // V2: el guion arranca SIEMPRE de fondo; si el backend está vivo, el pill
    // "Escribir yo" flota encima para pasar a la demo real.
    renderPhone(chat, status, phoneScenarios[Math.max(0, active)]);
    if (demoEstadoPromise && demoMostrarCTA) {
      demoEstadoPromise.then((disponible) => { if (disponible) demoMostrarCTA(); }).catch(() => {});
    }
  }

  const n = phoneScenarios.length;
  let targetP = 0;       // progreso bruto del scroll (0..1)
  let tgtMX = 0, tgtMY = 0;  // parallax de puntero (-1..1)
  // Valores suavizados que se animan hacia el objetivo (damping):
  let curP = 0, curMX = 0, curMY = 0;
  let running = false;

  function readScroll() {
    const rect = section.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    targetP = total > 0 ? Math.max(0, Math.min(1, -rect.top / total)) : 0;
    // El scroll dirige los 4 pasos (scrollytelling).
    setStep(Math.max(0, Math.min(n - 1, Math.floor(targetP * n * 0.999))));
    if (!running && !reduceMotion) start();
  }

  function applyMotion() {
    // Modo foco (chat real): movil frontal y quieto; el loop para.
    // OJO: escala SIEMPRE 1 — scale() sobre la capa 3D rasterizada emborrona
    // el movil; el tamano extra lo da el ancho real en CSS (.demo-live).
    if (demoLive) {
      phone.style.setProperty('--story-ry', '0deg');
      phone.style.setProperty('--story-rx', '0deg');
      phone.style.setProperty('--story-x', '0px');
      phone.style.setProperty('--story-y', '0px');
      phone.style.setProperty('--story-scale', '1');
      stop();
      return;
    }
    // Giro tipo plataforma: barrido suave de un lado a otro a lo largo del scroll.
    const ry = (0.5 - curP) * 26 + curMX * 5;        // +13deg -> -13deg
    const rx = 4 - curMY * 4 - Math.sin(curP * Math.PI) * 2;
    const lift = -Math.sin(curP * Math.PI) * 16;     // flota un poco hacia el centro
    const scale = 1 + Math.sin(curP * Math.PI) * 0.025;
    phone.style.setProperty('--story-ry', `${ry.toFixed(2)}deg`);
    phone.style.setProperty('--story-rx', `${rx.toFixed(2)}deg`);
    phone.style.setProperty('--story-x', `${(curMX * 10).toFixed(1)}px`);
    phone.style.setProperty('--story-y', `${lift.toFixed(1)}px`);
    phone.style.setProperty('--story-scale', scale.toFixed(3));
    phone.style.setProperty('--back-opacity', '1');
    if (stage) stage.style.setProperty('--orbit-rotate', `${(curP * 10).toFixed(2)}deg`);
  }

  function loop() {
    if (!running) return;
    // Interpolacion exponencial -> movimiento mantequilla, sin tirones.
    curP += (targetP - curP) * 0.085;
    curMX += (tgtMX - curMX) * 0.06;
    curMY += (tgtMY - curMY) * 0.06;
    applyMotion();
    requestAnimationFrame(loop);
  }
  function start() {
    if (running || demoLive) return;
    running = true;
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  setStep(0);

  if (reduceMotion) {
    steps.forEach((step) => step.classList.add('revealed'));
    startChat();  // sin animacion: muestra la conversacion directamente
  } else {
    if (notes) notes.classList.add('story-reveal');
    // Solo animamos cuando la seccion esta a la vista.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? start() : stop()));
      }, { threshold: 0 });
      io.observe(section);
      // Arranca la 1a conversacion (efecto de tecleo) cuando el telefono entra
      // en pantalla; se desconecta tras la primera vez.
      const chatIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { startChat(); chatIO.disconnect(); }
        });
      }, { threshold: 0.3 });
      chatIO.observe(phone);
    } else {
      start();
      startChat();
    }
    if (!matchMedia('(hover: none)').matches) {
      window.addEventListener('mousemove', (e) => {
        tgtMX = (e.clientX / window.innerWidth - 0.5) * 2;
        tgtMY = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }
  }

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', readScroll);
  readScroll();
})();

(function initSystemCases() {
  const wrap = document.getElementById('system-cases');
  const win = document.getElementById('discovery-board');
  if (!wrap || !win) return;

  const tabs = Array.from(wrap.querySelectorAll('.os-tab'));
  const steps = Array.from(win.querySelectorAll('.os-step'));
  const els = {
    message: document.getElementById('case-message'),
    decision: document.getElementById('case-decision'),
    action: document.getElementById('case-action'),
    done: document.getElementById('case-done'),
    human: document.getElementById('case-human'),
    metricLabel: document.getElementById('case-metric-label'),
    metricVal: document.getElementById('case-metric-val'),
    meter: document.getElementById('case-meter'),
    note: document.getElementById('case-note'),
    caption: document.getElementById('os-caption'),
  };

  const cases = {
    llamadas: {
      caption: 'Recupera llamadas perdidas sin fingir que no es IA.',
      message: 'Llamada perdida de +34 6XX XXX 210 a las 14:10. Sin mensaje.',
      decision: 'Identifica n\u00famero recurrente y pregunta el motivo antes de proponer el siguiente paso.',
      action: 'Env\u00eda un mensaje de recuperaci\u00f3n y deriva a recepci\u00f3n si el caso necesita una persona.',
      done: 9, human: 2, metric: 'Llamadas recuperadas', value: 71,
      note: 'Ninguna oportunidad se queda en el aire.',
    },
    agenda: {
      caption: 'Reorganiza la agenda y rescata huecos a punto de perderse.',
      message: 'Hueco de las 18:30 a punto de quedar vac\u00edo para ma\u00f1ana.',
      decision: 'Busca pacientes en lista de espera y cruza preferencias con disponibilidad.',
      action: 'Ofrece el hueco a dos candidatos y lo deja preparado cuando uno confirma.',
      done: 21, human: 1, metric: 'Agenda ocupada', value: 88,
      note: 'Protege los huecos que se pueden vender.',
    },
    noshows: {
      caption: 'Confirma citas y previene las ausencias antes de que pasen.',
      message: 'Cita de ma\u00f1ana 10:15 sin confirmar. Paciente con una ausencia previa.',
      decision: 'Calcula riesgo alto y pregunta si confirma, cambia o necesita hablar con recepci\u00f3n.',
      action: 'Manda recordatorio, pide confirmaci\u00f3n y prepara liberar el hueco si no responde.',
      done: 17, human: 4, metric: 'Riesgo de ausencia', value: 64,
      note: 'Act\u00faa antes de perder el hueco.',
    },
    reactivacion: {
      caption: 'Trae de vuelta a los pacientes que llevan meses sin venir.',
      message: 'Paciente sin venir desde hace 8 meses. Revisi\u00f3n pendiente.',
      decision: 'Segmenta por probabilidad de retorno y prepara un motivo personalizado.',
      action: 'Env\u00eda seguimiento contextual y pregunta si quiere ver huecos de revisi\u00f3n esta semana.',
      done: 32, human: 5, metric: 'Vuelven a la consulta', value: 58,
      note: 'Vuelve a llenar agenda sin perseguir a mano.',
    },
    whatsapp: {
      caption: 'Pregunta, cualifica y prepara los mensajes que nadie contesta. Canal de WhatsApp en preparaci\u00f3n.',
      message: 'Hola, \u00bften\u00e9is hueco para una limpieza? Mejor por la tarde.',
      decision: 'Detecta intenci\u00f3n de cita y pregunta si es primera visita, motivo y preferencia horaria.',
      action: 'Ofrece dos huecos reales y deja la cita preparada cuando el paciente elige.',
      done: 14, human: 3, metric: 'Confianza de la respuesta', value: 92,
      note: 'Sin esperar a que recepci\u00f3n abra.',
    },
  };

  let stepTimer = null;
  function lightSteps() {
    if (stepTimer) clearTimeout(stepTimer);
    steps.forEach((s) => s.classList.remove('lit'));
    if (reduceMotion) { steps.forEach((s) => s.classList.add('lit')); return; }
    let i = 0;
    const next = () => {
      if (i >= steps.length) return;
      steps[i].classList.add('lit');
      i += 1;
      stepTimer = setTimeout(next, 520);
    };
    next();
  }

  function countUp(el, target) {
    if (!el) return;
    if (reduceMotion) { el.textContent = String(target); return; }
    const start = performance.now();
    const dur = 650;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function select(key) {
    const data = cases[key] || cases.llamadas;
    if (els.caption) els.caption.textContent = data.caption;
    if (els.message) els.message.textContent = data.message;
    if (els.decision) els.decision.textContent = data.decision;
    if (els.action) els.action.textContent = data.action;
    if (els.metricLabel) els.metricLabel.textContent = data.metric;
    if (els.metricVal) els.metricVal.textContent = `${data.value}%`;
    if (els.meter) els.meter.style.setProperty('--w', `${data.value}%`);
    win.style.setProperty('--os-scan', `${8 + data.value * 0.82}%`);
    win.setAttribute('aria-labelledby', `tab-${key}`);
    countUp(els.done, data.done);
    countUp(els.human, data.human);
    tabs.forEach((tab) => {
      const on = tab.dataset.case === key;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    if (!reduceMotion) {
      win.classList.remove('swap');
      void win.offsetWidth;
      win.classList.add('swap');
    }
    lightSteps();
  }

  // Auto-demo: rota entre casos hasta que el usuario interactua.
  let autoIndex = 0;
  let auto = null;
  const keys = Object.keys(cases);
  function stopAuto() { if (auto) { clearInterval(auto); auto = null; } }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => { stopAuto(); select(tab.dataset.case); });
    tab.addEventListener('mouseenter', () => { stopAuto(); select(tab.dataset.case); });
    tab.addEventListener('focus', () => { stopAuto(); select(tab.dataset.case); });
    tab.addEventListener('keydown', (event) => {
      const current = tabs.indexOf(tab);
      let next = current;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      stopAuto();
      select(tabs[next].dataset.case);
      tabs[next].focus();
    });
  });

  if (!reduceMotion) {
    auto = setInterval(() => {
      autoIndex = (autoIndex + 1) % keys.length;
      select(keys[autoIndex]);
    }, 4200);
  }

  select(keys[0]);
})();

(function initInbox() {
  const list = document.getElementById('message-list');
  const els = {
    avatar: document.getElementById('reader-avatar'),
    from: document.getElementById('reader-from'),
    meta: document.getElementById('reader-meta'),
    pill: document.getElementById('reader-pill'),
    subject: document.getElementById('reader-subject'),
    summary: document.getElementById('reader-summary'),
    draft: document.getElementById('reader-draft'),
    action: document.getElementById('reader-action'),
    body: document.getElementById('reader-body'),
  };
  if (!list || !els.from) return;

  // Colores por etiqueta (coinciden con la leyenda del sidebar)
  const labelColor = {
    Prioritario: '#ff8066',
    Cita: '#5af0d8',
    Cambio: '#f1b64b',
    Reactivar: '#3978ff',
    Info: '#a4f4fd',
  };

  const messages = [
    {
      from: 'Carlos Martín', avatar: 'C', time: '8:12', label: 'Prioritario', unread: true,
      subject: 'Dolor de muela desde anoche',
      preview: 'Dolor fuerte, pide cita para hoy.',
      meta: 'Mensaje \u00b7 8:12 \u00b7 prioridad alta',
      summary: 'Dolor agudo. AItomat pregunta por síntomas, marca prioridad alta y prepara el caso para recepción.',
      body: ['Llevo desde anoche con un dolor de muela fuerte, casi no he dormido.', '\u00bfTen\u00e9is alg\u00fan hueco para hoy? Es bastante urgente.'],
      draft: 'Lo siento, Carlos. Para ayudarte bien: \u00bfhay inflamaci\u00f3n, fiebre o dolor al morder? Aviso a recepci\u00f3n para que te llamen cuanto antes.',
      cta: 'Pasar a recepci\u00f3n',
    },
    {
      from: 'Laura Pérez', avatar: 'L', time: '9:41', label: 'Cita', unread: true,
      subject: 'Limpieza esta semana',
      preview: 'Prefiere por la tarde, tel\u00e9fono confirmado.',
      meta: 'Mensaje \u00b7 9:41',
      summary: 'Paciente interesada en limpieza. AItomat confirma motivo, datos y preferencia antes de proponer huecos.',
      body: ['Hola, necesito una limpieza esta semana.', 'Si puede ser por la tarde, mejor. Gracias.'],
      draft: 'Hola Laura, perfecto. \u00bfSer\u00eda una limpieza normal y sigues usando este tel\u00e9fono? Si es as\u00ed, te paso dos huecos de tarde.',
      cta: 'Preguntar y preparar cita',
    },
    {
      from: 'Familia Soler', avatar: 'S', time: '9:08', label: 'Cita', unread: true,
      subject: 'Primera visita para mi hijo',
      preview: 'Ni\u00f1o de 7 a\u00f1os, revisi\u00f3n general.',
      meta: 'Mensaje \u00b7 9:08',
      summary: 'Primera visita infantil. AItomat pide datos b\u00e1sicos y ofrece pasar el caso a odontopediatr\u00eda.',
      body: ['Buenos d\u00edas, quer\u00eda pedir cita para mi hijo de 7 a\u00f1os.', 'Es la primera vez que viene a la cl\u00ednica.'],
      draft: 'Encantados de recibirle. Para orientarle bien: \u00bfla visita es revisi\u00f3n general o hay alguna molestia? Despu\u00e9s le paso opciones con odontopediatr\u00eda.',
      cta: 'Pedir datos',
    },
    {
      from: 'Marta Ruiz', avatar: 'M', time: 'Ayer', label: 'Cambio', unread: false,
      subject: 'Mover la cita del jueves',
      preview: 'No puede asistir, pide el viernes.',
      meta: 'Mensaje \u00b7 ayer 19:02',
      summary: 'La paciente pide cambio. AItomat pregunta disponibilidad y deja el nuevo hueco preparado para confirmar.',
      body: ['No voy a poder ir el jueves al final.', '\u00bfMe lo pod\u00e9is cambiar al viernes?'],
      draft: 'Sin problema, Marta. El viernes veo disponibilidad a las 12:00. \u00bfTe encaja ese horario para dejar el cambio preparado?',
      cta: 'Preparar cambio',
    },
    {
      from: 'Javier Gómez', avatar: 'J', time: 'Ayer', label: 'Info', unread: false,
      subject: 'Dudas con el presupuesto de ortodoncia',
      preview: 'Pregunta por financiaci\u00f3n y plazos.',
      meta: 'Mensaje \u00b7 ayer 17:40',
      summary: 'Consulta sobre el presupuesto de ortodoncia. AItomat responde dudas frecuentes y ofrece llamada con coordinadora.',
      body: ['Me pasasteis el presupuesto de ortodoncia la semana pasada.', '\u00bfHay opci\u00f3n de pagarlo a plazos?'],
      draft: 'Hola Javier, s\u00ed: financiamos la ortodoncia hasta en 12 meses sin intereses. \u00bfTe llamo ma\u00f1ana para verlo contigo?',
      cta: 'Enviar respuesta',
    },
    {
      from: 'Ana López', avatar: 'A', time: 'Lun', label: 'Cambio', unread: false,
      subject: 'Confirmaci\u00f3n cita 10:15',
      preview: 'Sin confirmar, 1 ausencia previa.',
      meta: 'Recordatorio \u00b7 lunes',
      summary: 'Cita sin confirmar con riesgo de ausencia. AItomat pide confirmaci\u00f3n o reprogramaci\u00f3n antes de tocar la agenda.',
      body: ['Recordatorio enviado para la cita de ma\u00f1ana a las 10:15.', 'Paciente con una ausencia previa. A la espera de confirmaci\u00f3n.'],
      draft: 'Hola Ana, te recordamos tu cita ma\u00f1ana a las 10:15. Responde S\u00cd para confirmar o NO para reprogramarla.',
      cta: 'Reenviar recordatorio',
    },
    {
      from: 'Pacientes dormidos', avatar: 'P', time: 'Lun', label: 'Reactivar', unread: false,
      subject: '12 pacientes sin revisi\u00f3n hace +6 meses',
      preview: 'Segmento listo para reactivar.',
      meta: 'Campa\u00f1a \u00b7 lunes',
      summary: '12 pacientes con revisi\u00f3n pendiente y alta probabilidad de retorno. Campa\u00f1a personalizada lista para enviar.',
      body: ['Segmento: \u00faltima visita hace m\u00e1s de 6 meses.', '12 candidatos a revisi\u00f3n y limpieza con buen hist\u00f3rico.'],
      draft: 'Hola {nombre}, hace tiempo que no vemos tu revisi\u00f3n. Si te viene bien retomarla, podemos pasarte opciones para esta semana.',
      cta: 'Enviar seguimiento',
    },
  ];

  // "AItomat" en texto plano se lee "Altomat"; resaltamos el "AI" para que la I se vea.
  function brandify(str) {
    return String(str).replace(/AItomat/g, '<span class="b-ai">AI</span>tomat');
  }

  function render(index) {
    const m = messages[index];
    els.avatar.textContent = m.avatar;
    els.from.textContent = m.from;
    els.meta.textContent = m.meta;
    els.pill.textContent = m.label;
    els.pill.style.color = labelColor[m.label] || 'var(--aqua)';
    if (els.subject) els.subject.textContent = m.subject;
    els.summary.innerHTML = brandify(m.summary);
    if (els.draft) els.draft.textContent = m.draft;
    if (els.action) els.action.textContent = m.cta;
    els.body.innerHTML = '';
    m.body.forEach((line) => {
      const p = document.createElement('p');
      p.textContent = line;
      els.body.appendChild(p);
    });
    Array.from(list.children).forEach((child, i) => {
      const on = i === index;
      child.classList.toggle('active', on);
      if (on) child.classList.remove('unread');
    });
  }

  messages.forEach((m, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `message-item${index === 0 ? ' active' : ''}${m.unread ? ' unread' : ''}`;
    const color = labelColor[m.label] || 'var(--aqua)';
    item.innerHTML = `
      <span class="mi-tag" style="background:${color}"></span>
      <span class="mi-from">${m.from}</span>
      <span class="mi-time">${m.time}</span>
      <span class="mi-sub">${m.subject}</span>
      <span class="mi-prev">${m.preview}</span>
    `;
    item.addEventListener('click', () => render(index));
    list.appendChild(item);
  });
  render(0);
})();

(function initReveal() {
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const els = Array.from(document.querySelectorAll(
    '.hero-copy, .section-copy, .audit-grid, .trust-faq, .voice-copy, .voice-skill-board, .voice-chat-example, .discovery-board, .story-phone-pin, .mail-app, .pricing-shell, .cta-copy, .lead-form'
  ));
  document.documentElement.classList.add('reveal-ready');
  els.forEach((el) => el.classList.add('reveal-item'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
  els.forEach((el) => observer.observe(el));
})();

(function initLeadForms() {
  const forms = Array.from(document.querySelectorAll('form[data-lead-form]'));
  if (!forms.length) return;

  // En producción la web está en GitHub Pages, pero los leads entran por el
  // backend propio para quedar guardados en la BD y visibles en el panel.
  forms.forEach((form) => wireLeadForm(form));

  function wireLeadForm(form) {
  const status = form.querySelector('.lead-status');
  const button = form.querySelector('button[type="submit"]');
  const inModal = form.closest('.demo-modal');

  function setStatus(message, type) {
    if (!status) return;
    status.textContent = message;
    status.className = `lead-status ${type || ''}`.trim();
  }

  function leadEndpoint() {
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isLocalStatic = isLocalhost && window.location.port === '8000';
    // Pruebas locales: igual que antes, contra el FastAPI local.
    if (isLocalStatic) return 'http://127.0.0.1:8001/api/lead';
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:8001/api/lead';
    if (isLocalhost) return '/api/lead';
    // Producción (dominio / GitHub Pages): backend propio.
    return 'https://api.aitomat.es/api/lead';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const honeypot = String(data.get('web') || '');
    const payload = {
      nombre: String(data.get('nombre') || '').trim(),
      clinica: String(data.get('clinica') || '').trim(),
      whatsapp: String(data.get('whatsapp') || '').trim(),
      web: honeypot,                 // honeypot para el backend
      _gotcha: honeypot,             // alias de honeypot por compatibilidad
      _subject: 'Nuevo lead AItomat',
      consent: data.get('consent') === 'on',
    };

    try {
      if (button) {
        button.disabled = true;
        button.textContent = 'Enviando...';
      }
      setStatus('Enviando solicitud...', '');
      const response = await fetch(leadEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let detail = 'No se pudo enviar. Inténtalo otra vez.';
        try {
          const body = await response.json();
          detail = body.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }
      form.reset();
      setStatus('Solicitud enviada. Te escribimos pronto.', 'ok');
      if (inModal) {
        window.setTimeout(() => {
          const closer = inModal.querySelector('[data-demo-close]');
          if (closer) closer.click();
        }, 1800);
      }
    } catch (error) {
      const usingLocalApi = leadEndpoint().includes('127.0.0.1:8001');
      const message = usingLocalApi
        ? 'No conecta con FastAPI. Arranca el servidor en el puerto 8001 y vuelve a enviar.'
        : (error.message || 'No se pudo enviar. Inténtalo otra vez.');
      setStatus(message, 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Solicitar demo';
      }
    }
  });
  }
})();

/* ===================================================================
   21st patterns reimplementados en vanilla (mismas guardas: reduceMotion,
   pointer, low-end). #6 partículas título · #1 escena 3D voz ·
   #5 lamp lateral · #7 modal demo expandible.
   =================================================================== */

(function initHeroTitleParticles() {
  if (reduceMotion) return;
  const canvas = document.getElementById('hero-title-fx');
  const wrap = canvas && canvas.closest('.hero-title-wrap');
  if (!canvas || !wrap) return;
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 2)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  if (lowEnd) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const COLORS = ['90,240,216', '123,231,255', '247,251,248'];
  let W = 0, H = 0, parts = [], raf = 0, running = false;

  function make() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      speed: Math.random() * 0.4 + 0.12,
      len: Math.random() * 1.6 + 0.8,
      op: Math.random() * 0.5 + 0.22,
      fade: Date.now() + Math.random() * 2600 + 600,
      out: false,
      c: COLORS[(Math.random() * COLORS.length) | 0],
    };
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(120, Math.floor((W * H) / 2200));
    parts = Array.from({ length: count }, make);
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    const now = Date.now();
    for (const p of parts) {
      p.y -= p.speed;
      if (p.y < -4) Object.assign(p, make(), { y: H + 2 });
      if (!p.out && now > p.fade) p.out = true;
      if (p.out) {
        p.op -= 0.006;
        if (p.op <= 0) Object.assign(p, make(), { y: H + 2 });
      }
      ctx.fillStyle = `rgba(${p.c},${p.op})`;
      ctx.fillRect(p.x, p.y, 0.7, p.len);
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    canvas.classList.add('is-live');
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  resize();
  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? start() : stop()));
    }, { threshold: 0.05 });
    io.observe(wrap);
  } else {
    start();
  }
})();

(function initVoiceSpline() {
  const fig = document.getElementById('voice-3d');
  if (!fig) return;
  const scene = fig.getAttribute('data-scene');
  if (!scene) return;
  // El 3D pesado solo en equipos capaces y con puntero fino; si no, se quedan
  // las anillas de fallback (estética coherente, coste cero).
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory < 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (reduceMotion || coarse || lowEnd) return;

  let loaded = false;
  function ensureRuntime() {
    if (window.customElements && customElements.get('spline-viewer')) return Promise.resolve();
    if (window.__splineLoading) return window.__splineLoading;
    window.__splineLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.type = 'module';
      // Runtime autoalojado: en la primera visita carga desde nuestro propio
      // dominio (rápido y fiable), no desde unpkg. Los sub-módulos perezosos
      // (navmesh/physics/...) viven en la misma carpeta y resuelven solos.
      s.src = '/features/landing/spline/spline-viewer.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.__splineLoading;
  }
  function load() {
    if (loaded) return;
    loaded = true;
    ensureRuntime().then(() => {
      const viewer = document.createElement('spline-viewer');
      viewer.setAttribute('url', scene);
      // CLAVE: loading="eager". Sin esto el visor usa loading="auto" y su load()
      // se niega a cargar la escena mientras el elemento esta fuera del viewport
      // (guarda interna: !inViewport && loading!=="eager" -> no carga). Resultado:
      // la escena solo cargaba al hacer scroll a la seccion y la intro (cara ->
      // camara alejandose al cuerpo) se reproducia ahi. Con "eager" la escena
      // carga al entrar en la web; la intro corre arriba mientras el robot esta
      // oculto y al llegar a la seccion ya esta en su pose final, sin transicion.
      viewer.setAttribute('loading', 'eager');
      // events-target="global": el runtime escucha el raton a nivel de VENTANA
      // (updateUseWindowEvents) en vez de solo sobre su canvas, asi la cabeza
      // del robot sigue al raton por toda la pagina, no solo al pasar por encima.
      viewer.setAttribute('events-target', 'global');
      viewer.setAttribute('loading-anim-type', 'none');
      fig.classList.add('is-spline-mounted');

      // Oculta la marca de agua "Built with Spline" SIN borrar nodos. CLAVE:
      // el runtime guarda this._logo y justo antes de disparar 'load-complete'
      // ejecuta this._logo.style.display="flex". Si borramos ese nodo del shadow
      // DOM, esa línea revienta ("reading 'style' of null"), NUNCA dispara
      // 'load-complete' y el canvas se queda visibility:hidden -> el robot no
      // aparece. Por eso lo tapamos con una hoja de estilos !important inyectada
      // en el shadow root (el nodo sigue ahí, el runtime no peta).
      let wmStyled = false;
      function hideWatermark() {
        const root = viewer.shadowRoot;
        if (!root || wmStyled) return;
        try {
          const st = document.createElement('style');
          st.textContent = '#logo,a[href*="spline" i],[class*="logo" i]{display:none!important;opacity:0!important;pointer-events:none!important}';
          root.appendChild(st);
          wmStyled = true;
        } catch (e) { /* shadow DOM no accesible */ }
      }

      // Revelar = hacer visible el canvas del visor y fundir el robot local
      // (is-live). El spline-viewer NO emite 'load'; emite 'load-complete'
      // (escena cargada) y 'rendered' (1er frame). Escuchamos esos, y además
      // forzamos nosotros la visibilidad del canvas por si el flujo fallara.
      let revealed = false;
      const reveal = () => {
        if (revealed) return;
        revealed = true;
        try {
          const c = viewer.shadowRoot && viewer.shadowRoot.querySelector('canvas');
          if (c) c.style.visibility = 'visible';
        } catch (e) { /* ignore */ }
        fig.classList.add('is-live');
      };
      viewer.addEventListener('load-complete', reveal);
      viewer.addEventListener('rendered', reveal);
      fig.appendChild(viewer);

      // Polling: oculta la marca de agua y, como red de seguridad si los eventos
      // no llegaran, revela cuando el canvas lleva ~5s presente (ya ha pintado;
      // en 1ª visita la escena tarda ~4-5s). El robot local cubre la espera.
      let ticks = 0;
      let canvasSeenAt = 0;
      const iv = window.setInterval(() => {
        hideWatermark();
        if (!revealed && viewer.shadowRoot && viewer.shadowRoot.querySelector('canvas')) {
          if (!canvasSeenAt) canvasSeenAt = Date.now();
          else if (Date.now() - canvasSeenAt > 5000) reveal();
        }
        ticks += 1;
        if ((revealed && wmStyled) || ticks > 140) window.clearInterval(iv);
      }, 150);
    }).catch(() => { loaded = false; });
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { load(); io.disconnect(); }
      });
    }, { rootMargin: '1200px' });
    io.observe(fig);
  } else {
    load();
  }

  // Arranque inmediato: el runtime y la escena ya van precargados en el <head>,
  // así que montamos el visor cuanto antes para que el 3D esté listo al llegar
  // a la sección (clave en la 1ª visita). El IntersectionObserver de arriba es
  // solo un respaldo; load() está protegido contra dobles llamadas.
  load();
})();

(function initLampEdges() {
  const sections = Array.from(document.querySelectorAll('[data-lamp]'));
  if (!sections.length) return;
  // En reduced-motion se deja el estado de reposo visible (sin animar).
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-lamp');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('lamp-in');
    });
  }, { threshold: 0.2 });
  sections.forEach((s) => io.observe(s));
})();

(function initDemoModal() {
  const modal = document.getElementById('demo-modal');
  if (!modal) return;
  const card = modal.querySelector('.demo-modal-card');
  const opens = Array.from(document.querySelectorAll('[data-demo-open]'));
  const closes = Array.from(modal.querySelectorAll('[data-demo-close]'));
  let lastFocus = null;

  function open(ev) {
    if (ev) ev.preventDefault();
    lastFocus = document.activeElement;
    const trigger = ev && (ev.currentTarget || ev.target);
    if (trigger && card && trigger.getBoundingClientRect) {
      const r = trigger.getBoundingClientRect();
      const ox = ((r.left + r.width / 2) / window.innerWidth * 100).toFixed(1);
      const oy = ((r.top + r.height / 2) / window.innerHeight * 100).toFixed(1);
      card.style.transformOrigin = `${ox}% ${oy}%`;
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('demo-open');
    const first = modal.querySelector('input, button[type="submit"]');
    if (first) window.setTimeout(() => first.focus(), 60);
    document.addEventListener('keydown', onKey);
  }
  function close() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('demo-open');
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const f = Array.from(modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  opens.forEach((b) => b.addEventListener('click', open));
  closes.forEach((b) => b.addEventListener('click', close));
})();

(function initVoiceTranscript() {
  const chat = document.getElementById('voice-chat');
  if (!chat) return;
  const statusEl = document.getElementById('voice-status');
  const topicEl = document.getElementById('voice-topic');

  // El asistente SIEMPRE se presenta como asistente de la clínica, nunca finge
  // ser humano. Cada escenario rota con un motivo distinto.
  const scenarios = [
    {
      topic: 'Prioritario',
      outcome: { action: 'Derivado a recepción', time: 'marcado como prioritario' },
      bubbles: [
        ['ai', 'Clínica dental, le atiende el asistente virtual. ¿En qué puedo ayudarle?'],
        ['patient', 'Me duele una muela desde anoche y se me ha hinchado un poco la cara.'],
        ['ai', 'Lo siento. Para avisar bien a recepción: ¿el dolor es constante? ¿Tiene fiebre o dificultad para abrir la boca?'],
        ['patient', 'Constante sí. Fiebre no, pero al morder me duele bastante.'],
        ['ai', 'Gracias. Lo marco como prioritario. Recepción le llamará cuanto antes para darle el primer hueco disponible hoy.'],
      ],
    },
    {
      topic: 'Primera visita',
      outcome: { action: 'Primera cita preparada', time: 'datos recogidos' },
      bubbles: [
        ['ai', 'Le atiende el asistente virtual de la clínica. ¿Es para una cita o tiene alguna molestia?'],
        ['patient', 'Sería primera visita. Quiero una revisión y limpieza si se puede.'],
        ['ai', 'Perfecto. ¿Me indica su nombre y si prefiere mañana o tarde? Así recepción le confirma un hueco concreto.'],
        ['patient', 'Marta Ruiz. Mejor por la tarde, a partir de las seis.'],
        ['ai', 'Anotado, Marta. Dejo registrada primera visita con preferencia de tarde y recepción le confirma la opción disponible.'],
      ],
    },
    {
      topic: 'Cambio de cita',
      outcome: { action: 'Cita reprogramada', time: 'hueco anterior liberado' },
      bubbles: [
        ['ai', 'Soy el asistente virtual de la clínica. ¿En qué le ayudo?'],
        ['patient', 'Tengo cita mañana a las 10:00 y no voy a poder ir.'],
        ['ai', 'De acuerdo. ¿Quiere cambiarla o prefiere que la cancelemos?'],
        ['patient', 'Cambiarla. Si puede ser esta semana por la tarde.'],
        ['ai', 'Perfecto. Aviso para liberar el hueco de mañana y dejo su preferencia de tarde. Recepción le confirma el nuevo horario.'],
      ],
    },
    {
      topic: 'Presupuesto ortodoncia',
      outcome: { action: 'Valoración agendada', time: 'sin compromiso' },
      bubbles: [
        ['ai', 'Le atiende el asistente virtual de la clínica. ¿En qué puedo ayudarle?'],
        ['patient', 'Quería saber el precio de la ortodoncia invisible.'],
        ['ai', 'Depende del caso y de la duración del tratamiento. Lo habitual es verlo en una valoración inicial. ¿Quiere que le busquen cita?'],
        ['patient', 'Sí, pero antes me gustaría saber si se puede financiar.'],
        ['ai', 'Sí, lo anoto para que le expliquen opciones de financiación. Recepción le llama y le propone horario para la valoración.'],
      ],
    },
    {
      topic: 'Paciente dormido',
      outcome: { action: 'Paciente reactivado', time: 'revisión solicitada' },
      bubbles: [
        ['ai', 'Hola, le escribimos de la clínica. Tiene pendiente la revisión anual. ¿Quiere que le pasemos opciones?'],
        ['patient', 'Sí, la verdad es que se me pasó.'],
        ['ai', 'No hay problema. ¿Le viene mejor por la mañana o por la tarde?'],
        ['patient', 'Por la mañana, pero que no sea lunes.'],
        ['ai', 'Anotado: mañana, evitando lunes. Recepción le confirmará el hueco que mejor encaje.'],
      ],
    },
  ];

  let token = 0;
  let running = false;
  const timers = [];
  function wait(ms) {
    return new Promise((resolve) => { timers.push(setTimeout(resolve, ms)); });
  }
  function clearTimers() {
    while (timers.length) clearTimeout(timers.pop());
  }
  function scrollDown() { chat.scrollTop = chat.scrollHeight; }

  function makeBubble(kind, time) {
    const b = document.createElement('div');
    b.className = `bubble ${kind}`;
    const body = document.createElement('span');
    body.className = 'b-text';
    const meta = document.createElement('span');
    meta.className = 'b-meta';
    meta.textContent = time || '';
    b.appendChild(body);
    b.appendChild(meta);
    return { b, body };
  }
  function typingEl(kind) {
    const t = document.createElement('div');
    t.className = `bubble ${kind} typing`;
    t.innerHTML = '<span></span><span></span><span></span>';
    return t;
  }
  function fillStatic(sc) {
    chat.innerHTML = '';
    if (topicEl) topicEl.textContent = sc.topic;
    sc.bubbles.forEach(([kind, text]) => {
      const { b, body } = makeBubble(kind);
      body.textContent = text;
      chat.appendChild(b);
    });
    if (statusEl) statusEl.textContent = 'derivación preparada';
  }

  async function streamText(node, text, my) {
    for (let i = 0; i < text.length; i++) {
      if (my !== token) return;
      node.textContent = text.slice(0, i + 1);
      scrollDown();
      await wait(text[i] === ' ' ? 6 : 10);
    }
  }
  async function playScenario(sc, my) {
    chat.innerHTML = '';
    if (topicEl) topicEl.textContent = sc.topic;
    for (let i = 0; i < sc.bubbles.length; i++) {
      if (my !== token) return;
      const [kind, text] = sc.bubbles[i];
      if (statusEl) statusEl.textContent = kind === 'ai' ? 'el asistente responde…' : 'paciente al habla…';
      const typing = typingEl(kind);
      chat.appendChild(typing);
      scrollDown();
      await wait(kind === 'patient' ? 240 : 320);
      if (my !== token) { typing.remove(); return; }
      typing.remove();
      const { b, body } = makeBubble(kind);
      chat.appendChild(b);
      scrollDown();
      await streamText(body, text, my);
      await wait(160);
    }
    if (my !== token) return;
    if (statusEl) statusEl.textContent = 'derivación preparada';
    scrollDown();
    await wait(1600);
  }
  async function runLoop() {
    const my = token;
    let i = 0;
    while (running && my === token) {
      await playScenario(scenarios[i % scenarios.length], my);
      i += 1;
    }
  }
  function start() {
    if (running || vozLive) return;
    running = true;
    token += 1;
    runLoop();
  }
  function stop() {
    running = false;
    token += 1;
    clearTimers();
  }
  vozPararGuion = stop;     // la llamada real corta el guion desde initVoiceCall
  vozArrancarGuion = start; // y lo retoma al colgar

  if (reduceMotion) {
    fillStatic(scenarios[0]);
    return;
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? start() : stop()));
    }, { threshold: 0.25 });
    io.observe(chat);
  } else {
    start();
  }
})();

(function initMobileNav() {
  const nav = document.querySelector('.site-nav');
  const toggle = nav ? nav.querySelector('.nav-toggle') : null;
  if (!nav || !toggle) return;
  const menu = nav.querySelector('.nav-links');
  const cta = nav.querySelector('.nav-cta');

  const setOpen = (open) => {
    nav.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!nav.classList.contains('menu-open'));
  });

  // Cerrar el menú al navegar a una sección o al abrir la demo desde el CTA.
  if (menu) {
    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setOpen(false));
    });
  }
  if (cta) cta.addEventListener('click', () => setOpen(false));

  // Cerrar con Escape o al tocar fuera del nav.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (nav.classList.contains('menu-open') && !nav.contains(event.target)) setOpen(false);
  });
})();

// ── Chat de demo REAL en el móvil (progressive enhancement) ──────────────────
// Si el backend responde en /demo/estado, la barra de escritura del móvil se
// vuelve real: el visitante habla con el MISMO bot que atiende las llamadas
// (agenda local de verdad; el asistente nunca dice un nombre de clínica).
// Si no hay backend (landing estática sin API), no aparece nada y la
// animación guionizada queda exactamente como siempre.
(function initDemoChat() {
  const form = document.getElementById('demo-chat-form');
  const input = document.getElementById('demo-chat-input');
  const boton = document.getElementById('demo-chat-send');
  const fakeBar = document.getElementById('demo-chat-inputbar-fake');
  const chat = document.getElementById('story-phone-chat');
  const status = document.getElementById('story-status');
  const pill = document.getElementById('demo-probar');
  if (!form || !input || !boton || !chat) return;

  const API_BASE = DEMO_API_BASE;

  // Identificador de sesión (el backend limita mensajes por sesión).
  let sessionId = '';
  try {
    sessionId = sessionStorage.getItem('aitomat-demo-session') || '';
    if (!sessionId) {
      sessionId = crypto.randomUUID
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('aitomat-demo-session', sessionId);
    }
  } catch (err) {
    sessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function hora() {
    return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  function burbuja(kind, texto) {
    chat.appendChild(makeWaBubble(kind, texto, hora()));
    chat.scrollTop = chat.scrollHeight;
  }
  function chip(titulo, detalle, enlace) {
    const el = document.createElement('div');
    // Con enlace (CTA), el modificador pone el link en su propia linea DENTRO
    // del recuadro; los chips del guion (sin enlace) no cambian.
    el.className = enlace ? 'wa-system wa-system-cta' : 'wa-system';
    const b = document.createElement('b');
    b.textContent = titulo;
    el.appendChild(b);
    const s = document.createElement('span');
    if (enlace) {
      const a = document.createElement('a');
      a.href = enlace.href;
      a.textContent = enlace.texto;
      s.appendChild(a);
    } else {
      s.textContent = detalle;
    }
    el.appendChild(s);
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  let typingEl = null;
  function mostrarTyping() {
    quitarTyping();
    typingEl = document.createElement('div');
    typingEl.className = 'bubble ai typing';
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    chat.appendChild(typingEl);
    chat.scrollTop = chat.scrollHeight;
  }
  function quitarTyping() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  // Primer foco o envío: se corta la animación guionizada, desaparecen las
  // tarjetas de alrededor (modo foco) y empieza la conversación real.
  function activarDemo() {
    if (demoLive) return;
    demoLive = true;
    if (pill) pill.hidden = true;
    chat.classList.remove('con-cta'); // el chat real usa todo el alto
    const seccion = document.getElementById('flujo');
    if (seccion) seccion.classList.add('demo-live');
    if (chat._bubbleTimers) {
      chat._bubbleTimers.forEach((t) => clearTimeout(t));
      chat._bubbleTimers = [];
    }
    chat.innerHTML = '';
    chat.setAttribute('aria-live', 'polite');
    if (status) status.textContent = 'en línea · demo real';
    chip('Demo real', 'Te responde la IA de la recepción. Escribe como paciente.');
    chip('Entorno de pruebas', 'No escriba datos personales reales.');
    burbuja('ai', 'Hola, le atiende el asistente de la clínica. ¿En qué puedo ayudarle?');
  }
  input.addEventListener('focus', activarDemo);

  // Pill "Escribir yo al asistente": lo enseña startChat cuando el móvil entra
  // en pantalla y el backend está disponible; el guion sigue de fondo.
  if (pill) {
    demoMostrarCTA = function () {
      if (demoLive) return;
      pill.hidden = false;
      chat.classList.add('con-cta'); // hueco para que el pill no tape la burbuja
    };
    pill.addEventListener('click', () => {
      activarDemo();
      input.focus();
    });
  }

  function nuevaSesionId() {
    const id = crypto.randomUUID
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try { sessionStorage.setItem('aitomat-demo-session', id); } catch (err) { /* privado */ }
    return id;
  }

  // Reinicia la demo con una sesión nueva (tras cerrar por cita reservada o al
  // agotar la 1.ª: nueva sesión, chat limpio, entrada reactivada).
  function reiniciarDemo() {
    sessionId = nuevaSesionId();
    esperando = false;
    chat.innerHTML = '';
    input.disabled = false;
    boton.disabled = false;
    input.placeholder = 'Escribe como paciente…';
    chip('Demo real', 'Empieza de nuevo: escribe como paciente.');
    chip('Entorno de pruebas', 'No escriba datos personales reales.');
    burbuja('ai', 'Hola, le atiende el asistente de la clínica. ¿En qué puedo ayudarle?');
    if (status) status.textContent = 'en línea · demo real';
    if (!matchMedia('(hover: none)').matches) input.focus();
  }

  function terminarDemo(reinicio) {
    input.disabled = true;
    boton.disabled = true;
    input.placeholder = 'Demo completada';
    chip('Fin de la demo', '', { href: '#contacto', texto: 'Pide una demo completa para tu clínica →' });
    if (!reinicio) return;
    // Le queda un intento a esta IP: enlace de reinicio en el mismo chip
    // (hereda el estilo .wa-system-cta span: su propia línea, alineado).
    const chipEl = chat.lastElementChild;
    const s = document.createElement('span');
    const a = document.createElement('a');
    a.href = '#';
    a.id = 'demo-reiniciar';
    a.textContent = 'Probar la demo otra vez ↺';
    a.addEventListener('click', (e) => { e.preventDefault(); reiniciarDemo(); });
    s.appendChild(a);
    chipEl.appendChild(s);
    chat.scrollTop = chat.scrollHeight;
  }

  // Cierre con éxito: la cita quedó reservada y el asistente se despidió.
  // Bloquea la entrada (no más «asdad») y muestra el chip aqua de éxito con la
  // opción de empezar de nuevo sin recargar.
  function cerrarConExito() {
    esperando = true;
    input.disabled = true;
    boton.disabled = true;
    input.placeholder = 'Conversación finalizada';
    if (status) status.textContent = 'cita reservada · finalizada';
    const el = document.createElement('div');
    el.className = 'wa-system done';
    const b = document.createElement('b');
    b.textContent = 'Cita reservada'; // el check lo dibuja .wa-system::before
    const s = document.createElement('span');
    s.textContent = 'Conversación finalizada.';
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'demo-restart';
    a.textContent = 'Empezar de nuevo ↺';
    a.addEventListener('click', (e) => { e.preventDefault(); reiniciarDemo(); });
    el.appendChild(b);
    el.appendChild(s);
    el.appendChild(a);
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  let esperando = false;

  function finalizarEnvio() {
    esperando = false;
    if (!input.disabled) {
      boton.disabled = false;
      if (!matchMedia('(hover: none)').matches) input.focus();
    }
    if (status && !input.disabled) status.textContent = 'en línea · demo real';
  }

  // Envía un turno al backend. En 429 NUNCA se descarta el mensaje del
  // usuario: primer 429 -> reintento silencioso a los 4 s (el typing sigue);
  // segundo 429 -> se devuelve el texto al input para reenviar con un clic.
  function mandar(texto, intento) {
    fetch(conClave(`${API_BASE}/demo/chat`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, mensaje: texto }),
    })
      .then((res) => {
        if (res.status === 429) {
          if (intento === 0) {
            setTimeout(() => mandar(texto, 1), 4000);
            return null;
          }
          quitarTyping();
          input.value = texto;
          burbuja('ai', 'Un segundo, que estoy atendiendo a varias personas. Vuelva a enviarlo, por favor.');
          finalizarEnvio();
          return null;
        }
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        if (!data) return; // 429 ya gestionado
        quitarTyping();
        burbuja('ai', data.respuesta || 'Disculpe, ¿puede repetírmelo?');
        if (data.ok === false && data.motivo === 'limite') terminarDemo(data.reinicio !== false);
        else if (data.fin) { cerrarConExito(); return; } // cita reservada: cerrar
        finalizarEnvio();
      })
      .catch(() => {
        quitarTyping();
        burbuja('ai', 'Ahora mismo no puedo responder. Pruebe de nuevo en un momento.');
        finalizarEnvio();
      });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const texto = input.value.trim();
    if (!texto || esperando || input.disabled) return;
    activarDemo();
    input.value = '';
    burbuja('patient', texto);
    esperando = true;
    boton.disabled = true;
    mostrarTyping();
    if (status) status.textContent = 'escribiendo...';
    mandar(texto, 0);
  });

  // Ping al backend: solo si contesta que está disponible se enseña la barra.
  // La promesa se comparte con startChat (selector ver/probar del móvil).
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 2500);
  demoEstadoPromise = fetch(`${API_BASE}/demo/estado`, { signal: ctrl.signal })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      clearTimeout(timeout);
      if (!data || !data.disponible) return false;
      form.hidden = false;
      if (fakeBar) fakeBar.hidden = true;
      return true;
    })
    .catch(() => { clearTimeout(timeout); return false; });
})();

// ── Llamada de voz REAL desde la web (Vapi) ───────────────────────────────────
// Mismo patrón que el chat: si el backend devuelve config (/demo/voz-config,
// solo cuando VAPI_PUBLIC_KEY y VAPI_WEB_ASSISTANT_ID existen), aparece el
// botón "Probar una llamada". El SDK de Vapi se carga bajo demanda al pulsar
// (import dinámico desde CDN: cero peso si nadie llama). La transcripción real
// sustituye al guion, que queda parado (vozLive).
(function initVoiceCall() {
  const cta = document.getElementById('voice-cta');
  const btn = document.getElementById('voice-call-btn');
  const chatEl = document.getElementById('voice-chat');
  const statusEl = document.getElementById('voice-status');
  const topicEl = document.getElementById('voice-topic');
  if (!cta || !btn || !chatEl) return;

  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

  fetch(conClave(`${DEMO_API_BASE}/demo/voz-config`))
    .then((res) => (res.ok ? res.json() : null))
    .then((cfg) => {
      if (!cfg || !cfg.disponible) {
        console.log('[voz] demo de voz no disponible (sin claves en el backend)');
        return;
      }
      console.log('[voz] demo de voz disponible; las claves se piden por llamada');
      // V2: el guion sigue corriendo de fondo; solo aparece el CTA flotante.
      // con-cta reserva hueco abajo para que el botón no tape la última burbuja.
      cta.hidden = false;
      chatEl.classList.add('con-cta');
      // El aviso de entorno de pruebas de la voz es la nota persistente bajo el
      // CTA (.voice-note en el HTML): no se pinta en el transcript porque el
      // guion lo borraría al repintar.

      let vapi = null;
      let publicKeyActual = null; // la key llega por-llamada desde /demo/voz-start
      let enLlamada = false;
      let ocupado = false;
      let reservaVoz = false; // se reservó una cita en esta llamada (señal de fin)

      // Badge aqua de éxito en el transcript de voz (hermano del chip del móvil),
      // con enlace «Empezar de nuevo» para lanzar otra llamada desde cero.
      function badgeReservada() {
        const el = document.createElement('div');
        el.className = 'call-done';
        el.innerHTML = '<b>Cita reservada ✓</b><span>Conversación finalizada.</span>';
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'voice-restart';
        a.textContent = 'Empezar de nuevo ↺';
        a.addEventListener('click', (e) => { e.preventDefault(); reiniciarVoz(); });
        el.appendChild(a);
        chatEl.appendChild(el);
        chatEl.scrollTop = chatEl.scrollHeight;
      }

      // Deja la sección lista para una llamada nueva sin recargar (hermano de
      // reiniciarDemo del chat móvil): limpia el transcript, botón en estado
      // inicial y reanuda el guion de ambiente (estado idle de la sección).
      function reiniciarVoz() {
        chatEl.innerHTML = '';
        burbujaAbierta = null;
        reservaVoz = false;
        if (topicEl) topicEl.textContent = 'Llamadas en vivo';
        setBoton('Hablar con el asistente', 'llamada real · máx. 2 min 15 s', false);
        setStatus('demo real · pulsa para hablar');
        if (vozArrancarGuion) vozArrancarGuion();
      }

      // Título/subtítulo del botón flotante (Hablar ↔ Colgar).
      const btnTitle = document.getElementById('voice-btn-title');
      const btnSub = document.getElementById('voice-btn-sub');
      function setBoton(titulo, sub, colgando) {
        if (btnTitle) btnTitle.textContent = titulo;
        if (btnSub) btnSub.textContent = sub;
        btn.classList.toggle('colgando', !!colgando);
      }

      // Transcript de la llamada REAL: mismas burbujas que el guion (variante
      // .live). Los transcripts finales llegan TROCEADOS por el transcriptor
      // («…en que puede» / «ayudarle?»): se fusionan en la burbuja abierta y
      // solo se abre burbuja nueva al cambiar de rol.
      let burbujaAbierta = null; // {rol, body}
      function lineaLlamada(rol, texto) {
        if (burbujaAbierta && burbujaAbierta.rol === rol) {
          burbujaAbierta.body.textContent += ' ' + texto;
          chatEl.scrollTop = chatEl.scrollHeight;
          return;
        }
        const b = document.createElement('div');
        b.className = `bubble ${rol === 'paciente' ? 'patient' : 'ai'} live`;
        const body = document.createElement('span');
        body.className = 'b-text';
        body.textContent = texto;
        b.appendChild(body);
        chatEl.appendChild(b);
        chatEl.scrollTop = chatEl.scrollHeight;
        burbujaAbierta = { rol, body };
      }

      // Diagnóstico de audio al conectar: fuerza la reproducción de los
      // <audio> del SDK si el navegador los dejó en pausa, y loguea el estado
      // y el micrófono por defecto. Todo con prefijo [voz][audio].
      function diagnosticarAudio() {
        setTimeout(() => {
          const audios = Array.from(document.querySelectorAll('audio'));
          console.log('[voz][audio] elementos <audio> del SDK:', audios.length);
          audios.forEach((el, i) => {
            console.log(`[voz][audio] #${i} paused=${el.paused} readyState=${el.readyState} srcObject=${!!el.srcObject} muted=${el.muted} volume=${el.volume} sinkId='${el.sinkId || ''}'`);
            // Salida FORZADA: desmutear, volumen al máximo y salida por
            // defecto del sistema. Era el eslabón sin loguear ni asegurar.
            el.muted = false;
            el.volume = 1;
            if (typeof el.setSinkId === 'function') {
              el.setSinkId('').then(
                () => console.log(`[voz][audio] #${i} setSinkId('') OK (salida por defecto)`),
                (err) => console.error(`[voz][audio] #${i} setSinkId falló:`, err && err.name),
              );
            }
            if (el.paused) {
              el.play().then(
                () => console.log(`[voz][audio] #${i} play() OK (estaba pausado)`),
                (err) => console.error(`[voz][audio] #${i} play() rechazado:`, err && err.name),
              );
            }
          });
        }, 800);
        // Segundo cinturón vía Daily: salida al dispositivo por defecto.
        esperarDaily().then((daily) => {
          if (!daily || typeof daily.setOutputDeviceAsync !== 'function') return;
          daily.setOutputDeviceAsync({ outputDeviceId: 'default' }).then(
            () => console.log('[voz][audio] Daily setOutputDeviceAsync(default) OK'),
            (err) => console.error('[voz][audio] Daily setOutputDeviceAsync falló:', err),
          );
        });
        navigator.mediaDevices.enumerateDevices().then((devs) => {
          const mics = devs.filter((d) => d.kind === 'audioinput');
          console.log('[voz][audio] micrófonos detectados:', mics.length);
          mics.slice(0, 3).forEach((m) => console.log(
            '[voz][audio] mic:', m.label || '(sin label)', (m.deviceId || '').slice(0, 8) + '…'));
        }).catch((e) => console.error('[voz][audio] enumerateDevices falló:', e));
      }

        // El objeto Daily interno tarda ~100-300 ms en existir tras start().
      function esperarDaily(intentos = 10) {
        return new Promise((resolver) => {
          const tick = (n) => {
            const daily = vapi && typeof vapi.getDailyCallObject === 'function'
              ? vapi.getDailyCallObject() : null;
            if (daily || n <= 0) return resolver(daily);
            setTimeout(() => tick(n - 1), 250);
          };
          tick(intentos);
        });
      }

      // ── Selector de micrófono (persistido en localStorage) ────────────────
      const micSelect = document.getElementById('voice-mic');
      const micLabel = document.getElementById('voice-mic-label');
      const MIC_KEY = 'aitomat-voz-mic';

      function aplicarMicro(deviceId, etiqueta) {
        esperarDaily().then((daily) => {
          if (!daily || typeof daily.setInputDevicesAsync !== 'function') {
            console.log('[voz][audio] Daily no disponible: micro no forzado (se usa el default)');
            return;
          }
          daily.setInputDevicesAsync({ audioDeviceId: deviceId }).then(
            () => {
              console.log('[voz][audio] micro aplicado:', etiqueta || deviceId);
              logMicroReal(daily);
            },
            (err) => console.error('[voz][audio] no se pudo aplicar el micro:', err),
          );
        });
      }

      // Micro REALMENTE en uso según Daily (para cazar «captura la webcam»).
      function logMicroReal(daily) {
        if (!daily || typeof daily.getInputDevices !== 'function') return;
        daily.getInputDevices().then((d) => {
          const mic = d && d.mic;
          console.log('[voz][audio] micro EN USO:', (mic && mic.label) || '(desconocido)');
        }).catch(() => {});
      }

      function preferenciaGuardada(mics) {
        // Guardada como {id, label}: el id puede rotar (Chrome los regenera
        // al limpiar datos), la etiqueta es estable -> fallback por label.
        let guardado = null;
        try { guardado = JSON.parse(localStorage.getItem(MIC_KEY) || 'null'); } catch (e) { /* nada */ }
        if (!guardado) return null;
        if (!mics) return guardado.id ? { deviceId: guardado.id, label: guardado.label } : null;
        return mics.find((m) => m.deviceId === guardado.id)
          || mics.find((m) => m.label === guardado.label) || null;
      }

      // Al conectar: el micro preferido se fuerza YA (sin esperar a enumerar
      // dispositivos) — antes se aplicaba ~1 s tarde y el primer turno del
      // paciente entraba por el micro por defecto.
      function aplicarPreferenciaYa() {
        const pref = preferenciaGuardada(null);
        if (pref) aplicarMicro(pref.deviceId, pref.label);
        else esperarDaily().then((daily) => logMicroReal(daily));
      }

      function poblarMicros() {
        if (!micSelect) return;
        navigator.mediaDevices.enumerateDevices().then((devs) => {
          const mics = devs.filter((d) => d.kind === 'audioinput' && d.deviceId);
          if (!mics.length) return;
          const preferido = preferenciaGuardada(mics);
          micSelect.innerHTML = '';
          mics.forEach((m) => {
            const opt = document.createElement('option');
            opt.value = m.deviceId;
            opt.textContent = m.label || `Micrófono ${micSelect.length + 1}`;
            if (preferido && m.deviceId === preferido.deviceId) opt.selected = true;
            micSelect.appendChild(opt);
          });
          if (micLabel) micLabel.hidden = false;
        }).catch((e) => console.error('[voz][audio] enumerateDevices (select):', e));
      }

      if (micSelect) {
        micSelect.addEventListener('change', () => {
          const opcion = micSelect.options[micSelect.selectedIndex];
          try {
            localStorage.setItem(MIC_KEY, JSON.stringify({
              id: micSelect.value,
              label: opcion ? opcion.textContent : '',
            }));
          } catch (e) { /* privado */ }
          if (enLlamada) aplicarMicro(micSelect.value, opcion && opcion.textContent);
          else console.log('[voz][audio] micro preferido guardado:', opcion && opcion.textContent);
        });
      }

      // El build +esm de jsdelivr entrega la clase ANIDADA (interop CJS rota:
      // mod.default es un objeto). Probamos esm.sh primero y resolvemos el
      // constructor por la cadena de posibles ubicaciones.
      async function cargarSDK() {
        // Versión FIJADA (2.5.2). Nota: el warning "daily-js 0.85.0 nearing
        // end of support" viene de la dependencia que fija el propio Vapi
        // (^0.85.0 incluso en su última versión); es inofensivo y desaparecerá
        // cuando Vapi actualice su SDK.
        const fuentes = [
          'https://esm.sh/@vapi-ai/web@2.5.2',
          'https://cdn.jsdelivr.net/npm/@vapi-ai/web@2.5.2/+esm',
        ];
        let ultimoError = null;
        for (const url of fuentes) {
          try {
            console.log('[voz] cargando SDK desde', url);
            const mod = await import(url);
            const Vapi = (mod.default && mod.default.default) || mod.default || mod.Vapi || mod;
            if (typeof Vapi !== 'function') {
              throw new Error('SDK sin constructor (default=' + typeof mod.default + ')');
            }
            console.log('[voz] SDK cargado, constructor:', Vapi.name || '(anonimo)');
            return Vapi;
          } catch (err) {
            console.error('[voz] fallo cargando SDK de', url, err);
            ultimoError = err;
          }
        }
        throw ultimoError || new Error('SDK de Vapi no disponible');
      }

      async function conectar(publicKey) {
        if (vapi) return vapi;
        const Vapi = await cargarSDK();
        vapi = new Vapi(publicKey);

        vapi.on('call-start', () => {
          console.log('[voz] call-start: llamada conectada');
          aplicarPreferenciaYa(); // el micro bueno ANTES del primer turno
          diagnosticarAudio();
          poblarMicros();
          enLlamada = true;
          ocupado = false;
          btn.disabled = false;
          setBoton('Colgar', 'en llamada · pulsa para terminar', true);
          vozLive = true;
          reservaVoz = false; // nueva llamada: empieza sin reserva
          if (vozPararGuion) vozPararGuion();
          chatEl.innerHTML = '';
          burbujaAbierta = null;
          if (topicEl) topicEl.textContent = 'Llamada real';
          setStatus('en llamada — hable con el asistente');
        });
        // reanudarGuion=false: se deja el estado fijo (p. ej. cita reservada) en
        // lugar de volver al guion de ambiente.
        function reposo(mensaje, reanudarGuion = true) {
          enLlamada = false;
          ocupado = false;
          btn.disabled = false;
          burbujaAbierta = null;
          setBoton('Hablar con el asistente', 'llamada real · máx. 2 min 15 s', false);
          setStatus(mensaje);
          vozLive = false;
          if (reanudarGuion) {
            setTimeout(() => { if (!enLlamada && vozArrancarGuion) vozArrancarGuion(); }, 2600);
          }
        }
        vapi.on('call-end', () => {
          console.log('[voz] call-end');
          if (reservaVoz) {
            // Cerró con cita: badge de éxito y el estado se queda fijo (no vuelve
            // el guion). Una nueva llamada limpia el transcript = «empezar de nuevo».
            badgeReservada();
            reposo('cita reservada · conversación finalizada', false);
          } else {
            reposo('llamada finalizada — puede volver a llamar');
          }
        });
        vapi.on('error', (err) => {
          console.error('[voz] error real del SDK:', err);
          reposo('no se pudo conectar la llamada');
        });
        vapi.on('message', (m) => {
          if (!m) return;
          if (m.type === 'transcript' && m.transcriptType === 'final' && m.transcript) {
            lineaLlamada(m.role === 'user' ? 'paciente' : 'asistente', m.transcript);
            return;
          }
          // Señal de fin: se llamó a reservar_cita durante la llamada. El default
          // clientMessages de Vapi ya incluye tool-calls; miramos varios formatos.
          const calls = m.toolCalls || m.toolCallList
            || (m.functionCall ? [m.functionCall] : null);
          if (calls && calls.some((c) => ((c.function && c.function.name) || c.name) === 'reservar_cita')) {
            reservaVoz = true;
            console.log('[voz] reservar_cita detectada -> fin de conversación al colgar');
          }
        });
        // Nivel de audio del asistente, 1 log/seg: >0 = el audio remoto llega
        // y se decodifica (si aun así no suena, es el altavoz del sistema);
        // siempre 0 = la media WebRTC no llega (red/antivirus).
        let ultimoNivelLog = 0;
        vapi.on('volume-level', (nivel) => {
          const ahora = Date.now();
          if (ahora - ultimoNivelLog > 1000) {
            ultimoNivelLog = ahora;
            console.log('[voz][audio] nivel asistente:', Number(nivel || 0).toFixed(3));
          }
        });
        vapi.on('speech-start', () => console.log('[voz][audio] speech-start (asistente hablando)'));
        vapi.on('speech-end', () => console.log('[voz][audio] speech-end'));
        return vapi;
      }

      // Aviso amable cuando se agotan las llamadas por IP (con enlace al form).
      function avisoLimite(texto) {
        const el = document.createElement('div');
        el.className = 'call-note';
        const s = document.createElement('span');
        s.textContent = texto || 'Has alcanzado el límite de pruebas de voz del demo.';
        const a = document.createElement('a');
        a.href = '#contacto';
        a.textContent = 'Solicita una demo completa →';
        el.appendChild(s);
        el.appendChild(a);
        chatEl.appendChild(el);
        chatEl.scrollTop = chatEl.scrollHeight;
      }

      async function empezarLlamada() {
        if (ocupado || enLlamada) return;
        ocupado = true;
        btn.disabled = true;
        setBoton('Conectando…', 'un momento', false);
        setStatus('conectando…');
        // Gate por IP EN EL BACKEND: la key/assistant solo llegan si autoriza.
        let auth;
        try {
          auth = await fetch(conClave(`${DEMO_API_BASE}/demo/voz-start`), { method: 'POST' }).then((r) => r.json());
        } catch (err) {
          auth = null;
        }
        if (!auth || !auth.ok) {
          ocupado = false;
          btn.disabled = false;
          setBoton('Hablar con el asistente', 'llamada real · máx. 2 min 15 s', false);
          if (auth && auth.motivo === 'limite') {
            avisoLimite(auth.mensaje);
            setStatus('límite de pruebas alcanzado');
          } else {
            setStatus('la voz no está disponible ahora mismo');
          }
          return;
        }
        publicKeyActual = auth.publicKey;
        try {
          const v = await conectar(publicKeyActual);
          console.log('[voz] start llamado, assistant:', (auth.assistantId || '').slice(0, 8) + '…');
          // Override POR-LLAMADA (no toca el asistente desplegado en Vapi): quitamos
          // el ambiente de oficina porque, al sumarse con el primer golpe de voz a
          // nivel pleno, saturaba (nivel 1.000) y se oía como un trabón al arrancar
          // el saludo de Cristina. Probar en local antes de desplegar.
          const overrides = { backgroundSound: 'off' };
          await v.start(auth.assistantId, overrides);
          // el estado real lo fija el evento call-start
        } catch (err) {
          console.error('[voz] error real al iniciar:', err);
          ocupado = false;
          btn.disabled = false;
          setBoton('Hablar con el asistente', 'llamada real · máx. 2 min 15 s', false);
          // Solo culpar al micrófono si de verdad es getUserMedia; si no, el
          // mensaje genérico con la pista de mirar la consola.
          const esMicro = err && (err.name === 'NotAllowedError' || err.name === 'NotFoundError');
          setStatus(esMicro ? 'micrófono bloqueado: permita el acceso y reintente'
                            : 'no se pudo conectar la llamada (detalle en consola)');
        }
      }

      // Cebar el micro ANTES de conectar: en el pointerdown (se dispara antes
      // del click) pedimos el micro para que el permiso y el arranque del
      // dispositivo salgan de la ruta crítica de v.start(). Así conecta antes y
      // el micro ya está caliente cuando llega la primera frase del paciente.
      let micCebado = false;
      function cebarMicro() {
        if (micCebado || !navigator.mediaDevices) return;
        micCebado = true;
        const pref = preferenciaGuardada(null);
        const constraints = pref && pref.deviceId
          ? { audio: { deviceId: { ideal: pref.deviceId } } }
          : { audio: true };
        navigator.mediaDevices.getUserMedia(constraints).then(
          (stream) => {
            console.log('[voz][audio] micro cebado (permiso y arranque listos)');
            // Se suelta enseguida; Daily abrirá el suyo, pero el dispositivo ya
            // quedó inicializado y el permiso concedido (sin diálogo en el clic).
            setTimeout(() => stream.getTracks().forEach((t) => t.stop()), 250);
          },
          (err) => { micCebado = false; console.log('[voz][audio] cebado de micro pospuesto:', err && err.name); },
        );
      }
      btn.addEventListener('pointerdown', cebarMicro);

      btn.addEventListener('click', () => {
        if (enLlamada) { if (vapi) vapi.stop(); return; }
        empezarLlamada();
      });

      // Precarga INMEDIATA del módulo del SDK (~1 MB): al pulsar solo queda
      // autorizar (voz-start), construir Vapi con la key y conectar. No se
      // construye Vapi aquí porque la key llega por-llamada tras el gate.
      cargarSDK()
        .then(() => console.log('[voz] módulo del SDK precargado y listo'))
        .catch((err) => console.error('[voz] precarga del SDK falló (se reintentará al pulsar):', err));
    })
    .catch(() => {});
})();

/* Conmutador mensual / anual del bloque de precios. Sin dependencias: alterna
   una clase en el contenedor y el CSS decide que precio se ve. */
(function initCicloPrecio() {
  const grupo = document.querySelector('.ciclo');
  const shell = document.querySelector('.pricing-shell');
  if (!grupo || !shell) return;

  const botones = Array.from(grupo.querySelectorAll('[data-ciclo]'));

  function elegir(btn) {
    shell.classList.toggle('anual', btn.dataset.ciclo === 'anual');
    botones.forEach((b) => {
      const activo = b === btn;
      b.classList.toggle('active', activo);
      b.setAttribute('aria-pressed', activo ? 'true' : 'false');
    });
  }

  grupo.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-ciclo]');
    if (btn) elegir(btn);
  });
})();
