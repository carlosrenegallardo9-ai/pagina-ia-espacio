/* =========================================================
   Planeta Tierra — main.js
   Two independent Three.js scenes:
     1) heroScene   -> planeta explorable con OrbitControls
     2) gameScene   -> minijuego "Destrucción educativa"
   ========================================================= */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---------------------------------------------------------
   Contenido educativo por arma
   --------------------------------------------------------- */
const WEAPON_DATA = {
  laser: {
    label: 'Láser térmico',
    icon: '🔴',
    title: 'Calentamiento global',
    body: 'El aumento sostenido de la temperatura acelera el deshielo de los polos, sube el nivel del mar y altera los patrones climáticos en todo el planeta. Desde 1880, la temperatura media global ya subió más de 1°C.',
    tip: 'Reducir el uso de combustibles fósiles y apostar por energías renovables frena la acumulación de gases de efecto invernadero.'
  },
  rocket: {
    label: 'Impacto / Asteroide',
    icon: '🚀',
    title: 'Destrucción masiva',
    body: 'Un impacto de gran escala —ya sea un asteroide o la actividad humana concentrada, como la minería intensiva o la deforestación masiva— puede borrar ecosistemas enteros en minutos, dejando cráteres que tardan siglos en recuperarse.',
    tip: 'Proteger áreas naturales y regular la extracción de recursos evita daños irreversibles al terreno y a la biodiversidad local.'
  },
  bomb: {
    label: 'Bomba',
    icon: '💣',
    title: 'Guerra y degradación ambiental',
    body: 'Los conflictos armados destruyen suelos, contaminan fuentes de agua y liberan sustancias tóxicas que persisten durante generaciones, además de desplazar a comunidades enteras.',
    tip: 'La cooperación internacional y la inversión en resolución pacífica de conflictos reducen el daño ambiental asociado a la guerra.'
  },
  pollution: {
    label: 'Arma de contaminación',
    icon: '☣️',
    title: 'Gases, smog y plásticos',
    body: 'Los microplásticos y la acidificación del océano afectan a ecosistemas marinos enteros. El smog urbano reduce la calidad del aire que respiran millones de personas cada día.',
    tip: 'Reducir el plástico de un solo uso y filtrar emisiones industriales disminuye la contaminación del aire y del agua.'
  }
};

/* ---------------------------------------------------------
   Utilidades compartidas
   --------------------------------------------------------- */

// Genera una textura terrestre (océanos + continentes + hielo polar) en canvas 2D,
// evitando dependencias de imágenes externas. Devuelve también el canvas para
// poder pintar efectos sobre él más tarde (usado en el minijuego).
function createEarthCanvas(){
  const w = 1024, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, '#0d3b52');
  ocean.addColorStop(0.5, '#125070');
  ocean.addColorStop(1, '#0d3b52');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);

  function landmass(cx, cy, r, tone){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    const pts = 12;
    for(let i = 0; i <= pts; i++){
      const a = (i / pts) * Math.PI * 2;
      const rad = r * (0.65 + Math.random() * 0.6);
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.6);
    }
    ctx.closePath();
    ctx.fillStyle = tone;
    ctx.fill();
    ctx.restore();
  }
  const greenA = '#2f6b3a', greenB = '#3c7d42';
  const clusters = [
    [150, 150, 75], [190, 195, 55], [125, 215, 42],
    [430, 120, 60], [470, 165, 45], [415, 195, 40],
    [520, 265, 65], [560, 305, 46], [500, 325, 52],
    [720, 145, 65], [775, 120, 48], [805, 195, 58],
    [860, 305, 52], [905, 265, 40],
    [260, 335, 48], [300, 305, 42],
    [620, 365, 45], [660, 345, 38]
  ];
  clusters.forEach((p, i) => landmass(p[0], p[1], p[2], i % 2 ? greenA : greenB));

  const iceTop = ctx.createLinearGradient(0, 0, 0, 60);
  iceTop.addColorStop(0, 'rgba(235,240,245,0.9)');
  iceTop.addColorStop(1, 'rgba(235,240,245,0)');
  ctx.fillStyle = iceTop; ctx.fillRect(0, 0, w, 60);
  const iceBot = ctx.createLinearGradient(0, h - 60, 0, h);
  iceBot.addColorStop(0, 'rgba(235,240,245,0)');
  iceBot.addColorStop(1, 'rgba(235,240,245,0.9)');
  ctx.fillStyle = iceBot; ctx.fillRect(0, h - 60, w, 60);

  return { canvas, ctx, width: w, height: h };
}

