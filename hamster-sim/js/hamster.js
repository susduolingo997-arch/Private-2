// The hamster: procedural fur-shell body, jointed rig with 2-bone IK legs, expressive face.
import * as THREE from 'three';
import { mergeVertices } from 'BufferGeometryUtils';
import { createFur } from './fur.js';

const V3 = THREE.Vector3;
const Q = THREE.Quaternion;
const ZAXIS = new V3(0, 0, 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- geometry ----------
function sphereGeo(wSeg, hSeg, fn) {
  let g = new THREE.SphereGeometry(1, wSeg, hSeg);
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-5);
  const p = g.attributes.position;
  const t = new V3();
  for (let i = 0; i < p.count; i++) {
    t.set(p.getX(i), p.getY(i), p.getZ(i));
    fn(t);
    p.setXYZ(i, t.x, t.y, t.z);
  }
  g.computeVertexNormals();
  return g;
}
const ellipsoid = (rx, ry, rz, w = 24, h = 16) => sphereGeo(w, h, (v) => v.set(v.x * rx, v.y * ry, v.z * rz));
function segGeo(r0, r1, seg = 10) {
  // unit-length tapered cylinder along +z, r0 at z=0 and r1 at z=1
  const g = new THREE.CylinderGeometry(r1, r0, 1, seg, 1, true);
  g.deleteAttribute('uv');
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, 0.5);
  return g;
}
const bodyGeo = () => sphereGeo(56, 40, (v) => {
  const rear = Math.max(0, -v.z), front = Math.max(0, v.z);
  const rx = 0.040 * (1 + 0.12 * rear - 0.22 * front * front);
  const ry = 0.037 * (1 + 0.06 * rear - 0.12 * front * front);
  const yy = v.y < 0 ? v.y * 0.80 : v.y;
  v.set(v.x * rx, 0.040 + yy * ry, v.z * 0.066);
});
const headGeo = () => sphereGeo(48, 36, (v) => {
  const zf = Math.max(0, v.z);
  const s = sstep(0, 1, zf);
  const tp = 1 - 0.46 * s;
  v.set(v.x * 0.030 * tp, v.y * 0.026 * tp - 0.004 * sstep(0.1, 1, zf), v.z * 0.038 + 0.030);
});

// ---------- materials ----------
const pinkMat = () => new THREE.MeshPhysicalMaterial({ color: 0xe9a8a0, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xffd8d0), sheenRoughness: 0.5 });
const clawMat = () => new THREE.MeshStandardMaterial({ color: 0xf2e6da, roughness: 0.4 });

function makePaw() {
  const g = new THREE.Group();
  const m = pinkMat(), c = clawMat();
  const palm = new THREE.Mesh(ellipsoid(0.0058, 0.0034, 0.0075, 14, 10), m);
  palm.position.set(0, -0.0008, 0.0025);
  g.add(palm);
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.30;
    const f = new THREE.Group();
    f.position.set((i - 1.5) * 0.0026, -0.0012, 0.0075);
    f.rotation.y = a;
    const fm = new THREE.Mesh(ellipsoid(0.0017, 0.0015, 0.0042, 10, 8), m);
    fm.position.z = 0.0032;
    const cl = new THREE.Mesh(ellipsoid(0.0009, 0.0008, 0.0016, 8, 6), c);
    cl.position.z = 0.0072;
    f.add(fm, cl);
    g.add(f);
  }
  return g;
}
function makeFoot() {
  const g = new THREE.Group();
  const m = pinkMat(), c = clawMat();
  const sole = new THREE.Mesh(ellipsoid(0.0056, 0.0034, 0.0125, 14, 10), m);
  sole.position.set(0, 0.0005, 0.010);
  g.add(sole);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    f.position.set((i - 1.5) * 0.0027, 0.0003, 0.0205);
    f.rotation.y = (i - 1.5) * 0.18;
    const fm = new THREE.Mesh(ellipsoid(0.0015, 0.0014, 0.0045, 10, 8), m);
    fm.position.z = 0.003;
    const cl = new THREE.Mesh(ellipsoid(0.0008, 0.0007, 0.0016, 8, 6), c);
    cl.position.z = 0.0068;
    f.add(fm, cl);
    g.add(f);
  }
  return g;
}

