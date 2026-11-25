/* Cristina en la portada: cuerpo real (la foto) + cabeza de televisor en 3D.
   · El cuerpo, el cuello y el traje son la foto (sin el televisor ni los
     cables que colgaban sobre la pared): todo su realismo. Respira y se
     balancea con el resto de la figura (lo hace hero.js sobre #ix-fig).
   · El televisor es una caja 3D hecha a medida: frontal con la textura de la
     propia foto, laterales y techo con las vistas reales del mismo televisor.
     Gira un poco hacia el puntero desde la base del cuello.
   · Los cables son tubos 3D que salen de los conectores del televisor y
     acaban en las correas de los hombros (en la foto); se recalculan en cada
     fotograma, así siempre están conectados.
   · La pantalla lleva los ojos de ditbo («i» y «o» del logo).
   Coordenadas: 1 unidad = 1 píxel de la foto (1671×941); y hacia arriba. */
import * as THREE from './vendor/three.module.min.js';

const FW = 1671, FH = 941;
const P = (x, y, z = 0) => new THREE.Vector3(x, -y, z);   // píxel de la foto → mundo
// Televisor en la foto (recorte del frontal) y su fondo (de las vistas laterales).
const TV = { x0: 926, x1: 1578, y0: 16, y1: 554, fondo: 473 };
const PANTALLA = { x0: 1019.3, x1: 1508.9, y0: 75.3, y1: 461.1 };
const PIVOTE = P(1252, 640, -170);        // base del cuello, bajo el televisor
const GIRO_Y = THREE.MathUtils.degToRad(13);
const GIRO_X = THREE.MathUtils.degToRad(6);
const RAD = 4.3;                           // grosor de los cables (px)

