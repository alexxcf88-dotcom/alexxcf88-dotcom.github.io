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
  const R = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  let firma = '';
  const pintarCara = (lx, ly, parpado, niveles, vol) => {
    const f = [lx.toFixed(2), ly.toFixed(2), parpado.toFixed(2), niveles, vol.toFixed(2)].join('|');
    if (f === firma) return false;
    firma = f;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Fondo del tubo: negro con un leve brillo central y viñeta.
    const g = ctx.createRadialGradient(CW / 2, CH * 0.45, 10, CW / 2, CH / 2, CW * 0.7);
    g.addColorStop(0, '#0c1615'); g.addColorStop(0.6, '#050a0a'); g.addColorStop(1, '#010202');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
    // La cara (se aplasta en vertical al pestañear) y mira un poco hacia el puntero.
    ctx.save();
    ctx.translate(CW / 2 + lx * CW * 0.035, CH / 2 + ly * CH * 0.04);
    ctx.scale(1, parpado);
    const grad = ctx.createLinearGradient(-CW * 0.3, -CH * 0.3, CW * 0.3, CH * 0.3);
    grad.addColorStop(0, '#5af0d8'); grad.addColorStop(1, '#35c9f0');
    ctx.shadowColor = `rgba(90,240,216,${0.75 + vol * 0.25})`;
    ctx.shadowBlur = 28;
    // «i»: 6 barras; las encendidas según el nivel.
    const bw = CW * 0.085, bh = CH * 0.062, gap = CH * 0.026, total = 6 * bh + 5 * gap;
    const bx = -CW * 0.2;
    for (let i = 0; i < 6; i++) {
      const y = -total / 2 + i * (bh + gap);
      ctx.globalAlpha = niveles[i] ? 1 : 0.26;
      ctx.fillStyle = grad; R(bx - bw / 2, y, bw, bh, bh * 0.24); ctx.fill();
    }
    // «o»: 12 segmentos de anillo (uno apagado) y el punto blanco de pupila.
    const ox = CW * 0.11, rOut = CH * 0.215 * (1 + vol * 0.08), rIn = rOut * 0.44;
    for (let k = 0; k < 12; k++) {
      const a0 = -Math.PI / 2 + (k * Math.PI * 2) / 12 + 0.035, a1 = a0 + (Math.PI * 2) / 12 - 0.07;
      ctx.globalAlpha = k === 6 ? 0.26 : 1;
      ctx.beginPath(); ctx.arc(ox, 0, rOut, a0, a1); ctx.arc(ox, 0, rIn, a1, a0, true); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = 22;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ox + lx * rIn * 0.55, ly * rIn * 0.55, rIn * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Líneas de barrido y reflejo del cristal.
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = 0; y < CH; y += 4) ctx.fillRect(0, y, CW, 1);
    const re = ctx.createRadialGradient(CW * 0.3, CH * 0.08, 5, CW * 0.3, CH * 0.08, CW * 0.55);
    re.addColorStop(0, 'rgba(255,255,255,0.10)'); re.addColorStop(1, 'rgba(255,255,255,0)');
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