// ---------- IK ----------
const _d = new V3(), _u = new V3(), _pp = new V3();
function ik2(H, T, a, b, pole, outElbow, outEnd) {
  _d.subVectors(T, H);
  let dist = _d.length();
  const maxD = a + b - 1e-4, minD = Math.abs(a - b) + 2e-3;
  _u.copy(_d).divideScalar(dist || 1);
  dist = clamp(dist, minD, maxD);
  outEnd.copy(H).addScaledVector(_u, dist);
  const l = (a * a - b * b + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(a * a - l * l, 0));
  _pp.copy(pole).addScaledVector(_u, -pole.dot(_u));
  if (_pp.lengthSq() < 1e-9) _pp.set(0, 1, 0);
  _pp.normalize();
  outElbow.copy(H).addScaledVector(_u, l).addScaledVector(_pp, h);
}
function place(mesh, A, B) {
  mesh.position.copy(A);
  _d.subVectors(B, A);
  const len = _d.length();
  mesh.quaternion.setFromUnitVectors(ZAXIS, _d.divideScalar(len || 1));
  mesh.scale.set(1, 1, len);
  if (mesh.userData.setStretch) mesh.userData.setStretch(1, 1, len);
}

const FUR = {
  base: 0xe2953a, tip: 0xfbcf85, dark: 0x3a2a22, belly: 0xf1dfc0, sheen: 0xffc58a,
};

export class Hamster {
  constructor() {
    this.root = new THREE.Group();
    this.pitchG = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.pitchG);
    this.pitchG.add(this.body);
    this.PIVOT = new V3(0, 0, -0.045);
    this.pitchG.position.copy(this.PIVOT);
    this.body.position.copy(this.PIVOT).negate();
    this.yaw = 0;
    this.groundFn = () => 0;
    this.slope = 0;
    this.air = 0;
    this.gait = { phase: 0, speed: 0, w: 0, lift: 1 };
    this.time = 0;

    // smoothed pose + targets
    const def = { pitch: 0, roll: 0, curl: 0, headPitch: 0, headYaw: 0, headRoll: 0, cheekL: 0, cheekR: 0, jaw: 0, chew: 0, ear: 0.6, eye: 1, sniff: 0.15, stretch: 0, breath: 1.4, sink: 0, frontZ: 0, hindZ: 0, bodyYaw: 0 };
    this.s = { ...def };
    this.t = { ...def };
    this.rates = { pitch: 5, roll: 6, curl: 2.5, headPitch: 9, headYaw: 9, headRoll: 8, cheekL: 3, cheekR: 3, jaw: 14, chew: 8, ear: 10, eye: 12, sniff: 6, stretch: 4, breath: 3, sink: 6, frontZ: 8, hindZ: 8, bodyYaw: 8 };

    const mk = () => ({ w: 0, cw: 0, pos: new V3(), cpos: new V3(), space: 'head', speed: 14 });
    this.hold = { fl: mk(), fr: mk(), hl: mk(), hr: mk() };

