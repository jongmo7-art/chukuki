// 측우기 (測雨器) 3D 시뮬레이션 — main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PARTS_INFO, TOUR_STEPS, HISTORY_TIMELINE, QUIZ_BANK } from './data.js';

/* ═══════════════════════════════════════════════
   물리 상수 (역사적 치수 기준)
   ═══════════════════════════════════════════════ */
const V = {
  height:    0.305,    // 측우기 높이 30.5 cm (약 1尺)
  outerR:    0.080,    // 외경 반지름 8.0 cm
  innerR:    0.074,    // 내경 반지름 7.4 cm (벽두께 6 mm)
  wallT:     0.006,    // 벽두께
  maxWater:  0.300,    // 최대 수위 30.0 cm
};
const STAND = { w: 0.36, d: 0.36, h: 0.14 };
const RULER = { r: 0.004, len: 0.36 };
const PUN_M = 0.00306;   // 1分 = 3.06 mm (조선 주척 기준)
const RAIN_RATES = { 소우: 2, 보통: 8, 큰비: 25, 폭우: 60 }; // mm/hr

/* ═══════════════════════════════════════════════
   전역 상태
   ═══════════════════════════════════════════════ */
const S = {
  isRaining:       false,
  rainKey:         '보통',
  timeSpeed:       600,
  waterM:          0,       // 현재 수위 (m)
  records:         [],
  showRuler:       true,
  showRain:        true,
  measuring:       false,
  measured:        false,   // 현재 수위 측정됐는지
  shadows:         false,
  highContrast:    false,
  lowPerf:         false,
  selectedPart:    null,
  lastTs:          null,
  date:            new Date(),
};

/* ═══════════════════════════════════════════════
   렌더러 / 씬 / 카메라
   ═══════════════════════════════════════════════ */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2e50);
scene.fog = new THREE.FogExp2(0x1a2e50, 0.35);

const camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / canvas.clientHeight, 0.005, 30);
camera.position.set(0.52, 0.50, 0.52);
const TARGET = new THREE.Vector3(0, V.height * 0.5, 0);
camera.lookAt(TARGET);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET);
controls.minDistance = 0.18;
controls.maxDistance = 2.5;
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.update();

const initCamPos = camera.position.clone();
const initTarget = controls.target.clone();

/* ═══════════════════════════════════════════════
   조명
   ═══════════════════════════════════════════════ */
scene.add(new THREE.AmbientLight(0x8899cc, 1.2));

const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
sun.position.set(2.5, 4, 2);
sun.castShadow = false;
scene.add(sun);

const fillL = new THREE.DirectionalLight(0x6080c0, 0.9);
fillL.position.set(-2, 1, -1.5);
scene.add(fillL);

// 위쪽에서 내려오는 보조 조명 (측우기 상단 밝게)
const topL = new THREE.DirectionalLight(0xddeeff, 1.0);
topL.position.set(0, 5, 0);
scene.add(topL);

const waterGlow = new THREE.PointLight(0x50b0ff, 0, 0.5);
waterGlow.position.set(0, 0.05, 0);
scene.add(waterGlow);

// 비올 때 하늘 어두워지는 효과용 ambient
const rainAmbient = new THREE.AmbientLight(0x405060, 0);
scene.add(rainAmbient);

/* ═══════════════════════════════════════════════
   재질
   ═══════════════════════════════════════════════ */
const mats = {
  bronzeOuter: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.88, roughness: 0.22 }),
  bronzeInner: new THREE.MeshStandardMaterial({ color: 0x7a4f22, metalness: 0.7, roughness: 0.45, side: THREE.BackSide }),
  bronzeRim:   new THREE.MeshStandardMaterial({ color: 0xd4a050, metalness: 0.92, roughness: 0.12 }),
  bronzeBase:  new THREE.MeshStandardMaterial({ color: 0x9a6228, metalness: 0.80, roughness: 0.38 }),
  graniteBody: new THREE.MeshStandardMaterial({ color: 0x7e7e70, metalness: 0, roughness: 0.88 }),
  graniteTop:  new THREE.MeshStandardMaterial({ color: 0x999990, metalness: 0, roughness: 0.78 }),
  granite2:    new THREE.MeshStandardMaterial({ color: 0x686860, metalness: 0, roughness: 0.92 }),
  bamboo:      new THREE.MeshStandardMaterial({ color: 0x9aad38, metalness: 0, roughness: 0.72 }),
  bambooMark:  new THREE.MeshStandardMaterial({ color: 0x705528, metalness: 0, roughness: 0.80 }),
  water:       new THREE.MeshStandardMaterial({ color: 0x1a6dc8, transparent: true, opacity: 0.82, roughness: 0.04, metalness: 0.08 }),
  waterSurf:   new THREE.MeshStandardMaterial({ color: 0x60b8f8, transparent: true, opacity: 0.55, roughness: 0.0,  metalness: 0.0 }),
  ground:      new THREE.MeshStandardMaterial({ color: 0x2a3448, metalness: 0, roughness: 1.0 }),
  stone2:      new THREE.MeshStandardMaterial({ color: 0x3a4258, metalness: 0, roughness: 0.95 }),
  rain:        new THREE.LineBasicMaterial({ color: 0x7ab8e8, transparent: true, opacity: 0.45 }),
  ripple:      new THREE.MeshBasicMaterial({ color: 0x8ac8f0, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
};

/* ═══════════════════════════════════════════════
   바닥 / 환경
   ═══════════════════════════════════════════════ */
function buildEnvironment() {
  // 좌표 기준: 측우대 상단 (= 측우기 바닥) = world y=0
  // 지면 = y = -(STAND.h + 여유)
  const FLOOR_Y = -(STAND.h + 0.015);

  // 지면
  const groundGeo = new THREE.PlaneGeometry(6, 6);
  const ground = new THREE.Mesh(groundGeo, mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y;
  ground.receiveShadow = true;
  scene.add(ground);

  // 석조 바닥 (전통 마당 느낌 — 격자 판석)
  const tileGeo = new THREE.BoxGeometry(2.0, 0.03, 2.0);
  const tile = new THREE.Mesh(tileGeo, mats.stone2);
  tile.position.y = FLOOR_Y + 0.01;
  scene.add(tile);

  // 판석 틈 선 (격자)
  const lineMatGrid = new THREE.LineBasicMaterial({ color: 0x383e46, transparent: true, opacity: 0.6 });
  const GRID_Y = FLOOR_Y + 0.018;
  for (let i = -4; i <= 4; i++) {
    const g1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.0, GRID_Y, i * 0.25),
      new THREE.Vector3( 1.0, GRID_Y, i * 0.25)
    ]);
    scene.add(new THREE.Line(g1, lineMatGrid));
    const g2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(i * 0.25, GRID_Y, -1.0),
      new THREE.Vector3(i * 0.25, GRID_Y,  1.0)
    ]);
    scene.add(new THREE.Line(g2, lineMatGrid));
  }
}

