/* Píxel de Meta con consentimiento (RGPD / LSSI).
   · Sin ID (PIXEL_ID vacío) no hace NADA: ni aviso ni píxel.
   · Con ID: aviso de cookies abajo; el píxel solo se carga si la persona
     acepta. La elección se guarda 180 días en este navegador.
   · window.ditboPixel('Lead') y window.ditboPixel('DemoVoz', {...}) envían
     eventos solo si hay consentimiento; si no, no hacen nada.
   · Cualquier enlace con [data-cookies] vuelve a abrir el aviso. */
(function () {
  'use strict';
  var PIXEL_ID = ''; // ← el ID del píxel de Meta (Administrador de eventos → Orígenes de datos)
  var CLAVE = 'ditbo-consentimiento';
  var DIAS = 180;
  var ESTANDAR = { Lead: 1, Contact: 1, Schedule: 1, ViewContent: 1, CompleteRegistration: 1 };

  window.ditboPixel = function () {};
  if (!/^\d{10,20}$/.test(PIXEL_ID)) return;

  var leer = function () {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (v && v.t && Date.now() - v.t < DIAS * 864e5) return v.si ? 'si' : 'no';
    } catch (e) {}
    return null;
  };
  var guardar = function (si) { try { localStorage.setItem(CLAVE, JSON.stringify({ si: !!si, t: Date.now() })); } catch (e) {} };

  var cargado = false;
  var cargarPixel = function () {
    if (cargado) return;
    cargado = true;
    /* Código base oficial de Meta */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  };
  window.ditboPixel = function (evento, datos) {
    if (leer() !== 'si' || !window.fbq) return;
    window.fbq(ESTANDAR[evento] ? 'track' : 'trackCustom', evento, datos || {});
  };

  /* ── Aviso ── */
  var aviso = null;
  var cerrar = function () { if (aviso) { aviso.remove(); aviso = null; } };
  var mostrar = function () {
    if (aviso) return;
    var css = document.createElement('style');
    css.textContent = '.dc-aviso{position:fixed;z-index:2147483000;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;padding:16px 18px;border-radius:18px;background:rgba(6,10,12,.96);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 60px -20px rgba(0,0,0,.7);color:#dbe6ec;font:14px/1.5 Inter,system-ui,sans-serif;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}'
      + '.dc-aviso p{margin:0 0 12px}.dc-aviso a{color:#5af0d8}.dc-aviso b{color:#f7fbf8}'
      + '.dc-bot{display:flex;flex-wrap:wrap;gap:8px}.dc-bot button{flex:1 1 140px;min-height:42px;border-radius:999px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;border:1px solid rgba(255,255,255,.22);background:transparent;color:#f7fbf8}'
      + '.dc-bot .dc-si{background:#5af0d8;border-color:#5af0d8;color:#04110f}.dc-bot button:focus-visible{outline:2px solid #5af0d8;outline-offset:2px}';
    document.head.appendChild(css);
    aviso = document.createElement('div');
    aviso.className = 'dc-aviso';
    aviso.setAttribute('role', 'dialog');
    aviso.setAttribute('aria-label', 'Aviso de cookies');
    aviso.setAttribute('data-nosnippet', '');
    aviso.innerHTML = '<p><b>¿Nos dejas medir nuestros anuncios?</b> Con tu permiso usamos el píxel de Meta (Facebook e Instagram) para saber si nuestros anuncios funcionan. Si no aceptas, la web funciona igual. <a href="/legal/cookies.html">Más información</a></p>'
      + '<div class="dc-bot"><button type="button" class="dc-no">Rechazar</button><button type="button" class="dc-si">Aceptar</button></div>';
    aviso.querySelector('.dc-si').addEventListener('click', function () { guardar(true); cerrar(); cargarPixel(); });
    aviso.querySelector('.dc-no').addEventListener('click', function () {
      var antes = leer() === 'si';
      guardar(false); cerrar();
      if (antes) location.reload(); // retirar el permiso: se recarga sin el píxel
    });
    document.body.appendChild(aviso);
  };

  var iniciar = function () {
    var e = leer();
    if (e === 'si') cargarPixel();
    else if (e === null) {
      // Tras la pantalla de carga de la portada, para no taparla.
      var raiz = document.documentElement;
      if (raiz.classList.contains('preloader-active')) window.addEventListener('ditbo:ready', function () { setTimeout(mostrar, 1200); }, { once: true });
      else setTimeout(mostrar, 600);
    }
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('[data-cookies]');
      if (a) { ev.preventDefault(); mostrar(); }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