    this.buildBody();
    this.buildFace();
    this.buildLimbs();
    this.blinkT = 2; this.blinkK = 0; this.earTwitch = [0, 0];
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow ?? true; } });
  }

  buildBody() {
    this.bodyFur = createFur(bodyGeo(), {
      len: 0.0075, density: 1900, layers: 26, ...FUR,
      blobs: [[0.0, 0.072, -0.035, 0.030], [0.030, 0.078, 0.022, 0.016], [0.045, 0.050, -0.018, 0.016]], tick: 0.5,
    });
    this.body.add(this.bodyFur);
    this.tail = createFur(ellipsoid(0.006, 0.006, 0.007, 14, 10), { len: 0.003, density: 3000, layers: 8, ...FUR, tick: 0 });
    this.tail.position.set(0, 0.026, -0.070);
    this.body.add(this.tail);
    // chest/neck group the head hangs from
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.043, 0.050);
    this.body.add(this.neck);
    this.head = new THREE.Group();
    this.head.rotation.order = 'YXZ';
    this.neck.add(this.head);
  }

  buildFace() {
    const H = this.head;
    this.headFur = createFur(headGeo(), {
      len: 0.0058, density: 2400, layers: 24, ...FUR,
      blobs: [[0.029, -0.004, 0.004, 0.016], [0.0, 0.022, 0.012, 0.007], [0.024, 0.020, -0.002, 0.011]], tick: 0.3,
    });
    H.add(this.headFur);
    // cheek pouches
    this.cheeks = [1, -1].map((s) => {
      const m = createFur(ellipsoid(0.0165, 0.0150, 0.0195, 28, 20), {
        len: 0.0055, density: 2400, layers: 18, ...FUR,
        blobs: [[0.012, -0.004, -0.012, 0.012], [0, 0, 0, 0], [0, 0, 0, 0]], tick: 0.25,
      });
      m.userData.side = s;
      H.add(m);
      return m;
    });
    // jaw
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.set(0, -0.007, 0.028);
    H.add(this.jawPivot);
    this.jawFur = createFur(ellipsoid(0.0105, 0.0072, 0.0165, 18, 12), { len: 0.004, density: 3400, layers: 10, ...FUR, base: 0xf3d9b0, tip: 0xfbeed6, tick: 0 });
    this.jawFur.position.set(0, -0.004, 0.0185);
    this.jawPivot.add(this.jawFur);
    // inside of the mouth + teeth
    const mouth = new THREE.Mesh(ellipsoid(0.0062, 0.004, 0.0105, 12, 8), new THREE.MeshStandardMaterial({ color: 0x6a1f27, roughness: 0.4 }));
    mouth.position.set(0, 0.001, 0.0235);
    this.jawPivot.add(mouth);
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xf2dc9a, roughness: 0.35 });
    this.teethLow = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.0042, 0.0012), toothMat);
    this.teethLow.position.set(0, 0.0045, 0.0345);
    this.jawPivot.add(this.teethLow);
    this.teethUp = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.0048, 0.0013), toothMat);
    this.teethUp.position.set(0, -0.0072, 0.0668);
    H.add(this.teethUp);
    // nose
    this.nose = new THREE.Mesh(ellipsoid(0.0048, 0.0038, 0.0042, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xd68a86, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
    this.nose.position.set(0, -0.0025, 0.0678);
    H.add(this.nose);
    // eyes
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x050303, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x1b100c, roughness: 0.9 });
    this.eyes = [1, -1].map((s) => {
      const g = new THREE.Group();
      g.position.set(s * 0.0252, 0.0095, 0.0270);
      const ring = new THREE.Mesh(ellipsoid(0.0100, 0.0102, 0.0100, 16, 12), ringMat);
      ring.position.x = -s * 0.0016;
      const e = new THREE.Mesh(ellipsoid(0.0072, 0.0072, 0.0072, 24, 18), eyeMat);
      g.add(ring, e);
      g.userData.ball = e; g.userData.ring = ring;
      H.add(g);
      return g;
    });
    // ears
    const dome = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const outer = new THREE.MeshStandardMaterial({ color: 0x4a312d, roughness: 0.7, side: THREE.FrontSide });
    const inner = new THREE.MeshPhysicalMaterial({ color: 0xd9908a, roughness: 0.5, side: THREE.BackSide, sheen: 0.5, sheenColor: new THREE.Color(0xffc0b8) });
    this.ears = [1, -1].map((s) => {
      const g = new THREE.Group();
      const o = new THREE.Mesh(dome, outer); o.scale.set(0.0128, 0.0075, 0.0150);
      const i = new THREE.Mesh(dome, inner); i.scale.set(0.0120, 0.0066, 0.0142);
      g.add(o, i);
      g.userData.side = s;
      H.add(g);
      return g;
    });
    // whiskers
    const wm = new THREE.LineBasicMaterial({ color: 0xfff1de, transparent: true, opacity: 0.8 });
    this.whiskers = [1, -1].map((s) => {
      const pts = [];
      for (let i = 0; i < 7; i++) {
        const yaw = THREE.MathUtils.degToRad(18 + i * 11), pitch = THREE.MathUtils.degToRad(14 - i * 5);
        const L = 0.034 + 0.012 * Math.sin(i * 0.9 + 0.4);
        const d = new V3(Math.sin(yaw) * s, Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
        const o = new V3(s * 0.008, -0.004 + (i - 3) * 0.0011, 0.059);
        const mid = o.clone().addScaledVector(d, L * 0.5).add(new V3(0, 0.0012, 0));
        const end = o.clone().addScaledVector(d, L).add(new V3(0, -0.006 - i * 0.0006, 0));
        pts.push(o, mid, mid, end);
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.LineSegments(g, wm);
      const grp = new THREE.Group();
      grp.position.set(0, 0, 0);
      grp.add(l);
      grp.userData.side = s;
      H.add(grp);
      return grp;
    });
  }

  buildLimbs() {
    const B = this.body;
    const L = (side) => side;
    this.limbs = {};
    const mkFur = (g, o) => { const m = createFur(g, { ...FUR, ...o }); B.add(m); return m; };
    for (const name of ['fl', 'fr', 'hl', 'hr']) {
      const front = name[0] === 'f';
      const side = name[1] === 'l' ? 1 : -1;
      const limb = { front, side, name };
      if (front) {
        limb.shoulder = new V3(side * 0.027, 0.028, 0.041);
        limb.a = 0.026; limb.b = 0.024;
        limb.upper = mkFur(segGeo(0.0095, 0.0070), { len: 0.004, density: 3200, layers: 11, tick: 0.1 });
        limb.elbow = mkFur(ellipsoid(0.0072, 0.0072, 0.0072, 12, 8), { len: 0.004, density: 3200, layers: 9, tick: 0.1 });
        limb.lower = mkFur(segGeo(0.0062, 0.0048), { len: 0.003, density: 3400, layers: 9, base: 0xe9b777, tip: 0xf8e0b8, tick: 0 });
        limb.paw = makePaw();
        limb.cap = mkFur(ellipsoid(0.0052, 0.0052, 0.0052, 10, 8), { len: 0.003, density: 3400, layers: 8, base: 0xe9b777, tip: 0xf8e0b8, tick: 0 });
        limb.pole = new V3(side * 0.7, 0.25, -1).normalize();
      } else {
        limb.shoulder = new V3(side * 0.031, 0.031, -0.026);
        limb.a = 0.031; limb.b = 0.033;
        limb.upper = mkFur(segGeo(0.0175, 0.0105), { len: 0.005, density: 2800, layers: 13, tick: 0.3 });
        limb.elbow = mkFur(ellipsoid(0.0108, 0.0108, 0.0108, 12, 8), { len: 0.004, density: 3000, layers: 9, tick: 0.2 });
        limb.lower = mkFur(segGeo(0.0072, 0.0052), { len: 0.003, density: 3400, layers: 9, base: 0xeec58a, tip: 0xfaead0, tick: 0 });
        limb.paw = makeFoot();
        limb.cap = mkFur(ellipsoid(0.0056, 0.0056, 0.0056, 10, 8), { len: 0.003, density: 3400, layers: 8, base: 0xeec58a, tip: 0xfaead0, tick: 0 });
        limb.pole = new V3(side * 0.35, 0.35, 1).normalize();
      }
      B.add(limb.paw);
      limb.foot = new V3();     // smoothed world target
      limb.fp = new V3();       // body-local final
      limb.ke = new V3();       // body-local elbow
      limb.init = false;
      this.limbs[name] = limb;
    }
    this.phaseOff = {
      fl: [0.25, 0.0], fr: [0.75, 0.5], hl: [0.0, 0.5], hr: [0.5, 0.0], // [lateral-sequence, trot]
    };
  }

  // ---------- pose helpers ----------
  setHold(name, w, pos, space = 'head', speed = 14) {
    const h = this.hold[name];
    h.w = w;
    if (pos) { if (h.space !== space && h.cw < 0.02) h.cpos.copy(pos); h.pos.copy(pos); }
    h.space = space;
    h.speed = speed;
  }
  releaseHolds() { for (const k in this.hold) this.hold[k].w = 0; }
  headWorld(out = new V3()) { this.head.updateWorldMatrix(true, false); return this.head.localToWorld(out.set(0, 0.005, 0.02)); }
  mouthWorld(out = new V3()) { this.head.updateWorldMatrix(true, false); return this.head.localToWorld(out.set(0, -0.005, 0.066)); }
  headForward(out = new V3()) { this.head.updateWorldMatrix(true, false); return out.set(0, 0, 1).transformDirection(this.head.matrixWorld); }
  snap() { for (const k in this.s) this.s[k] = this.t[k]; for (const k in this.hold) { this.hold[k].cw = this.hold[k].w; this.hold[k].cpos.copy(this.hold[k].pos); } for (const k in this.limbs) this.limbs[k].init = false; }

  // ---------- per-frame ----------
  update(dt, time) {
    this.time = time;
    const s = this.s, t = this.t;
    for (const k in s) s[k] += (t[k] - s[k]) * (1 - Math.exp(-(this.rates[k] ?? 8) * dt));
    for (const k in this.hold) {
      const h = this.hold[k];
      h.cw += (h.w - h.cw) * (1 - Math.exp(-h.speed * dt));
      h.cpos.lerp(h.pos, 1 - Math.exp(-h.speed * dt));
    }
    // gait
    const g = this.gait;
    const sp = g.speed;
    const f = clamp(2.2 + sp * 11, 2.2, 13);
    g.phase += f * dt * (sp > 0.015 ? 1 : 0.0);
    g.w += ((sp > 0.015 ? 1 : 0) - g.w) * (1 - Math.exp(-10 * dt));
    const stride = sp * 0.6 / f;
    const lift = (0.006 + 0.012 * clamp(sp / 0.8, 0, 1)) * g.lift;
    const trotK = clamp((sp - 0.18) / 0.3, 0, 1);

    // root & body transform
    this.root.rotation.y = this.yaw;
    const slope = this.slope;
    const pitch = s.pitch + slope;
    this.pitchG.rotation.set(-pitch, s.bodyYaw, s.roll + Math.sin(g.phase * Math.PI * 2) * 0.035 * g.w * clamp(sp * 4, 0, 1), 'YXZ');
    const bob = Math.abs(Math.sin(g.phase * Math.PI * 2 * 1)) * 0.0022 * g.w;
    this.pitchG.position.set(this.PIVOT.x, this.PIVOT.y + bob - s.sink, this.PIVOT.z);
    // breathing + curl squash
    const br = Math.sin(time * Math.PI * 2 * s.breath);
    const c = s.curl;
    this.body.scale.set(lerp(1, 1.14, c) + br * 0.004, lerp(1, 1.1, c) + br * 0.012, lerp(1, 0.84, c) * (1 + 0.14 * s.stretch) + br * 0.004);
    // body scale non-uniform → body local origin stays at pivot
    this.body.position.copy(this.PIVOT).negate();
    this.bodyFur.userData.setStretch(1, 1, 1);

    // neck/head
    const np = this.neck.position;
    np.set(lerp(0, 0.028, c), lerp(0.043, 0.030, c), lerp(0.050, 0.040, c) + 0.012 * s.stretch);
    const sn = Math.sin(time * 38) * s.sniff * 0.012 + Math.sin(time * 17.3) * s.sniff * 0.006;
    this.head.rotation.set(-(s.headPitch - c * 0.35) + sn, s.headYaw + c * 1.15, s.headRoll + c * 0.35, 'YXZ');

    // face
    const jawAng = s.jaw * 0.55 + s.chew * (0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 7.5)) * 0.16;
    this.jawPivot.rotation.x = jawAng;
    const open = jawAng > 0.1;
    this.teethLow.visible = open; this.teethUp.visible = jawAng > 0.1;
    this.nose.position.y = -0.0025 + Math.sin(time * 38) * s.sniff * 0.0006;
    const chewSq = s.chew * Math.sin(time * Math.PI * 2 * 7.5);
    this.cheeks.forEach((m, i) => {
      const full = i === 0 ? s.cheekL : s.cheekR, sd = m.userData.side;
      m.position.set(sd * (0.0150 + 0.007 * full), -0.0085 - 0.004 * full, 0.0150 - 0.007 * full);
      const k1 = 1 + 0.85 * full, k2 = 1 + 0.5 * full + chewSq * 0.03, k3 = 1 + 0.7 * full;
      m.scale.set(k1, k2, k3);
      m.userData.setStretch(1, 1, 1);
    });
    // blinking
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinkK = 1; this.blinkT = 1.8 + Math.random() * 4.5; if (Math.random() < 0.2) this.blinkT = 0.25; }
    this.blinkK = Math.max(0, this.blinkK - dt * 7);
    const blink = this.blinkK > 0 ? Math.abs(1 - 2 * (1 - this.blinkK)) : 1;
    const eyeScaleY = clamp(s.eye, 0.04, 1) * (this.blinkK > 0 ? clamp(blink, 0.04, 1) : 1);
    this.eyes.forEach((g2) => { g2.userData.ball.scale.set(1, eyeScaleY, 1); g2.userData.ring.scale.set(1, lerp(0.30, 1, eyeScaleY), 1); });
    // ears
    this.earTwitch[0] = Math.max(0, this.earTwitch[0] - dt * 8); this.earTwitch[1] = Math.max(0, this.earTwitch[1] - dt * 8);
    if (Math.random() < dt * 0.5) this.earTwitch[Math.random() < 0.5 ? 0 : 1] = 1;
    const m4 = new THREE.Matrix4(), up = new V3(0, 1, 0), nrm = new V3(), tall = new V3(), xax = new V3(), qe = new Q();
    this.ears.forEach((e, i) => {
      const sd = e.userData.side;
      const perk = clamp(s.ear, 0, 1);
      nrm.set(sd * lerp(0.35, 0.55, perk), lerp(0.30, 0.50, perk), lerp(-0.90, -0.35, perk) + this.earTwitch[i] * 0.25).normalize();
      tall.copy(up).addScaledVector(nrm, -up.dot(nrm)).normalize();
      xax.crossVectors(nrm, tall);
      m4.makeBasis(xax, nrm, tall);
      qe.setFromRotationMatrix(m4);
      e.quaternion.copy(qe);
      e.position.set(sd * 0.0205, 0.0205, -0.003).addScaledVector(tall, 0.0085).addScaledVector(nrm, -0.001);
    });
    // whiskers
    const wsw = Math.sin(time * 45) * s.sniff * 0.16;
    this.whiskers.forEach((w) => { w.rotation.y = w.userData.side * (wsw + 0.05 * (1 - s.ear)); w.rotation.z = Math.sin(time * 31 + w.userData.side) * s.sniff * 0.06; });

    this.solveLimbs(dt, trotK, stride, lift, f);
  }

  solveLimbs(dt, trotK, stride, lift) {
    const g = this.gait, s = this.s;
    this.root.updateMatrixWorld(true);
    const bodyInv = new THREE.Matrix4().copy(this.body.matrixWorld).invert();
    const bodyQ = new Q(); this.body.getWorldQuaternion(bodyQ);
    const rootQ = new Q().setFromEuler(new THREE.Euler(0, this.yaw, 0));
    const flatQ = bodyQ.clone().invert().multiply(rootQ);
    const tmp = new V3(), world = new V3(), a2 = new V3(), a3 = new V3();
    const sit = sstep(0.15, 0.85, (s.pitch + this.slope) / 1.0);
    const c = s.curl;

    for (const name in this.limbs) {
      const L = this.limbs[name];
      const hold = this.hold[name];
      // ground target in root yaw frame
      const front = L.front;
      const po = this.phaseOff[name];
      const ph = g.phase + lerp(po[0], po[1], trotK);
      const u = ((ph % 1) + 1) % 1;
      let dz, dy;
      if (u < 0.6) { const k = u / 0.6; dz = stride * (0.5 - k); dy = 0; }
      else { const k = (u - 0.6) / 0.4; dz = stride * (-0.5 + k); dy = lift * Math.sin(Math.PI * k); }
      dz *= g.w; dy *= g.w;
      let rx = L.side * (front ? 0.030 : 0.034), rz;
      if (front) rz = 0.040 + s.frontZ - c * 0.025 - sit * 0.012;
      else rz = lerp(-0.030, 0.012, sit) + s.hindZ - c * 0.01;
      if (c > 0) rx = lerp(rx, L.side * 0.027, c);
      tmp.set(rx, 0, rz + dz);
      this.root.localToWorld(world.copy(tmp));
      const gy = this.groundFn(world.x, world.z);
      world.y = gy + 0.0065 + dy - s.sink * 0.5 + this.air * 0.022;
      if (!L.init) { L.foot.copy(world); L.init = true; L.hw = 0; }
      // ground frame → smoothed (fast so planted feet stay planted)
      const k = 1 - Math.exp(-(g.w > 0.5 ? 60 : 22) * dt);
      L.foot.lerp(world, k);
      let ftarget = L.foot;
      let flat = 1;
      if (hold.cw > 0.002) {
        const hp = hold.cpos;
        const sp = hold.space;
        let wp = a2;
        if (sp === 'world') wp.copy(hp);
        else if (sp === 'body') wp = this.body.localToWorld(a2.copy(hp));
        else { this.head.updateWorldMatrix(true, false); wp = this.head.localToWorld(a2.copy(hp)); }
        a3.copy(L.foot).lerp(wp, hold.cw);
        ftarget = a3;
        flat = 1 - hold.cw;
      }
      L.fp.copy(ftarget).applyMatrix4(bodyInv);
      // IK in body-local space
      const H = L.shoulder;
      const out = tmp.set(0, 0, 0);
      ik2(H, L.fp, L.a, L.b, L.pole, L.ke, out);
      place(L.upper, H, L.ke);
      L.elbow.position.copy(L.ke);
      place(L.lower, L.ke, out);
      L.cap.position.copy(out);
      // paw / foot
      if (L.front) {
        const dir = a2.subVectors(out, L.ke).normalize();
        const along = new Q().setFromUnitVectors(ZAXIS, dir);
        L.paw.quaternion.copy(flatQ).slerp(along, clamp(1 - flat + (L.front ? 0.0 : 0), 0, 1));
        L.paw.position.copy(out).add(a3.set(0, -0.0045 * flat, -0.002));
      } else {
        const dir = a2.subVectors(out, L.ke).normalize();
        const along = new Q().setFromUnitVectors(ZAXIS, dir);
        L.paw.quaternion.copy(flatQ).slerp(along, clamp(1 - flat, 0, 1));
        L.paw.position.copy(out).add(a3.set(0, -0.0035 * flat, -0.006));
      }
    }
  }
}
