/* Cristina en 3D (portada). Modelo propio generado a partir de sus vistas
   (frente, lados y espalda) y servido como glTF. Lo carga hero.js cuando la
   web ya ha entrado; mientras tanto, y si no hay WebGL, se ve la foto.

   · Cabeza: gira hacia el puntero desde la base del cuello. El giro no es un
     corte: se reparte de forma suave entre el cuello y el televisor (peso por
     altura en el propio shader), así cuello y cables siguen unidos.
   · Cuerpo: respira y se balancea (los valores los calcula hero.js y los deja
     en window.ditboVivo; aquí solo se aplican).
   · Pantalla: una capa encendida sobre el cristal del televisor con la cara de
     ditbo, la «i» (barras de nivel) y la «o» (dial con su punto). Lee el
     estado de los ojos del DOM que ya mueve hero.js (pestañeo y barras).
   Solo se dibuja mientras la portada está a la vista. */
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// Medidas del modelo (unidades del glTF, medidas sobre el propio modelo).
const CUELLO_DESDE = 0.60;   // a partir de aquí el giro empieza a contar
const CUELLO_HASTA = 0.70;   // desde aquí todo gira entero (el televisor)
const PIVOTE = new THREE.Vector3(0, 0.615, -0.02);
const PANTALLA = { x0: -0.137, x1: 0.133, y0: 0.73, y1: 0.97, z: 0.1045 };
const GIRO_Y = THREE.MathUtils.degToRad(15);   // izquierda / derecha
const GIRO_X = THREE.MathUtils.degToRad(7);   // arriba / abajo