export async function montar({ hero, lienzo, alListo }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const escena = new THREE.Scene();
  // Cámara casi ortográfica centrada en la foto: el plano z=0 coincide con ella.
  const FOV = 8, DIST = (FH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const camara = new THREE.PerspectiveCamera(FOV, FW / FH, DIST * 0.5, DIST * 1.6);
  camara.position.set(FW / 2, -FH / 2, DIST);
  camara.lookAt(FW / 2, -FH / 2, 0);

  // Luz (solo para los cables): estudio suave desde arriba a la izquierda, como la foto.
  escena.add(new THREE.HemisphereLight(0xfff3ec, 0x51463f, 1.4));
  const clave = new THREE.DirectionalLight(0xffffff, 2.4); clave.position.set(-600, 900, 1400); escena.add(clave);
  const borde = new THREE.DirectionalLight(0xffffff, 0.9); borde.position.set(900, 300, -600); escena.add(borde);

  const cargar = (url) => new Promise((ok, mal) => new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, mal));
  const base = '/features/landing/media/hero/';
  const [tFrente, tIzq, tDer, tArriba] = await Promise.all(['cristina-cabeza.webp', 'cristina-lado-izq.webp', 'cristina-lado-der.webp', 'cristina-arriba.webp'].map((f) => cargar(base + f + '?v=1')));
  const plano = (mat, ancho, alto) => new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
  const mat = (tex, color = 0xffffff) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, color, side: THREE.DoubleSide, toneMapped: false });

  // Grupo de la cabeza, con el origen en el pivote del cuello.
  const cabeza = new THREE.Group();
  cabeza.position.copy(PIVOTE);
  escena.add(cabeza);
  const enCabeza = (o, v) => { o.position.copy(v).sub(PIVOTE); cabeza.add(o); return o; };
  const W = TV.x1 - TV.x0, H = TV.y1 - TV.y0, D = TV.fondo, cx = (TV.x0 + TV.x1) / 2, cyTV = (TV.y0 + TV.y1) / 2;

  // Interior y tapa trasera (para que no se vea a través al girar).
  const caja = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, H * 0.84, D * 0.92), new THREE.MeshBasicMaterial({ color: 0x5d5853, toneMapped: false }));
  enCabeza(caja, P(cx, cyTV, -D * 0.5));
  // Laterales: la vista de perfil del mismo televisor (con su forma recortada).
  const latIzq = enCabeza(plano(mat(tDer, 0xc9c2bb), D, H * 0.96), P(TV.x0 + 6, cyTV + 6, -D / 2)); latIzq.rotation.y = -Math.PI / 2;
  const latDer = enCabeza(plano(mat(tIzq, 0xbab3ac), D, H * 0.96), P(TV.x1 - 6, cyTV + 6, -D / 2)); latDer.rotation.y = Math.PI / 2;
  // Techo y suelo.
  const techo = enCabeza(plano(mat(tArriba, 0xcfc8c1), W * 0.98, D), P(cx, TV.y0 + 4, -D / 2)); techo.rotation.x = -Math.PI / 2;
  const suelo = enCabeza(plano(new THREE.MeshBasicMaterial({ color: 0x3c3935, side: THREE.DoubleSide, toneMapped: false }), W * 0.9, D * 0.9), P(cx, TV.y1 - 6, -D * 0.48)); suelo.rotation.x = Math.PI / 2;
  // Frontal: la foto.
  const matFrente = mat(tFrente);
  enCabeza(plano(matFrente, W, H), P(cx, cyTV, 0.5));


  // Pantalla encendida con la cara de ditbo.
  const lienzoCara = document.createElement('canvas');
  const CW = 640, CH = Math.round(640 * (PANTALLA.y1 - PANTALLA.y0) / (PANTALLA.x1 - PANTALLA.x0));
  lienzoCara.width = CW; lienzoCara.height = CH;
  const ctx = lienzoCara.getContext('2d');
  const texCara = new THREE.CanvasTexture(lienzoCara);
  texCara.colorSpace = THREE.SRGBColorSpace;
  const pw = PANTALLA.x1 - PANTALLA.x0, ph = PANTALLA.y1 - PANTALLA.y0;
  const matCara = new THREE.MeshBasicMaterial({ map: texCara, toneMapped: false, transparent: true, opacity: 1 });
  enCabeza(plano(matCara, pw, ph), P((PANTALLA.x0 + PANTALLA.x1) / 2, (PANTALLA.y0 + PANTALLA.y1) / 2, 1.5));
  const barras = Array.from(hero.querySelectorAll('.tv-bar'));
  const ojos = hero.querySelector('#tv-eyes');

  // Los ojos son los mismos de la versión de la foto: la «o» se toma del
  // símbolo del logo (#tv-o) y la «i» con las medidas exactas del logo.
  const R = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const simbolo = document.getElementById('tv-o');
  const anillo = new Image();
  const tenidos = {};
  let anilloListo = false;
  if (simbolo) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="375.2 52.5 620 620" width="512" height="512">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5af0d8"/><stop offset="1" stop-color="#35c9f0"/></linearGradient></defs>'
      + '<style>.tv-o-dim{opacity:.26}</style>'
      + simbolo.innerHTML.replace(/url\(#tv-grad\)/g, 'url(#g)') + '</svg>';
    anillo.onload = () => {
      // Copias teñidas del anillo para la aberración cromática.
      for (const [clave, color] of [['rojo', '#ff5a78'], ['azul', '#4696ff']]) {
        const c = document.createElement('canvas'); c.width = c.height = 512;
        const x = c.getContext('2d'); x.drawImage(anillo, 0, 0, 512, 512);
        x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, 512, 512);
        tenidos[clave] = c;
      }
      anilloListo = true; firma = '';
    };
    anillo.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  let firma = '';
  const pintarCara = (lx, ly, parpado, niveles, vol) => {
    const f = [lx.toFixed(3), ly.toFixed(3), parpado.toFixed(2), niveles, vol.toFixed(2), anilloListo].join('|');
    if (f === firma) return false;
    firma = f;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // Tubo apagado: negro con viñeta.
    const g = ctx.createRadialGradient(CW / 2, CH * 0.45, 10, CW / 2, CH / 2, CW * 0.72);
    g.addColorStop(0, '#0b1414'); g.addColorStop(0.6, '#050a0a'); g.addColorStop(1, '#010202');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);

    // Misma composición que la portada en foto: «i» 16 %, hueco 12 %, «o» 35 %.
    const iw = CW * 0.16, ih = iw * 765 / 320, ow = CW * 0.35 * (1 + vol * 0.12);
    const total = iw + CW * 0.12 + CW * 0.35;
    const x0 = (CW - total) / 2 + lx * CW * 0.06, cy = CH / 2 + ly * CH * 0.06;
    const pintarOjos = (dx, color, alpha) => {
      ctx.save();
      ctx.translate(dx, 0);
      ctx.translate(0, cy); ctx.scale(1, parpado); ctx.translate(0, -cy);
      ctx.globalAlpha = alpha;
      // «i»: 6 barras del logo (280×91,3, separación 126,7, radio 22 en 320×765).
      const k = iw / 320, bx = x0 + 20 * k, by = cy - ih / 2 + 20 * k;
      const grad = ctx.createLinearGradient(bx, by, bx + 280 * k, by + 725 * k);
      grad.addColorStop(0, color || '#5af0d8'); grad.addColorStop(1, color || '#35c9f0');
      for (let i = 0; i < 6; i++) {
        ctx.globalAlpha = alpha * (niveles[i] ? 1 : 0.26);
        ctx.fillStyle = grad; R(bx, by + i * 126.7 * k, 280 * k, 91.3 * k, 22 * k); ctx.fill();
      }
      ctx.globalAlpha = alpha;
      // «o»: el anillo del logo y su punto blanco de pupila.
      const ox = x0 + iw + CW * 0.12 + (CW * 0.35 - ow) / 2, oy = cy - ow / 2;
      if (anilloListo) {
        const img = color ? (color === '#ff5a78' ? tenidos.rojo : tenidos.azul) : anillo;
        if (img) ctx.drawImage(img, ox, oy, ow, ow);
      }
      if (!color) {
        const pr = ow * 0.186 / 2, px = ox + ow / 2 + lx * pr * 2 * 0.58, py = oy + ow / 2 + ly * pr * 2 * 0.58;
        const pg = ctx.createRadialGradient(px, py, 0, px, py, pr * 1.25);
        pg.addColorStop(0, '#fff'); pg.addColorStop(0.6, '#fff'); pg.addColorStop(0.75, 'rgba(220,255,250,.85)'); pg.addColorStop(1, 'rgba(160,250,235,0)');
        ctx.shadowColor = 'rgba(255,255,255,.8)'; ctx.shadowBlur = 18;
        ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr * 1.25, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    };
    // Aberración cromática suave (rojo a la izquierda, azul a la derecha), como en la foto.
    ctx.globalCompositeOperation = 'lighter';
    pintarOjos(-3, '#ff5a78', 0.22);
    pintarOjos(3, '#4696ff', 0.26);
    ctx.globalCompositeOperation = 'source-over';
    // Ojos con su resplandor.
    ctx.shadowColor = `rgba(110,250,225,${0.85 + vol * 0.15})`; ctx.shadowBlur = 26;
    pintarOjos(0, null, 1);
    ctx.shadowColor = 'rgba(53,201,240,.5)'; ctx.shadowBlur = 60;
    ctx.globalAlpha = 0.5; pintarOjos(0, null, 0.5);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // Líneas de barrido y reflejo del cristal.
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = 0; y < CH; y += 3) ctx.fillRect(0, y, CW, 1);
    const re = ctx.createRadialGradient(CW * 0.3, CH * 0.06, 5, CW * 0.3, CH * 0.06, CW * 0.6);
    re.addColorStop(0, 'rgba(255,255,255,0.07)'); re.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = re; ctx.fillRect(0, 0, CW, CH);
    texCara.needsUpdate = true;
    return true;
  };


  // Cables: 12 tubos (6 por lado). Salen de los conectores del lateral y de
  // debajo del televisor y acaban repartidos sobre la correa de cada hombro.
  const conectores = [
    // lado izquierdo (3), debajo izquierda (3), debajo derecha (3), lado derecho (3)
    ...[0, 1, 2].map((i) => ({ a: P(TV.x0 - 2, 380 + i * 9, -110 - i * 22), b: P(1006 + i * 8, 672), lado: -1 })),
    ...[0, 1, 2].map((i) => ({ a: P(1088 + i * 13, TV.y1 - 2, -60 - i * 10), b: P(1034 + i * 9, 668), lado: 0 })),
    ...[0, 1, 2].map((i) => ({ a: P(1405 + i * 15, TV.y1 - 2, -60 - i * 10), b: P(1466 + i * 9, 684), lado: 0 })),
    ...[0, 1, 2].map((i) => ({ a: P(TV.x1 + 2, 380 + i * 9, -110 - i * 22), b: P(1496 + i * 9, 688), lado: 1 })),
  ];
  const matCable = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.5, metalness: 0.05 });
  const tmp = new THREE.Vector3();
  const cables = conectores.map((c) => {
    const curva = new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), c.b.clone());
    const malla = new THREE.Mesh(new THREE.TubeGeometry(curva, 28, RAD, 7, false), matCable);
    escena.add(malla);
    return { ...c, curva, malla };
  });
  const rehacerCables = () => {
    cabeza.updateMatrixWorld(true);
    for (const c of cables) {
      const a = tmp.copy(c.a).sub(PIVOTE).applyMatrix4(cabeza.matrixWorld);
      c.curva.v0.copy(a);
      // Los de los lados bajan pegados al lateral; los de abajo caen rectos.
      c.curva.v1.set(a.x + c.lado * 6, a.y - (c.lado ? 150 : 45), a.z + (c.lado ? 20 : 30));
      c.curva.v2.set(c.b.x - c.lado * 10, c.b.y + 55, c.b.z + 10);
      const g = new THREE.TubeGeometry(c.curva, 28, RAD, 7, false);
      c.malla.geometry.dispose(); c.malla.geometry = g;
    }
  };

  const ajustar = () => {
    const w = lienzo.clientWidth || 1, h = lienzo.clientHeight || 1;
    renderer.setSize(w, h, false);
  };
  ajustar();
  window.addEventListener('resize', ajustar, { passive: true });

  const eu = new THREE.Euler(0, 0, 0, 'YXZ');
  let visible = true, bucle = 0, ultimoGiro = '';
  const reloj = () => {
    bucle = 0;
    if (!visible || document.hidden) return;
    const v = window.ditboVivo || {};
    const t = performance.now() / 1000;
    eu.set((v.cy || 0) * GIRO_X + 0.008 * Math.sin(t * 0.37 + 1),
           (v.cx || 0) * GIRO_Y + 0.012 * Math.sin(t * 0.29 + 4),
           -(v.cx || 0) * 0.025 + 0.008 * Math.sin(t * 0.41 + 2));
    cabeza.rotation.copy(eu);
    // El frontal se oscurece un poco al girar (deja de mirar a la luz).
    const sombra = 1 - Math.min(0.18, Math.abs(eu.y) * 0.7);
    matFrente.color.setScalar(sombra);
    const firmaGiro = eu.x.toFixed(4) + eu.y.toFixed(4) + eu.z.toFixed(4);
    if (firmaGiro !== ultimoGiro) { ultimoGiro = firmaGiro; rehacerCables(); }
    let parpado = 1;
    if (ojos && ojos.classList.contains('is-blink')) {
      const tr = getComputedStyle(ojos).transform;
      const m = tr && tr.startsWith('matrix(') ? tr.slice(7, -1).split(',').map(Number) : null;
      parpado = m ? Math.max(0.06, m[3]) : 1;
    }
    const niveles = barras.map((b) => (b.style.opacity === '' || Number(b.style.opacity) > 0.5 ? 1 : 0));
    pintarCara(v.ex || 0, v.ey || 0, parpado, niveles, v.vol || 0);
    renderer.render(escena, camara);
    bucle = requestAnimationFrame(reloj);
  };
  const despertar = () => { if (!bucle && visible && !document.hidden) bucle = requestAnimationFrame(reloj); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; despertar(); }, { rootMargin: '80px' }).observe(hero);
  }
  document.addEventListener('visibilitychange', despertar);

  rehacerCables();
  pintarCara(0, 0, 1, barras.map(() => 1), 0);
  renderer.render(escena, camara);
  alListo();
  despertar();
}