/* ═══════════════════════════════════════════════
   측우대 (測雨臺) — 화강석 받침
   ═══════════════════════════════════════════════ */
let standMesh;
function buildStand() {
  const group = new THREE.Group();
  // 좌표 기준: 측우대 상단 = y=0, 하단 = y=-STAND.h
  const TOP_Y = 0;      // 상단 (= 측우기 바닥)
  const BOT_Y = -STAND.h; // 하단

  // 주 몸체 (y: BOT_Y ~ TOP_Y)
  const bodyGeo = new THREE.BoxGeometry(STAND.w, STAND.h, STAND.d);
  const body = new THREE.Mesh(bodyGeo, mats.graniteBody);
  body.position.y = (TOP_Y + BOT_Y) / 2; // = -STAND.h/2
  body.userData.part = 'stand';
  group.add(body);

  // 상단 덮개 — 얇은 판, y: -0.02 ~ 0
  const topGeo = new THREE.BoxGeometry(STAND.w + 0.022, 0.022, STAND.d + 0.022);
  const topMesh = new THREE.Mesh(topGeo, mats.graniteTop);
  topMesh.position.y = -0.011; // 중심 at -0.011 → -0.022 ~ 0
  topMesh.userData.part = 'stand';
  group.add(topMesh);

  // 하단 기초석 — BOT_Y 아래로 살짝 돌출
  const baseGeo = new THREE.BoxGeometry(STAND.w + 0.04, 0.04, STAND.d + 0.04);
  const baseMesh = new THREE.Mesh(baseGeo, mats.granite2);
  baseMesh.position.y = BOT_Y - 0.02; // = -STAND.h-0.02
  baseMesh.userData.part = 'stand';
  group.add(baseMesh);

  // 음각 장식 선 (측우대 옆면 수평 홈)
  for (let i = 0; i < 2; i++) {
    const gGeo = new THREE.BoxGeometry(STAND.w + 0.001, 0.003, STAND.d + 0.001);
    const gMesh = new THREE.Mesh(gGeo, mats.granite2);
    gMesh.position.y = BOT_Y + STAND.h * (0.25 + i * 0.5);
    group.add(gMesh);
  }

  standMesh = body;
  scene.add(group);
  return group;
}

/* ═══════════════════════════════════════════════
   측우기 (測雨器) — 청동 원통
   ═══════════════════════════════════════════════ */
