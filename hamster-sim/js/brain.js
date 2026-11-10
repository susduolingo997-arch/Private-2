// Hamster brain: needs → utility-based activity choice → scripted (generator) behaviours.
import * as THREE from 'three';
import { CAGE } from './world.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
const fwd = (yaw) => new V3(Math.sin(yaw), 0, Math.cos(yaw));
const right = (yaw) => new V3(-Math.cos(yaw), 0, Math.sin(yaw)); // hamster's right-hand side in world

const COL = { dust: 0xcdb48a, husk: 0x7a7066, sand: 0xe6d2a4, chip: 0xc79b63, water: 0xaad8ff, seed: 0x3b3430 };

export const LABELS = {
  sleep: 'Sleeping in the cabin', wake: 'Waking up, a big yawn…', wheel: 'Running on the wheel', eat: 'Nibbling sunflower seeds', stuff: 'Stuffing the cheeks',
  hoard: 'Stashing food in the nest', drink: 'Having a drink', groom: 'Grooming', explore: 'Exploring & sniffing around', dig: 'Digging in the bedding',
  sand: 'Taking a sand bath', lookout: 'Up on the lookout deck', tunnel: 'Cruising through the cork tunnel', gnaw: 'Gnawing on the branch', treat: 'Found a treat!',
};

export class Brain {
  constructor(ham, W, scene) {
    this.ham = ham; this.W = W; this.scene = scene;
    this.pos = ham.root.position;
    this.cmd = { speed: 0, yaw: null, treadmill: false, gaitSpeed: 0 };
    this.speed = 0;
    this.dt = 1 / 60;
    this.needs = { energy: 0.35, hunger: 0.45, thirst: 0.3, dirt: 0.2, boredom: 0.3 };
    this.carrying = 0;
    this.state = 'sleep';
    this.history = [];
    this.label = LABELS.sleep;
    this.hopY = 0;
    this.lift = 0;
    this.wheelMode = false;
    this.wakeRequested = false;
    this.forceNext = null;
    this.A = null; // audio
    this.time = 0;
    this.stats = { seeds: 0, laps: 0 };
    // held item shown between the paws
    const sg = new THREE.SphereGeometry(1, 12, 10); sg.rotateX(Math.PI / 2); sg.scale(0.0042, 0.0022, 0.0078);
    this.heldSeed = new THREE.Mesh(sg, W.mats.seed); this.heldSeed.visible = false; this.heldSeed.castShadow = true; scene.add(this.heldSeed);
    this.heldSeedBase = sg;
    this.pawL = new V3(); this.pawR = new V3();

    ham.groundFn = (x, z) => this.groundAt(x, z);
    // start asleep in the nest
    const n = W.spots.nest;
    this.pos.set(n.x, 0, n.z); ham.yaw = n.yaw;
    this.pos.y = this.groundAt(n.x, n.z);
    this.resetPose(); this.sleepPose();
    ham.snap();
    this.startState('sleep', true);
  }

  groundAt(x, z) {
    if (this.wheelMode) return this.W.wheel.innerY;
    let y = this.W.groundY(x, z);
    const H = this.W.HOUSE;
    if (x > H.x0 && x < H.x1 && z > H.z0 && z < H.z1) {
      const d = Math.hypot(x + 0.60, z + 0.30);
      y += 0.022 * Math.exp(-(d * d) / 0.0072);
    }
    return y;
  }

  // ---------------------------------------------------------------- pose helpers
  resetPose() {
    const t = this.ham.t;
    Object.assign(t, { pitch: 0, roll: 0, curl: 0, headPitch: 0, headYaw: 0, headRoll: 0, jaw: 0, chew: 0, ear: 0.65, eye: 1, sniff: 0.2, stretch: 0, breath: 1.4, sink: 0, frontZ: 0, hindZ: 0, bodyYaw: 0 });
    this.ham.releaseHolds();
    this.cmd.treadmill = false; this.cmd.speed = 0; this.cmd.yaw = null;
    this.heldSeed.visible = false;
    this.ham.air = 0;
    this.ham.gait.lift = 1;
  }
  sleepPose() {
    const t = this.ham.t;
    Object.assign(t, { curl: 1, eye: 0, ear: 0.1, sniff: 0, breath: 0.85, sink: -0.004, headPitch: -0.2 });
  }
  sit(p = 0.95) { const t = this.ham.t; t.pitch = p; t.headPitch = -0.12; t.hindZ = 0; }
  faceYaw(y) { this.cmd.yaw = y; }

