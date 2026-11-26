/* Cristina en la portada, en 3D de verdad.
   · Cuerpo: la foto de Cristina convertida en malla 3D. Cada píxel tiene su
     profundidad (torso redondeado, cuello, hombros), así que al moverse se ve
     el volumen sin perder la calidad de la foto. Respira (hombros y pecho),
     se balancea de pie y gira el torso hacia el puntero desde la cadera.
   · Cuello: parte de la misma malla; arriba sigue a la cabeza, abajo a la
     camisa (se dobla en la tarjeta gráfica).
   · Televisor: modelado entero (marco metálico biselado, panel negro, cristal
     de tubo abombado, carcasa con fondo de tubo, rejillas y conectores), con
     luz de estudio y reflejos reales.
   · Cara: la «i» y la «o» del logo de ditbo hechas con geometría (no con una
     imagen): nítidas a cualquier tamaño y siempre rectas. Miran al puntero,
     pestañean y la «i» sube y baja con la voz.
   · Cables: tubos 3D de los conectores a las correas de los hombros.
   Coordenadas: 1 unidad = 1 píxel de la foto (1671×941); y hacia arriba. */
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const FW = 1671, FH = 941;
const P = (x, y, z = 0) => new THREE.Vector3(x, -y, z);   // píxel de la foto → mundo
const TV = { x0: 958, x1: 1561, y0: 23, y1: 543 };          // borde exterior del marco
const PANEL = { x0: 997, x1: 1522, y0: 60, y1: 505 };       // panel negro dentro del marco
const PANTALLA = { x0: 1019.3, x1: 1508.9, y0: 75.3, y1: 461.1 };
const PIVOTE = P(1260, 640, -170);      // base del cuello
const CADERA = P(1260, 1180, -170);     // el torso gira desde aquí (fuera de cuadro)
const SUELO = P(1260, 1500, -170);      // eje del balanceo de pie
const CUERPO = { x0: 740, y0: 470, x1: 1671, y1: 1011, z0: -170, z1: 44.93 };
const RAD = 4.2;                        // grosor de los cables (px)
const OJO = { x: 1259, y: 283 };        // la cámara mira al centro del televisor
const gr = THREE.MathUtils.degToRad;