let vesselGroup, waterMesh, waterSurfMesh, rippleMeshes = [];
function buildVessel() {
  vesselGroup = new THREE.Group();
  vesselGroup.position.y = 0; // 측우기 바닥 기준 Y=0

  const SEG = 64; // 원의 분할 수 (높을수록 부드럽지만 성능 저하)

  // ── 외벽 (open-ended cylinder) ──
  const outerGeo = new THREE.CylinderGeometry(V.outerR, V.outerR, V.height, SEG, 1, true);
  const outerMesh = new THREE.Mesh(outerGeo, mats.bronzeOuter);
  outerMesh.position.y = V.height / 2;
  outerMesh.userData.part = 'vessel';
  vesselGroup.add(outerMesh);

  // ── 내벽 (법선 반전 — 위에서 내려다볼 때 안쪽 보임) ──
  const innerGeo = new THREE.CylinderGeometry(V.innerR, V.innerR, V.height, SEG, 1, true);
  const innerMesh = new THREE.Mesh(innerGeo, mats.bronzeInner);
  innerMesh.position.y = V.height / 2;
  vesselGroup.add(innerMesh);

  // ── 바닥 ──
  const bottomGeo = new THREE.CircleGeometry(V.outerR, SEG);
  const bottomMesh = new THREE.Mesh(bottomGeo, mats.bronzeBase);
  bottomMesh.rotation.x = -Math.PI / 2;
  bottomMesh.position.y = 0.001;
  bottomMesh.userData.part = 'vessel';
  vesselGroup.add(bottomMesh);

  // ── 상단 테두리 (구연부) — 납작한 링 ──
  const rimGeo = new THREE.TorusGeometry((V.outerR + V.innerR) * 0.5, V.wallT * 0.55, 8, SEG);
  const rimMesh = new THREE.Mesh(rimGeo, mats.bronzeRim);
  rimMesh.position.y = V.height;
  rimMesh.rotation.x = Math.PI / 2; // 눕히기
  rimMesh.userData.part = 'rim';
  vesselGroup.add(rimMesh);

  // ── 외벽 눈금 선 (촌 단위 — 약 3 cm 간격) ──
  const punchMat = new THREE.MeshStandardMaterial({ color: 0x7a4010, metalness: 0.6, roughness: 0.5 });
  const tickCount = Math.floor(V.height / (PUN_M * 10)); // 1촌마다
  for (let i = 1; i <= tickCount; i++) {
    const y = i * PUN_M * 10;
    if (y >= V.height) break;
    const tickGeo = new THREE.TorusGeometry(V.outerR + 0.001, 0.0008, 4, SEG);
    const tickMesh = new THREE.Mesh(tickGeo, punchMat);
    tickMesh.rotation.x = Math.PI / 2;
    tickMesh.position.y = y;
    vesselGroup.add(tickMesh);
  }

  // ── 물 (내부 채움) ──
  const waterGeo = new THREE.CylinderGeometry(V.innerR - 0.001, V.innerR - 0.001, V.height, SEG);
  waterMesh = new THREE.Mesh(waterGeo, mats.water);
  waterMesh.position.y = 0;
  waterMesh.scale.y = 0.0001;
  vesselGroup.add(waterMesh);

  // ── 물 표면 ──
  const surfGeo = new THREE.CircleGeometry(V.innerR - 0.002, SEG);
  waterSurfMesh = new THREE.Mesh(surfGeo, mats.waterSurf);
  waterSurfMesh.rotation.x = -Math.PI / 2;
  waterSurfMesh.position.y = 0.001;
  waterSurfMesh.visible = false;
  vesselGroup.add(waterSurfMesh);

  // ── 파문 (ripple) — 물 표면: scale로 확장하는 링 ──
  const RIPPLE_LIFETIME = 1.1;
  for (let i = 0; i < 4; i++) {
    const ripGeo = new THREE.RingGeometry(V.innerR * 0.06, V.innerR * 0.12, 32);
    const ripMat = mats.ripple.clone();
    const rip = new THREE.Mesh(ripGeo, ripMat);
    rip.rotation.x = -Math.PI / 2;
    rip.visible = false;
    // 각 파문을 시간차로 시작시키기
    rip.userData = { t: (i / 4) * RIPPLE_LIFETIME, lifetime: RIPPLE_LIFETIME };
    vesselGroup.add(rip);
    rippleMeshes.push(rip);
  }

  scene.add(vesselGroup);
  return vesselGroup;
}

/* ═══════════════════════════════════════════════
   측우침 (測雨針) — 대나무 눈금자
   ═══════════════════════════════════════════════ */
let rulerGroup, rulerMeasureTarget = 0;
function buildRuler() {
  rulerGroup = new THREE.Group();

  // 대나무 몸체 (8각형으로 대나무 느낌)
  const rodGeo = new THREE.CylinderGeometry(RULER.r, RULER.r * 1.1, RULER.len, 8);
  const rod = new THREE.Mesh(rodGeo, mats.bamboo);
  rod.userData.part = 'ruler';
  rulerGroup.add(rod);

  // 눈금 마디 (촌 간격)
  const nodeCount = Math.floor(RULER.len / (PUN_M * 10));
  for (let i = 1; i <= nodeCount; i++) {
    const ny = -RULER.len / 2 + i * PUN_M * 10;
    const nodeGeo = new THREE.CylinderGeometry(RULER.r * 1.35, RULER.r * 1.35, 0.004, 8);
    const node = new THREE.Mesh(nodeGeo, mats.bambooMark);
    node.position.y = ny;
    node.userData.part = 'ruler';
    rulerGroup.add(node);
  }

  // 분 단위 작은 눈금 (5분마다)
  for (let i = 1; i <= Math.floor(RULER.len / (PUN_M * 5)); i++) {
    const ny = -RULER.len / 2 + i * PUN_M * 5;
    const sGeo = new THREE.CylinderGeometry(RULER.r * 1.18, RULER.r * 1.18, 0.002, 8);
    const s = new THREE.Mesh(sGeo, mats.bambooMark);
    s.position.y = ny;
    rulerGroup.add(s);
  }

  // 측우침 끝 뾰족 (금속 촉)
  const tipGeo = new THREE.ConeGeometry(RULER.r * 0.9, 0.015, 8);
  const tip = new THREE.Mesh(tipGeo, mats.bronzeRim);
  tip.position.y = -RULER.len / 2 - 0.008;
  tip.rotation.x = Math.PI; // 아래로
  rulerGroup.add(tip);

  // 측우침 위쪽 손잡이 링
  const handleGeo = new THREE.TorusGeometry(RULER.r * 2.5, RULER.r * 0.7, 6, 16);
  const handle = new THREE.Mesh(handleGeo, mats.bronzeRim);
  handle.position.y = RULER.len / 2 + 0.008;
  handle.rotation.x = Math.PI / 2;
  rulerGroup.add(handle);

  // 초기 위치: 측우기 오른쪽에 세워둠 (받침대 위에 서 있도록 bottom=y=0)
  rulerGroup.position.set(V.outerR + 0.065, RULER.len / 2, 0);
  rulerGroup.rotation.z = 0.07; // 살짝 기울기

  scene.add(rulerGroup);
  return rulerGroup;
}

/* ═══════════════════════════════════════════════
   빗줄기 (雨) 파티클 시스템
   ═══════════════════════════════════════════════ */
let rainLines, rainPositions;
const RAIN_COUNT   = 1400;
const RAIN_AREA    = 2.4;
const RAIN_TOP_Y   = 1.8;
const RAIN_BOTTOM  = -(STAND.h + 0.2);
const BASE_SPEED   = 3.5; // m/s

