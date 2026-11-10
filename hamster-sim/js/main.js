import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { RoomEnvironment } from 'RoomEnvironment';
import { buildWorld, CAGE } from './world.js';
import { Hamster } from './hamster.js';
import { Brain, LABELS } from './brain.js';
import { Audio } from './audio.js';
import { radialTex } from './textures.js';
import { setFurQuality } from './fur.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const q = params.get('q') === 'low' ? 0.5 : params.get('q') === 'high' ? 1.4 : 1;
const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

setFurQuality(q < 1 ? 0.6 : 1);
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q < 1 ? 1.25 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120d0a);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, 1, 0.004, 40);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 0.07; controls.maxDistance = 3.4;
controls.maxPolarAngle = 1.62; controls.minAzimuthAngle = -1.5; controls.maxAzimuthAngle = 1.5;
controls.zoomSpeed = 0.8; controls.rotateSpeed = 0.7;

let world, ham, brain, audio = new Audio(), shadowDecal;
let hour = parseFloat(params.get('hour') ?? '20.5'), rate = 0.5, clock = 0;
let camMode = 'front';
const presets = {
  front: { p: [0.0, 0.42, 1.55], t: [0.0, 0.09, 0.0], fov: 38, label: 'Front' },
  wide: { p: [0.5, 0.85, 2.7], t: [0.0, 0.2, -0.1], fov: 40, label: 'Room' },
  top: { p: [0.0, 1.55, 0.55], t: [0.0, 0.0, -0.02], fov: 45, label: 'Top' },
  cabin: { p: [-0.5, 0.2, 0.55], t: [-0.62, 0.08, -0.27], fov: 36, label: 'Cabin' },
  wheel: { p: [0.5, 0.2, 0.55], t: [0.52, 0.17, -0.27], fov: 36, label: 'Wheel' },
  follow: { label: 'Follow' },
  pov: { label: 'Hamster POV' },
};
const order = ['front', 'wide', 'top', 'cabin', 'wheel', 'follow', 'pov'];
let tween = null;

function setCam(mode) {
  camMode = mode;
  document.querySelectorAll('#cams button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  controls.enabled = mode !== 'pov';
  if (mode === 'pov') { camera.fov = 78; camera.near = 0.002; camera.updateProjectionMatrix(); return; }
  camera.near = 0.004;
  if (mode === 'follow') {
    const h = ham.headWorld(new V3());
    const f = new V3(Math.sin(ham.yaw), 0, Math.cos(ham.yaw));
    const rx = -Math.cos(ham.yaw);
    const to = h.clone().add(new V3(rx * 0.14, 0.085, 0.30));
    tween = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo: h.clone(), fov0: camera.fov, fov1: 42, t: 0 };
    return;
  }
  const p = presets[mode];
  tween = { from: camera.position.clone(), to: new V3(...p.p), tFrom: controls.target.clone(), tTo: new V3(...p.t), fov0: camera.fov, fov1: p.fov, t: 0 };
}
function stepTween(dt) {
  if (!tween) return;
  tween.t = Math.min(1, tween.t + dt / 1.3);
  const e = tween.t * tween.t * (3 - 2 * tween.t);
  camera.position.lerpVectors(tween.from, tween.to, e);
  controls.target.lerpVectors(tween.tFrom, tween.tTo, e);
  camera.fov += (tween.fov1 - camera.fov) * 0.1; camera.updateProjectionMatrix();
  if (tween.t >= 1) tween = null;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the whole cage in frame on narrow screens
  camera.userData.narrow = w / h < 1;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ UI
const cams = $('#cams');
order.forEach((m, i) => {
  const b = document.createElement('button');
  b.textContent = presets[m].label; b.dataset.m = m; b.title = `Camera: ${presets[m].label} (${i + 1})`;
  b.addEventListener('click', () => setCam(m));
  cams.appendChild(b);
});
const needsEl = $('#needs');
const needNames = [['energy', 'Energy'], ['hunger', 'Hunger'], ['thirst', 'Thirst'], ['dirt', 'Messy'], ['boredom', 'Restless']];
needNames.forEach(([k, n]) => { needsEl.insertAdjacentHTML('beforeend', `<span>${n}</span><div class="bar"><b data-k="${k}"></b></div>`); });
const toggle = (el, on) => el.classList.toggle('on', on);
function updateSound(on) { on ? audio.start() : audio.stop(); toggle($('#bSound'), on); $('#bSound').textContent = on ? '🔊 Sound' : '🔇 Sound'; }
let soundOn = false;
$('#bSound').addEventListener('click', () => { soundOn = !soundOn; updateSound(soundOn); });
$('#bLamp').addEventListener('click', (e) => { world.lampOn = !world.lampOn; toggle(e.currentTarget, world.lampOn); world.setTime(hour); });
$('#bFairy').addEventListener('click', (e) => { world.fairyOn = !world.fairyOn; toggle(e.currentTarget, world.fairyOn); world.setTime(hour); });
$('#bTreat').addEventListener('click', () => {
  const p = world.randomFree((x, z) => z > -0.1 && Math.hypot(x - brain.pos.x, z - brain.pos.z) > 0.2);
  world.dropTreat(p.x, p.z, Math.random() < 0.3 ? 'peanut' : 'seed');
});
$('#bFill').addEventListener('click', () => { world.food.count = world.food.max; world.refreshBowl(); });
$('#bWake').addEventListener('click', () => { brain.wakeRequested = true; });
$('#bSleep').addEventListener('click', () => { brain.needs.energy = 0.05; if (brain.state !== 'sleep') brain.forceNext = 'sleep'; });
const hourEl = $('#hour'), rateEl = $('#rate');
hourEl.addEventListener('input', () => { hour = parseFloat(hourEl.value); world.setTime(hour); });
rateEl.addEventListener('change', () => { rate = parseFloat(rateEl.value); });
let dragMoved = 0;
canvas.addEventListener('pointerdown', () => { dragMoved = 0; });
canvas.addEventListener('pointermove', (e) => { dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY); });
canvas.addEventListener('dblclick', (e) => {
  if (dragMoved > 12) return;
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new V3(0, 1, 0), -0.01), p = new V3();
  if (ray.ray.intersectPlane(plane, p) && Math.abs(p.x) < CAGE.x - 0.05 && Math.abs(p.z) < CAGE.z - 0.05) world.dropTreat(p.x, p.z, 'seed');
});
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '7') setCam(order[+k - 1]);
  if (k === 'n') needsEl.classList.toggle('hidden');
  if (k === 'm') { soundOn = !soundOn; updateSound(soundOn); }
  if (k === 't') $('#bTreat').click();
});

