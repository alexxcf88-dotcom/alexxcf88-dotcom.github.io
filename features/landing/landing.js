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

function renderPhone(chatEl, statusEl, scenario) {
  if (!chatEl || !scenario) return;
  if (chatEl._bubbleTimers) {
    chatEl._bubbleTimers.forEach((timer) => clearTimeout(timer));
  }
  chatEl._bubbleTimers = [];
  chatEl.innerHTML = '';

  function makeBubble(kind, text, time) {
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

  function appendOutcome() {
    const chip = document.createElement('div');
    chip.className = 'wa-system';
    chip.innerHTML = `<b>${scenario.action}</b><span>${scenario.time}</span>`;
    chatEl.appendChild(chip);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  // Sin animacion: pinta todo de golpe.
  if (reduceMotion) {
    if (statusEl) statusEl.textContent = 'en l\u00ednea';
    scenario.bubbles.forEach(([kind, text, time]) => chatEl.appendChild(makeBubble(kind, text, time)));
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
    chatEl.appendChild(makeBubble(kind, text, time));
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
  chatEl._bubbleTimers.push(setTimeout(appendOutcome, elapsed));
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
    if (video) {
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
    whatsapp: {
      kicker: 'WhatsApp sin responder',
      title: 'Convierte mensajes en citas reales.',
      copy: 'Detecta motivo, urgencia y disponibilidad, y pregunta lo necesario antes de proponer el siguiente hueco.',
      lines: ['82%', '58%', '70%'],
      detected: 'Paciente pide limpieza fuera de horario',
      decision: 'Confirmar datos y buscar hueco real',
      next: 'Responder + preparar cita',
    },
    llamadas: {
      kicker: 'Llamadas perdidas',
      title: 'Recupera oportunidades aunque nadie coja el tel\u00e9fono.',
      copy: 'Cuando entra una llamada perdida, AItomat prepara respuesta, prioridad y seguimiento para que no quede en el aire.',
      lines: ['68%', '76%', '48%'],
      detected: 'Llamada perdida sin seguimiento',
      decision: 'Priorizar por horario y motivo probable',
      next: 'Enviar WhatsApp de recuperaci\u00f3n',
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
      copy: 'Detecta citas sin confirmar, manda recordatorios y escala los casos que necesitan una persona.',
      lines: ['62%', '80%', '42%'],
      detected: 'Cita sin confirmar',
      decision: 'Medir riesgo y activar recordatorio',
      next: 'Confirmar o preparar cambio',
    },
    reactivacion: {
      kicker: 'Pacientes dormidos',
      title: 'Vuelve a llenar agenda sin perseguir a mano.',
      copy: 'Segmenta revisiones pendientes, tratamientos a medias y pacientes con probabilidad de volver.',
      lines: ['86%', '54%', '66%'],
      detected: 'Paciente 8 meses sin volver',
      decision: 'Preparar motivo y oferta de revisi\u00f3n',
      next: 'Enviar seguimiento contextual',
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

  function setStep(index) {
    if (index === active) return;
    active = index;
    steps.forEach((step, i) => {
      step.classList.toggle('active', i === index);
      step.classList.toggle('revealed', i <= index);
    });
    renderPhone(chat, status, phoneScenarios[index]);
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
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  setStep(0);

  if (reduceMotion) {
    steps.forEach((step) => step.classList.add('revealed'));
  } else {
    if (notes) notes.classList.add('story-reveal');
    // Solo animamos cuando la seccion esta a la vista.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? start() : stop()));
      }, { threshold: 0 });
      io.observe(section);
    } else {
      start();
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
    whatsapp: {
      caption: 'Pregunta, cualifica y prepara los WhatsApp que nadie contesta.',
      message: 'Hola, \u00bften\u00e9is hueco para una limpieza? Mejor por la tarde.',
      decision: 'Detecta intenci\u00f3n de cita y pregunta si es primera visita, motivo y preferencia horaria.',
      action: 'Ofrece dos huecos reales y deja la cita preparada cuando el paciente elige.',
      done: 14, human: 3, metric: 'Confianza de la respuesta', value: 92,
      note: 'Sin esperar a que recepci\u00f3n abra.',
    },
    llamadas: {
      caption: 'Recupera llamadas perdidas sin fingir que no es IA.',
      message: 'Llamada perdida de +34 6XX XXX 210 a las 14:10. Sin mensaje.',
      decision: 'Identifica n\u00famero recurrente y pregunta el motivo antes de proponer el siguiente paso.',
      action: 'Env\u00eda WhatsApp de recuperaci\u00f3n y deriva a recepci\u00f3n si el caso necesita una persona.',
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
    const data = cases[key] || cases.whatsapp;
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

(function initWhatsAppFloat() {
  const link = document.getElementById('whatsapp-float');
  if (!link) return;

  link.addEventListener('click', (event) => {
    const rawPhone = String(link.dataset.phone || '').replace(/[^\d]/g, '');
    const message = link.dataset.message || 'Hola, quiero una demo de AItomat para mi clínica dental.';
    if (rawPhone.length >= 8) {
      event.preventDefault();
      window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      return;
    }

    const form = document.getElementById('lead-form');
    const field = document.getElementById('lead-whatsapp');
    const status = form ? form.querySelector('.lead-status') : null;
    if (status) {
      status.textContent = 'Deja tu WhatsApp y te escribimos para activar la demo.';
      status.className = 'lead-status ok';
    }
    window.setTimeout(() => {
      if (field) field.focus({ preventScroll: true });
    }, 620);
  });
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
    Urgencia: '#ff8066',
    Cita: '#5af0d8',
    Cambio: '#f1b64b',
    Reactivar: '#3978ff',
    Info: '#a4f4fd',
  };

  const messages = [
    {
      from: 'Carlos Martín', avatar: 'C', time: '8:12', label: 'Urgencia', unread: true,
      subject: 'Dolor de muela desde anoche',
      preview: 'Dolor fuerte, pide cita para hoy.',
      meta: 'WhatsApp \u00b7 8:12 \u00b7 prioridad alta',
      summary: 'Dolor agudo. AItomat pregunta por síntomas, marca prioridad alta y prepara el caso para recepción.',
      body: ['Llevo desde anoche con un dolor de muela fuerte, casi no he dormido.', '\u00bfTen\u00e9is alg\u00fan hueco para hoy? Es bastante urgente.'],
      draft: 'Lo siento, Carlos. Para ayudarte bien: \u00bfhay inflamaci\u00f3n, fiebre o dolor al morder? Aviso a recepci\u00f3n para que te llamen cuanto antes.',
      cta: 'Pasar a recepci\u00f3n',
    },
    {
      from: 'Laura Pérez', avatar: 'L', time: '9:41', label: 'Cita', unread: true,
      subject: 'Limpieza esta semana',
      preview: 'Prefiere por la tarde, tel\u00e9fono confirmado.',
      meta: 'WhatsApp \u00b7 9:41',
      summary: 'Paciente interesada en limpieza. AItomat confirma motivo, datos y preferencia antes de proponer huecos.',
      body: ['Hola, necesito una limpieza esta semana.', 'Si puede ser por la tarde, mejor. Gracias.'],
      draft: 'Hola Laura, perfecto. \u00bfSer\u00eda una limpieza normal y sigues usando este tel\u00e9fono? Si es as\u00ed, te paso dos huecos de tarde.',
      cta: 'Preguntar y preparar cita',
    },
    {
      from: 'Familia Soler', avatar: 'S', time: '9:08', label: 'Cita', unread: true,
      subject: 'Primera visita para mi hijo',
      preview: 'Ni\u00f1o de 7 a\u00f1os, revisi\u00f3n general.',
      meta: 'WhatsApp \u00b7 9:08',
      summary: 'Primera visita infantil. AItomat pide datos b\u00e1sicos y ofrece pasar el caso a odontopediatr\u00eda.',
      body: ['Buenos d\u00edas, quer\u00eda pedir cita para mi hijo de 7 a\u00f1os.', 'Es la primera vez que viene a la cl\u00ednica.'],
      draft: 'Encantados de recibirle. Para orientarle bien: \u00bfla visita es revisi\u00f3n general o hay alguna molestia? Despu\u00e9s le paso opciones con odontopediatr\u00eda.',
      cta: 'Pedir datos',
    },
    {
      from: 'Marta Ruiz', avatar: 'M', time: 'Ayer', label: 'Cambio', unread: false,
      subject: 'Mover la cita del jueves',
      preview: 'No puede asistir, pide el viernes.',
      meta: 'WhatsApp \u00b7 ayer 19:02',
      summary: 'La paciente pide cambio. AItomat pregunta disponibilidad y deja el nuevo hueco preparado para confirmar.',
      body: ['No voy a poder ir el jueves al final.', '\u00bfMe lo pod\u00e9is cambiar al viernes?'],
      draft: 'Sin problema, Marta. El viernes veo disponibilidad a las 12:00. \u00bfTe encaja ese horario para dejar el cambio preparado?',
      cta: 'Preparar cambio',
    },
    {
      from: 'Javier Gómez', avatar: 'J', time: 'Ayer', label: 'Info', unread: false,
      subject: 'Dudas con el presupuesto de ortodoncia',
      preview: 'Pregunta por financiaci\u00f3n y plazos.',
      meta: 'WhatsApp \u00b7 ayer 17:40',
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

  // En producción la web es estática (GitHub Pages), no hay backend: los leads
  // se envían a Formspree (form real configurado en la cuenta del proyecto).
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xeebjdkq';

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
    // Producción (dominio / GitHub Pages): sin backend → Formspree.
    return FORMSPREE_ENDPOINT;
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
      web: honeypot,                 // honeypot para el backend local (FastAPI)
      _gotcha: honeypot,             // honeypot que Formspree reconoce (descarta bots)
      _subject: 'Nuevo lead AItomat',// asunto del email que envía Formspree
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
      s.src = 'https://unpkg.com/@splinetool/viewer@1/build/spline-viewer.js';
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
      viewer.setAttribute('loading-anim-type', 'none');

      // Borra el "Built with Spline". Selector amplio (id, clase, href o texto)
      // porque la versión del viewer puede variar el nodo.
      function stripWatermark() {
        try {
          const root = viewer.shadowRoot;
          if (!root) return false;
          let removed = false;
          root.querySelectorAll('a, [id*="logo" i], [class*="logo" i]').forEach((el) => {
            const href = (el.getAttribute && el.getAttribute('href')) || '';
            const txt = (el.textContent || '').toLowerCase();
            if (el.id === 'logo' || /spline/i.test(href) || txt.includes('spline') || txt.includes('built with')) {
              el.remove();
              removed = true;
            }
          });
          return removed;
        } catch (e) { /* shadow DOM no accesible: se ignora */ }
        return false;
      }

      viewer.addEventListener('load', () => fig.classList.add('is-live'));
      fig.appendChild(viewer);

      // Polling INDEPENDIENTE del evento load (a veces no dispara), + observer
      // para volver a quitarla si la reinyecta tras renderizar.
      let ticks = 0;
      let observer = null;
      const iv = window.setInterval(() => {
        stripWatermark();
        if (!observer && viewer.shadowRoot) {
          try {
            observer = new MutationObserver(stripWatermark);
            observer.observe(viewer.shadowRoot, { childList: true, subtree: true });
          } catch (e) { /* sin shadow root accesible */ }
        }
        ticks += 1;
        if (ticks > 75) {
          window.clearInterval(iv);
          if (observer) window.setTimeout(() => observer.disconnect(), 5000);
        }
      }, 200);
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

  // Precarga proactiva: en cuanto el navegador esté ocioso (o poco después de
  // cargar la página), descarga runtime + escena en segundo plano para que el
  // robot ya esté listo al llegar a la sección, en vez de cargar tarde.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => load(), { timeout: 3500 });
  } else {
    window.addEventListener('load', () => window.setTimeout(load, 2500));
  }
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
      topic: 'Urgencia',
      outcome: { action: 'Derivado a recepción', time: 'urgencia priorizada' },
      bubbles: [
        ['ai', 'Clínica dental, le atiende el asistente virtual. ¿En qué puedo ayudarle?'],
        ['patient', 'Me duele una muela desde anoche y se me ha hinchado un poco la cara.'],
        ['ai', 'Lo siento. Para avisar bien a recepción: ¿el dolor es constante? ¿Tiene fiebre o dificultad para abrir la boca?'],
        ['patient', 'Constante sí. Fiebre no, pero al morder me duele bastante.'],
        ['ai', 'Gracias. Lo marco como posible urgencia. Recepción le llamará cuanto antes para darle el primer hueco disponible hoy.'],
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
    if (running) return;
    running = true;
    token += 1;
    runLoop();
  }
  function stop() {
    running = false;
    token += 1;
    clearTimers();
  }

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