// 강도별 파라미터
const RAIN_PARAMS = {
  소우: { streak: 0.032, wind: 0.008, opacity: 0.30, speed: 0.80 },
  보통: { streak: 0.052, wind: 0.018, opacity: 0.42, speed: 1.00 },
  큰비: { streak: 0.075, wind: 0.035, opacity: 0.55, speed: 1.25 },
  폭우: { streak: 0.110, wind: 0.060, opacity: 0.70, speed: 1.55 },
};

function buildRain() {
  rainPositions = new Float32Array(RAIN_COUNT * 6);
  for (let i = 0; i < RAIN_COUNT; i++) _resetRainDrop(i, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainLines = new THREE.LineSegments(geo, mats.rain);
  rainLines.visible = false;
  scene.add(rainLines);
}

function _resetRainDrop(i, randomY = false) {
  const p = RAIN_PARAMS[S.rainKey];
  const x = (Math.random() - 0.5) * RAIN_AREA;
  const z = (Math.random() - 0.5) * RAIN_AREA;
  const y = randomY
    ? Math.random() * (RAIN_TOP_Y - RAIN_BOTTOM) + RAIN_BOTTOM
    : RAIN_TOP_Y + Math.random() * 0.3;
  const wx = p.wind, wz = p.wind * 0.4;
  rainPositions[i*6+0] = x;
  rainPositions[i*6+1] = y;
  rainPositions[i*6+2] = z;
  rainPositions[i*6+3] = x - wx;
  rainPositions[i*6+4] = y - p.streak;
  rainPositions[i*6+5] = z - wz;
}

function updateRain(dt) {
  if (!S.isRaining || !S.showRain) { rainLines.visible = false; return; }
  rainLines.visible = true;

  const p = RAIN_PARAMS[S.rainKey];
  const intensity = RAIN_RATES[S.rainKey] / 60;
  const visCount = Math.floor(160 + intensity * (RAIN_COUNT - 160));
  const speed = BASE_SPEED * p.speed;

  mats.rain.opacity = p.opacity;

  for (let i = 0; i < RAIN_COUNT; i++) {
    if (i >= visCount) {
      rainPositions[i*6+1] = -100; rainPositions[i*6+4] = -100; continue;
    }
    rainPositions[i*6+1] -= speed * dt;
    rainPositions[i*6+4] -= speed * dt;
    if (rainPositions[i*6+1] < RAIN_BOTTOM) _resetRainDrop(i, false);
  }
  rainLines.geometry.attributes.position.needsUpdate = true;
}

/* ═══════════════════════════════════════════════
   빗방울 튀김 (splash) — 측우기 내부 + 바닥
   ═══════════════════════════════════════════════ */
const SPLASH_COUNT  = 80;   // 내부 splash 파티클
const GSPLASH_COUNT = 12;   // 바닥 ring splash

let splashGeo, splashPos, splashVel, splashLife;
let groundSplashRings = [];  // { mesh, t, maxT }

function buildSplashes() {
  // ── 내부 splash 포인트 ──
  splashPos  = new Float32Array(SPLASH_COUNT * 3);
  splashVel  = new Float32Array(SPLASH_COUNT * 3);
  splashLife = new Float32Array(SPLASH_COUNT);
  for (let i = 0; i < SPLASH_COUNT; i++) {
    splashPos[i*3+1] = -10; // 숨김
    splashLife[i] = 0;
  }
  splashGeo = new THREE.BufferGeometry();
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
  const splashMat = new THREE.PointsMaterial({
    color: 0xb0d8ff, size: 0.005, transparent: true, opacity: 0.85, sizeAttenuation: true,
  });
  const splashPts = new THREE.Points(splashGeo, splashMat);
  vesselGroup.add(splashPts); // vesselGroup 로컬 좌표 사용

  // ── 바닥 ring splash ──
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x8ab8d8, transparent: true, opacity: 0, side: THREE.DoubleSide,
  });
  const FLOOR_Y = -(STAND.h + 0.012);
  for (let i = 0; i < GSPLASH_COUNT; i++) {
    const geo = new THREE.RingGeometry(0.001, 0.004, 20);
    const mat = ringMat.clone();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    const rx = (Math.random() - 0.5) * 1.2;
    const rz = (Math.random() - 0.5) * 1.2;
    mesh.position.set(rx, FLOOR_Y, rz);
    mesh.visible = false;
    scene.add(mesh);
    groundSplashRings.push({ mesh, t: (i / GSPLASH_COUNT) * 1.5, maxT: 0.8 + Math.random() * 0.4 });
  }
}