export async function montar({ hero, lienzo, alListo }) {
  const movil = window.matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, movil ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const escena = new THREE.Scene();
  // Estudio para los reflejos del metal y del cristal.
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  // Cámara frente al televisor, con el encuadre desplazado para que el plano
  // z=0 coincida exactamente con la foto.
  const FOV = 10, DIST = (FH / 2) / Math.tan(gr(FOV / 2));
  const camara = new THREE.PerspectiveCamera(FOV, FW / FH, DIST * 0.5, DIST * 1.6);
  camara.position.set(OJO.x, -OJO.y, DIST);
  camara.updateMatrixWorld();
  {
    const n = camara.near, k = n / DIST;
    camara.projectionMatrix.makePerspective((0 - OJO.x) * k, (FW - OJO.x) * k, OJO.y * k, (OJO.y - FH) * k, n, camara.far);
    camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
  }
  // Un punto a profundidad z que se ve exactamente en el píxel (x, y) de la foto.
  const enFoto = (x, y, z) => { const t = (DIST - z) / DIST; return new THREE.Vector3(OJO.x + (x - OJO.x) * t, -(OJO.y + (y - OJO.y) * t), z); };

  // Luz de la foto: estudio suave, clave arriba a la izquierda, tono cálido.
  escena.add(new THREE.HemisphereLight(0xfff1ea, 0x5b4a43, 0.9));
  const clave = new THREE.DirectionalLight(0xfff4ee, 1.9); clave.position.set(-700, 900, 1500); escena.add(clave);
  const relleno = new THREE.DirectionalLight(0xffe9df, 0.45); relleno.position.set(1200, 200, 900); escena.add(relleno);
  const contra = new THREE.DirectionalLight(0xffffff, 0.6); contra.position.set(300, 600, -900); escena.add(contra);

  const cargar = (url) => new Promise((ok, mal) => new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); ok(t); }, undefined, mal));
  const cargarImg = (url) => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
  const [tCuerpo, imgProf] = await Promise.all([
    cargar('/features/landing/media/hero/cristina-cuerpo3d@2x.webp?v=2'),
    cargarImg('/features/landing/media/hero/cristina-prof.png?v=1'),
  ]);

  /* ── Jerarquía: figura (balanceo) → torso (giro desde la cadera) →
        hombros (suben al respirar) → cabeza (gira desde el cuello). ── */
  const conPivote = (padre, piv) => {
    const g = new THREE.Group(); g.position.copy(piv); padre.add(g);
    const dentro = new THREE.Group(); dentro.position.copy(piv).negate(); g.add(dentro);
    return { g, dentro };
  };
  const figura = conPivote(escena, SUELO);
  const torso = conPivote(figura.dentro, CADERA);
  const hombros = new THREE.Group(); torso.dentro.add(hombros);
  const cabeza = conPivote(hombros, PIVOTE);
  const enCabeza = (o) => { cabeza.dentro.add(o); return o; };

  // Giros compartidos con los shaders del cuerpo y de los cables.
  const uCabeza = { value: new THREE.Matrix3() };
  const uTorso = { value: new THREE.Matrix3() };
  const uRespira = { value: 0 };
  const uSube = { value: 0 };
  const uLuz = { value: 1 };

  /* ── Cuerpo: la foto sobre una malla con relieve ── */
  let profundidad = () => 0;
  {
    const c = document.createElement('canvas');
    c.width = imgProf.width; c.height = imgProf.height;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(imgProf, 0, 0);
    const px = cx.getImageData(0, 0, c.width, c.height).data;
    const prof = (u, v) => {             // u, v en 0…1 (v hacia abajo), bilineal
      const x = u * (c.width - 1), y = v * (c.height - 1);
      const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, c.width - 1), y1 = Math.min(y0 + 1, c.height - 1);
      const f = (xx, yy) => { const i = (yy * c.width + xx) * 4; return (px[i] * 256 + px[i + 1]) / 65535; };
      const a = f(x0, y0) + (f(x1, y0) - f(x0, y0)) * (x - x0), b = f(x0, y1) + (f(x1, y1) - f(x0, y1)) * (x - x0);
      return CUERPO.z0 + (a + (b - a) * (y - y0)) * (CUERPO.z1 - CUERPO.z0);
    };
    const SX = movil ? 120 : 190, SY = movil ? 70 : 110;
    const geo = new THREE.PlaneGeometry(1, 1, SX, SY);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    const aPy = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i), v = 1 - uv.getY(i);
      const x = CUERPO.x0 + u * (CUERPO.x1 - CUERPO.x0), y = CUERPO.y0 + v * (CUERPO.y1 - CUERPO.y0);
      const p = enFoto(x, y, prof(u, v));
      pos.setXYZ(i, p.x, p.y, p.z);
      aPy[i] = y;
    }
    geo.setAttribute('aPy', new THREE.BufferAttribute(aPy, 1));
    geo.computeBoundingSphere();
    geo.computeVertexNormals();   // forma del cuerpo en reposo, para la luz
    const mat = new THREE.MeshBasicMaterial({ map: tCuerpo, transparent: true, depthWrite: false, toneMapped: false });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uCabeza, uTorso, uRespira, uSube, uLuz, uPiv: { value: PIVOTE }, uCad: { value: CADERA } });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float aPy; uniform mat3 uCabeza, uTorso; uniform vec3 uPiv, uCad; uniform float uRespira, uSube; varying float vPy;
          varying vec3 vN0, vN1; varying vec2 vFoto;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            vPy = aPy;
            vec3 p = transformed;
            // Respira: hombros arriba, pecho algo más ancho y adelante.
            float sube = 1.0 - smoothstep(700.0, 1000.0, aPy);
            float pecho = smoothstep(610.0, 720.0, aPy) * (1.0 - smoothstep(900.0, 1060.0, aPy));
            p.y += uSube * sube;
            p.x += (p.x - 1260.0) * uRespira * 0.0065 * pecho;
            p.z += uRespira * 3.5 * pecho * clamp((p.z + 170.0) / 210.0, 0.0, 1.0);
            // El cuello se dobla con la cabeza (arriba entero, abajo nada).
            float wc = 1.0 - smoothstep(560.0, 648.0, aPy);
            p = mix(p, uCabeza * (p - uPiv) + uPiv, wc);
            // El torso gira desde la cadera; los hombros, del todo.
            float wt = 1.0 - smoothstep(700.0, 1180.0, aPy);
            p = mix(p, uTorso * (p - uCad) + uCad, wt);
            transformed = p;
            // Normal en reposo y girada: la luz cambia con el giro.
            vec3 n0 = normalize(normal);
            vec3 n1 = normalize(mix(n0, uCabeza * n0, wc));
            n1 = normalize(mix(n1, uTorso * n1, wt));
            vN0 = n0; vN1 = n1;
            vFoto = vec2(${CUERPO.x0.toFixed(1)} + uv.x * ${(CUERPO.x1 - CUERPO.x0).toFixed(1)}, aPy);
          }`);
      // Al girar, el lado que se aleja de la luz se oscurece un poco.
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uLuz; varying vec3 vN0, vN1; varying vec2 vFoto;
          // Sombra suave de cada mazo de cables sobre la correa del hombro.
          float sombraCable(vec2 c) { vec2 d = (vFoto - c) / vec2(30.0, 20.0); return 1.0 - 0.34 * exp(-dot(d, d)); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            // La foto ya trae su luz: solo se suma la diferencia al girar
            // (el lado que mira a la luz se aclara, el otro se apaga).
            vec3 L = normalize(vec3(-0.45, 0.55, 0.72));
            float rel = dot(normalize(vN1), L) - dot(normalize(vN0), L);
            float luz = clamp(1.0 + rel * 1.1, 0.75, 1.3);
            float sombra = sombraCable(vec2(1022.0, 688.0)) * sombraCable(vec2(1052.0, 684.0))
                         * sombraCable(vec2(1482.0, 700.0)) * sombraCable(vec2(1512.0, 704.0));
            diffuseColor.rgb *= uLuz * luz * sombra;
          }`);
    };
    const malla = new THREE.Mesh(geo, mat);
    malla.frustumCulled = false;
    malla.renderOrder = 2;
    figura.dentro.add(malla);
    // La profundidad del cuerpo, para clavar los cables en las correas.
    profundidad = (x, y) => prof((x - CUERPO.x0) / (CUERPO.x1 - CUERPO.x0), (y - CUERPO.y0) / (CUERPO.y1 - CUERPO.y0));
  }

  /* ── Televisor ── */
  const lienzoTex = (w, h, pintar) => { const c = document.createElement('canvas'); c.width = w; c.height = h; pintar(c.getContext('2d'), w, h); return c; };
  // Metal gastado del marco: cepillado fino, alguna marca de uso y motas
  // muy suaves (como el de la foto), nada de manchas.
  const desgaste = lienzoTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#958b86'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {   // cepillado
      const y = Math.random() * h, v = Math.random() < 0.5 ? 255 : 0;
      c.fillStyle = `rgba(${v},${v},${v},${0.018 + Math.random() * 0.03})`;
      c.fillRect(Math.random() * w - 200, y, 120 + Math.random() * 420, 0.7 + Math.random() * 0.8);
    }
    for (let i = 0; i < 14000; i++) { const v = Math.random() < 0.5 ? 70 : 205; c.fillStyle = `rgba(${v},${v - 8},${v - 12},${0.04 + Math.random() * 0.08})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    for (let i = 0; i < 60; i++) {     // roces
      const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 60;
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(70,58,52,${0.05 + Math.random() * 0.06})`); g.addColorStop(1, 'rgba(70,58,52,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.lineCap = 'round';
    for (let i = 0; i < 70; i++) { const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 6.28, l = 4 + Math.random() * 18;
      c.strokeStyle = Math.random() < 0.6 ? `rgba(235,228,224,${0.08 + Math.random() * 0.12})` : `rgba(50,42,38,${0.08 + Math.random() * 0.12})`;
      c.lineWidth = 0.5 + Math.random() * 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  });
  const tDesgaste = new THREE.CanvasTexture(desgaste);
  tDesgaste.colorSpace = THREE.SRGBColorSpace; tDesgaste.wrapS = tDesgaste.wrapT = THREE.RepeatWrapping; tDesgaste.repeat.set(1 / 420, 1 / 420);
  tDesgaste.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rugosidad = lienzoTex(256, 256, (c, w, h) => {
    c.fillStyle = '#8a8a8a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const v = 90 + Math.random() * 120 | 0; c.fillStyle = `rgba(${v},${v},${v},0.35)`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1); }
  });
  const tRug = new THREE.CanvasTexture(rugosidad); tRug.wrapS = tRug.wrapT = THREE.RepeatWrapping; tRug.repeat.set(1 / 180, 1 / 180);
  const matMetal = new THREE.MeshStandardMaterial({ map: tDesgaste, color: 0xc4bcb8, metalness: 0.7, roughness: 0.42, roughnessMap: tRug, envMapIntensity: 1.0 });
  const matCarcasa = new THREE.MeshStandardMaterial({ map: tDesgaste, color: 0xaaa19c, metalness: 0.55, roughness: 0.55, roughnessMap: tRug, envMapIntensity: 0.75 });
  const matNegro = new THREE.MeshStandardMaterial({ color: 0x060606, metalness: 0, roughness: 0.5, envMapIntensity: 0.22 });
  const matRanura = new THREE.MeshStandardMaterial({ color: 0x1d1917, metalness: 0.2, roughness: 0.8 });

  const rectRedondo = (x0, y0, x1, y1, r) => {   // en mundo (y hacia arriba)
    const f = new THREE.Shape();
    f.moveTo(x0 + r, y0); f.lineTo(x1 - r, y0); f.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
    f.lineTo(x1, y1 - r); f.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
    f.lineTo(x0 + r, y1); f.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
    f.lineTo(x0, y0 + r); f.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    return f;
  };
  const rectFoto = (R, r) => rectRedondo(R.x0, -R.y1, R.x1, -R.y0, r);
  const W = TV.x1 - TV.x0, H = TV.y1 - TV.y0, cxTV = (TV.x0 + TV.x1) / 2, cyTV = -(TV.y0 + TV.y1) / 2;

  // Marco frontal: una pieza biselada con el hueco del panel.
  {
    const forma = rectFoto({ x0: TV.x0 + 5, x1: TV.x1 - 5, y0: TV.y0 + 5, y1: TV.y1 - 5 }, 38);
    forma.holes.push(rectFoto({ x0: PANEL.x0 - 4, x1: PANEL.x1 + 4, y0: PANEL.y0 - 4, y1: PANEL.y1 + 4 }, 20));
    const geo = new THREE.ExtrudeGeometry(forma, { depth: 16, bevelEnabled: true, bevelThickness: 6, bevelSize: 5, bevelSegments: 5, curveSegments: 18 });
    geo.translate(0, 0, -28);   // frente del bisel en z = 0
    enCabeza(new THREE.Mesh(geo, matMetal));
  }
  // Panel negro, hundido, con el hueco de la pantalla.
  {
    const forma = rectFoto({ x0: PANEL.x0 - 6, x1: PANEL.x1 + 6, y0: PANEL.y0 - 6, y1: PANEL.y1 + 6 }, 22);
    forma.holes.push(rectFoto({ x0: PANTALLA.x0 - 2, x1: PANTALLA.x1 + 2, y0: PANTALLA.y0 - 2, y1: PANTALLA.y1 + 2 }, 34));
    const geo = new THREE.ExtrudeGeometry(forma, { depth: 10, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 3, curveSegments: 18 });
    geo.translate(0, 0, -21);
    enCabeza(new THREE.Mesh(geo, matNegro));
    // Fondo negro detrás de todo el frontal: por los huecos nunca se ve la pared.
    const fondo = new THREE.Mesh(new THREE.PlaneGeometry(W - 20, H - 20), new THREE.MeshBasicMaterial({ color: 0x030303 }));
    fondo.position.set(cxTV, cyTV, -27); enCabeza(fondo);
  }
  // Carcasa: bloque frontal y fondo de tubo que se estrecha hacia atrás.
  {
    const contorno = (w, h, r, n = 28) => {
      const pts = [], hw = w / 2, hh = h / 2;
      const esquinas = [[hw - r, hh - r, 0], [-hw + r, hh - r, Math.PI / 2], [-hw + r, -hh + r, Math.PI], [hw - r, -hh + r, Math.PI * 1.5]];
      for (const [ex, ey, a0] of esquinas) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push([ex + Math.cos(a) * r, ey + Math.sin(a) * r]); }
      return pts;
    };
    const tramo = (est, mat) => {      // est: [{z, w, h, r, dy}]
      const anillos = est.map((e) => contorno(e.w, e.h, e.r));
      const n = anillos[0].length, v = [], uvs = [], idx = [];
      est.forEach((e, k) => {
        let l = 0;
        anillos[k].forEach(([x, y], i) => {
          if (i) { const [px, py] = anillos[k][i - 1]; l += Math.hypot(x - px, y - py); }
          v.push(cxTV + x, cyTV + e.dy + y, e.z); uvs.push(l, e.z);
        });
      });
      for (let k = 0; k < est.length - 1; k++) for (let i = 0; i < n; i++) {
        const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, d = (k + 1) * n + (i + 1) % n;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx); g.computeVertexNormals();
      return enCabeza(new THREE.Mesh(g, mat));
    };
    tramo([{ z: -24, w: W - 12, h: H - 12, r: 36, dy: 0 }, { z: -60, w: W - 10, h: H - 10, r: 36, dy: 0 }, { z: -176, w: W - 14, h: H - 14, r: 38, dy: 0 }, { z: -184, w: W - 30, h: H - 30, r: 40, dy: 0 }], matCarcasa);
    const fin = { z: -455, w: W * 0.6, h: H * 0.6, r: 70, dy: 8 };
    tramo([{ z: -184, w: W - 30, h: H - 30, r: 40, dy: 0 }, { z: -230, w: W * 0.9, h: H * 0.88, r: 52, dy: 2 }, { z: -330, w: W * 0.74, h: H * 0.74, r: 62, dy: 5 }, fin], matCarcasa);
    const tapa = new THREE.Mesh(new THREE.ShapeGeometry(rectRedondo(-fin.w / 2, -fin.h / 2, fin.w / 2, fin.h / 2, fin.r), 12), matCarcasa);
    tapa.rotation.y = Math.PI; tapa.position.set(cxTV, cyTV + fin.dy, fin.z); enCabeza(tapa);
    // Rejillas de ventilación en los laterales y arriba del tubo.
    const ranura = new THREE.BoxGeometry(3, 5.5, 74);
    for (const lado of [-1, 1]) for (let i = 0; i < 10; i++) {
      const r = new THREE.Mesh(ranura, matRanura);
      r.position.set(cxTV + lado * ((W - 10) / 2 - 0.6), -(196 + i * 14), -104);
      enCabeza(r);
    }
    const ranuraArriba = new THREE.BoxGeometry(5, 2, 90);
    for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(ranuraArriba, matRanura); r.position.set(cxTV - 110 + i * 20, cyTV + H * 0.37 + 6, -300); r.rotation.x = -0.35; enCabeza(r); }
  }
  // Piloto: azul en reposo, rojo en llamada.
  const matPiloto = new THREE.MeshBasicMaterial({ color: 0x2f74ff, toneMapped: false });
  let haloPiloto = null;
  {
    const forma = rectRedondo(-9, -2.6, 9, 2.6, 2.6);
    const p = new THREE.Mesh(new THREE.ShapeGeometry(forma, 6), matPiloto);
    p.position.set(1266, -487, -8.5); enCabeza(p);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(46, 22), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lienzoTex(64, 32, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h / 2); g.addColorStop(0, 'rgba(80,140,255,.55)'); g.addColorStop(1, 'rgba(80,140,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); })), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.position.set(1266, -487, -8.3); enCabeza(halo); haloPiloto = halo.material;
  }

  /* ── Pantalla: cristal de tubo abombado con la cara de ditbo ── */
  const pw = PANTALLA.x1 - PANTALLA.x0, ph = PANTALLA.y1 - PANTALLA.y0;
  const pcx = (PANTALLA.x0 + PANTALLA.x1) / 2, pcy = -(PANTALLA.y0 + PANTALLA.y1) / 2;
  const Z_BORDE = -19, ABOMBADO = 9;
  const bombeo = (x, y) => { const u = (x / (pw / 2)), v = (y / (ph / 2)); return Z_BORDE + ABOMBADO * (1 - 0.55 * u * u - 0.55 * v * v); };
  const abombar = (geo, dz = 0) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, bombeo(p.getX(i), p.getY(i)) + dz + p.getZ(i)); p.needsUpdate = true; geo.computeVertexNormals(); return geo; };
  const pantalla = new THREE.Group(); pantalla.position.set(pcx, pcy, 0); enCabeza(pantalla);
  // Fondo de la pantalla: negro con un halo turquesa en el centro.
  const fondoPantalla = lienzoTex(512, 404, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h * 0.47, 8, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, '#0d1918'); g.addColorStop(0.55, '#050a0a'); g.addColorStop(1, '#010202'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const tFondo = new THREE.CanvasTexture(fondoPantalla); tFondo.colorSpace = THREE.SRGBColorSpace;
  const matCristal = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tFondo, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.22 });
  pantalla.add(new THREE.Mesh(abombar(new THREE.PlaneGeometry(pw + 14, ph + 14, 36, 28)), matCristal));

  // La cara: medidas del logo («i» de 6 barras y «o» de 12 segmentos).
  const cara = new THREE.Group(); pantalla.add(cara);
  const ojos = new THREE.Group(); cara.add(ojos);
  const AQUA = new THREE.Color('#5af0d8'), CIAN = new THREE.Color('#35c9f0');
  // Degradado diagonal del logo (arriba-izq → abajo-der) sobre la caja de
  // todo el grupo, como el <linearGradient> del SVG.
  const degradado = (geo, caja, dx = 0, dy = 0) => {
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const t = (((p.getX(i) + dx - caja.x0) / (caja.x1 - caja.x0)) + ((caja.y1 - (p.getY(i) + dy)) / (caja.y1 - caja.y0))) / 2;
      c.copy(AQUA).lerp(CIAN, Math.min(1, Math.max(0, t))); col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  };
  const iw = pw * 0.16, ki = iw / 320, ih = 765 * ki, ow = pw * 0.35, ko = ow / 620;
  const X0 = -(iw + pw * 0.12 + ow) / 2, OX = X0 + iw + pw * 0.12;
  const OC = { x: OX + ow / 2, y: 0 };              // centro de la «o»
  const Z_CARA = 1.2;                               // sobre el cristal
  // Todo lo de la cara va a la altura del punto más alto del cristal: así
  // ningún trozo de brillo queda tapado por la curva del tubo.
  const Z_TOPE = Z_BORDE + ABOMBADO + Z_CARA;
  const sobreCristal = (m, x, y) => { m.position.set(x, y, Z_TOPE); return m; };
  // Brillos: se pintan una vez (desenfoque) y se suman a la imagen.
  const brillo = (w, h, pintar) => {
    const t = new THREE.CanvasTexture(lienzoTex(w, h, pintar)); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  };
  // «i»: seis barras.
  const barras = [];
  {
    const bw = 280 * ki, bh = 91.3 * ki, r = 22 * ki;
    const formaBarra = rectRedondo(-bw / 2, -bh / 2, bw / 2, bh / 2, r);
    const G = 2.2;   // margen del brillo respecto a la barra
    const matBrilloBarra = brillo(256, 160, (c, w, h) => {
      const ew = w / G, eh = ew * bh / bw;
      c.shadowColor = 'rgba(110,250,225,1)'; c.shadowBlur = 26; c.fillStyle = 'rgba(90,240,216,0.55)';
      c.beginPath(); c.roundRect((w - ew) / 2, (h - eh) / 2, ew, eh, eh * 0.24); c.fill();
      c.shadowColor = 'rgba(53,201,240,0.9)'; c.shadowBlur = 52; c.fill();
    });
    const geoBrillo = new THREE.PlaneGeometry(bw * G, bw * G * 160 / 256);
    const x = X0 + 20 * ki + bw / 2, yTop = ih / 2 - 20 * ki - bh / 2;
    const cajaI = { x0: x - bw / 2, x1: x + bw / 2, y0: yTop - 5 * 126.7 * ki - bh / 2, y1: yTop + bh / 2 };
    for (let i = 0; i < 6; i++) {
      const y = yTop - i * 126.7 * ki;
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, toneMapped: false });
      const b = sobreCristal(new THREE.Mesh(degradado(new THREE.ShapeGeometry(formaBarra, 8), cajaI, x, y), mat), x, y);
      const mb = matBrilloBarra.clone();
      const g = sobreCristal(new THREE.Mesh(geoBrillo, mb), x, y); g.position.z -= 0.4;
      ojos.add(g, b);
      barras.push({ mat, mb });
    }
  }
  // «o»: los doce segmentos del símbolo (#tv-o), con su hueco.
  const simbolo = document.getElementById('tv-o');
  {
    const grupo = new THREE.Group();
    const CXo = 685.2, CYo = 362.5;
    const segs = simbolo ? Array.from(simbolo.querySelectorAll('path')) : [];
    const formas = [];
    for (const p of segs) {
      const n = (p.getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number);
      if (n.length < 18) continue;
      const [x1, y1, R, , , , , x2, y2, x3, y3, r, , , , , x4, y4] = n;
      const ang = (x, y) => Math.atan2(-(y - CYo), x - CXo);
      const f = new THREE.Shape();
      f.moveTo(x1 - CXo, -(y1 - CYo));
      f.absarc(0, 0, R, ang(x1, y1), ang(x2, y2), true);
      f.lineTo(x3 - CXo, -(y3 - CYo));
      f.absarc(0, 0, r, ang(x3, y3), ang(x4, y4), false);
      f.closePath();
      formas.push({ f, tenue: p.classList.contains('tv-o-dim') });
    }
    const geos = { claro: [], tenue: [] };
    formas.forEach((x) => geos[x.tenue ? 'tenue' : 'claro'].push(x.f));
    const cajaO = { x0: -297.5, x1: 297.5, y0: -297.5, y1: 297.5 };
    const conDeg = (lista) => { const g = degradado(new THREE.ShapeGeometry(lista, 24), cajaO); g.scale(ko, ko, 1); return g; };
    grupo.add(new THREE.Mesh(conDeg(geos.claro), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
    if (geos.tenue.length) grupo.add(new THREE.Mesh(conDeg(geos.tenue), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.26, toneMapped: false })));
    sobreCristal(grupo, OC.x, OC.y);
    // Brillo del anillo, dibujado con los mismos trazos del logo.
    const lado = 512, esc = lado / 620 / 1.5;
    const mBrilloO = brillo(lado, lado, (c) => {
      c.translate(lado / 2, lado / 2); c.scale(esc, esc); c.translate(-CXo, -CYo);
      for (const p of segs) {
        const ruta = new Path2D(p.getAttribute('d'));
        c.globalAlpha = p.classList.contains('tv-o-dim') ? 0.26 : 1;
        c.shadowColor = 'rgba(110,250,225,1)'; c.shadowBlur = 70; c.fillStyle = 'rgba(90,240,216,0.45)'; c.fill(ruta);
        c.shadowColor = 'rgba(53,201,240,0.8)'; c.shadowBlur = 150; c.fill(ruta);
      }
    });
    const bO = sobreCristal(new THREE.Mesh(new THREE.PlaneGeometry(ow * 1.5, ow * 1.5), mBrilloO), OC.x, OC.y); bO.position.z -= 0.4;
    ojos.add(bO, grupo);
  }
  // Pupila: punto blanco con halo, dentro del hueco de la «o».
  const pr = ow * 0.186 / 2;
  const pupila = new THREE.Group();
  {
    const nucleo = new THREE.Mesh(new THREE.CircleGeometry(pr * 0.7, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(pr * 3.4, pr * 3.4), brillo(128, 128, (c, w) => {
      const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.32, 'rgba(225,255,250,0.55)'); g.addColorStop(0.6, 'rgba(160,250,235,0.12)'); g.addColorStop(1, 'rgba(160,250,235,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, w);
    }));
    halo.position.z = -0.2;
    pupila.add(halo, nucleo);
    sobreCristal(pupila, OC.x, OC.y); pupila.position.z += 0.3;
    ojos.add(pupila);
  }
  // Cristal por encima: reflejo suave y líneas de barrido muy finas.
  {
    const t = new THREE.CanvasTexture(lienzoTex(512, 404, (c, w, h) => {
      c.fillStyle = 'rgba(255,255,255,0.028)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
      const g = c.createLinearGradient(0, 0, w * 0.55, h);
      g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.35, 'rgba(255,255,255,0.025)'); g.addColorStop(0.36, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const v = c.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.62);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = v; c.fillRect(0, 0, w, h);
    }));
    t.colorSpace = THREE.SRGBColorSpace;
    const tapa = new THREE.Mesh(abombar(new THREE.PlaneGeometry(pw + 4, ph + 4, 24, 18), 2.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    tapa.renderOrder = 3;
    pantalla.add(tapa);
  }

  /* ── Conectores y cables ── */
  const matConector = new THREE.MeshStandardMaterial({ color: 0x2a2523, metalness: 0.6, roughness: 0.4 });
  const conectores = [
    ...[0, 1, 2].map((i) => ({ a: P(TV.x0 - 4, 380 + i * 10, -100 - i * 22), b: [1006 + i * 8, 676], lado: -1 })),
    ...[0, 1, 2].map((i) => ({ a: P(1088 + i * 13, TV.y1 - 4, -60 - i * 10), b: [1034 + i * 9, 672], lado: 0 })),
    ...[0, 1, 2].map((i) => ({ a: P(1405 + i * 15, TV.y1 - 4, -60 - i * 10), b: [1466 + i * 9, 688], lado: 0 })),
    ...[0, 1, 2].map((i) => ({ a: P(TV.x1 + 4, 380 + i * 10, -100 - i * 22), b: [1496 + i * 9, 692], lado: 1 })),
  ];
  for (const c of conectores) {
    const caja = new THREE.Mesh(new THREE.BoxGeometry(c.lado ? 10 : 11, c.lado ? 9 : 10, 13), matConector);
    caja.position.copy(c.a).add(new THREE.Vector3(c.lado * -2, c.lado ? 0 : -4, 0));
    enCabeza(caja);
  }
  const matCable = new THREE.MeshPhysicalMaterial({ color: 0x151312, roughness: 0.48, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.7 });
  matCable.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uCabeza, uPiv: { value: PIVOTE } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat3 uCabeza; uniform vec3 uPiv;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n{ float w = pow(1.0 - uv.x, 1.6); objectNormal = normalize(mix(objectNormal, uCabeza * objectNormal, w)); }')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float w = pow(1.0 - uv.x, 1.6); transformed = mix(transformed, uCabeza * (transformed - uPiv) + uPiv, w); }');
  };
  for (const c of conectores) {
    const a = c.a.clone().add(new THREE.Vector3(c.lado * 3, c.lado ? 0 : -9, 0));
    const zb = profundidad(c.b[0], c.b[1]) - 6;
    const b = enFoto(c.b[0], c.b[1], zb);
    const curva = new THREE.CubicBezierCurve3(a,
      new THREE.Vector3(a.x + c.lado * 10, a.y - (c.lado ? 150 : 50), a.z + (c.lado ? 22 : 30)),
      new THREE.Vector3(b.x - c.lado * 10, b.y + 60, b.z + 12), b);
    const malla = new THREE.Mesh(new THREE.TubeGeometry(curva, 40, RAD, 10, false), matCable);
    malla.frustumCulled = false;
    hombros.add(malla);
  }

  /* ── Tamaño ── */
  const ajustar = () => { renderer.setSize(lienzo.clientWidth || 1, lienzo.clientHeight || 1, false); };
  ajustar();
  window.addEventListener('resize', ajustar, { passive: true });

  /* ── Movimiento ── */
  const barrasDom = Array.from(hero.querySelectorAll('.tv-bar'));
  const ojosDom = hero.querySelector('#tv-eyes');
  const eu = new THREE.Euler(0, 0, 0, 'YXZ');
  const m4 = new THREE.Matrix4();
  let visible = true, bucle = 0, tx = 0, ty = 0, ult = 0;
  let fallo = 0;
  const fotograma = (ahora) => {
    bucle = 0;
    if (!visible || document.hidden) return;
    const v = window.ditboVivo || {};
    const t = ahora / 1000, dt = Math.min(0.05, ult ? (ahora - ult) / 1000 : 0.016); ult = ahora;
    const cx = v.cx || 0, cy = v.cy || 0;
    // El cuerpo llega después que la cabeza (más pesado).
    tx += (cx - tx) * Math.min(1, dt * 1.6);
    ty += (cy - ty) * Math.min(1, dt * 1.6);
    const respira = v.respira || 0;
    // Balanceo de pie: el peso pasa de un pie a otro, muy despacio.
    const bx = v.bx || 0, br = v.br || 0;
    figura.g.position.x = SUELO.x + bx * 1.6;
    figura.g.rotation.z = gr(br * 0.55 - tx * 0.5);
    // Torso: gira hacia el puntero desde la cadera, se inclina un poco.
    eu.set(gr(ty * 1.6 + 0.35 * Math.sin(t * 0.41 + 2)), gr(tx * 7 + 0.9 * Math.sin(t * 0.23 + 1)), gr(-tx * 0.8));
    torso.g.rotation.copy(eu);
    torso.g.updateMatrix();
    uTorso.value.setFromMatrix4(m4.makeRotationFromEuler(eu));
    // Hombros: suben al inspirar.
    uRespira.value = respira; uSube.value = respira * 2.8;
    hombros.position.y = uSube.value;
    // Cabeza: mira al puntero (sobre el giro del torso), recta (sin ladearse).
    eu.set(gr(cy * 7.5 + 0.45 * Math.sin(t * 0.37 + 1)), gr(cx * 11 + 0.7 * Math.sin(t * 0.29 + 4)), 0);
    cabeza.g.rotation.copy(eu);
    uCabeza.value.setFromMatrix4(m4.makeRotationFromEuler(eu));
    uLuz.value = 1 - Math.min(0.08, Math.abs(tx) * 0.07);
    // Cara: mirada, pestañeo, voz.
    let parpado = 1;
    if (ojosDom && ojosDom.classList.contains('is-blink')) {
      const tr = getComputedStyle(ojosDom).transform;
      const m = tr && tr.startsWith('matrix(') ? tr.slice(7, -1).split(',').map(Number) : null;
      parpado = m ? Math.max(0.06, m[3]) : 1;
    }
    const lx = v.ex || 0, ly = v.ey || 0, vol = v.vol || 0, esc = 1 + vol * 0.06;
    ojos.position.set(lx * pw * 0.06, -ly * ph * 0.06, 0);
    ojos.scale.set(esc, esc * parpado, 1);
    pupila.position.x = OC.x + lx * pr * 2 * 0.58;
    pupila.position.y = OC.y - ly * pr * 2 * 0.58;
    barrasDom.forEach((b, i) => {
      const on = b.style.opacity === '' || Number(b.style.opacity) > 0.5;
      const o = barras[i]; if (!o) return;
      const objetivo = on ? 1 : 0.26;
      o.mat.opacity += (objetivo - o.mat.opacity) * Math.min(1, dt * 22);
      o.mb.opacity = o.mat.opacity * (0.85 + vol * 0.3);
    });
    const enLlamada = hero.classList.contains('is-call');
    matPiloto.color.set(enLlamada ? 0xff3b3b : 0x2f74ff);
    if (haloPiloto) haloPiloto.color.set(enLlamada ? 0xff6a50 : 0xffffff);
    renderer.render(escena, camara);
    window.ditbo3d = (window.ditbo3d || 0) + 1;
  };
  // Un fallo en un fotograma no para la animación: se avisa y se sigue.
  const reloj = (ahora) => {
    bucle = 0;
    if (!visible || document.hidden) return;
    try { fotograma(ahora); } catch (e) { if (fallo++ < 3) console.error('[portada] fotograma 3D', e); window.ditbo3dError = String(e && e.message || e); }
    bucle = requestAnimationFrame(reloj);
  };
  const despertar = () => { if (!bucle && visible && !document.hidden) { ult = 0; bucle = requestAnimationFrame(reloj); } };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; despertar(); }, { rootMargin: '80px' }).observe(hero);
  }
  document.addEventListener('visibilitychange', despertar);

  renderer.compile(escena, camara);
  renderer.render(escena, camara);
  alListo();
  despertar();
}
