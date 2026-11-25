/* Cristina en la portada, toda en 3D.
   · Cuerpo (del cuello para abajo): el busto del modelo 3D de Cristina, con su
     textura tal cual (material mate, sin brillos). Se descartan su televisor
     y sus cables; el cuello se dobla con la cabeza. Respira.
   · El televisor es una caja 3D hecha a medida: frontal con la textura de la
     propia foto, laterales y techo con las vistas reales del mismo televisor.
     Gira un poco hacia el puntero desde la base del cuello.
   · Los cables son tubos 3D que salen de los conectores del televisor y
     acaban en las correas de los hombros. Se construyen una vez; al girar la
     cabeza los dobla la tarjeta gráfica (sin recalcular nada en JS).
   Rendimiento: la cara de la pantalla se compone de piezas ya dibujadas (el
   brillo se pinta una vez) y nada se reconstruye por fotograma.
   · La pantalla lleva los ojos de ditbo («i» y «o» del logo).
   Coordenadas: 1 unidad = 1 píxel de la foto (1671×941); y hacia arriba. */
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const FW = 1671, FH = 941;
const P = (x, y, z = 0) => new THREE.Vector3(x, -y, z);   // píxel de la foto → mundo
// Televisor en la foto (recorte del frontal) y su fondo (de las vistas laterales).
const TV = { x0: 958, x1: 1561, y0: 23, y1: 543, fondo: 460 };   // borde exterior del marco
const PANTALLA = { x0: 1019.3, x1: 1508.9, y0: 75.3, y1: 461.1 };
const PIVOTE = P(1252, 640, -170);        // base del cuello, bajo el televisor
const GIRO_Y = THREE.MathUtils.degToRad(13);
const GIRO_X = THREE.MathUtils.degToRad(6);
const RAD = 4.3;                           // grosor de los cables (px)