function updateSplashes(dt) {
  const active = S.isRaining && S.waterM > 0.002;
  const intensity = RAIN_RATES[S.rainKey] / 60;
  const G = -3.0; // 중력 (m/s²)

  // ── 내부 splash ──
  const spawnRate = active ? intensity * 35 : 0;
  let toSpawn = Math.floor(spawnRate * dt + Math.random() * 0.5);

  for (let i = 0; i < SPLASH_COUNT; i++) {
    if (splashLife[i] > 0) {
      splashLife[i] -= dt;
      splashPos[i*3]   += splashVel[i*3]   * dt;
      splashPos[i*3+1] += splashVel[i*3+1] * dt + 0.5 * G * dt * dt;
      splashPos[i*3+2] += splashVel[i*3+2] * dt;
      splashVel[i*3+1] += G * dt;
      // 수위 아래로 내려가면 제거
      if (splashLife[i] <= 0 || splashPos[i*3+1] < S.waterM - 0.003) {
        splashLife[i] = 0; splashPos[i*3+1] = -10;
      }
    } else if (toSpawn > 0) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * (V.innerR - 0.008);
      splashPos[i*3]   = Math.cos(angle) * r;
      splashPos[i*3+1] = S.waterM + 0.001;
      splashPos[i*3+2] = Math.sin(angle) * r;
      const upV = 0.06 + intensity * 0.14 + Math.random() * 0.06;
      splashVel[i*3]   = (Math.random() - 0.5) * 0.12;
      splashVel[i*3+1] = upV;
      splashVel[i*3+2] = (Math.random() - 0.5) * 0.12;
      splashLife[i] = 0.18 + Math.random() * 0.18;
      toSpawn--;
    }
  }
  splashGeo.attributes.position.needsUpdate = true;

  // ── 바닥 ring splash ──
  const groundActive = S.isRaining && S.showRain;
  const ringSpeed = 0.6 + intensity * 0.8;
  const FLOOR_Y = -(STAND.h + 0.012);
  groundSplashRings.forEach(gs => {
    if (!groundActive) { gs.mesh.visible = false; return; }
    gs.t += dt * ringSpeed;
    if (gs.t >= gs.maxT) {
      // 재시작: 새 랜덤 위치
      gs.t = 0;
      gs.maxT = 0.6 + Math.random() * 0.5;
      const rx = (Math.random() - 0.5) * 1.4;
      const rz = (Math.random() - 0.5) * 1.4;
      gs.mesh.position.set(rx, FLOOR_Y, rz);
    }
    const p = gs.t / gs.maxT;      // 0→1
    const maxR = 0.025 + intensity * 0.025;
    const s = 0.1 + p * maxR / 0.004; // scale to reach maxR (ring geo outer=0.004)
    gs.mesh.scale.set(s, s, 1);
    gs.mesh.material.opacity = (1 - p) * (0.4 + intensity * 0.3);
    gs.mesh.visible = true;
  });
}

/* ═══════════════════════════════════════════════
   수위 업데이트
   ═══════════════════════════════════════════════ */
function updateWater(dt) {
  if (S.isRaining) {
    const rateMs = (RAIN_RATES[S.rainKey] / 1000) / 3600; // m/s
    S.waterM = Math.min(V.maxWater, S.waterM + rateMs * S.timeSpeed * dt);
  }

  const frac = S.waterM / V.height;
  if (frac < 0.0001) {
    waterMesh.scale.y = 0.0001;
    waterMesh.position.y = 0;
    waterSurfMesh.visible = false;
    waterGlow.intensity = 0;
  } else {
    waterMesh.scale.y = (S.waterM / V.height);
    waterMesh.position.y = S.waterM / 2;
    waterSurfMesh.position.y = S.waterM + 0.001;
    waterSurfMesh.visible = true;
    waterGlow.intensity = Math.min(0.6, frac * 1.2);
    waterGlow.position.y = S.waterM * 0.5;
  }
  updateMeasureDisplay();
}

/* ═══════════════════════════════════════════════
   파문 (ripple) 업데이트
   ═══════════════════════════════════════════════ */
function updateRipples(dt) {
  const active = S.isRaining && S.waterM > 0.003;
  const intensity = RAIN_RATES[S.rainKey] / 60;
  // 폭우일수록 빠르고 많은 파문
  const speedMult = 0.6 + intensity * 1.4;
  const maxScale = (V.innerR - 0.004) / (V.innerR * 0.09);
  const baseOpacity = 0.4 + intensity * 0.35;

  rippleMeshes.forEach(r => {
    if (!active) { r.visible = false; return; }
    r.userData.t = (r.userData.t + dt * speedMult) % r.userData.lifetime;
    const progress = r.userData.t / r.userData.lifetime;
    const s = 0.05 + progress * maxScale;
    r.scale.set(s, s, 1);
    r.material.opacity = (1 - progress) * baseOpacity;
    r.material.color.setHSL(0.58, 0.7, 0.55 + intensity * 0.15); // 강도별 색상
    r.position.y = S.waterM + 0.0015;
    r.visible = true;
  });
}

/* ═══════════════════════════════════════════════
   대기 효과 (비 올 때 어두워짐 + 안개 진해짐)
   ═══════════════════════════════════════════════ */
function updateAtmosphere() {
  const t = S.isRaining ? 1 : 0;
  rainAmbient.intensity = THREE.MathUtils.lerp(rainAmbient.intensity, t * 0.25, 0.04);
  sun.intensity = THREE.MathUtils.lerp(sun.intensity, S.isRaining ? 1.2 : 2.2, 0.04);
  const fogDensity = S.isRaining ? (0.35 + RAIN_RATES[S.rainKey] / 60 * 0.4) : 0.35;
  scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, fogDensity, 0.04);
  const bgTarget = S.isRaining ? new THREE.Color(0x121e38) : new THREE.Color(0x1a2e50);
  scene.background.lerp(bgTarget, 0.04);
}

/* ═══════════════════════════════════════════════
   측우침 측정 애니메이션
   ═══════════════════════════════════════════════ */