  // ---------------------------------------------------------------- generator utilities
  *wait(s) { let t = 0; while (t < s) { yield; t += this.dt; } }
  *during(s, fn) { let t = 0; while (t < s) { fn(t, this.dt); yield; t += this.dt; } }
  *turnTo(yaw, tol = 0.1) {
    let guard = 0;
    while (Math.abs(angDiff(yaw, this.ham.yaw)) > tol && guard < 400) { this.cmd.yaw = yaw; this.cmd.speed = 0; yield; guard++; }
    this.cmd.yaw = null;
  }
  *goTo(x, z, o = {}) {
    const speed = o.speed ?? 0.17, tol = o.tol ?? 0.025;
    const path = this.W.findPath(this.pos.x, this.pos.z, x, z);
    let total = 0;
    for (let k = 0; k < path.length; k++) {
      const wp = path[k], last = k === path.length - 1;
      let stuck = 0, lastD = 9;
      while (total < 40) {
        const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < (last ? tol : 0.04)) break;
        const want = Math.atan2(dx, dz);
        const err = Math.abs(angDiff(want, this.ham.yaw));
        const slow = last ? clamp(d / 0.10, 0.3, 1) : 1;
        this.cmd.yaw = want;
        this.cmd.speed = speed * slow * (err > 1.0 ? 0.15 : err > 0.4 ? 0.6 : 1) * (1 + 0.12 * Math.sin(this.time * 2.3));
        yield; total += this.dt;
        if (d > lastD - 0.0004) stuck += this.dt; else stuck = 0;
        lastD = d; if (stuck > 1.6) break;
      }
    }
    this.cmd.speed = 0;
    if (o.yaw != null) yield* this.turnTo(o.yaw);
    this.cmd.yaw = null;
    yield* this.wait(0.15);
  }
  *hop(to, yawTo, dur = 0.55, h = 0.035) {
    const from = this.pos.clone(), yaw0 = this.ham.yaw;
    let t = 0;
    this.hopping = true;
    while (t < dur) {
      const k = t / dur, e = k * k * (3 - 2 * k);
      this.pos.x = lerp(from.x, to.x, e); this.pos.z = lerp(from.z, to.z, e);
      this.hopY = Math.sin(k * Math.PI) * h;
      this.ham.yaw = yaw0 + angDiff(yawTo, yaw0) * e;
      this.ham.air = Math.sin(k * Math.PI);
      this.ham.t.pitch = 0.25 * Math.sin(k * Math.PI);
      yield; t += this.dt;
    }
    this.pos.x = to.x; this.pos.z = to.z; this.hopY = 0; this.ham.air = 0; this.ham.yaw = yawTo; this.hopping = false;
  }
  // analytic mouth position (root frame) for a given body pitch / head pitch
  mouthAt(pitch, headPitch) {
    const P = this.ham.PIVOT;
    const m = new V3(0, -0.005, 0.066).applyAxisAngle(new V3(1, 0, 0), -headPitch).add(new V3(0, 0.043, 0.050));
    return m.sub(P).applyAxisAngle(new V3(1, 0, 0), -pitch).add(P);
  }
  solveReach(h, headPitch) {
    let best = { pitch: 1, f: 0.05, err: 9 };
    for (let p = 0.2; p <= 1.5; p += 0.02) { const m = this.mouthAt(p, headPitch); const e = Math.abs(m.y - h); if (e < best.err) best = { pitch: p, f: m.z, err: e }; }
    return best;
  }
  seedAtPaws() {
    const L = this.ham.limbs;
    L.fl.paw.getWorldPosition(this.pawL); L.fr.paw.getWorldPosition(this.pawR);
    this.heldSeed.position.copy(this.pawL).add(this.pawR).multiplyScalar(0.5).add(new V3(0, 0.003, 0));
    this.heldSeed.quaternion.setFromAxisAngle(new V3(0, 1, 0), this.ham.yaw + 1.57);
  }
  mouthPos() { return this.ham.mouthWorld(new V3()); }
  spawnDust(n, color, pos, spread = 0.02, up = 0.25, size = 0.0016) {
    for (let i = 0; i < n; i++) this.W.emit(pos, new V3((Math.random() - 0.5) * spread * 8, Math.random() * up + 0.05, (Math.random() - 0.5) * spread * 8), color, size);
  }

  // ---------------------------------------------------------------- activity selection
  startState(name, first = false) {
    this.state = name; this.label = LABELS[name] || name;
    this.resetPose();
    this.gen = this.run(name, first);
    this.stateTime = 0;
  }
  choose() {
    const n = this.needs, W = this.W;
    if (this.forceNext) { const f = this.forceNext; this.forceNext = null; return f; }
    if (this.carrying > 0) return 'hoard';
    if (W.treats.some((t) => t.landed)) return 'treat';
    const hour = W.time;
    const night = hour < 6 || hour > 19 ? 1 : (hour < 7 || hour > 18 ? 0.55 : 0.18);
    const w = {
      sleep: n.energy < 0.14 ? 50 : clamp((0.5 - n.energy) * 9, 0, 6) + (1 - night) * 1.4,
      wheel: (n.energy > 0.25 ? (0.7 + n.boredom * 2.6) * (0.4 + night) : 0),
      eat: n.hunger * 3.2,
      stuff: (W.stash.count < 120 ? 0.5 + n.hunger * 1.6 : 0.1) * (0.4 + night),
      drink: n.thirst * 3.6,
      groom: n.dirt * 2.4 + (['wheel', 'dig', 'sand', 'eat'].includes(this.state) ? 1.1 : 0.2),
      explore: 1.2 + n.boredom,
      dig: 0.5 + n.boredom * 0.7,
      sand: 0.35 + n.dirt * 0.9,
      lookout: 0.55, tunnel: 0.6, gnaw: 0.35,
    };
    for (const h of this.history.slice(-2)) w[h] = (w[h] || 0) * 0.15;
    if (n.energy < 0.14) return 'sleep';
    const tot = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * tot;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'explore';
  }
  *run(name, first) {
    try { yield* this[name](first); } catch (e) { console.warn('behaviour error', name, e); }
  }

  // ---------------------------------------------------------------- main update
  update(dt, time, hour) {
    this.dt = dt; this.time = time;
    const n = this.needs, st = this.state;
    // needs
    const asleep = st === 'sleep';
    const night = hour < 6 || hour > 19 ? 1 : 0.35;
    if (asleep) { n.energy = Math.min(1, n.energy + dt * 0.022); n.hunger += dt * 0.0015; n.thirst += dt * 0.0012; }
    else {
      n.energy = Math.max(0, n.energy - dt * (0.0038 + (1 - night) * 0.004 + (st === 'wheel' ? 0.012 : 0)));
      n.hunger += dt * 0.0075; n.thirst += dt * 0.0062; n.boredom += dt * 0.007; n.dirt += dt * 0.0035;
    }
    for (const k of ['hunger', 'thirst', 'boredom', 'dirt']) n[k] = clamp(n[k], 0, 1);
    this.stateTime += dt;
    // run behaviour
    const r = this.gen.next();
    if (r.done) {
      this.history.push(this.state); if (this.history.length > 6) this.history.shift();
      this.startState(this.choose());
    }
    this.move(dt);
    this.W.updateTreats(dt);
    if (this.heldSeed.visible) this.seedAtPaws();
  }

  move(dt) {
    const c = this.cmd, ham = this.ham, pos = this.pos;
    if (!this.hopping) {
      if (c.yaw != null) {
        const d = angDiff(c.yaw, ham.yaw);
        const maxTurn = (this.speed > 0.05 ? 5 : 7) * dt;
        ham.yaw += clamp(d * 9 * dt, -maxTurn, maxTurn);
        ham.t.bodyYaw = 0;
      }
      this.speed += clamp(c.speed - this.speed, -3.2 * dt, 1.8 * dt);
      if (!c.treadmill && this.speed > 0.001) {
        const f = fwd(ham.yaw);
        pos.x = clamp(pos.x + f.x * this.speed * dt, -CAGE.x + 0.03, CAGE.x - 0.03);
        pos.z = clamp(pos.z + f.z * this.speed * dt, -CAGE.z + 0.03, CAGE.z - 0.03);
      }
    }
    // gait speed
    const turning = c.yaw != null && Math.abs(angDiff(c.yaw, ham.yaw)) > 0.25 && this.speed < 0.02;
    ham.gait.speed = c.treadmill ? c.gaitSpeed : (this.hopping ? 0 : Math.max(this.speed, turning ? 0.06 : 0));
    // height + slope
    const g = this.groundAt(pos.x, pos.z) + this.lift;
    pos.y += (g - pos.y) * clamp(16 * dt, 0, 1);
    pos.y = Math.max(pos.y, g - 0.02);
    if (this.hopping) pos.y = g + this.hopY;
    if (!this.wheelMode) {
      const f = fwd(ham.yaw);
      const sl = Math.atan2(this.groundAt(pos.x + f.x * 0.05, pos.z + f.z * 0.05) - this.groundAt(pos.x - f.x * 0.05, pos.z - f.z * 0.05), 0.10);
      ham.slope += (clamp(sl, -0.5, 0.5) * (1 - clamp(ham.s.pitch * 1.4, 0, 1)) - ham.slope) * clamp(8 * dt, 0, 1);
    }
    // audio hooks
    if (this.A) this.A.walk(ham.gait.speed * (this.wheelMode ? 0 : 1), dt);
  }

  // ================================================================ BEHAVIOURS
  *sleep(first) {
    const W = this.W, n = W.spots.nest;
    if (!first) {
      yield* this.goTo(W.spots.houseDoor.x, W.spots.houseDoor.z, { speed: 0.2 });
      yield* this.goTo(n.x, n.z, { speed: 0.14, yaw: n.yaw });
      // turn around a few times before settling
      const t = this.ham.t;
      for (let i = 0; i < 2; i++) { yield* this.turnTo(this.ham.yaw + 2.2, 0.15); }
      this.A?.rustle(0.8);
    }
    const t = this.ham.t;
    this.sit(0); t.curl = 0;
    yield* this.during(1.2, () => { t.pitch = 0; t.sink = 0.006; t.headPitch = -0.3; });
    this.sleepPose();
    const need = clamp(1 - this.needs.energy, 0.2, 1);
    let dur = first ? 9 : rnd(30, 70) * need + 12;
    let tw = rnd(2, 6), tt = 0;
    while (dur > 0) {
      yield; dur -= this.dt; tt += this.dt;
      tw -= this.dt;
      if (tw < 0) { // twitch / dream
        tw = rnd(3, 9);
        const k = Math.random();
        if (k < 0.5) { t.sniff = 0.7; yield* this.wait(0.35); t.sniff = 0; }
        else if (k < 0.8) { this.ham.earTwitch[0] = 1; t.headRoll = 0.12; yield* this.wait(0.25); t.headRoll = 0; }
        else { t.breath = 1.7; yield* this.wait(1.8); t.breath = 0.85; }
      }
      if (this.wakeRequested || (this.needs.energy > 0.95 && dur < 8) || (W.treats.length && Math.random() < this.dt * 0.15)) { this.wakeRequested = false; break; }
    }
    yield* this.wakeUp();
  }
  *wakeUp() {
    const t = this.ham.t;
    this.label = LABELS.wake;
    t.curl = 0.5; t.eye = 0.3; t.breath = 1.6; t.sink = 0; t.ear = 0.4;
    yield* this.wait(0.8);
    t.curl = 0; t.eye = 0.1;
    // yawn
    t.pitch = 0.5; t.headPitch = 0.55; t.jaw = 1; t.ear = 0.1;
    this.A?.squeak(0.4);
    yield* this.wait(2.0);
    t.jaw = 0; t.headPitch = 0; t.pitch = 0.0; t.eye = 0.8; t.ear = 0.6;
    yield* this.wait(0.5);
    // stretch: front paws forward, bum up
    t.eye = 1;
    t.pitch = -0.28; t.frontZ = 0.045; t.hindZ = -0.01; t.stretch = 1; t.headPitch = 0.3; t.sniff = 0.3;
    yield* this.wait(2.0);
    this.resetPose();
    this.ham.t.sniff = 0.5;
    yield* this.wait(0.8);
    this.needs.energy = Math.max(this.needs.energy, 0.7);
  }

  *wheel() {
    const W = this.W, wh = W.wheel, ham = this.ham, t = ham.t;
    const e = W.spots.wheelEntry;
    yield* this.goTo(e.x, e.z, { speed: 0.32, yaw: Math.PI });
    // hop over the lip
    this.A?.squeak(0.2);
    this.wheelMode = true; this.lift = 0;
    const dir = Math.random() < 0.5 ? 1 : -1;               // +1 → faces +x
    yield* this.hop(new V3(wh.cx, 0, wh.cz - 0.005), dir * Math.PI / 2, 0.5, 0.05);
    ham.gait.lift = 1.3;
    this.cmd.treadmill = true; this.cmd.speed = 0; this.cmd.gaitSpeed = 0;
    wh.dir = dir;
    const runs = (Math.random() * 3 | 0) + 1;
    let sp = 0;
    for (let r = 0; r < runs; r++) {
      const target = rnd(0.35, 0.85), dur = rnd(8, 24);
      yield* this.during(dur, (tt, dt) => {
        const wob = 1 + 0.12 * Math.sin(tt * 1.7) + 0.05 * Math.sin(tt * 5.1);
        sp += (target * wob - sp) * clamp(1.6 * dt, 0, 1);
        wh.vel = sp / wh.R;
        this.cmd.gaitSpeed = sp;
        t.pitch = 0.0; ham.slope = 0.1 + sp * 0.15;
        t.headPitch = 0.1 + sp * 0.2; t.sniff = 0.1; t.ear = 0.3; t.jaw = 0.12; t.stretch = sp * 0.25;
      });
      // short breather
      const pause = rnd(1.5, 4);
      yield* this.during(pause, (tt, dt) => { sp += (0 - sp) * clamp(2 * dt, 0, 1); wh.vel = Math.max(wh.vel - 4 * dt, sp / wh.R); this.cmd.gaitSpeed = wh.vel * wh.R * 0.7; t.jaw = 0.1; t.breath = 3; });
      while (wh.vel > 0.6) { wh.vel -= 5 * this.dt; this.cmd.gaitSpeed = wh.vel * wh.R * 0.5; yield; }
    }
    // stop & hop out
    this.cmd.treadmill = false; this.cmd.gaitSpeed = 0; sp = 0;
    while (Math.abs(wh.vel) > 0.3) { wh.vel *= 1 - Math.min(1, 6 * this.dt); yield; }
    wh.vel = 0;
    t.breath = 3; t.slope = 0; ham.slope = 0;
    yield* this.turnTo(0, 0.12);
    yield* this.wait(0.6);
    this.wheelMode = false;
    yield* this.hop(new V3(wh.cx, 0, W.spots.wheelEntry.z + 0.02), 0, 0.55, 0.05);
    this.needs.boredom = Math.max(0, this.needs.boredom - 0.55);
    this.needs.dirt += 0.1;
    this.stats.laps++;
    yield* this.wait(0.6);
  }

  // ---- eating ------------------------------------------------------
  *sitAtBowl() {
    const W = this.W, dir = Math.random() < 0.5 ? 1 : -1, B = W.BOWL;
    const x = B.x - dir * 0.115, z = B.z;
    yield* this.goTo(x, z, { speed: 0.2, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2 });
    return dir;
  }
  // take one seed from `src` (world pos) to the mouth, then chew or stuff
  *takeSeed(src, dirVec, stuff) {
    const t = this.ham.t, h = this.ham;
    const r = right(h.yaw);
    // reach down
    t.pitch = 0.42; t.headPitch = -0.42; t.sniff = 0.3;
    h.setHold('fl', 1, src.clone().addScaledVector(r, -0.010), 'world', 10);
    h.setHold('fr', 1, src.clone().addScaledVector(r, 0.010), 'world', 10);
    yield* this.wait(0.55);
    this.heldSeed.visible = true; this.heldSeed.scale.setScalar(1);
    // bring to mouth
    t.pitch = 0.95; t.headPitch = -0.12;
    h.setHold('fl', 1, new V3(0.009, -0.014, 0.050), 'head', 11);
    h.setHold('fr', 1, new V3(-0.009, -0.014, 0.050), 'head', 11);
    yield* this.wait(0.5);
    if (stuff) {
      t.jaw = 0.5; yield* this.wait(0.22); t.jaw = 0; this.heldSeed.visible = false;
      this.A?.nibble(1);
      const side = Math.random() < 0.5;
      t.cheekL = Math.min(1, t.cheekL + (side ? 0.2 : 0.12)); t.cheekR = Math.min(1, t.cheekR + (side ? 0.12 : 0.2));
      // push seed into the cheek with a paw
      h.setHold(side ? 'fl' : 'fr', 1, new V3(side ? 0.020 : -0.020, -0.010, 0.012), 'head', 14);
      yield* this.wait(0.4);
      this.carrying++;
    } else {
      t.chew = 1; t.jaw = 0.08;
      const dur = rnd(1.6, 3);
      yield* this.during(dur, (tt) => {
        const ph = tt * 6;
        h.setHold('fl', 1, new V3(0.009 + Math.sin(ph) * 0.002, -0.013 + Math.cos(ph * 1.3) * 0.002, 0.050), 'head', 16);
        h.setHold('fr', 1, new V3(-0.009 - Math.sin(ph) * 0.002, -0.013 + Math.sin(ph * 1.1) * 0.002, 0.050), 'head', 16);
        this.heldSeed.scale.setScalar(Math.max(0.15, 1 - tt / dur * 0.85));
        t.headPitch = -0.12 + Math.sin(tt * 7.5) * 0.03; t.eye = 0.85;
        if (Math.random() < this.dt * 2.2) { this.W.emit(this.mouthPos().add(new V3(0, -0.01, 0)), new V3((Math.random() - 0.5) * 0.04, 0.04, (Math.random() - 0.5) * 0.04), COL.husk, 0.0016, 1.0); this.A?.nibble(0.5); }
      });
      t.chew = 0; this.heldSeed.visible = false; t.jaw = 0;
      this.needs.hunger = Math.max(0, this.needs.hunger - 0.1); this.stats.seeds++;
    }
  }
  *eat() {
    const W = this.W;
    const dir = yield* this.sitAtBowl();
    const n = (Math.random() * 4 | 0) + 4;
    const dv = fwd(this.ham.yaw);
    for (let i = 0; i < n && this.needs.hunger > 0.02; i++) {
      if (W.food.count <= 0) break;
      const src = new V3(W.BOWL.x - dir * 0.038, 0.03, W.BOWL.z);
      yield* this.takeSeed(src, dv, false);
      W.food.count--; W.refreshBowl();
      yield* this.wait(rnd(0.2, 0.6));
      if (Math.random() < 0.3) { this.ham.t.pitch = 0.9; yield* this.wait(0.5); this.ham.earTwitch[0] = 1; }
    }
    this.needs.hunger = Math.max(0, this.needs.hunger - 0.15);
    this.resetPose(); yield* this.wait(0.3);
    if (W.food.count <= 0) W.food.count = 0;
  }
  *stuff() {
    const W = this.W;
    const dir = yield* this.sitAtBowl();
    const dv = fwd(this.ham.yaw);
    let n = (Math.random() * 4 | 0) + 5;
    while (n-- > 0 && W.food.count > 0 && this.ham.t.cheekL + this.ham.t.cheekR < 1.8) {
      const src = new V3(W.BOWL.x - dir * 0.038, 0.03, W.BOWL.z);
      yield* this.takeSeed(src, dv, true);
      W.food.count--; W.refreshBowl();
    }
    this.resetPose();
    this.ham.t.sniff = 0.5; this.ham.t.ear = 0.8;
    yield* this.wait(0.6);
  }
  *treat() {
    const W = this.W;
    const tr = W.treats.filter((q) => q.landed).sort((a, b) => Math.hypot(a.x - this.pos.x, a.z - this.pos.z) - Math.hypot(b.x - this.pos.x, b.z - this.pos.z))[0];
    if (!tr) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    // sniff approach
    yield* this.goTo(tr.x - dir * 0.09, tr.z, { speed: 0.3, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2, tol: 0.04 });
    this.ham.t.sniff = 1; this.ham.t.headPitch = -0.3; this.ham.t.pitch = 0.2;
    yield* this.wait(0.7);
    const src = tr.mesh.position.clone();
    const stuff = Math.random() < 0.6 || this.carrying > 0;
    this.heldSeed.visible = false;
    // pick up
    const t = this.ham.t, h = this.ham, r = right(h.yaw);
    t.pitch = 0.5; t.headPitch = -0.35;
    h.setHold('fl', 1, src.clone().addScaledVector(r, -0.008).add(new V3(0, 0.004, 0)), 'world', 10);
    h.setHold('fr', 1, src.clone().addScaledVector(r, 0.008).add(new V3(0, 0.004, 0)), 'world', 10);
    yield* this.wait(0.55);
    W.removeTreat(tr);
    this.heldSeed.visible = true;
    t.pitch = 0.95; t.headPitch = -0.12;
    h.setHold('fl', 1, new V3(0.009, -0.014, 0.050), 'head', 11);
    h.setHold('fr', 1, new V3(-0.009, -0.014, 0.050), 'head', 11);
    yield* this.wait(0.6);
    if (stuff) {
      t.jaw = 0.5; yield* this.wait(0.25); t.jaw = 0; this.heldSeed.visible = false;
      t.cheekL = Math.min(1, t.cheekL + 0.25); t.cheekR = Math.min(1, t.cheekR + 0.25); this.carrying += 2;
      yield* this.wait(0.5);
    } else {
      t.chew = 1; yield* this.during(2.8, (tt) => { t.headPitch = -0.12 + Math.sin(tt * 7.5) * 0.03; this.heldSeed.scale.setScalar(Math.max(0.1, 1 - tt / 2.8)); });
      t.chew = 0; this.heldSeed.visible = false; this.needs.hunger = Math.max(0, this.needs.hunger - 0.2);
    }
    this.stats.seeds++;
    this.resetPose(); this.ham.t.ear = 0.9;
    yield* this.wait(0.4);
  }
  *hoard() {
    const W = this.W, h = this.ham, t = h.t;
    const sp = W.spots.stash;
    yield* this.goTo(W.spots.houseDoor.x, W.spots.houseDoor.z, { speed: 0.26 });
    yield* this.goTo(sp.x + 0.07, sp.z + 0.05, { speed: 0.2, yaw: Math.atan2(sp.x - (sp.x + 0.07), sp.z - (sp.z + 0.05)) });
    const amount = Math.max(1, this.carrying);
    let each = 0.5 + 0.3 * Math.random();
    for (let i = 0; i < amount; i++) {
      const side = i % 2 === 0;
      t.pitch = 0.9; t.headPitch = -0.2; t.jaw = 0.0;
      // squeeze the cheek out with the paw
      yield* this.during(0.7, (tt) => {
        const k = tt / 0.7;
        h.setHold(side ? 'fl' : 'fr', 1, new V3(side ? 0.027 : -0.027, -0.008, -0.002 + 0.042 * k), 'head', 18);
        t.jaw = 0.35 * Math.sin(k * Math.PI);
        t.headPitch = -0.35 + 0.1 * Math.sin(k * 3);
      });
      const m = this.mouthPos();
      this.W.emit(m, new V3((Math.random() - 0.5) * 0.05, 0.06, (Math.random() - 0.5) * 0.05), COL.seed, 0.0028, 1.2, 1);
      W.stash.count = Math.min(140, W.stash.count + 1); W.refreshStash();
      t.cheekL = Math.max(0, t.cheekL - 0.9 / amount * (side ? 1.2 : 0.5));
      t.cheekR = Math.max(0, t.cheekR - 0.9 / amount * (side ? 0.5 : 1.2));
      this.A?.nibble(0.6);
      yield* this.wait(each);
    }
    t.cheekL = 0; t.cheekR = 0; this.carrying = 0;
    // pat the pile
    t.pitch = 0.5; t.headPitch = -0.5;
    yield* this.during(1.4, (tt) => { h.setHold('fl', 1, new V3(0.012 + Math.sin(tt * 8) * 0.004, -0.02, 0.04), 'head', 14); h.setHold('fr', 1, new V3(-0.012, -0.02, 0.04 + Math.sin(tt * 8 + 1) * 0.004), 'head', 14); });
    this.resetPose();
    this.ham.t.eye = 0.7;
    yield* this.wait(0.6);
    this.needs.energy = Math.max(0, this.needs.energy - 0.03);
  }

  // ---- drinking ----------------------------------------------------
  *drink() {
    const W = this.W, h = this.ham, t = h.t, S = W.spots.spout;
    yield* this.goTo(S.x - 0.13, S.z, { speed: 0.2, yaw: Math.PI / 2 });
    const hp = 0.45;
    const sol = this.solveReach(S.y - this.pos.y + 0.003, hp);
    const sx = S.x - sol.f + 0.004, start = this.pos.x;
    t.headPitch = hp; t.pitch = sol.pitch; t.sniff = 0.5; t.ear = 0.8;
    // walk to the spot while rising
    yield* this.during(1.0, (tt) => { const k = Math.min(1, tt / 1.0); this.pos.x = lerp(start, sx, k * k * (3 - 2 * k)); h.setHold('fl', k, new V3(S.x + 0.018, S.y - 0.025, S.z - 0.016), 'world', 8); h.setHold('fr', k, new V3(S.x + 0.018, S.y - 0.025, S.z + 0.016), 'world', 8); });
    const sips = (Math.random() * 4 | 0) + 4;
    W.bubble.visible = true;
    for (let s = 0; s < sips; s++) {
      t.chew = 1; t.jaw = 0.08;
      const dur = rnd(1.2, 2.4);
      yield* this.during(dur, (tt) => {
        t.eye = 0.7; t.sniff = 0.1;
        const b = W.bubble; b.position.y = 0.32 + (tt * 0.3) % 0.1; b.position.x = Math.sin(tt * 3) * 0.006; b.scale.setScalar(0.8 + 0.4 * Math.sin(tt * 9));
        W.drip.visible = Math.sin(tt * 4) > 0.2; W.drip.position.y = S.y - 0.007 - ((tt * 0.05) % 0.02);
        if (Math.random() < this.dt * 3) this.A?.lap();
      });
      t.chew = 0; t.jaw = 0; t.eye = 1;
      yield* this.wait(rnd(0.3, 0.8));
      if (Math.random() < 0.3) { t.sniff = 0.8; yield* this.wait(0.5); }
      this.needs.thirst = Math.max(0, this.needs.thirst - 0.18);
    }
    W.bubble.visible = false; W.drip.visible = false;
    this.needs.thirst = Math.max(0, this.needs.thirst - 0.3);
    t.pitch = 0.9; t.headPitch = 0; h.releaseHolds();
    // lick a paw
    yield* this.wait(0.5);
    this.resetPose();
    yield* this.wait(0.3);
  }

  // ---- grooming ----------------------------------------------------
  *groom() {
    const h = this.ham, t = h.t;
    // groom wherever it is (pick a spot in the open if it is somewhere odd)
    if (this.W.walkable(this.pos.x, this.pos.z) === false) { const p = this.W.randomFree(); yield* this.goTo(p.x, p.z); }
    const rounds = 3 + (Math.random() * 3 | 0);
    for (let r = 0; r < rounds; r++) {
      const kind = pick(['face', 'face', 'belly', 'scratch', 'ear', 'flank']);
      this.resetPose();
      if (kind === 'face') {
        this.sit(0.95);
        const dur = rnd(3.5, 6.5), f = rnd(3.5, 5);
        yield* this.during(dur, (tt) => {
          const ph = tt * f * TAU;
          t.eye = 0.35; t.ear = 0.25; t.sniff = 0; t.headPitch = -0.28 + Math.sin(ph * 0.5) * 0.06;
          h.setHold('fl', 1, new V3(0.011, -0.002 + Math.sin(ph) * 0.013, 0.040 + Math.cos(ph) * 0.010), 'head', 16);
          h.setHold('fr', 1, new V3(-0.011, -0.002 + Math.sin(ph + Math.PI) * 0.013, 0.040 + Math.cos(ph + Math.PI) * 0.010), 'head', 16);
          t.roll = Math.sin(ph * 0.5) * 0.04;
        });
        t.eye = 1;
      } else if (kind === 'belly') {
        this.sit(1.0);
        const dur = rnd(4, 7);
        yield* this.during(dur, (tt) => {
          t.curl = 0.65; t.headPitch = -0.7 + Math.sin(tt * 6) * 0.05; t.jaw = 0.05; t.chew = 0.5; t.eye = 0.5; t.pitch = 1.05;
          h.setHold('fl', 1, new V3(0.018, 0.030, 0.050 + Math.sin(tt * 3) * 0.004), 'body', 10);
          h.setHold('fr', 1, new V3(-0.018, 0.030, 0.052), 'body', 10);
        });
      } else if (kind === 'scratch') {
        this.sit(0.55);
        const dur = rnd(2, 4);
        yield* this.during(dur, (tt) => {
          t.roll = -0.28; t.eye = 0.3; t.headRoll = 0.2; t.headPitch = 0.1; t.ear = 0.3;
          h.setHold('hl', 1, new V3(0.034, 0.062 + Math.sin(tt * 52) * 0.004, 0.030 + Math.sin(tt * 47) * 0.004), 'body', 14);
          h.setHold('fr', 1, new V3(-0.03, -0.01, 0.07), 'body', 8);
        });
      } else if (kind === 'ear') {
        this.sit(0.95);
        const dur = rnd(2.5, 4);
        yield* this.during(dur, (tt) => {
          t.headRoll = 0.3; t.eye = 0.4; t.ear = 0.2;
          h.setHold('fl', 1, new V3(0.03 - Math.sin(tt * 7) * 0.005, 0.010 + Math.sin(tt * 7) * 0.016, 0.006 + Math.cos(tt * 7) * 0.005), 'head', 16);
          h.setHold('fr', 1, new V3(-0.012, -0.012, 0.05), 'head', 10);
        });
      } else {
        this.sit(0.85);
        const dur = rnd(3, 5);
        yield* this.during(dur, (tt) => {
          t.curl = 0.8; t.headYaw = 0.2; t.headPitch = -0.45 + Math.sin(tt * 6) * 0.05; t.chew = 0.4; t.eye = 0.5;
          h.setHold('fl', 1, new V3(0.014, 0.018, 0.045), 'body', 10);
        });
      }
      this.needs.dirt = Math.max(0, this.needs.dirt - 0.25);
      this.resetPose(); this.sit(0.95);
      this.ham.t.sniff = 0.4;
      yield* this.wait(rnd(0.4, 1.0));
    }
    this.needs.dirt = Math.max(0, this.needs.dirt - 0.3);
    this.resetPose();
  }

  // ---- exploring ---------------------------------------------------
  *sniffAround(dur = 2) {
    const t = this.ham.t;
    t.sniff = 1; t.ear = 0.85;
    const rear = Math.random() < 0.45;
    if (rear) { t.pitch = 1.2; t.headPitch = 0.25; this.ham.setHold('fl', 1, new V3(0.016, -0.02, 0.03), 'head', 8); this.ham.setHold('fr', 1, new V3(-0.016, -0.02, 0.03), 'head', 8); }
    yield* this.during(dur, (tt) => {
      t.headYaw = Math.sin(tt * 1.6) * 0.7; t.headPitch = (rear ? 0.25 : -0.15) + Math.sin(tt * 2.3) * 0.12;
      t.roll = Math.sin(tt * 1.6) * 0.03;
    });
    this.ham.releaseHolds(); t.pitch = 0; t.headYaw = 0; t.sniff = 0.2;
    yield* this.wait(0.4);
  }
  *explore() {
    const W = this.W, n = 3 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const p = W.randomFree((x, z) => Math.hypot(x - this.pos.x, z - this.pos.z) > 0.2 && !(x > W.HOUSE.x0 && x < W.HOUSE.x1 && z > W.HOUSE.z0 && z < W.HOUSE.z1));
      const sp = Math.random() < 0.3 ? 0.34 : rnd(0.13, 0.22);
      yield* this.goTo(p.x, p.z, { speed: sp, tol: 0.04 });
      this.resetPose();
      yield* this.sniffAround(rnd(1.4, 3.4));
      this.needs.boredom = Math.max(0, this.needs.boredom - 0.07);
      if (Math.random() < 0.25) { this.sit(0.95); this.ham.t.sniff = 0.6; yield* this.wait(rnd(1, 3)); this.resetPose(); }
    }
  }
  *tunnel() {
    const W = this.W, a = W.spots.tunnelW, b = W.spots.tunnelE;
    const fromWest = Math.random() < 0.5;
    const s = fromWest ? a : b, e = fromWest ? b : a;
    yield* this.goTo(s.x + (fromWest ? 0 : 0.06), s.z, { speed: 0.2, yaw: fromWest ? Math.PI / 2 : -Math.PI / 2 });
    yield* this.sniffAround(1.2);
    yield* this.goTo(e.x, e.z, { speed: 0.22, tol: 0.04 });
    this.resetPose(); this.sit(1.2); this.ham.t.sniff = 0.8; this.ham.t.headYaw = 0;
    yield* this.wait(rnd(1.5, 3));
    if (Math.random() < 0.4) { yield* this.goTo(s.x, s.z, { speed: 0.3 }); }
    this.needs.boredom = Math.max(0, this.needs.boredom - 0.15);
  }
  *lookout() {
    const W = this.W, d = W.spots.deck;
    yield* this.goTo(W.spots.rampBase.x, W.spots.rampBase.z, { speed: 0.2, yaw: 0 });
    yield* this.goTo(d.x, d.z, { speed: 0.17, tol: 0.03 });
    this.resetPose();
    yield* this.turnTo(rnd(-0.6, 0.6));
    this.sit(1.0); this.ham.t.sniff = 0.5;
    const dur = rnd(7, 14);
    yield* this.during(dur, (tt) => {
      const t = this.ham.t;
      t.headYaw = Math.sin(tt * 0.5) * 0.9; t.headPitch = 0.05 + Math.sin(tt * 0.9) * 0.12; t.ear = 0.9;
      this.ham.setHold('fl', 1, new V3(0.014, -0.022, 0.025), 'head', 6); this.ham.setHold('fr', 1, new V3(-0.014, -0.022, 0.025), 'head', 6);
      if (Math.sin(tt * 0.6) > 0.95) t.pitch = 1.25; else t.pitch = 1.0;
    });
    this.resetPose();
    this.needs.boredom = Math.max(0, this.needs.boredom - 0.2);
    const p = W.randomFree((x, z) => x < 0.4);
    yield* this.goTo(p.x, p.z, { speed: 0.2 });
  }
  *dig() {
    const W = this.W, h = this.ham, t = h.t, s = W.spots.dig;
    const d = { x: s.x + rnd(-0.1, 0.1), z: s.z + rnd(-0.06, 0.1) };
    const yaw = rnd(-Math.PI, Math.PI);
    yield* this.goTo(d.x, d.z, { speed: 0.2, yaw });
    for (let burst = 0; burst < 2 + (Math.random() * 2 | 0); burst++) {
      const dur = rnd(3, 5.5);
      yield* this.during(dur, (tt) => {
        const f = fwd(h.yaw), r = right(h.yaw);
        const ph = tt * 8.5 * TAU * 0.5;
        t.pitch = -0.12 + Math.sin(ph) * 0.05; t.headPitch = -0.55; t.sniff = 0.5; t.eye = 0.9; t.ear = 0.45;
        t.sink = 0.004;
        for (const [nm, off] of [['fl', 0], ['fr', Math.PI]]) {
          const k = Math.sin(ph + off);
          const side = nm === 'fl' ? -1 : 1;
          const p = this.pos.clone().addScaledVector(f, 0.07 - 0.075 * (k * 0.5 + 0.5)).addScaledVector(r, side * 0.028);
          p.y = W.groundY(p.x, p.z) + 0.004 + (k > 0.4 ? 0.014 : 0);
          h.setHold(nm, 1, p, 'world', 28);
        }
        if (Math.sin(ph + 0.4) > 0.9 && Math.random() < 0.6) {
          const base = this.pos.clone().addScaledVector(f, -0.02); base.y = W.groundY(base.x, base.z) + 0.01;
          this.spawnDust(2, COL.dust, base, 0.015, 0.4, 0.002);
          for (let q = 0; q < 2; q++) this.W.emit(base, f.clone().multiplyScalar(-0.25 + Math.random() * -0.2).add(new V3((Math.random() - 0.5) * 0.15, 0.25, (Math.random() - 0.5) * 0.15)), COL.dust, 0.0024, 0.9);
          this.A?.rustle(0.5);
        }
      });
      this.resetPose();
      yield* this.sniffAround(rnd(0.8, 1.6));
      if (burst < 1) { const q = fwd(h.yaw); yield* this.goTo(clamp(this.pos.x + q.x * 0.03, -0.8, 0.8), clamp(this.pos.z + q.z * 0.03, -0.4, 0.4), { speed: 0.1 }); }
    }
    this.needs.boredom = Math.max(0, this.needs.boredom - 0.25); this.needs.dirt += 0.12;
  }
  *sand() {
    const W = this.W, h = this.ham, t = h.t, s = W.spots.sand;
    yield* this.goTo(s.x + rnd(-0.07, 0.07), s.z + rnd(-0.04, 0.04), { speed: 0.22, tol: 0.03 });
    yield* this.sniffAround(1.2);
    const rolls = 2 + (Math.random() * 3 | 0);
    for (let r = 0; r < rolls; r++) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      // drop onto a shoulder
      const dur = rnd(2.4, 4);
      yield* this.during(dur, (tt) => {
        const k = Math.min(1, tt / 0.5);
        const ph = tt * 7;
        t.roll = dir * (1.25 * k + Math.sin(ph) * 0.2);
        t.sink = 0.012 * k; t.pitch = 0.1 + Math.sin(ph * 0.5) * 0.12; t.headPitch = -0.2 + Math.sin(ph) * 0.2; t.eye = 0.35; t.curl = 0.35;
        t.bodyYaw = Math.sin(ph * 0.5) * 0.35;
        h.setHold('hl', k, new V3(0.025, 0.06 + Math.sin(ph) * 0.012, -0.02 + Math.cos(ph) * 0.01), 'body', 8);
        h.setHold('fr', k, new V3(-0.015, 0.07 + Math.sin(ph + 1) * 0.012, 0.04), 'body', 8);
        h.setHold('fl', k, new V3(0.02, 0.075, 0.03 + Math.sin(ph + 2) * 0.01), 'body', 8);
        if (Math.random() < this.dt * 14) { const p = this.pos.clone(); p.y += 0.03; this.W.emit(p, new V3((Math.random() - 0.5) * 0.25, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.25), COL.sand, 0.0022, 1.1, 0.5); }
        if (Math.random() < this.dt * 5) this.A?.rustle(0.4);
      });
      t.roll = 0; yield* this.wait(0.5);
      this.resetPose();
      // shake off
      yield* this.during(0.7, (tt) => { t.bodyYaw = Math.sin(tt * 40) * 0.25; t.headRoll = Math.sin(tt * 36) * 0.2; if (Math.random() < this.dt * 20) { const p = this.pos.clone(); p.y += 0.05; this.W.emit(p, new V3((Math.random() - 0.5) * 0.3, 0.2, (Math.random() - 0.5) * 0.3), COL.sand, 0.002, 0.8, 0.8); } });
      this.resetPose();
    }
    this.needs.dirt = Math.max(0, this.needs.dirt - 0.5);
    this.needs.boredom = Math.max(0, this.needs.boredom - 0.12);
  }
  *gnaw() {
    const W = this.W, h = this.ham, t = h.t, g = W.spots.gnaw;
    yield* this.goTo(g.x, g.z + 0.05, { speed: 0.2, yaw: Math.PI });
    const dur = rnd(5, 9);
    this.sit(0.65);
    yield* this.during(dur, (tt) => {
      t.pitch = 0.7; t.headPitch = 0.05 + Math.sin(tt * 3) * 0.05; t.chew = 1; t.jaw = 0.12; t.eye = 0.75; t.sniff = 0;
      const bp = new V3(g.x, 0.06, g.z - 0.04);
      h.setHold('fl', 1, bp.clone().add(new V3(0.012, 0, 0.0)), 'world', 12);
      h.setHold('fr', 1, bp.clone().add(new V3(-0.012, 0, 0.0)), 'world', 12);
      if (Math.random() < this.dt * 3) { this.W.emit(this.mouthPos(), new V3((Math.random() - 0.5) * 0.06, 0.05, 0.02), COL.chip, 0.0016, 0.9); this.A?.nibble(0.6); }
    });
    this.resetPose();
    this.needs.boredom = Math.max(0, this.needs.boredom - 0.2);
  }
}