// ------------------------------------------------------------------ init
function init() {
  world = buildWorld(scene, renderer, q);
  ham = new Hamster();
  scene.add(ham.root);
  brain = new Brain(ham, world, scene);
  brain.A = audio;
  window.__sim = { world, ham, brain, camera, controls, setCam, scene, step: (dt) => step(dt, true), frame: () => frame(last + 16), finishTween: () => { if (tween) { tween.t = 1; stepTween(0); } } };
  // soft contact shadow under the hamster
  shadowDecal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(0,0,0,0.75)'], [0.5, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  shadowDecal.rotation.x = -Math.PI / 2; shadowDecal.renderOrder = 2; shadowDecal.scale.set(0.1, 0.16, 1);
  scene.add(shadowDecal);
  hourEl.value = hour; world.setTime(hour);
  resize();
  const sk = parseFloat(params.get('skip') || '0');
  if (params.get('force')) { brain.startState(params.get('force')); brain.needs.energy = 0.8; }
  if (sk > 0) { for (let i = 0; i < sk * 30; i++) step(1 / 30, true); }
  const start = params.get('cam') || 'front';
  const p = presets[start] || presets.front;
  camera.position.set(...(p.p || presets.front.p)); controls.target.set(...(p.t || presets.front.t)); camera.fov = p.fov || 38; camera.updateProjectionMatrix();
  setCam(presets[start] ? start : 'front');
  if (tween) { tween.t = 1; stepTween(0); }
  $('#loading').classList.add('done'); if (params.has('shot')) $('#loading').style.display = 'none';
  last = performance.now();
  if (params.has('shot')) { frame(last + 33); window.__done = true; } else requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ loop
let last = 0, uiT = 0;
const tmp = new V3();
function step(dt, quiet) {
  clock += dt;
  hour = (hour + dt * rate / 60) % 24;
  brain.update(dt, clock, hour);
  // wheel physics
  const wh = world.wheel;
  wh.angle -= (wh.dir ?? 1) * wh.vel * dt;
  wh.spin.rotation.z = wh.angle;
  ham.update(dt, clock);
  world.updateParticles(dt);
  if (!quiet) { audio.update(wh.vel, hour < 6 || hour > 19 ? 1 : 0); }
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt);
  if (rate > 0) { world.setTime(hour); hourEl.value = hour; }
  // contact shadow
  const p = ham.root.position;
  shadowDecal.position.set(p.x, 0, p.z);
  shadowDecal.rotation.z = -ham.yaw;
  shadowDecal.position.y = brain.wheelMode ? world.wheel.innerY + 0.0008 : brain.groundAt(p.x, p.z) + 0.0015;
  const lift = clamp(p.y - brain.groundAt(p.x, p.z), 0, 0.06);
  shadowDecal.material.opacity = 0.55 * (1 - lift * 12);
  // camera
  stepTween(dt);
  if (camMode === 'follow' && !tween) {
    const h = ham.headWorld(new V3());
    const before = controls.target.clone();
    const move = h.sub(before).multiplyScalar(1 - Math.exp(-5 * dt));
    camera.position.add(move); controls.target.add(move);
  }
  if (camMode === 'pov') {
    const head = ham.headWorld(new V3());
    const f = ham.headForward(new V3());
    camera.position.copy(head).addScaledVector(f, 0.03).add(new V3(0, 0.012, 0));
    camera.lookAt(camera.position.clone().add(f));
  } else controls.update();
  renderer.render(scene, camera);
  // HUD
  uiT += dt;
  if (uiT > 0.25) {
    uiT = 0;
    $('#act').textContent = brain.label;
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    $('#clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${hour < 5.5 || hour > 20.5 ? 'night' : hour < 8 ? 'sunrise' : hour < 17 ? 'daytime' : 'evening'} · ${brain.stats.seeds} seeds eaten · stash ${world.stash.count}`;
    needNames.forEach(([k]) => { const b = needsEl.querySelector(`[data-k="${k}"]`); if (b) b.style.width = (clamp(brain.needs[k], 0, 1) * 100).toFixed(0) + '%'; });
  }
  if (!params.has('shot')) requestAnimationFrame(frame);
}

setTimeout(() => { try { init(); } catch (e) { console.error(e); document.querySelector('#loading div').innerHTML = '<b>Something went wrong</b>' + e.message; } }, 60);