let measureAnim = null;
function startMeasureAnim() {
  if (S.measuring) return;
  S.measuring = true;

  const startX = rulerGroup.position.x;
  const startZ = rulerGroup.position.z;
  const startY = rulerGroup.position.y;
  const startRZ = rulerGroup.rotation.z;

  // 목표: 측우기 위쪽에서 내려 삽입, 바닥에 닿도록
  const targetX = 0, targetZ = 0;
  const targetY_top = V.height + RULER.len / 2 + 0.08; // 삽입 전 대기 위치
  const targetY_insert = RULER.len / 2;                 // 측우침 바닥 = 측우기 바닥(y=0)

  let phase = 0; // 0=이동 1=삽입 2=읽기 3=복귀
  let phaseT = 0;

  measureAnim = {
    update(dt) {
      phaseT += dt;
      if (phase === 0) {
        // 위로 들기 & 중앙으로 이동
        const p = Math.min(1, phaseT / 0.6);
        const ep = easeInOut(p);
        rulerGroup.position.x = THREE.MathUtils.lerp(startX, targetX, ep);
        rulerGroup.position.z = THREE.MathUtils.lerp(startZ, targetZ, ep);
        rulerGroup.position.y = THREE.MathUtils.lerp(startY, targetY_top, ep);
        rulerGroup.rotation.z = THREE.MathUtils.lerp(startRZ, 0, ep);
        if (p >= 1) { phase = 1; phaseT = 0; }
      } else if (phase === 1) {
        // 아래로 삽입
        const p = Math.min(1, phaseT / 0.5);
        const ep = easeInOut(p);
        rulerGroup.position.y = THREE.MathUtils.lerp(targetY_top, targetY_insert, ep);
        if (p >= 1) {
          phase = 2; phaseT = 0;
          showMeasureResult();
        }
      } else if (phase === 2) {
        // 읽기 유지
        if (phaseT >= 1.8) { phase = 3; phaseT = 0; hideMeasureResult(); }
      } else if (phase === 3) {
        // 복귀: 0~0.35 → 위로 올리기, 0.35~1.0 → 측면으로 이동 (벽 통과 방지)
        const p = Math.min(1, phaseT / 0.9);
        if (p < 0.35) {
          const ep = easeInOut(p / 0.35);
          rulerGroup.position.y = THREE.MathUtils.lerp(targetY_insert, targetY_top, ep);
        } else {
          const ep = easeInOut((p - 0.35) / 0.65);
          rulerGroup.position.y = THREE.MathUtils.lerp(targetY_top, startY, ep);
          rulerGroup.position.x = THREE.MathUtils.lerp(targetX, startX, ep);
          rulerGroup.position.z = THREE.MathUtils.lerp(targetZ, startZ, ep);
          rulerGroup.rotation.z = THREE.MathUtils.lerp(0, startRZ, ep);
        }
        if (p >= 1) { phase = -1; S.measuring = false; measureAnim = null; }
      }
    }
  };
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/* ═══════════════════════════════════════════════
   표시 업데이트
   ═══════════════════════════════════════════════ */
function updateMeasureDisplay() {
  const mm = S.waterM * 1000;
  const totalPun = mm / (PUN_M * 1000);
  const chon = Math.floor(totalPun / 10);
  const pun = Math.floor(totalPun % 10);

  document.getElementById('depth-chon').textContent = chon;
  document.getElementById('depth-pun').textContent = pun;
  document.getElementById('depth-mm').textContent = mm.toFixed(1) + ' mm';

  const fillPct = Math.min(100, (S.waterM / V.maxWater) * 100);
  document.getElementById('depth-fill').style.height = fillPct + '%';

  // HUD 누계 갱신
  const accumEl = document.getElementById('hud-accum');
  if (accumEl) accumEl.textContent = `누계 ${(S.waterM * 1000).toFixed(1)} mm`;

  document.getElementById('btn-record').disabled = (S.waterM < 0.001);
}

function showMeasureResult() {
  const mm = S.waterM * 1000;
  if (mm < 0.1) {
    showOverlay('<h3>측우침 읽기</h3><div class="measure-result">우무(雨無)</div><div class="measure-result-mm">강수량 없음</div>', 2000);
    return;
  }
  const totalPun = mm / (PUN_M * 1000);
  const chon = Math.floor(totalPun / 10);
  const pun = Math.floor(totalPun % 10);
  const li = Math.floor((totalPun - Math.floor(totalPun)) * 10);

  let resultStr = '';
  if (chon > 0) resultStr += `${chon}촌 `;
  resultStr += `${pun}분`;
  if (li > 0) resultStr += ` ${li}리`;

  const recordFmt = `雨深 ${chon > 0 ? chon + '寸 ' : ''}${pun}分`;
  showOverlay(
    `<h3>측우침 읽기 (測雨針)</h3>
     <div class="measure-result">${resultStr}</div>
     <div class="measure-result-mm">${mm.toFixed(1)} mm</div>
     <div class="measure-record-note">기록 형식: <span>${recordFmt}</span></div>`,
    2200
  );
  S.measured = true;
  document.getElementById('btn-record').disabled = false;
}

let overlayTimeout;
function showOverlay(html, duration) {
  let el = document.querySelector('.measure-overlay');
  if (!el) {
    el = document.createElement('div');
    el.className = 'measure-overlay';
    document.querySelector('.stage').appendChild(el);
  }
  el.innerHTML = html;
  el.style.display = 'block';
  clearTimeout(overlayTimeout);
  overlayTimeout = setTimeout(hideMeasureResult, duration);
}

function hideMeasureResult() {
  const el = document.querySelector('.measure-overlay');
  if (el) el.style.display = 'none';
}

/* ═══════════════════════════════════════════════
   기록 남기기
   ═══════════════════════════════════════════════ */
function addRecord() {
  if (S.waterM < 0.001) return;
  const mm = S.waterM * 1000;
  const totalPun = mm / (PUN_M * 1000);
  const chon = Math.floor(totalPun / 10);
  const pun  = Math.floor(totalPun % 10);
  const now  = S.date;

  const dateStr = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;
  const koStr   = chon > 0 ? `우심(雨深) ${chon}촌 ${pun}분` : `우심(雨深) ${pun}분`;

  S.records.unshift({ dateStr, koStr, mm });

  const list = document.getElementById('record-list');
  const empty = list.querySelector('.empty-msg');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'record-item';
  item.innerHTML = `
    <div class="record-time">${dateStr}</div>
    <div class="record-amount">${koStr}</div>
    <div class="record-modern">(${mm.toFixed(1)} mm)</div>
  `;
  list.prepend(item);

  document.getElementById('btn-record').disabled = true;
}

/* ═══════════════════════════════════════════════
   레이캐스팅 — 클릭 시 부속 선택
   ═══════════════════════════════════════════════ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickables = [];

function setupPicking() {
  scene.traverse(obj => {
    if (obj.isMesh && obj.userData.part) clickables.push(obj);
  });

  renderer.domElement.addEventListener('click', e => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickables, true);
    if (hits.length) {
      const part = hits[0].object.userData.part;
      if (part) showPartInfo(part);
    }
  });
}

function showPartInfo(partKey) {
  const data = PARTS_INFO[partKey];
  if (!data) return;
  const panel = document.getElementById('info-panel');
  panel.querySelector('.info-empty').hidden = true;
  const content = panel.querySelector('.info-content');
  content.hidden = false;

  content.querySelector('.part-tag').textContent   = data.tag;
  content.querySelector('.part-name').textContent  = data.name;
  content.querySelector('.part-hanja').textContent = data.hanja;
  content.querySelector('.part-en').textContent    = data.en;
  content.querySelector('.part-material').innerHTML    = `<strong>재료:</strong> ${data.material}`;
  content.querySelector('.part-dimensions').innerHTML  = `<strong>크기:</strong> ${data.dimensions}`;
  content.querySelector('.part-role').textContent  = data.role;
  content.querySelector('.part-desc').textContent  = data.desc;
  content.querySelector('.part-source').textContent = '참고: ' + data.source;
}

/* ═══════════════════════════════════════════════
   UI 이벤트 연결
   ═══════════════════════════════════════════════ */
function setupUI() {
  // 날짜 초기값
  const d = new Date();
  document.getElementById('date-input').value = d.toISOString().slice(0, 10);

  // 비 토글
  document.getElementById('btn-rain-toggle').addEventListener('click', () => {
    S.isRaining = !S.isRaining;
    const btn = document.getElementById('btn-rain-toggle');
    btn.classList.toggle('active', S.isRaining);
    document.getElementById('rain-label').textContent = S.isRaining ? '비 그치기' : '비 내리기';
    document.getElementById('rain-icon').textContent  = S.isRaining ? '⛈' : '🌧';
    document.getElementById('weather-hud').style.display = S.isRaining ? 'flex' : 'none';
    const badge = document.getElementById('rate-badge');
    if (badge) badge.style.display = S.isRaining ? 'flex' : 'none';
    updateRainUI();
  });

  // 강도 버튼
  document.querySelectorAll('.intens-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.intens-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.rainKey = btn.dataset.key;
      updateRainUI();
    });
  });

  // 측우침 측정
  document.getElementById('btn-measure').addEventListener('click', () => {
    if (!S.measuring) startMeasureAnim();
  });

  // 기록
  document.getElementById('btn-record').addEventListener('click', addRecord);

  // 측우기 비우기
  document.getElementById('btn-reset-water').addEventListener('click', () => {
    S.waterM = 0;
    S.measured = false;
    document.getElementById('btn-record').disabled = true;
    updateMeasureDisplay();
  });

  // 정보 패널 닫기
  document.querySelector('.info-close').addEventListener('click', () => {
    document.getElementById('info-panel').querySelector('.info-empty').hidden = false;
    document.getElementById('info-panel').querySelector('.info-content').hidden = true;
  });

  // 시점 초기화
  document.getElementById('btn-reset').addEventListener('click', resetCamera);

  // 속도
  document.getElementById('speed-select').addEventListener('change', e => {
    S.timeSpeed = +e.target.value;
  });

  // 날짜
  document.getElementById('date-input').addEventListener('change', e => {
    S.date = new Date(e.target.value);
  });

  // 체크박스: 측우침 표시
  document.getElementById('chk-ruler').addEventListener('change', e => {
    S.showRuler = e.target.checked;
    rulerGroup.visible = S.showRuler;
  });

  // 체크박스: 빗줄기 표시
  document.getElementById('chk-rain-vis').addEventListener('change', e => {
    S.showRain = e.target.checked;
  });

  // 설정
  document.getElementById('chk-shadows').addEventListener('change', e => {
    S.shadows = e.target.checked;
    renderer.shadowMap.enabled = S.shadows;
    sun.castShadow = S.shadows;
  });
  document.getElementById('chk-highcontrast').addEventListener('change', e => {
    document.body.classList.toggle('high-contrast', e.target.checked);
  });
  document.getElementById('chk-low').addEventListener('change', e => {
    S.lowPerf = e.target.checked;
    renderer.setPixelRatio(S.lowPerf ? 1 : Math.min(window.devicePixelRatio, 2));
  });

  // 오버레이 버튼
  document.getElementById('btn-tour').addEventListener('click', () => startTour());
  document.getElementById('btn-history').addEventListener('click', () => openHistory());
  document.getElementById('btn-quiz').addEventListener('click', () => openQuiz());
  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('settings-overlay').hidden = false;
  });

  // 모달 닫기 버튼들
  document.querySelectorAll('.dialog-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.close;
      document.getElementById(key + '-overlay').hidden = true;
    });
  });

  // 키보드 단축키
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      document.getElementById('btn-rain-toggle').click();
    } else if (e.code === 'KeyM') {
      document.getElementById('btn-measure').click();
    } else if (e.code === 'KeyR') {
      resetCamera();
    } else if (e.code === 'Delete') {
      document.getElementById('btn-reset-water').click();
    }
  });

  // 초기 UI 상태
  updateRainUI();
  document.getElementById('weather-hud').style.display = 'none';
}