export async function montar({ hero, lienzo, alListo }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const escena = new THREE.Scene();
  // Cámara frente al televisor (como en la foto) con el encuadre desplazado
  // para que el plano z=0 coincida exactamente con la foto: en reposo no se
  // ve ningún lateral y al girar aparece la carcasa.
  const FOV = 10, DIST = (FH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const OJO = { x: 1259, y: 283 };        // centro del televisor en la foto
  const camara = new THREE.PerspectiveCamera(FOV, FW / FH, DIST * 0.5, DIST * 1.6);
  camara.position.set(OJO.x, -OJO.y, DIST);
  camara.updateMatrixWorld();
  {
    const n = camara.near, k = n / DIST;
    camara.projectionMatrix.makePerspective((0 - OJO.x) * k, (FW - OJO.x) * k, OJO.y * k, (OJO.y - FH) * k, n, camara.far);
    camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
  }

  // Luz (solo para los cables): estudio suave desde arriba a la izquierda, como la foto.
  escena.add(new THREE.HemisphereLight(0xfff3ec, 0x51463f, 1.4));
  const clave = new THREE.DirectionalLight(0xffffff, 2.4); clave.position.set(-600, 900, 1400); escena.add(clave);
  const borde = new THREE.DirectionalLight(0xffffff, 0.9); borde.position.set(900, 300, -600); escena.add(borde);

  const cargar = (url) => new Promise((ok, mal) => new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, mal));
  const tFrente = await cargar('/features/landing/media/hero/cristina-cabeza.webp?v=2');
  const plano = (mat, ancho, alto) => new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
  const mat = (tex, color = 0xffffff) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, color, toneMapped: false });

  // Giro de la cabeza compartido con cuello y cables: cada vértice se mueve
  // hacia su posición girada según un peso (1 pegado a la cabeza, 0 fijo).
  const uGiro = { value: new THREE.Matrix3() };
  const doblar = (material, piv, pesoGLSL, extraVS = '', extraFS = '') => {
    const uPiv = { value: piv };
    material.onBeforeCompile = (sh) => {
      sh.uniforms.uGiro = uGiro; sh.uniforms.uPiv = uPiv;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat3 uGiro; uniform vec3 uPiv;' + extraVS)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n{ float w = ' + pesoGLSL + '; objectNormal = normalize(mix(objectNormal, uGiro * objectNormal, w)); }')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float w = ' + pesoGLSL + '; transformed = mix(transformed, uGiro * (transformed - uPiv) + uPiv, w); }');
      if (extraFS) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + extraFS.split('@@')[0]).replace('void main() {', 'void main() {\n' + extraFS.split('@@')[1]);
    };
    material.needsUpdate = true;
    return uPiv;
  };

  // Grupo de la cabeza, con el origen en el pivote del cuello.
  const cabeza = new THREE.Group();
  cabeza.position.copy(PIVOTE);
  escena.add(cabeza);
  const enCabeza = (o, v) => { o.position.copy(v).sub(PIVOTE); cabeza.add(o); return o; };
  const W = TV.x1 - TV.x0, H = TV.y1 - TV.y0, D = TV.fondo, cx = (TV.x0 + TV.x1) / 2, cyTV = (TV.y0 + TV.y1) / 2;

  // Carcasa: una sola pieza extruida desde la silueta del frontal (bordes
  // redondeados), más el culo del tubo detrás. Sin láminas sueltas: no hay
  // huecos posibles entre frontal, laterales, techo y suelo.
  const rect = (w, h, r) => {
    const f = new THREE.Shape(), x = -w / 2, y = -h / 2;
    f.moveTo(x + r, y); f.lineTo(x + w - r, y); f.quadraticCurveTo(x + w, y, x + w, y + r);
    f.lineTo(x + w, y + h - r); f.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    f.lineTo(x + r, y + h); f.quadraticCurveTo(x, y + h, x, y + h - r);
    f.lineTo(x, y + r); f.quadraticCurveTo(x, y, x + r, y);
    return f;
  };
  // Metal gastado: el mismo tono del marco de la foto, con algo de ruido.
  const ruido = document.createElement('canvas'); ruido.width = ruido.height = 256;
  { const c = ruido.getContext('2d'); c.fillStyle = '#8a7a72'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const v = 110 + Math.random() * 60 | 0; c.fillStyle = `rgba(${v},${v - 10},${v - 14},${Math.random() * 0.35})`; c.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(40,32,28,${0.2 + Math.random() * 0.3})`; c.fillRect(Math.random() * 256, Math.random() * 256, 1, 1 + Math.random() * 3); } }
  const tRuido = new THREE.CanvasTexture(ruido); tRuido.colorSpace = THREE.SRGBColorSpace; tRuido.wrapS = tRuido.wrapT = THREE.RepeatWrapping; tRuido.repeat.set(0.006, 0.006);
  const matCarcasa = new THREE.MeshStandardMaterial({ map: tRuido, color: 0xcbbcb3, roughness: 0.78, metalness: 0.08 });
  const prof = D * 0.42;
  const geoMarco = new THREE.ExtrudeGeometry(rect(W - 4, H - 4, 32), { depth: prof, bevelEnabled: true, bevelThickness: 5, bevelSize: 4, bevelSegments: 3, curveSegments: 8 });
  geoMarco.translate(0, 0, -prof - 10); // el bisel (5) queda detrás del frontal de la foto
  enCabeza(new THREE.Mesh(geoMarco, matCarcasa), P(cx, cyTV, 0));
  const geoTubo = new THREE.ExtrudeGeometry(rect(W * 0.74, H * 0.76, 60), { depth: D - prof, bevelEnabled: true, bevelThickness: 18, bevelSize: 14, bevelSegments: 4, curveSegments: 10 });
  geoTubo.translate(0, 0, -D);
  enCabeza(new THREE.Mesh(geoTubo, matCarcasa), P(cx, cyTV - 6, 0));
  // Rejilla de ventilación en los laterales (ranuras oscuras).
  const matRanura = new THREE.MeshBasicMaterial({ color: 0x231f1c, toneMapped: false, side: THREE.DoubleSide });
  for (const lado of [-1, 1]) for (let i = 0; i < 7; i++) {
    const r = plano(matRanura, D * 0.2, 5);
    r.rotation.y = Math.PI / 2;
    enCabeza(r, P(cx + lado * (W / 2 - 3.2), 150 + i * 16, -prof * 0.55));
  }

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

  // Los ojos son los de la portada en foto: la «o» del símbolo del logo
  // (#tv-o) y la «i» con sus medidas exactas. Todo lo caro (brillo, bordes de
  // color) se dibuja UNA vez en lienzos guardados; cada fotograma solo coloca
  // piezas: fondo + ojos (por combinación de barras) + pupila + cristal.
  const nuevo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const iw = CW * 0.16, ih = iw * 765 / 320, ow = CW * 0.35;
  const total = iw + CW * 0.12 + ow, X0 = (CW - total) / 2, CY = CH / 2;
  const OX = X0 + iw + CW * 0.12, OY = CY - ow / 2;          // esquina del anillo
  const fondo = nuevo(CW, CH);
  { const c = fondo.getContext('2d'); const g = c.createRadialGradient(CW / 2, CH * 0.45, 10, CW / 2, CH / 2, CW * 0.72);
    g.addColorStop(0, '#0b1414'); g.addColorStop(0.6, '#050a0a'); g.addColorStop(1, '#010202'); c.fillStyle = g; c.fillRect(0, 0, CW, CH); }
  const vidrio = nuevo(CW, CH);
  { const c = vidrio.getContext('2d'); c.fillStyle = 'rgba(255,255,255,0.035)'; for (let y = 0; y < CH; y += 3) c.fillRect(0, y, CW, 1);
    const re = c.createRadialGradient(CW * 0.3, CH * 0.06, 5, CW * 0.3, CH * 0.06, CW * 0.6);
    re.addColorStop(0, 'rgba(255,255,255,0.07)'); re.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = re; c.fillRect(0, 0, CW, CH); }
  const pupila = nuevo(96, 96);
  { const c = pupila.getContext('2d'); const g = c.createRadialGradient(48, 48, 0, 48, 48, 30);
    g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#fff'); g.addColorStop(0.72, 'rgba(220,255,250,.85)'); g.addColorStop(1, 'rgba(160,250,235,0)');
    c.shadowColor = 'rgba(255,255,255,.8)'; c.shadowBlur = 16; c.fillStyle = g; c.beginPath(); c.arc(48, 48, 30, 0, Math.PI * 2); c.fill(); }
  const simbolo = document.getElementById('tv-o');
  const anillo = new Image();
  let anilloListo = false;
  const spriteOjos = new Map();
  const pintarOjosEn = (c, niveles) => {
    const unaVez = (dx, color, alpha) => {
      c.save(); c.translate(dx, 0); c.globalAlpha = alpha;
      const k = iw / 320, bx = X0 + 20 * k, by = CY - ih / 2 + 20 * k;
      const grad = c.createLinearGradient(bx, by, bx + 280 * k, by + 725 * k);
      grad.addColorStop(0, color || '#5af0d8'); grad.addColorStop(1, color || '#35c9f0');
      for (let i = 0; i < 6; i++) {
        c.globalAlpha = alpha * (niveles[i] ? 1 : 0.26); c.fillStyle = grad;
        c.beginPath(); c.roundRect(bx, by + i * 126.7 * k, 280 * k, 91.3 * k, 22 * k); c.fill();
      }
      c.globalAlpha = alpha;
      if (anilloListo) {
        if (color) { const t = nuevo(512, 512), x = t.getContext('2d'); x.drawImage(anillo, 0, 0, 512, 512); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, 512, 512); c.drawImage(t, OX, OY, ow, ow); }
        else c.drawImage(anillo, OX, OY, ow, ow);
      }
      c.restore();
    };
    c.globalCompositeOperation = 'lighter';
    unaVez(-3, '#ff5a78', 0.22); unaVez(3, '#4696ff', 0.26);
    c.globalCompositeOperation = 'source-over';
    c.shadowColor = 'rgba(110,250,225,.9)'; c.shadowBlur = 26; unaVez(0, null, 1);
    c.shadowColor = 'rgba(53,201,240,.5)'; c.shadowBlur = 60; unaVez(0, null, 0.5);
    c.shadowBlur = 0;
  };
  const ojosPara = (niveles) => {
    const clave = niveles.join('') + (anilloListo ? 'o' : '');
    let c = spriteOjos.get(clave);
    if (!c) { c = nuevo(CW, CH); pintarOjosEn(c.getContext('2d'), niveles); spriteOjos.set(clave, c); }
    return c;
  };
  if (simbolo) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="375.2 52.5 620 620" width="512" height="512">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5af0d8"/><stop offset="1" stop-color="#35c9f0"/></linearGradient></defs>'
      + '<style>.tv-o-dim{opacity:.26}</style>'
      + simbolo.innerHTML.replace(/url\(#tv-grad\)/g, 'url(#g)') + '</svg>';
    anillo.onload = () => { anilloListo = true; spriteOjos.clear(); firma = ''; };
    anillo.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  let firma = '';
  const pintarCara = (lx, ly, parpado, niveles, vol) => {
    const f = [lx.toFixed(2), ly.toFixed(2), parpado.toFixed(2), niveles.join(''), vol.toFixed(1), anilloListo].join('|');
    if (f === firma) return false;
    firma = f;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fondo, 0, 0);
    const dx = lx * CW * 0.06, dy = ly * CH * 0.06, esc = 1 + vol * 0.06;
    ctx.save();
    ctx.translate(CW / 2 + dx, CY + dy); ctx.scale(esc, parpado * esc); ctx.translate(-CW / 2, -CY);
    ctx.drawImage(ojosPara(niveles), 0, 0);
    const pr = ow * 0.186 / 2, px = OX + ow / 2 + lx * pr * 2 * 0.58, py = OY + ow / 2 + ly * pr * 2 * 0.58, ps = pr * 2.5 / 60;
    ctx.drawImage(pupila, px - 48 * ps, py - 48 * ps, 96 * ps, 96 * ps);
    ctx.restore();
    ctx.drawImage(vidrio, 0, 0);
    texCara.needsUpdate = true;
    return true;
  };

  // Cuerpo: el busto del modelo 3D. Se lleva a coordenadas de la foto
  // (escala por el ancho del televisor; el cuello del modelo queda bajo el
  // televisor y su centro en el pivote) y se guarda la y original del modelo
  // para decidir qué se dobla y qué se descarta.
  const S = 2500, Y_TV = 0.672, Z_CUELLO = -0.04;  // escala del busto: misma complexión que la foto
  const BASE_Y = -1000;                        // origen del grupo: por debajo del encuadre (respira desde abajo)
  const cuerpo = new THREE.Group();
  cuerpo.position.set(0, BASE_Y, 0);
  escena.add(cuerpo);
  const gltf = await new GLTFLoader().loadAsync('/features/landing/media/hero/cristina-cuerpo.glb?v=1');
  const aMundo = new THREE.Matrix4().makeTranslation(1259, -543 - BASE_Y, -170)
    .multiply(new THREE.Matrix4().makeScale(S, S, S))
    .multiply(new THREE.Matrix4().makeTranslation(0, -Y_TV, -Z_CUELLO));
  let pivCuerpo = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const pos = g.attributes.position, n = pos.count;
    const mxy = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { mxy[i * 2] = pos.getX(i); mxy[i * 2 + 1] = pos.getY(i); }
    g.setAttribute('aMod', new THREE.BufferAttribute(mxy, 2));
    g.applyMatrix4(aMundo);
    const m = new THREE.MeshBasicMaterial({ map: o.material.map || null, color: 0xffffff });
    pivCuerpo = doblar(m, PIVOTE.clone().sub(cuerpo.position),
      'smoothstep(0.600, 0.672, aMod.y)',
      '\nattribute vec2 aMod; varying vec2 vMod;',
      'varying vec2 vMod;@@ if (vMod.y > 0.676 || (abs(vMod.x) > 0.07 && vMod.y > 0.668 - (abs(vMod.x) - 0.07) * 0.36)) discard;');
    m.onBeforeCompile = ((orig) => (sh) => {
      orig(sh);
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMod = aMod;');
      // Los cables que traía el modelo sobre los hombros se pintan del color
      // del traje (con un leve sombreado del propio mapa): se leen como hombro.
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { float ax = abs(vMod.x);
          float zona = smoothstep(0.078, 0.092, ax) * (1.0 - smoothstep(0.205, 0.225, ax)) * smoothstep(0.46, 0.49, vMod.y);
          float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 traje = vec3(0.085, 0.078, 0.074) * (0.75 + 0.5 * clamp(l * 2.0, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, traje, zona);
          // Más contraste, como la foto (la textura del modelo sale lavada).
          diffuseColor.rgb = pow(diffuseColor.rgb, vec3(1.35)) * 1.08; }`);
    })(m.onBeforeCompile);
    const malla = new THREE.Mesh(g, m);
    malla.frustumCulled = false;
    cuerpo.add(malla);
  });

  // Cables: 12 tubos (6 por lado). Salen de los conectores del lateral y de
  // debajo del televisor y acaban repartidos sobre la correa de cada hombro.
  const conectores = [
    // lado izquierdo (3), debajo izquierda (3), debajo derecha (3), lado derecho (3)
    ...[0, 1, 2].map((i) => ({ a: P(TV.x0 - 2, 380 + i * 9, -110 - i * 22), b: P(1006 + i * 8, 672), lado: -1 })),
    ...[0, 1, 2].map((i) => ({ a: P(1088 + i * 13, TV.y1 - 2, -60 - i * 10), b: P(1034 + i * 9, 668), lado: 0 })),
    ...[0, 1, 2].map((i) => ({ a: P(1405 + i * 15, TV.y1 - 2, -60 - i * 10), b: P(1466 + i * 9, 684), lado: 0 })),
    ...[0, 1, 2].map((i) => ({ a: P(TV.x1 + 2, 380 + i * 9, -110 - i * 22), b: P(1496 + i * 9, 688), lado: 1 })),
  ];
  const matCable = new THREE.MeshStandardMaterial({ color: 0x1a1715, roughness: 0.72, metalness: 0.0 });
  doblar(matCable, PIVOTE.clone(), 'pow(1.0 - uv.x, 1.6)');
  for (const c of conectores) {
    const a = c.a.clone(), b = c.b.clone().setZ(110);   // sobre la superficie de los hombros del busto 3D
    const curva = new THREE.CubicBezierCurve3(a,
      new THREE.Vector3(a.x + c.lado * 6, a.y - (c.lado ? 150 : 45), a.z + (c.lado ? 20 : 30)),
      new THREE.Vector3(b.x - c.lado * 10, b.y + 55, b.z + 10), b);
    const malla = new THREE.Mesh(new THREE.TubeGeometry(curva, 28, RAD, 7, false), matCable);
    malla.frustumCulled = false;
    escena.add(malla);
  }

  const ajustar = () => {
    const w = lienzo.clientWidth || 1, h = lienzo.clientHeight || 1;
    renderer.setSize(w, h, false);
  };
  ajustar();
  window.addEventListener('resize', ajustar, { passive: true });

  const eu = new THREE.Euler(0, 0, 0, 'YXZ');
  let visible = true, bucle = 0;
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
    cabeza.updateMatrix();
    uGiro.value.setFromMatrix4(cabeza.matrix);
    // Respira: el busto crece un poco desde abajo y la cabeza sube con él.
    const r = v.respira || 0, k = 1 + r * 0.006;
    cuerpo.scale.set(1 + r * 0.003, k, 1 + r * 0.004);
    cuerpo.rotation.z = THREE.MathUtils.degToRad((v.br || 0) * 0.25);
    cabeza.position.y = PIVOTE.y + (PIVOTE.y - BASE_Y) * (k - 1);
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

  pintarCara(0, 0, 1, barras.map(() => 1), 0);
  renderer.render(escena, camara);
  alListo();
  despertar();
}