export async function montar({ hero, lienzo, alListo }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(20, 1, 0.1, 20);

  // Luz de estudio suave, como la foto: cálida desde arriba a la izquierda,
  // relleno frío y un borde que separa la figura del fondo.
  escena.add(new THREE.HemisphereLight(0xfff4ee, 0x6f6360, 1.25));
  const clave = new THREE.DirectionalLight(0xfff1e6, 2.1); clave.position.set(-1.4, 2.2, 2.6); escena.add(clave);
  const relleno = new THREE.DirectionalLight(0xdfe8ff, 0.55); relleno.position.set(1.8, 0.6, 1.5); escena.add(relleno);
  const borde = new THREE.DirectionalLight(0xffffff, 1.1); borde.position.set(0.6, 1.6, -2.4); escena.add(borde);

  // Giro de la cabeza, compartido por todos los materiales del modelo.
  const uni = {
    uGiro: { value: new THREE.Matrix3() },
    uPivote: { value: PIVOTE },
    uDesde: { value: CUELLO_DESDE },
    uHasta: { value: CUELLO_HASTA },
  };
  const conGiro = (material) => {
    material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform mat3 uGiro; uniform vec3 uPivote; uniform float uDesde; uniform float uHasta;
          float pesoCuello(float y){ float w = smoothstep(uDesde, uHasta, y); return w * w * (3.0 - 2.0 * w); }`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          objectNormal = normalize(mix(objectNormal, uGiro * objectNormal, pesoCuello(position.y)));`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          { float w = pesoCuello(position.y);
            vec3 girado = uGiro * (transformed - uPivote) + uPivote;
            transformed = mix(transformed, girado, w); }`);
    };
    material.needsUpdate = true;
  };

  const gltf = await new GLTFLoader().loadAsync('/features/landing/media/hero/cristina.glb?v=1');
  const modelo = gltf.scene;
  modelo.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // los vértices se mueven en el shader
    const m = o.material;
    m.metalness = 0; m.roughness = 0.78;
    if (m.map) m.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    conGiro(m);
  });

  // Pantalla encendida con la cara de ditbo (se redibuja solo cuando cambia).
  const lienzoCara = document.createElement('canvas');
  const CW = 640, CH = Math.round(640 * (PANTALLA.y1 - PANTALLA.y0) / (PANTALLA.x1 - PANTALLA.x0));
  lienzoCara.width = CW; lienzoCara.height = CH;
  const ctx = lienzoCara.getContext('2d');
  const texCara = new THREE.CanvasTexture(lienzoCara);
  texCara.colorSpace = THREE.SRGBColorSpace;
  texCara.anisotropy = 4;
  const geoCara = new THREE.PlaneGeometry(PANTALLA.x1 - PANTALLA.x0, PANTALLA.y1 - PANTALLA.y0, 8, 8);
  geoCara.translate((PANTALLA.x0 + PANTALLA.x1) / 2, (PANTALLA.y0 + PANTALLA.y1) / 2, PANTALLA.z);
  // Cristal un poco abombado, como un tubo.
  const pos = geoCara.attributes.position;
  const cx0 = (PANTALLA.x0 + PANTALLA.x1) / 2, cy0 = (PANTALLA.y0 + PANTALLA.y1) / 2;
  const hw = (PANTALLA.x1 - PANTALLA.x0) / 2, hh = (PANTALLA.y1 - PANTALLA.y0) / 2;
  for (let i = 0; i < pos.count; i++) {
    const nx = (pos.getX(i) - cx0) / hw, ny = (pos.getY(i) - cy0) / hh;
    pos.setZ(i, PANTALLA.z + 0.004 * (1 - Math.min(1, (nx * nx + ny * ny) * 0.5)));
  }
  const matCara = new THREE.MeshBasicMaterial({ map: texCara, toneMapped: false });
  conGiro(matCara);
  const cara = new THREE.Mesh(geoCara, matCara);
  cara.frustumCulled = false;
  modelo.add(cara);

  const raiz = new THREE.Group();
  raiz.add(modelo);
  escena.add(raiz);

  const barras = Array.from(hero.querySelectorAll('.tv-bar')); // de arriba abajo
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

  // Encuadre: busto desde el pecho, como la foto.
  const encuadrar = () => {
    const w = lienzo.clientWidth || 1, h = lienzo.clientHeight || 1;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    const movil = w < 560 && h / w > 0.85;
    // Como la foto original: el televisor arranca a ~21 % de la altura, los
    // hombros salen justo por el borde de abajo y, en escritorio, el
    // televisor queda centrado al 68 % del ancho del lienzo (a la derecha).
    const alto = movil ? 0.74 : 0.67;
    const centro = movil ? 0.79 : 0.795;
    const dx = movil ? 0 : -(0.685 - 0.5) * alto * camara.aspect;
    const dist = (alto / 2) / Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
    camara.position.set(dx, centro + 0.02, dist);
    camara.lookAt(dx, centro, 0);
    camara.updateProjectionMatrix();
  };
  encuadrar();
  window.addEventListener('resize', encuadrar, { passive: true });

  const rot = new THREE.Matrix4(), m3 = new THREE.Matrix3(), eu = new THREE.Euler(0, 0, 0, 'YXZ');
  let visible = true, bucle = 0;
  const reloj = () => {
    bucle = 0;
    if (!visible || document.hidden) return;
    const v = window.ditboVivo || {};
    const cx = v.cx || 0, cy = v.cy || 0, ex = v.ex || 0, ey = v.ey || 0, respira = v.respira || 0, t = performance.now() / 1000;
    // Cabeza: hacia el puntero + micro-movimientos propios.
    eu.set(cy * GIRO_X + 0.012 * Math.sin(t * 0.37 + 1),
           cx * GIRO_Y + 0.018 * Math.sin(t * 0.29 + 4),
           -cx * 0.03 + 0.012 * Math.sin(t * 0.41 + 2));
    rot.makeRotationFromEuler(eu);
    uni.uGiro.value.setFromMatrix4(rot);
    // Cuerpo: balanceo y respiración (muy sutil) + un poco de giro del torso.
    raiz.rotation.y = (v.br || 0) * 0.01; // cuerpo de frente: solo cabeza y cuello siguen al cursor
    raiz.rotation.z = THREE.MathUtils.degToRad((v.br || 0) * 0.5);
    raiz.position.x = (v.bx || 0) * 0.0012;
    raiz.position.y = -(respira * 0.0035);
    modelo.scale.set(1 + respira * 0.004, 1, 1 + respira * 0.006);
    // Pantalla: pestañeo (del DOM que anima hero.js), barras y voz.
    let parpado = 1;
    if (ojos && ojos.classList.contains('is-blink')) {
      const tr = getComputedStyle(ojos).transform;
      const m = tr && tr.startsWith('matrix(') ? tr.slice(7, -1).split(',').map(Number) : null;
      parpado = m ? Math.max(0.06, m[3]) : 1;
    }
    const niveles = barras.map((b) => (b.style.opacity === '' || Number(b.style.opacity) > 0.5 ? 1 : 0));
    pintarCara(ex, ey, parpado, niveles, v.vol || 0);
    renderer.render(escena, camara);
    bucle = requestAnimationFrame(reloj);
  };
  const despertar = () => { if (!bucle && visible && !document.hidden) bucle = requestAnimationFrame(reloj); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; despertar(); }, { rootMargin: '80px' }).observe(hero);
  }
  document.addEventListener('visibilitychange', despertar);

  // Primer fotograma ya pintado antes de mostrarlo: sin parpadeo al cambiar.
  pintarCara(0, 0, 1, barras.map(() => 1), 0);
  renderer.render(escena, camara);
  alListo();
  despertar();
}