function updateRainUI() {
  const rate = RAIN_RATES[S.rainKey];
  const intensity = rate / 60; // 0~1
  document.getElementById('hud-text').textContent = `${S.rainKey} 내리는 중`;
  document.getElementById('hud-rate').textContent = `${rate} mm/h`;
  // 강도 게이지
  const gauge = document.querySelector('.intensity-gauge-fill');
  if (gauge) gauge.style.width = (intensity * 100) + '%';
  // 강수율 배지
  const badge = document.getElementById('rate-badge-val');
  if (badge) badge.textContent = `${rate} mm/h`;
}

function resetCamera() {
  camera.position.copy(initCamPos);
  controls.target.copy(initTarget);
  controls.update();
}

/* ═══════════════════════════════════════════════
   가이드 투어
   ═══════════════════════════════════════════════ */
let tourIdx = 0;
function startTour() {
  tourIdx = 0;
  renderTour();
  document.getElementById('tour-overlay').hidden = false;
}
function renderTour() {
  const step = TOUR_STEPS[tourIdx];
  document.getElementById('tour-title').textContent = step.title;
  document.getElementById('tour-body').textContent  = step.body;
  document.getElementById('tour-prev').disabled = tourIdx === 0;
  document.getElementById('tour-next').textContent = tourIdx === TOUR_STEPS.length - 1 ? '완료' : '다음';
  const dots = document.getElementById('tour-dots');
  dots.innerHTML = TOUR_STEPS.map((_, i) => `<span class="${i === tourIdx ? 'active' : ''}"></span>`).join('');
}
document.getElementById('tour-next').addEventListener('click', () => {
  if (tourIdx < TOUR_STEPS.length - 1) { tourIdx++; renderTour(); }
  else document.getElementById('tour-overlay').hidden = true;
});
document.getElementById('tour-prev').addEventListener('click', () => {
  if (tourIdx > 0) { tourIdx--; renderTour(); }
});
document.getElementById('tour-skip').addEventListener('click', () => {
  document.getElementById('tour-overlay').hidden = true;
});