function createStarfield(scene, count = 1200){
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for(let i = 0; i < count; i++){
    const r = 25 + Math.random() * 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.8 });
  scene.add(new THREE.Points(geo, mat));
}

function createAtmosphere(radius, color = 0x4fa8ff){
  const geo = new THREE.SphereGeometry(radius * 1.045, 64, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) } },
    vertexShader: `
      varying float intensity;
      void main(){
        vec3 vNormal = normalize( normalMatrix * normal );
        vec3 vNormel = normalize( normalMatrix * vec3(0.0,0.0,1.0) );
        intensity = pow( 0.65 - dot(vNormal, vNormel), 2.2 );
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      varying float intensity;
      uniform vec3 glowColor;
      void main(){ gl_FragColor = vec4(glowColor, intensity); }`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true
  });
  return new THREE.Mesh(geo, mat);
}

function setupRenderer(container){
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  return renderer;
}

function resizeToContainer(container, camera, renderer){
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

/* ===========================================================
   1) HERO — planeta explorable con OrbitControls + GLTFLoader
   =========================================================== */
function initHeroScene(){
  const container = document.getElementById('hero-canvas');
  const statusEl = document.getElementById('model-status');
  const toggleBtn = document.getElementById('toggle-model-btn');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 4.6);

  const renderer = setupRenderer(container);
  resizeToContainer(container, camera, renderer);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.8;
  controls.maxDistance = 8;
  controls.enablePan = false;

  createStarfield(scene, 700);
  scene.add(new THREE.AmbientLight(0x25304a, 1.2));
  const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
  sun.position.set(5, 2, 4);
  scene.add(sun);

  // --- Tierra: esfera con textura procedural (fallback garantizado) ---
  const { canvas: earthCanvas } = createEarthCanvas();
  const earthTexture = new THREE.CanvasTexture(earthCanvas);
  const earthGeo = new THREE.SphereGeometry(1.6, 64, 64);
  const earthMat = new THREE.MeshPhongMaterial({ map: earthTexture, shininess: 8 });
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.rotation.z = THREE.MathUtils.degToRad(23.4);
  scene.add(earthMesh);

  const atmosphere = createAtmosphere(1.6);
  scene.add(atmosphere);

  // --- Ejemplo de carga de modelo propio con GLTFLoader ---
  // Sustituye ASSET_PATH por tu propio modelo .glb/.gltf de la Tierra cuando
  // lo tengas listo. El modelo incluido aquí es solo un ejemplo funcional
  // (un planeta genérico) para demostrar el flujo de carga; si falla o no
  // existe, la app ya muestra la esfera con textura como plan por defecto.
  const ASSET_PATH = 'assets/models/example-model.glb';
  const loader = new GLTFLoader();
  let exampleModel = null;
  let showingExample = false;

  toggleBtn.addEventListener('click', () => {
    if(showingExample){
      earthMesh.visible = true;
      atmosphere.visible = true;
      if(exampleModel) exampleModel.visible = false;
      showingExample = false;
      toggleBtn.textContent = 'Cargar modelo de ejemplo (.glb)';
      statusEl.textContent = '';
      return;
    }

    if(exampleModel){
      earthMesh.visible = false;
      atmosphere.visible = false;
      exampleModel.visible = true;
      showingExample = true;
      toggleBtn.textContent = 'Volver a la esfera con textura';
      return;
    }

    statusEl.textContent = 'Cargando modelo .glb…';
    loader.load(
      ASSET_PATH,
      (gltf) => {
        exampleModel = gltf.scene;

        // Autoescala y centra el modelo cargado, ya que sus dimensiones
        // originales son desconocidas de antemano.
        const box = new THREE.Box3().setFromObject(exampleModel);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());
        exampleModel.position.sub(center);
        exampleModel.scale.setScalar(3.2 / size);

        scene.add(exampleModel);
        earthMesh.visible = false;
        atmosphere.visible = false;
        showingExample = true;
        toggleBtn.textContent = 'Volver a la esfera con textura';
        statusEl.textContent = 'Modelo de ejemplo cargado vía GLTFLoader (sustitúyelo por tu Tierra .glb).';
      },
      undefined,
      (error) => {
        console.warn('GLTFLoader: no se pudo cargar el modelo de ejemplo, se mantiene la esfera con textura.', error);
        statusEl.textContent = 'No se pudo cargar el modelo .glb — mostrando esfera con textura.';
      }
    );
  });

  function animate(){
    requestAnimationFrame(animate);
    earthMesh.rotation.y += 0.0015;
    if(exampleModel && showingExample) exampleModel.rotation.y += 0.0015;
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => resizeToContainer(container, camera, renderer));
}