/* ═══════════════════════════════════════════════
   역사 모달
   ═══════════════════════════════════════════════ */
function openHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  HISTORY_TIMELINE.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<h3 class="${item.highlight ? 'highlight' : ''}">${item.year} — ${item.title}</h3>
      <p>${item.content}</p>`;
    list.appendChild(li);
  });
  document.getElementById('history-overlay').hidden = false;
}

/* ═══════════════════════════════════════════════
   퀴즈
   ═══════════════════════════════════════════════ */
let quizIdx = 0, quizAnswered = false;
function openQuiz() {
  quizIdx = 0;
  quizAnswered = false;
  renderQuiz();
  document.getElementById('quiz-overlay').hidden = false;
}
function renderQuiz() {
  const q = QUIZ_BANK[quizIdx];
  quizAnswered = false;
  document.getElementById('quiz-question').textContent = q.q;
  document.getElementById('quiz-feedback').textContent = '';
  document.getElementById('quiz-feedback').className = 'quiz-feedback';
  document.getElementById('quiz-next').hidden = true;
  document.getElementById('quiz-progress').textContent = `${quizIdx + 1} / ${QUIZ_BANK.length}`;
  const choices = document.getElementById('quiz-choices');
  choices.innerHTML = '';
  q.choices.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-choice';
    btn.textContent = c;
    btn.addEventListener('click', () => {
      if (quizAnswered) return;
      quizAnswered = true;
      choices.querySelectorAll('.quiz-choice').forEach(b => b.disabled = true);
      const fb = document.getElementById('quiz-feedback');
      if (i === q.answer) {
        btn.classList.add('correct');
        fb.textContent = '✓ 정답입니다! ' + q.explain;
        fb.className = 'quiz-feedback ok';
      } else {
        btn.classList.add('wrong');
        choices.querySelectorAll('.quiz-choice')[q.answer].classList.add('correct');
        fb.textContent = '✗ 오답입니다. ' + q.explain;
        fb.className = 'quiz-feedback bad';
      }
      document.getElementById('quiz-next').hidden = false;
    });
    choices.appendChild(btn);
  });
}
document.getElementById('quiz-next').addEventListener('click', () => {
  if (quizIdx < QUIZ_BANK.length - 1) { quizIdx++; renderQuiz(); }
  else {
    document.getElementById('quiz-question').textContent = '퀴즈를 모두 완료했습니다!';
    document.getElementById('quiz-choices').innerHTML = '';
    document.getElementById('quiz-feedback').textContent = '';
    document.getElementById('quiz-next').hidden = true;
    document.getElementById('quiz-progress').textContent = `${QUIZ_BANK.length} / ${QUIZ_BANK.length}`;
  }
});

/* ═══════════════════════════════════════════════
   창 크기 변경
   ═══════════════════════════════════════════════ */
function onResize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);

/* ═══════════════════════════════════════════════
   메인 애니메이션 루프
   ═══════════════════════════════════════════════ */
function animate(ts) {
  requestAnimationFrame(animate);
  const dt = S.lastTs === null ? 0.016 : Math.min((ts - S.lastTs) / 1000, 0.1);
  S.lastTs = ts;

  controls.update();
  updateRain(dt);
  updateWater(dt);
  updateRipples(dt);
  updateSplashes(dt);
  updateAtmosphere();
  if (measureAnim) measureAnim.update(dt);

  renderer.render(scene, camera);
}

/* ═══════════════════════════════════════════════
   초기화 실행
   ═══════════════════════════════════════════════ */
buildEnvironment();
buildStand();
buildVessel();
buildRuler();
buildRain();
buildSplashes();
setupPicking();
setupUI();
onResize();
animate();