/* ===========================================================
   2) MINIJUEGO — "Destrucción educativa"
   =========================================================== */
function initGameScene(){
  const container = document.getElementById('game-canvas');
  const weaponButtons = document.querySelectorAll('.weapon-btn');
  const weaponStatus = document.getElementById('weapon-status');
  const damageCounter = document.getElementById('damage-counter');
  const restoreBtn = document.getElementById('restore-btn');
  const eduModal = document.getElementById('edu-modal');
  const restoreModal = document.getElementById('restore-modal');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  const renderer = setupRenderer(container);
  resizeToContainer(container, camera, renderer);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.6;
  controls.maxDistance = 7;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;

  createStarfield(scene, 500);
  scene.add(new THREE.AmbientLight(0x25304a, 1.2));
  const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
  sun.position.set(5, 2, 4);
  scene.add(sun);

  // Textura mutable: los impactos se pintan directamente sobre este canvas.
  const { canvas: earthCanvas, ctx: earthCtx, width: texW, height: texH } = createEarthCanvas();
  const pristineImage = earthCtx.getImageData(0, 0, texW, texH);
  const earthTexture = new THREE.CanvasTexture(earthCanvas);

  const RADIUS = 1.6;
  const earthGeo = new THREE.SphereGeometry(RADIUS, 96, 96);
  const originalPositions = earthGeo.attributes.position.array.slice();
  const earthMat = new THREE.MeshPhongMaterial({ map: earthTexture, shininess: 8 });
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  scene.add(earthMesh);

  const atmosphere = createAtmosphere(RADIUS, 0x5aa9a3);
  scene.add(atmosphere);

  // --- estado del daño acumulado ---
  let damageCount = 0;
  const activeEffects = []; // { update(dt), mesh } — partículas / anillos temporales
  let selectedWeapon = null;

  function setWeaponStatus(text){ weaponStatus.textContent = text; }
  function updateDamageCounter(){ damageCounter.textContent = `Daños activos: ${damageCount}`; }

  weaponButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const weapon = btn.dataset.weapon;
      const isSame = selectedWeapon === weapon;
      weaponButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
      selectedWeapon = isSame ? null : weapon;
      if(selectedWeapon){
        btn.setAttribute('aria-pressed', 'true');
        setWeaponStatus(`${WEAPON_DATA[weapon].icon} ${WEAPON_DATA[weapon].label} listo. Haz clic sobre el planeta.`);
      } else {
        setWeaponStatus('Selecciona un arma para comenzar.');
      }
    });
  });

  /* ---------- raycasting: distinguir clic de arrastre de OrbitControls ---------- */
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let pointerDownPos = null;

  container.addEventListener('pointerdown', (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  });

  container.addEventListener('pointerup', (e) => {
    if(!pointerDownPos) return;
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    pointerDownPos = null;
    if(Math.hypot(dx, dy) > 6) return; // fue un arrastre de cámara, no un disparo
    if(!selectedWeapon) return;

    const rect = container.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hit = raycaster.intersectObject(earthMesh)[0];
    if(!hit) return;

    applyWeapon(selectedWeapon, hit.point);
  });

  /* ---------- pintar sobre la textura en la coordenada UV del impacto ---------- */
  function worldPointToUV(worldPoint){
    const local = earthMesh.worldToLocal(worldPoint.clone()).normalize();
    const u = 0.5 + Math.atan2(local.z, -local.x) / (2 * Math.PI);
    const v = 0.5 - Math.asin(local.y) / Math.PI;
    return { u, v };
  }

  function paintDecal(u, v, drawFn){
    const cx = u * texW, cy = v * texH;
    drawFn(earthCtx, cx, cy);
    earthTexture.needsUpdate = true;
  }

  /* ---------- deformación física (cráteres) ---------- */
  function deformSurface(localPoint, strength, radius){
    const pos = earthGeo.attributes.position;
    const p = new THREE.Vector3();
    for(let i = 0; i < pos.count; i++){
      p.fromBufferAttribute(pos, i);
      const d = p.distanceTo(localPoint);
      if(d < radius){
        const falloff = 1 - d / radius;
        const dir = p.clone().normalize();
        p.addScaledVector(dir, -strength * falloff * falloff);
        pos.setXYZ(i, p.x, p.y, p.z);
      }
    }
    pos.needsUpdate = true;
    earthGeo.computeVertexNormals();
  }

  /* ---------- partículas temporales (fuego / humo / smog) ---------- */
  function spawnParticles(originWorld, { color, count = 60, speed = 0.9, size = 0.035, life = 1.2, spread = 0.5 }){
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for(let i = 0; i < count; i++){
      positions[i * 3] = originWorld.x;
      positions[i * 3 + 1] = originWorld.y;
      positions[i * 3 + 2] = originWorld.z;
      const dir = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() - 0.5),
        (Math.random() - 0.5)
      ).normalize().multiplyScalar(speed * (0.4 + Math.random() * spread));
      velocities.push(dir);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 1, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let age = 0;
    const effect = {
      update(dt){
        age += dt;
        const arr = geo.attributes.position.array;
        for(let i = 0; i < count; i++){
          arr[i * 3] += velocities[i].x * dt;
          arr[i * 3 + 1] += velocities[i].y * dt + dt * 0.15; // leve flotación
          arr[i * 3 + 2] += velocities[i].z * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.max(0, 1 - age / life);
        return age >= life;
      },
      dispose(){
        scene.remove(points);
        geo.dispose();
        mat.dispose();
      }
    };
    activeEffects.push(effect);
  }

  function spawnShockRing(originWorld, color){
    const geo = new THREE.RingGeometry(0.02, 0.05, 48);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(originWorld);
    ring.lookAt(camera.position);
    scene.add(ring);

    let age = 0;
    const life = 0.9;
    const effect = {
      update(dt){
        age += dt;
        const s = 1 + (age / life) * 12;
        ring.scale.setScalar(s);
        mat.opacity = Math.max(0, 0.8 * (1 - age / life));
        return age >= life;
      },
      dispose(){ scene.remove(ring); geo.dispose(); mat.dispose(); }
    };
    activeEffects.push(effect);
  }

  /* ---------- efectos por arma (4 distintos, según el enunciado) ---------- */
  function applyWeapon(weapon, worldPoint){
    const { u, v } = worldPointToUV(worldPoint);
    const localPoint = earthMesh.worldToLocal(worldPoint.clone());

    if(weapon === 'laser'){
      paintDecal(u, v, (ctx, cx, cy) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34);
        g.addColorStop(0, 'rgba(255,90,40,0.95)');
        g.addColorStop(0.5, 'rgba(200,40,20,0.55)');
        g.addColorStop(1, 'rgba(200,40,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
      });
      spawnParticles(worldPoint, { color: 0xff6b35, count: 40, speed: 0.5, size: 0.03, life: 1, spread: 0.3 });
    }

    if(weapon === 'rocket'){
      paintDecal(u, v, (ctx, cx, cy) => {
        ctx.fillStyle = 'rgba(30,20,15,0.85)';
        ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
      });
      deformSurface(localPoint, 0.14, 0.55);
      spawnParticles(worldPoint, { color: 0xffb35c, count: 90, speed: 1.4, size: 0.045, life: 1, spread: 0.8 });
      spawnShockRing(worldPoint, 0xff9d4d);
    }

    if(weapon === 'bomb'){
      paintDecal(u, v, (ctx, cx, cy) => {
        ctx.fillStyle = 'rgba(10,10,10,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
      });
      deformSurface(localPoint, 0.09, 0.4);
      spawnParticles(worldPoint, { color: 0x555555, count: 70, speed: 0.6, size: 0.06, life: 1.6, spread: 0.6 });
      spawnShockRing(worldPoint, 0xffffff);
    }

    if(weapon === 'pollution'){
      paintDecal(u, v, (ctx, cx, cy) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
        g.addColorStop(0, 'rgba(90,110,40,0.75)');
        g.addColorStop(1, 'rgba(90,110,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fill();
      });
      spawnParticles(worldPoint, { color: 0x9acd32, count: 55, speed: 0.25, size: 0.05, life: 2, spread: 0.4 });
    }

    damageCount++;
    updateDamageCounter();
    openEduModal(weapon);
  }

  function openEduModal(weapon){
    const data = WEAPON_DATA[weapon];
    document.getElementById('edu-modal-icon').textContent = data.icon;
    document.getElementById('edu-modal-title').textContent = data.title;
    document.getElementById('edu-modal-body').textContent = data.body;
    document.getElementById('edu-modal-tip').textContent = data.tip;
    if(typeof eduModal.showModal === 'function') eduModal.showModal();
  }

  /* ---------- restaurar planeta ---------- */
  restoreBtn.addEventListener('click', () => {
    earthCtx.putImageData(pristineImage, 0, 0);
    earthTexture.needsUpdate = true;

    earthGeo.attributes.position.array.set(originalPositions);
    earthGeo.attributes.position.needsUpdate = true;
    earthGeo.computeVertexNormals();

    activeEffects.splice(0).forEach(e => e.dispose());

    damageCount = 0;
    updateDamageCounter();
    setWeaponStatus('Selecciona un arma para comenzar.');
    selectedWeapon = null;
    weaponButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));

    if(typeof restoreModal.showModal === 'function') restoreModal.showModal();
  });

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    earthMesh.rotation.y += 0.0008;
    controls.update();

    for(let i = activeEffects.length - 1; i >= 0; i--){
      const done = activeEffects[i].update(dt);
      if(done){
        activeEffects[i].dispose();
        activeEffects.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => resizeToContainer(container, camera, renderer));
}

/* ===========================================================
   3) Noticias — placeholder listo para conectar una API real
   =========================================================== */
function initNewsSection(){
  const btn = document.getElementById('load-news-btn');
  const status = document.getElementById('news-status');

  // Deja tu API key aquí (NewsAPI, GNews, etc.) para activar noticias en vivo.
  const NEWS_API_KEY = '';

  async function loadLiveNews(){
    if(!NEWS_API_KEY){
      status.textContent = 'Sin API key configurada — conecta NEWS_API_KEY en js/main.js para activar noticias en vivo.';
      return;
    }
    status.textContent = 'Cargando noticias…';
    try{
      // Ejemplo de integración (ajusta el endpoint según el proveedor elegido):
      // const res = await fetch(`https://gnews.io/api/v4/search?q=medio+ambiente&token=${NEWS_API_KEY}`);
      // const data = await res.json();
      // ...renderizar data.articles en .news-grid...
      status.textContent = 'Integración lista: implementa el renderizado de resultados aquí.';
    } catch(err){
      console.warn('No se pudieron cargar noticias en vivo.', err);
      status.textContent = 'No se pudieron cargar noticias en vivo.';
    }
  }

  btn.addEventListener('click', loadLiveNews);
}

/* ---------------------------------------------------------
   Arranque
   --------------------------------------------------------- */
initHeroScene();
initGameScene();
initNewsSection();
