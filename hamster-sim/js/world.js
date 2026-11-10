// The giant cozy enclosure, the room around it, props, terrain height and navigation.
import * as THREE from 'three';
import * as TX from './textures.js';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const CAGE = { x: 0.9, z: 0.45, h: 0.85 };

export function buildWorld(scene, renderer, quality = 1) {
  const W = { time: 20 };
  const rand = TX.rng(77);
  const root = new THREE.Group();
  scene.add(root);

  // ---------------------------------------------------------------- materials
  const wood = (c, rep, seed) => new THREE.MeshStandardMaterial({ map: TX.woodTexture(c, { repeat: rep, seed }), roughness: 0.72 });
  const mats = {
    pine: wood([196, 148, 92], [1, 1], 2),
    darkWood: wood([112, 74, 46], [1, 1], 5),
    walnut: wood([84, 54, 36], [2, 1], 9),
    birch: wood([222, 190, 140], [1, 1], 12),
    bark: new THREE.MeshStandardMaterial({ map: TX.woodTexture([96, 70, 52], { repeat: [1, 4], rings: 30, seed: 41 }), roughness: 0.95 }),
    cork: new THREE.MeshStandardMaterial({ map: TX.corkTexture(), roughness: 0.95, side: THREE.DoubleSide }),
    corkIn: new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 1, side: THREE.BackSide }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: 0xe9dcc6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }),
    ceramicBlue: new THREE.MeshPhysicalMaterial({ color: 0x6f8fa0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.1, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.25, metalness: 1 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.6 }),
    sand: new THREE.MeshStandardMaterial({ map: TX.sandTexture(), color: 0xb9a88a, roughness: 1 }),
    wall: new THREE.MeshStandardMaterial({ map: TX.wallpaperTexture(), roughness: 0.95 }),
    wool: new THREE.MeshStandardMaterial({ map: TX.woolTexture(), roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.6, side: THREE.DoubleSide }),
    hay: new THREE.MeshStandardMaterial({ color: 0xd9bf79, roughness: 0.9, side: THREE.DoubleSide }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.85 }),
    seed: new THREE.MeshStandardMaterial({ map: TX.seedTexture(), roughness: 0.55 }),
    emissive: new THREE.MeshBasicMaterial({ color: 0xffe2a8 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x2f4a3b, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
  };
  W.mats = mats;
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv;
    parent.add(m); return m;
  };
  const box = (parent, w, h, d, mat, x, y, z, cast = true) => add(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z, cast);

  // ---------------------------------------------------------------- terrain height
  const MOUND = { x: 0.22, z: -0.08, r: 0.15, a: 0.045 };
  const TRAY = { x0: -0.30, x1: 0.00, z0: -0.17, z1: 0.03, y: 0.024 };
  const HOUSE = { x0: -0.80, x1: -0.44, z0: -0.41, z1: -0.13, y: 0.012 };
  const RAMP = { x0: 0.41, x1: 0.63, z0: 0.25, z1: 0.35, y: 0.09 };
  const DECK = { x0: 0.63, x1: 0.85, z0: 0.21, z1: 0.39, y: 0.09 };
  const baseNoise = (x, z) => (TX.fbm(x * 9 + 40, z * 9 + 11, 3, 5) - 0.5) * 0.016 + (TX.fbm(x * 30, z * 30, 2, 9) - 0.5) * 0.004;
  const box2 = (x, z, r, t = 0.02) => sstep(0, 1, 1 - clamp(Math.max(r.x0 - x, x - r.x1, r.z0 - z, z - r.z1) / t, 0, 1));
  W.groundY = (x, z) => {
    let y = baseNoise(x, z);
    const md = Math.hypot(x - MOUND.x, z - MOUND.z) / MOUND.r;
    y += MOUND.a * Math.exp(-md * md * 2.2) * 1.0;
    y = lerp(y, TRAY.y, box2(x, z, TRAY, 0.035));
    y = lerp(y, HOUSE.y + 0.004 * Math.sin(x * 30), box2(x, z, HOUSE, 0.03));
    if (x > RAMP.x0 - 0.02 && x < RAMP.x1 + 0.02 && z > RAMP.z0 - 0.02 && z < RAMP.z1 + 0.02) {
      const t = clamp((x - RAMP.x0) / (RAMP.x1 - RAMP.x0), 0, 1);
      y = lerp(y, RAMP.y * t, box2(x, z, RAMP, 0.02));
    }
    y = lerp(y, DECK.y, box2(x, z, DECK, 0.02));
    return y;
  };

  // ---------------------------------------------------------------- room
  const room = new THREE.Group(); root.add(room);
  const wallM = mats.wall;
  add(room, new THREE.PlaneGeometry(9, 4), wallM, 0, 1.1, -1.15, false, true);
  // side walls
  add(room, new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({ color: 0xd8c8aa, roughness: 1 }), -3.6, 1.1, 1, false, true).rotation.y = Math.PI / 2;
  add(room, new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({ color: 0xd8c8aa, roughness: 1 }), 3.6, 1.1, 1, false, true).rotation.y = -Math.PI / 2;
  // wainscot
  box(room, 9, 0.5, 0.03, mats.birch, 0, -0.55, -1.13, false);
  // desk the cage sits on
  const deskTop = box(room, 3.6, 0.08, 1.7, mats.walnut, 0, -0.26, -0.15);
  deskTop.receiveShadow = true;
  box(room, 3.6, 1.0, 0.08, mats.walnut, 0, -0.78, 0.62, false);
  box(room, 0.1, 1.0, 1.6, mats.walnut, -1.75, -0.78, -0.15, false);
  box(room, 0.1, 1.0, 1.6, mats.walnut, 1.75, -0.78, -0.15, false);
  const floor = add(room, new THREE.PlaneGeometry(12, 8), new THREE.MeshStandardMaterial({ map: TX.woodTexture([150, 108, 72], { repeat: [6, 4], seed: 14 }), roughness: 0.6 }), 0, -1.28, 1, false, true);
  floor.rotation.x = -Math.PI / 2;
  // window with live sky
  const sky = TX.makeSkyCanvas();
  W.sky = sky;
  const winG = new THREE.Group(); winG.position.set(1.75, 0.95, -1.12); room.add(winG);
  add(winG, new THREE.PlaneGeometry(0.95, 1.2), new THREE.MeshBasicMaterial({ map: sky.texture, toneMapped: false }), 0, 0, 0.0, false, false);
  const fr = mats.birch;
  box(winG, 1.1, 0.07, 0.07, fr, 0, 0.62, 0.03, false); box(winG, 1.1, 0.07, 0.07, fr, 0, -0.62, 0.03, false);
  box(winG, 0.07, 1.3, 0.07, fr, -0.52, 0, 0.03, false); box(winG, 0.07, 1.3, 0.07, fr, 0.52, 0, 0.03, false);
  box(winG, 0.04, 1.2, 0.04, fr, 0, 0, 0.03, false); box(winG, 0.95, 0.04, 0.04, fr, 0, 0.05, 0.03, false);
  box(winG, 1.3, 0.04, 0.16, fr, 0, -0.67, 0.08, false);
  // curtains
  const curtainM = new THREE.MeshStandardMaterial({ color: 0xb88a6a, roughness: 1, side: THREE.DoubleSide });
  for (const sx of [-0.7, 0.7]) {
    const g = new THREE.PlaneGeometry(0.4, 1.7, 24, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 42) * 0.025 + 0.12);
    g.computeVertexNormals();
    add(winG, g, curtainM, sx, 0.0, 0.0, false, true);
  }
  // table props: books, mug, plant
  const books = new THREE.Group(); books.position.set(-1.5, -0.22, -0.55); room.add(books);
  const bc = [0x7a3b3b, 0x3d5a6c, 0xc9a24a, 0x4d6b4a];
  bc.forEach((c, i) => { const b = box(books, 0.28 - i * 0.012, 0.045, 0.2, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }), 0, 0.022 + i * 0.047, 0); b.rotation.y = (i - 1.5) * 0.12; });
  const mug = add(room, new THREE.CylinderGeometry(0.05, 0.045, 0.1, 24), mats.ceramicBlue, 1.45, -0.17, -0.5);
  add(room, new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI), mats.ceramicBlue, 1.5, -0.17, -0.5).rotation.z = -Math.PI / 2;
  const pot = add(room, new THREE.CylinderGeometry(0.1, 0.07, 0.14, 24), new THREE.MeshStandardMaterial({ color: 0xb06a45, roughness: 0.9 }), -1.2, -0.15, -0.8);
  for (let i = 0; i < 14; i++) {
    const g = new THREE.PlaneGeometry(0.07, 0.3, 1, 5);
    const p = g.attributes.position;
    for (let j = 0; j < p.count; j++) { const y = p.getY(j) + 0.15; p.setZ(j, y * y * 0.8); p.setX(j, p.getX(j) * (1 - y * 1.6)); }
    g.translate(0, 0.15, 0); g.computeVertexNormals();
    const l = add(room, g, mats.leaf, -1.2, -0.08, -0.8);
    l.rotation.y = (i / 14) * Math.PI * 2 + rand(); l.rotation.x = -0.2;
  }
  // hanging lamp (the cozy light source)
  const lampG = new THREE.Group(); lampG.position.set(0.3, 1.2, 0.05); room.add(lampG);
  add(lampG, new THREE.CylinderGeometry(0.004, 0.004, 1.2, 6), mats.black, 0, 0.6, 0, false);
  add(lampG, new THREE.ConeGeometry(0.2, 0.18, 32, 1, true), mats.lamp, 0, 0, 0, false).rotation.x = 0;
  add(lampG, new THREE.SphereGeometry(0.045, 16, 12), mats.emissive, 0, -0.04, 0, false, false);
  W.lampBulb = lampG.children[2];

  // ---------------------------------------------------------------- cage shell
  const cage = new THREE.Group(); root.add(cage);
  const CX = CAGE.x, CZ = CAGE.z, CH = CAGE.h, FLOORY = -0.2;
  // bedding base
  const bedBox = new THREE.Group(); cage.add(bedBox);
  const bedM = new THREE.MeshStandardMaterial({ map: TX.beddingTexture(), roughness: 1, bumpMap: null });
  {
    const fg = new THREE.PlaneGeometry(CX * 2, CZ * 2, 220, 110);
    fg.rotateX(-Math.PI / 2);
    const p = fg.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, W.groundY(p.getX(i), p.getZ(i)) - 0.004);
    fg.computeVertexNormals();
    const fm = new THREE.Mesh(fg, bedM);
    fm.receiveShadow = true; fm.castShadow = false;
    cage.add(fm);
    const sideM = bedM.clone(); sideM.map = bedM.map.clone(); sideM.map.repeat.set(3, 0.35); sideM.map.needsUpdate = true;
    const sb = new THREE.Mesh(new THREE.BoxGeometry(CX * 2, -FLOORY - 0.012, CZ * 2), sideM);
    sb.position.y = FLOORY / 2 - 0.006 - 0.005; sb.receiveShadow = true;
    cage.add(sb);
  }
  // timber frame
  const fw = 0.045;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(cage, fw, CH - FLOORY, fw, mats.walnut, sx * (CX + fw / 2), (CH + FLOORY) / 2, sz * (CZ + fw / 2), false);
  for (const sz of [-1, 1]) { box(cage, CX * 2 + fw * 2, fw, fw, mats.walnut, 0, CH, sz * (CZ + fw / 2), false); box(cage, CX * 2 + fw * 2, 0.06, fw, mats.walnut, 0, FLOORY + 0.03, sz * (CZ + fw / 2), false); }
  for (const sx of [-1, 1]) { box(cage, fw, fw, CZ * 2, mats.walnut, sx * (CX + fw / 2), CH, 0, false); box(cage, fw, 0.06, CZ * 2, mats.walnut, sx * (CX + fw / 2), FLOORY + 0.03, 0, false); }
  box(cage, CX * 2 + 0.2, 0.05, CZ * 2 + 0.2, mats.walnut, 0, FLOORY - 0.03, 0, false);
  // glass: front + both sides
  const gl = (w, h, x, y, z, ry) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.glass); g.position.set(x, y, z); g.rotation.y = ry; g.renderOrder = 5; cage.add(g); return g; };
  W.glassFront = gl(CX * 2, CH - FLOORY, 0, (CH + FLOORY) / 2, CZ + 0.002, 0);
  gl(CZ * 2, CH - FLOORY, -CX - 0.002, (CH + FLOORY) / 2, 0, Math.PI / 2);
  gl(CZ * 2, CH - FLOORY, CX + 0.002, (CH + FLOORY) / 2, 0, -Math.PI / 2);
  // back panel – painted forest backdrop
  const backTex = TX.canvasTex(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6f8f73'); g.addColorStop(0.55, '#a7bd8d'); g.addColorStop(1, '#8a7a52');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = TX.rng(5);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `rgba(${40 + k * 16},${80 + k * 18},${50 + k * 8},${0.28})`;
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * (0.35 + k * 0.1) + Math.sin(x * 0.012 + k * 2) * 40 + Math.sin(x * 0.05 + k) * 12);
      ctx.lineTo(w, h); ctx.fill();
    }
    for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,255,230,${r() * 0.06})`; ctx.beginPath(); ctx.arc(r() * w, r() * h * 0.6, 8 + r() * 40, 0, 7); ctx.fill(); }
  });
  add(cage, new THREE.PlaneGeometry(CX * 2, CH - FLOORY), new THREE.MeshStandardMaterial({ map: backTex, roughness: 1 }), 0, (CH + FLOORY) / 2, -CZ - 0.001, false, true);
  // wire lid
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(CX * 2, CZ * 2), new THREE.MeshStandardMaterial({ map: TX.wireTexture(), transparent: true, alphaTest: 0.5, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide }));
  lid.rotation.x = -Math.PI / 2; lid.position.y = CH - 0.005; cage.add(lid);

  // ---------------------------------------------------------------- bedding flakes (instanced)
  {
    const N = Math.round(26000 * quality);
    const g = new THREE.PlaneGeometry(1, 1, 2, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, (Math.abs(p.getX(i)) < 0.01 ? 0.18 : 0) + (i % 2 ? 0.05 : 0));
    g.rotateX(-Math.PI / 2); g.computeVertexNormals();
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }), N);
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    const pal = [0xe9d9b8, 0xdcc79c, 0xc8aa76, 0xf2e8d2, 0xb8946a, 0xd6bc8a, 0xefe2c4];
    let n = 0;
    while (n < N) {
      const x = (rand() * 2 - 1) * (CX - 0.01), z = (rand() * 2 - 1) * (CZ - 0.01);
      if (box2(x, z, TRAY, 0.0) > 0.01 || box2(x, z, HOUSE, 0.0) > 0.01 || box2(x, z, RAMP, 0.0) > 0.01 || box2(x, z, DECK, 0.0) > 0.01) continue;
      dummy.position.set(x, W.groundY(x, z) + 0.0015 + rand() * 0.004, z);
      dummy.rotation.set((rand() - 0.5) * 0.7, rand() * 6.28, (rand() - 0.5) * 0.7);
      const l = 0.008 + rand() * 0.02;
      dummy.scale.set(l, 0.016 + rand() * 0.012, l * (0.22 + rand() * 0.3));
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      col.setHex(pal[(rand() * pal.length) | 0]).multiplyScalar(0.8 + rand() * 0.3);
      m.setColorAt(n, col);
      n++;
    }
    m.receiveShadow = true; m.castShadow = false;
    cage.add(m);
  }

  // ---------------------------------------------------------------- house
  const house = new THREE.Group(); house.position.set(-0.62, 0, -0.27); cage.add(house);
  {
    box(house, 0.36, 0.012, 0.28, mats.birch, 0, 0.006, 0, false);
    box(house, 0.36, 0.23, 0.016, mats.pine, 0, 0.115, -0.132);           // back
    box(house, 0.016, 0.20, 0.28, mats.pine, -0.18, 0.1, 0);              // left
    box(house, 0.016, 0.20, 0.28, mats.pine, 0.18, 0.1, 0);               // right
    // gables
    for (const sx of [-1, 1]) {
      const tri = new THREE.Shape(); tri.moveTo(-0.14, 0); tri.lineTo(0.14, 0); tri.lineTo(0, 0.07); tri.lineTo(-0.14, 0);
      const gm = new THREE.Mesh(new THREE.ShapeGeometry(tri), mats.pine);
      gm.position.set(sx * 0.18, 0.2, 0); gm.rotation.y = Math.PI / 2; gm.castShadow = true; house.add(gm);
    }
    // roof
    const roofM = new THREE.MeshStandardMaterial({ map: TX.woodTexture([128, 86, 56], { repeat: [3, 2], seed: 22, rings: 22 }), roughness: 0.8 });
    for (const sz of [-1, 1]) {
      const r = box(house, 0.46, 0.014, 0.19, roofM, 0, 0.255, sz * 0.082);
      r.rotation.x = sz * 0.52;
      r.position.y = 0.245;
    }
    box(house, 0.46, 0.02, 0.03, mats.darkWood, 0, 0.283, 0, false);
    // door arch posts + front step
    box(house, 0.02, 0.2, 0.02, mats.darkWood, -0.17, 0.1, 0.14, false); box(house, 0.02, 0.2, 0.02, mats.darkWood, 0.17, 0.1, 0.14, false);
    box(house, 0.36, 0.035, 0.02, mats.darkWood, 0, 0.0175, 0.145, false);
    // round window glow on the left wall
    const win = add(house, new THREE.CircleGeometry(0.035, 24), new THREE.MeshBasicMaterial({ color: 0xffcf8a }), -0.173, 0.13, -0.03, false, false); win.rotation.y = Math.PI / 2;
    // nest: soft lumps
    const nest = new THREE.Group(); nest.position.set(0.02, 0.012, -0.03); house.add(nest);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2, r = 0.075 + rand() * 0.025;
      const m = add(nest, new THREE.SphereGeometry(0.04 + rand() * 0.02, 14, 10), mats.wool, Math.cos(a) * r, 0.012 + rand() * 0.015, Math.sin(a) * r * 0.8);
      m.scale.y = 0.45;
    }
    for (let i = 0; i < 8; i++) { const m = add(nest, new THREE.SphereGeometry(0.05, 12, 8), mats.wool, (rand() - 0.5) * 0.08, 0.006, (rand() - 0.5) * 0.06); m.scale.y = 0.3; }
    // rug
    const rug = add(house, new THREE.CylinderGeometry(0.085, 0.085, 0.004, 32), new THREE.MeshStandardMaterial({ color: 0x9c5a4a, roughness: 1 }), 0.0, 0.014, 0.08, false, true);
    // fairy lights in house
    const strand = [];
    for (let i = 0; i < 9; i++) {
      const x = -0.15 + i * 0.0375, y = 0.205 + 0.012 * Math.sin(i * 1.7);
      const b = add(house, new THREE.SphereGeometry(0.0045, 8, 6), mats.emissive, x, y, -0.1, false, false); strand.push(b);
    }
  }
  const houseLight = new THREE.PointLight(0xffb870, 0.14, 0.8, 2); houseLight.position.set(-0.62, 0.17, -0.2); cage.add(houseLight);
  W.houseLight = houseLight;

  // ---------------------------------------------------------------- wheel
  const wheel = new THREE.Group(); wheel.position.set(0.52, 0.19, -0.27); cage.add(wheel);
  const wheelSpin = new THREE.Group(); wheel.add(wheelSpin);
  {
    const R = 0.155, Wd = 0.12;
    const trackTex = TX.woodTexture([190, 140, 88], { repeat: [10, 1], seed: 30, rings: 8 });
    const trackM = new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.8, side: THREE.DoubleSide });
    const tg = new THREE.CylinderGeometry(R, R, Wd, 72, 1, true); tg.rotateX(Math.PI / 2);
    add(wheelSpin, tg, trackM, 0, 0, 0);
    const back = add(wheelSpin, new THREE.CircleGeometry(R, 48), mats.darkWood, 0, 0, -Wd / 2, true, true); back.rotation.y = Math.PI;
    // spokes decoration
    for (let i = 0; i < 6; i++) { const s = box(wheelSpin, 0.012, R * 0.8, 0.008, mats.pine, 0, 0, -Wd / 2 + 0.006, false); s.position.set(Math.sin(i / 6 * Math.PI) * 0, 0, 0); s.rotation.z = i / 6 * Math.PI; s.geometry = new THREE.BoxGeometry(0.01, R * 1.7, 0.006); }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.002, 0.006, 8, 72), mats.pine); rim.position.z = Wd / 2; rim.castShadow = true; wheelSpin.add(rim);
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R - 0.002, 0.006, 8, 72), mats.pine); rim2.position.z = -Wd / 2; wheelSpin.add(rim2);
    // rungs for visible motion
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; const r = box(wheelSpin, 0.014, 0.003, Wd - 0.004, mats.darkWood, Math.sin(a) * (R - 0.002), -Math.cos(a) * (R - 0.002), 0, false); r.rotation.z = a; }
    add(wheelSpin, new THREE.CylinderGeometry(0.014, 0.014, 0.03, 16), mats.metal, 0, 0, -Wd / 2 - 0.012).rotation.x = Math.PI / 2;
    // stand
    box(wheel, 0.03, 0.2, 0.02, mats.darkWood, 0, -0.1, -Wd / 2 - 0.035);
    box(wheel, 0.3, 0.02, 0.2, mats.darkWood, 0, -0.18, -0.02, false);
  }
  W.wheel = { group: wheel, spin: wheelSpin, angle: 0, vel: 0, innerY: 0.19 - 0.15, cx: 0.52, cz: -0.27, R: 0.15 };

  // ---------------------------------------------------------------- food bowl + seeds
  const BOWL = { x: 0.25, z: 0.19 };
  const bowl = new THREE.Group(); bowl.position.set(BOWL.x, 0, BOWL.z); cage.add(bowl);
  {
    const prof = [[0, 0.002], [0.034, 0.002], [0.05, 0.012], [0.059, 0.028], [0.062, 0.04], [0.058, 0.042], [0.054, 0.03], [0.046, 0.016], [0.0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y));
    const lg = new THREE.LatheGeometry(prof, 48);
    add(bowl, lg, mats.ceramic, 0, 0, 0);
    const rimBand = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0016, 6, 48), mats.ceramicBlue); rimBand.rotation.x = Math.PI / 2; rimBand.position.y = 0.04; bowl.add(rimBand);
  }
  // seeds in bowl
  const seedGeo = new THREE.SphereGeometry(1, 12, 10); seedGeo.rotateX(Math.PI / 2); seedGeo.scale(0.0042, 0.0020, 0.0078);
  const MAXSEEDS = 70;
  const bowlSeeds = new THREE.InstancedMesh(seedGeo, mats.seed, MAXSEEDS);
  bowlSeeds.castShadow = true; bowlSeeds.receiveShadow = true; bowl.add(bowlSeeds);
  const seedPos = [];
  for (let i = 0; i < MAXSEEDS; i++) {
    const a = rand() * 6.28, r = Math.sqrt(rand()) * 0.042;
    seedPos.push({ x: Math.cos(a) * r, y: 0.014 + (1 - r / 0.042) * 0.008 + rand() * 0.006, z: Math.sin(a) * r, ry: rand() * 6.28, rz: (rand() - 0.5) });
  }
  W.food = { count: 55, max: MAXSEEDS };
  const seedDummy = new THREE.Object3D();
  W.refreshBowl = () => {
    for (let i = 0; i < MAXSEEDS; i++) {
      const s = seedPos[i];
      seedDummy.position.set(s.x, s.y, s.z); seedDummy.rotation.set(0, s.ry, s.rz); seedDummy.scale.setScalar(i < W.food.count ? 1 : 0.0001);
      seedDummy.updateMatrix(); bowlSeeds.setMatrixAt(i, seedDummy.matrix);
    }
    bowlSeeds.instanceMatrix.needsUpdate = true;
  };
  W.refreshBowl();

  // stash pile in house
  const STASH = { x: -0.73, z: -0.36 };
  const stashSeeds = new THREE.InstancedMesh(seedGeo, mats.seed, 140);
  stashSeeds.castShadow = true; cage.add(stashSeeds);
  W.stash = { count: 6 };
  const stashPos = [];
  for (let i = 0; i < 140; i++) { const a = rand() * 6.28, r = Math.sqrt(rand()) * 0.045; stashPos.push({ x: STASH.x + Math.cos(a) * r, z: STASH.z + Math.sin(a) * r * 0.6, ry: rand() * 6.28, h: (1 - r / 0.045) * 0.012 + rand() * 0.004 }); }
  W.refreshStash = () => {
    for (let i = 0; i < 140; i++) {
      const s = stashPos[i];
      seedDummy.position.set(s.x, HOUSE.y + 0.003 + s.h, s.z); seedDummy.rotation.set(0, s.ry, (i % 3) * 0.4); seedDummy.scale.setScalar(i < W.stash.count ? 1 : 0.0001);
      seedDummy.updateMatrix(); stashSeeds.setMatrixAt(i, seedDummy.matrix);
    }
    stashSeeds.instanceMatrix.needsUpdate = true;
  };
  W.refreshStash();

  // ---------------------------------------------------------------- water bottle (right wall)
  const bottle = new THREE.Group(); bottle.position.set(CX - 0.035, 0, 0.14); cage.add(bottle);
  const SPOUT = new V3(CX - 0.062, 0.150, 0.14);
  {
    box(bottle, 0.012, 0.3, 0.07, mats.darkWood, 0.028, 0.36, 0, false);
    const glassB = add(bottle, new THREE.CylinderGeometry(0.032, 0.032, 0.2, 32), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, roughness: 0.05, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false }), 0, 0.415, 0, false);
    const water = add(bottle, new THREE.CylinderGeometry(0.029, 0.029, 0.15, 32), new THREE.MeshPhysicalMaterial({ color: 0x8ec9ff, roughness: 0.05, transparent: true, opacity: 0.45, transmission: 0 }), 0, 0.39, 0, false);
    W.bottleWater = water;
    add(bottle, new THREE.CylinderGeometry(0.03, 0.024, 0.03, 24), mats.black, 0, 0.30, 0);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 10), mats.metal);
    const A = new V3(0, 0.29, 0), B = new V3(SPOUT.x - bottle.position.x, SPOUT.y, 0);
    tube.position.copy(A).add(B).multiplyScalar(0.5);
    tube.scale.y = A.distanceTo(B);
    tube.quaternion.setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
    tube.castShadow = true; bottle.add(tube);
    const tip = add(bottle, new THREE.SphereGeometry(0.0055, 12, 10), mats.metal, B.x, B.y - 0.001, 0);
    const bubbleM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    W.bubble = add(bottle, new THREE.SphereGeometry(0.004, 8, 6), bubbleM, 0.0, 0.34, 0, false, false); W.bubble.visible = false;
    W.drip = add(bottle, new THREE.SphereGeometry(0.0022, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0xaad8ff, roughness: 0, transparent: true, opacity: 0.8 }), B.x, B.y - 0.008, 0, false, false);
  }

  // ---------------------------------------------------------------- sand bath
  const tray = new THREE.Group(); cage.add(tray);
  {
    const cx = (TRAY.x0 + TRAY.x1) / 2, cz = (TRAY.z0 + TRAY.z1) / 2, w = TRAY.x1 - TRAY.x0, d = TRAY.z1 - TRAY.z0;
    const wallsM = mats.ceramic;
    box(tray, w + 0.02, 0.04, 0.012, wallsM, cx, 0.02, TRAY.z0 - 0.006); box(tray, w + 0.02, 0.04, 0.012, wallsM, cx, 0.02, TRAY.z1 + 0.006);
    box(tray, 0.012, 0.04, d, wallsM, TRAY.x0 - 0.006, 0.02, cz); box(tray, 0.012, 0.04, d, wallsM, TRAY.x1 + 0.006, 0.02, cz);
    const sg = new THREE.PlaneGeometry(w, d, 80, 56); sg.rotateX(-Math.PI / 2);
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * 90 + TX.vnoise(x * 12, z * 12) * 5) * 0.0008 + TX.fbm(x * 40, z * 40, 3) * 0.004); }
    sg.computeVertexNormals();
    const sm = new THREE.Mesh(sg, mats.sand); sm.position.set(cx, TRAY.y - 0.002, cz); sm.receiveShadow = true; tray.add(sm);
    W.sandMesh = sm;
  }

  // ---------------------------------------------------------------- cork tunnel
  const LOG = { x0: -0.42, x1: -0.02, z: 0.30 };
  {
    const len = LOG.x1 - LOG.x0;
    const og = new THREE.CylinderGeometry(0.085, 0.09, len, 40, 18, true); og.rotateZ(Math.PI / 2);
    const p = og.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = (TX.fbm(x * 18, Math.atan2(y, z) * 3, 3, 4) - 0.5) * 0.014; const r = Math.hypot(y, z); const k = (r + n) / r; p.setY(i, y * k); p.setZ(i, z * k); }
    og.computeVertexNormals();
    const log = new THREE.Group(); log.position.set((LOG.x0 + LOG.x1) / 2, 0.06, LOG.z); cage.add(log);
    add(log, og, mats.cork, 0, 0, 0);
    const ig = new THREE.CylinderGeometry(0.06, 0.06, len - 0.002, 28, 1, true); ig.rotateZ(Math.PI / 2);
    add(log, ig, mats.corkIn, 0, 0, 0, false, true);
    for (const sx of [-1, 1]) { const rg = new THREE.RingGeometry(0.059, 0.087, 36); const r = add(log, rg, mats.cork, sx * len / 2, 0, 0); r.rotation.y = Math.PI / 2; }
  }

  // ---------------------------------------------------------------- platform + ramp lookout
  {
    const dk = new THREE.Group(); cage.add(dk);
    const cx = (DECK.x0 + DECK.x1) / 2, cz = (DECK.z0 + DECK.z1) / 2;
    box(dk, DECK.x1 - DECK.x0, 0.014, DECK.z1 - DECK.z0, mats.pine, cx, DECK.y - 0.007, cz);
    for (const px of [DECK.x0 + 0.015, DECK.x1 - 0.015]) for (const pz of [DECK.z0 + 0.015, DECK.z1 - 0.015]) box(dk, 0.025, DECK.y, 0.025, mats.darkWood, px, DECK.y / 2 - 0.007, pz);
    // fence
    const rail = (w, d, x, z, h = 0.03) => box(dk, w, 0.012, d, mats.darkWood, x, DECK.y + h, z, false);
    rail(DECK.x1 - DECK.x0 + 0.02, 0.012, cx, DECK.z0 - 0.002); rail(DECK.x1 - DECK.x0 + 0.02, 0.012, cx, DECK.z1 + 0.002);
    rail(0.012, DECK.z1 - DECK.z0, DECK.x1 + 0.002, cz);
    rail(0.012, 0.045, DECK.x0 - 0.002, DECK.z0 + 0.02); rail(0.012, 0.045, DECK.x0 - 0.002, DECK.z1 - 0.02);
    for (const [px, pz] of [[DECK.x0, DECK.z0], [DECK.x1, DECK.z0], [DECK.x0, DECK.z1], [DECK.x1, DECK.z1], [DECK.x1, cz], [cx, DECK.z0], [cx, DECK.z1]]) box(dk, 0.012, 0.045, 0.012, mats.darkWood, px, DECK.y + 0.02, pz, false);
    // ramp
    const len = Math.hypot(RAMP.x1 - RAMP.x0, RAMP.y), ang = Math.atan2(RAMP.y, RAMP.x1 - RAMP.x0);
    const rg = new THREE.Group(); rg.position.set((RAMP.x0 + RAMP.x1) / 2, RAMP.y / 2 - 0.006, (RAMP.z0 + RAMP.z1) / 2); rg.rotation.z = ang; dk.add(rg);
    box(rg, len, 0.012, RAMP.z1 - RAMP.z0 + 0.02, mats.pine, 0, 0, 0);
    for (let i = 1; i < 9; i++) box(rg, 0.007, 0.006, RAMP.z1 - RAMP.z0, mats.darkWood, -len / 2 + i * len / 9, 0.008, 0, false);
    for (const sz of [RAMP.z0 - 0.008, RAMP.z1 + 0.008]) box(rg, len, 0.03, 0.01, mats.darkWood, 0, 0.012, sz, false);
  }

  // ---------------------------------------------------------------- branch, stones, plants, hay
  {
    const curve = new THREE.CatmullRomCurve3([new V3(-0.30, 0.02, -0.37), new V3(-0.12, 0.045, -0.35), new V3(0.06, 0.03, -0.385), new V3(0.28, 0.055, -0.36)]);
    const tg = new THREE.TubeGeometry(curve, 40, 0.022, 12, false);
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = TX.fbm(x * 40, z * 40 + y * 30, 3, 8) * 0.006; p.setY(i, y + n); }
    tg.computeVertexNormals();
    add(cage, tg, mats.bark, 0, 0, 0);
    const tw = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(-0.04, 0.05, -0.36), new V3(-0.03, 0.10, -0.36), new V3(0.0, 0.15, -0.37)]), 10, 0.009, 8), mats.bark); tw.castShadow = true; cage.add(tw);
  }
  const rocks = [[0.40, 0.08, 0.05], [-0.84, 0.17, 0.065], [0.27, -0.30, 0.04]];
  rocks.forEach(([x, z, r], i) => {
    const g = new THREE.SphereGeometry(r, 24, 16);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const v = new V3(p.getX(k), p.getY(k), p.getZ(k)); const n = 1 + (TX.fbm(v.x * 30 + i * 9, v.z * 30 + v.y * 20, 3, 6) - 0.5) * 0.5; v.multiplyScalar(n); v.y *= 0.7; p.setXYZ(k, v.x, v.y, v.z); }
    g.computeVertexNormals();
    add(cage, g, mats.stone, x, r * 0.4, z);
  });
  // fake plant, back right
  const plant = new THREE.Group(); plant.position.set(0.80, 0, -0.36); cage.add(plant);
  for (let i = 0; i < 18; i++) {
    const g = new THREE.PlaneGeometry(0.05, 0.28, 1, 6);
    const p = g.attributes.position;
    for (let j = 0; j < p.count; j++) { const y = p.getY(j) + 0.14; p.setZ(j, y * y * 1.2); p.setX(j, p.getX(j) * (1 - y * 1.4)); }
    g.translate(0, 0.14, 0); g.computeVertexNormals();
    const l = add(plant, g, mats.leaf, 0, 0, 0);
    l.rotation.y = (i / 18) * Math.PI * 2; l.rotation.x = -0.15 - rand() * 0.2; l.scale.setScalar(0.7 + rand() * 0.7);
  }
  // hay tufts
  {
    const bg = new THREE.PlaneGeometry(0.05, 1, 1, 4); const bp = bg.attributes.position;
    for (let j = 0; j < bp.count; j++) { const y = bp.getY(j) + 0.5; bp.setX(j, bp.getX(j) * (1 - y * 0.9)); bp.setZ(j, y * y * 0.4); }
    bg.translate(0, 0.5, 0);
    const N = Math.round(900 * quality);
    const im = new THREE.InstancedMesh(bg, mats.hay, N);
    const d = new THREE.Object3D();
    const clumps = [[-0.40, -0.02], [-0.9, -0.42], [0.88, 0.42], [-0.6, 0.40], [0.2, -0.42], [-0.15, 0.2], [0.1, 0.40]];
    for (let i = 0; i < N; i++) {
      const c = clumps[i % clumps.length];
      const x = clamp(c[0] + (rand() - 0.5) * 0.18, -0.88, 0.88), z = clamp(c[1] + (rand() - 0.5) * 0.14, -0.43, 0.43);
      if (box2(x, z, TRAY, 0.0) > 0.01 || box2(x, z, HOUSE, 0.0) > 0.01 || box2(x, z, RAMP, 0.0) > 0.01 || box2(x, z, DECK, 0.0) > 0.01) { i--; continue; }
      d.position.set(x, W.groundY(x, z), z);
      d.rotation.set((rand() - 0.5) * 1.0, rand() * 6.28, (rand() - 0.5) * 0.6);
      d.scale.setScalar(0.03 + rand() * 0.05);
      d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    }
    im.castShadow = false; im.receiveShadow = true; cage.add(im);
  }

  // ---------------------------------------------------------------- fairy lights along top back
  const fairy = [];
  {
    const pts = [];
    for (let i = 0; i <= 22; i++) { const x = -CX + 0.04 + (i / 22) * (CX * 2 - 0.08); pts.push({ x, y: CH - 0.07 - 0.04 * Math.sin((i / 22) * Math.PI * 3) - 0.03, z: -CZ + 0.04 }); }
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(p.x, p.y, p.z))), 120, 0.0015, 4), mats.black); cage.add(wire);
    pts.forEach((p, i) => { const b = add(cage, new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd7a0 : 0xffe9c8 }), p.x, p.y - 0.006, p.z, false, false); fairy.push(b); });
    for (const i of [3, 11, 19]) { const l = new THREE.PointLight(0xffc27a, 0.25, 1.3, 2); l.position.set(pts[i].x, pts[i].y - 0.03, pts[i].z + 0.05); cage.add(l); fairy.push(l); }
  }
  W.fairy = fairy;

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0xffeedd, 0x6b5640, 0.5); scene.add(hemi);
  const lamp = new THREE.SpotLight(0xffbf7a, 28, 0, 0.62, 0.75, 2);
  lamp.position.set(0.3, 1.16, 0.05); lamp.target.position.set(-0.05, 0, -0.05);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(quality >= 1 ? 4096 : 2048, quality >= 1 ? 4096 : 2048);
  lamp.shadow.bias = -0.00006; lamp.shadow.normalBias = 0.0008; lamp.shadow.radius = 3; lamp.shadow.camera.near = 0.3; lamp.shadow.camera.far = 3;
  scene.add(lamp, lamp.target);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.5);
  sun.position.set(2.6, 1.6, -0.6); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -1.2; sc.right = 1.2; sc.top = 1.2; sc.bottom = -1.2; sc.near = 0.5; sc.far = 6;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.002;
  scene.add(sun, sun.target);
  W.lights = { hemi, lamp, sun };
  W.lampOn = true; W.fairyOn = true;

  const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  let lastSky = -1;
  W.setTime = (hour) => {
    W.time = hour;
    const dayK = clamp(Math.sin(((hour - 6) / 12) * Math.PI), 0, 1);       // 0 night .. 1 noon
    const dusk = sstep(0, 0.35, dayK) * (1 - sstep(0.35, 0.8, dayK));
    sun.intensity = 0.15 + 2.4 * dayK;
    sun.color.copy(lerpC(0x8fa6ff, 0xfff2dc, sstep(0.0, 0.5, dayK))).lerp(new THREE.Color(0xffa860), dusk * 0.7);
    const ang = ((hour - 6) / 12) * Math.PI;
    sun.position.set(2.6, 0.8 + Math.sin(ang) * 2.2, -0.6 + Math.cos(ang) * 0.9);
    hemi.intensity = 0.16 + 0.55 * dayK;
    hemi.color.copy(lerpC(0x5668a8, 0xfff1e0, dayK)); hemi.groundColor.copy(lerpC(0x241d26, 0x6b5640, dayK));
    scene.environmentIntensity = 0.1 + 0.3 * dayK;
    lamp.intensity = W.lampOn ? 28 : 0;
    if (Math.abs(hour - lastSky) > 0.05) { sky.draw(hour); lastSky = hour; }
    const lit = W.fairyOn;
    fairy.forEach((f) => { if (f.isLight) f.visible = lit; else f.visible = lit; });
    W.lampBulb.material.color.set(W.lampOn ? 0xffe2a8 : 0x6a5a48);
    renderer.toneMappingExposure = 0.95 + 0.25 * (1 - dayK);
  };

  // ---------------------------------------------------------------- spots + nav
  W.spots = {
    nest: { x: -0.62, z: -0.30, yaw: 1.2 },
    stash: { x: -0.73, z: -0.34, yaw: -1.57 },
    houseDoor: { x: -0.62, z: -0.06, yaw: 0 },
    bowl: BOWL,
    wheelEntry: { x: 0.52, z: -0.115 },
    drink: { x: 0.74, z: 0.14, yaw: Math.PI / 2 },
    spout: SPOUT,
    sand: { x: -0.15, z: -0.07 },
    tunnelW: { x: -0.50, z: LOG.z }, tunnelE: { x: 0.06, z: LOG.z },
    rampBase: { x: 0.35, z: 0.30 }, deck: { x: 0.74, z: 0.30 },
    dig: { x: -0.48, z: 0.10 },
    gnaw: { x: -0.18, z: -0.28 },
    rock: { x: 0.40, z: 0.08 },
  };
  W.HOUSE = HOUSE; W.TRAY = TRAY; W.RAMP = RAMP; W.DECK = DECK; W.LOG = LOG; W.BOWL = BOWL; W.STASH = STASH;
  W.houseGroup = house; W.cage = cage; W.bowlGroup = bowl; W.bottleGroup = bottle;

  const rect = (x0, z0, x1, z1) => ({ t: 'r', x0, z0, x1, z1 });
  const circ = (x, z, r) => ({ t: 'c', x, z, r });
  const obstacles = [
    rect(-0.81, -0.42, -0.43, -0.39), rect(-0.81, -0.42, -0.78, -0.13), rect(-0.45, -0.42, -0.42, -0.13),  // house walls
    rect(0.37, -0.42, 0.67, -0.20),                                                                       // wheel
    circ(BOWL.x, BOWL.z, 0.062),
    rect(LOG.x0, 0.22, LOG.x1, 0.24), rect(LOG.x0, 0.36, LOG.x1, 0.38),                                    // tunnel walls
    rect(-0.32, -0.42, 0.28, -0.33),                                                                      // branch
    ...rocks.map(([x, z, r]) => circ(x, z, r * 0.9)),
    circ(0.80, -0.36, 0.05),
    rect(RAMP.x0, 0.23, RAMP.x1, 0.25), rect(RAMP.x0, 0.35, RAMP.x1, 0.37),                                // ramp rails
    rect(0.83, 0.19, 0.85, 0.41), rect(DECK.x0, 0.19, 0.85, 0.21), rect(DECK.x0, 0.39, 0.85, 0.41),      // deck fence
    rect(0.61, 0.19, 0.63, 0.25), rect(0.61, 0.35, 0.63, 0.41),
    rect(LOG.x0 - 0.0, 0.215, LOG.x0 + 0.0, 0.385),
  ];
  const CELL = 0.02, GX = Math.round((CX * 2) / CELL), GZ = Math.round((CZ * 2) / CELL);
  const grid = new Uint8Array(GX * GZ);
  const INF = 0.03, EDGE = 0.045;
  const cellC = (i, j) => [-CX + (i + 0.5) * CELL, -CZ + (j + 0.5) * CELL];
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const [x, z] = cellC(i, j);
    let b = Math.abs(x) > CX - EDGE || Math.abs(z) > CZ - EDGE;
    if (!b) for (const o of obstacles) {
      if (o.t === 'c') { if (Math.hypot(x - o.x, z - o.z) < o.r + INF) { b = true; break; } }
      else if (x > o.x0 - INF && x < o.x1 + INF && z > o.z0 - INF && z < o.z1 + INF) { b = true; break; }
    }
    grid[j * GX + i] = b ? 1 : 0;
  }
  // wheel interior is not walkable via nav; the entry corridor is cleared explicitly
  const toCell = (x, z) => [clamp(Math.floor((x + CX) / CELL), 0, GX - 1), clamp(Math.floor((z + CZ) / CELL), 0, GZ - 1)];
  W.walkable = (x, z) => { const [i, j] = toCell(x, z); return !grid[j * GX + i]; };
  function nearestFree(i, j) {
    if (!grid[j * GX + i]) return [i, j];
    for (let r = 1; r < 14; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= GX || jj >= GZ) continue;
      if (!grid[jj * GX + ii]) return [ii, jj];
    }
    return [i, j];
  }
  const los = (a, b) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let k = 0; k <= n; k++) {
      const t = k / (n || 1), i = Math.round(a[0] + (b[0] - a[0]) * t), j = Math.round(a[1] + (b[1] - a[1]) * t);
      if (grid[j * GX + i]) return false;
    }
    return true;
  };
  W.findPath = (sx, sz, gx, gz) => {
    const s = nearestFree(...toCell(sx, sz)), g = nearestFree(...toCell(gx, gz));
    const open = [[0, s[0], s[1]]], came = new Map(), cost = new Map();
    const key = (i, j) => j * GX + i;
    cost.set(key(...s), 0);
    const hh = (i, j) => { const dx = Math.abs(i - g[0]), dz = Math.abs(j - g[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    let found = false;
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, ci, cj] = open.splice(bi, 1)[0];
      if (ci === g[0] && cj === g[1]) { found = true; break; }
      const cc = cost.get(key(ci, cj));
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ || grid[nj * GX + ni]) continue;
        if (di && dj && (grid[cj * GX + ni] || grid[nj * GX + ci])) continue;
        const nc = cc + (di && dj ? 1.414 : 1), k = key(ni, nj);
        if (!cost.has(k) || nc < cost.get(k)) { cost.set(k, nc); came.set(k, [ci, cj]); open.push([nc + hh(ni, nj), ni, nj]); }
      }
    }
    if (!found) return [new V3(gx, 0, gz)];
    const path = [[g[0], g[1]]];
    let cur = g;
    while (came.has(key(...cur))) { cur = came.get(key(...cur)); path.push(cur); }
    path.reverse();
    // string pull
    const out = [path[0]]; let anchor = 0;
    for (let k = 2; k < path.length; k++) if (!los(path[anchor], path[k])) { out.push(path[k - 1]); anchor = k - 1; }
    out.push(path[path.length - 1]);
    const pts = out.map(([i, j]) => { const [x, z] = cellC(i, j); return new V3(x, 0, z); });
    pts[pts.length - 1].set(clamp(gx, -CX + 0.04, CX - 0.04), 0, clamp(gz, -CZ + 0.04, CZ - 0.04));
    if (W.walkable(gx, gz) === false) pts[pts.length - 1].set(...(() => { const [x, z] = cellC(...g); return [x, 0, z]; })());
    return pts.slice(1).length ? pts.slice(1) : pts;
  };
  W.randomFree = (pred = () => true) => {
    for (let k = 0; k < 60; k++) {
      const x = (rand() * 2 - 1) * (CX - 0.1), z = (rand() * 2 - 1) * (CZ - 0.08);
      if (W.walkable(x, z) && pred(x, z)) return { x, z };
    }
    return { x: 0, z: 0.1 };
  };

  // ---------------------------------------------------------------- particles
  {
    const N = 260;
    const g = new THREE.IcosahedronGeometry(1, 0);
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), N);
    m.frustumCulled = false; m.castShadow = false;
    const parts = Array.from({ length: N }, () => ({ life: 0, max: 1, p: new V3(), v: new V3(), s: 0.002, g: 1, spin: 0, c: new THREE.Color() }));
    const d = new THREE.Object3D();
    let next = 0;
    for (let i = 0; i < N; i++) { d.scale.setScalar(0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, new THREE.Color(1, 1, 1)); }
    scene.add(m);
    W.emit = (pos, vel, color, size = 0.002, life = 0.8, gravity = 1) => {
      const p = parts[next]; next = (next + 1) % N;
      p.life = p.max = life * (0.7 + Math.random() * 0.6); p.p.copy(pos); p.v.copy(vel); p.s = size * (0.6 + Math.random() * 0.8); p.g = gravity; p.c.set(color);
      m.setColorAt(parts.indexOf(p), p.c); m.instanceColor.needsUpdate = true;
    };
    W.updateParticles = (dt) => {
      for (let i = 0; i < N; i++) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.v.y -= 2.2 * p.g * dt; p.v.multiplyScalar(1 - 1.2 * dt);
          p.p.addScaledVector(p.v, dt);
          const gy = W.groundY(p.p.x, p.p.z);
          if (p.p.y < gy) { p.p.y = gy; p.v.set(0, 0, 0); }
          const k = Math.min(1, p.life / (p.max * 0.4)) * p.s;
          d.position.copy(p.p); d.scale.setScalar(Math.max(k, 0)); d.rotation.set(i, i * 2, 0); d.updateMatrix();
          m.setMatrixAt(i, d.matrix);
        } else if (p.max > 0) { p.max = 0; d.scale.setScalar(0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
      }
      m.instanceMatrix.needsUpdate = true;
    };
  }

  // ---------------------------------------------------------------- treats the visitor drops in
  W.treats = [];
  const treatGeo = new THREE.SphereGeometry(1, 12, 10); treatGeo.rotateX(Math.PI / 2); treatGeo.scale(0.0055, 0.0030, 0.011);
  W.dropTreat = (x, z, type = 'seed') => {
    const mesh = new THREE.Mesh(type === 'peanut' ? new THREE.CapsuleGeometry(0.007, 0.012, 4, 10) : treatGeo, type === 'peanut' ? new THREE.MeshStandardMaterial({ color: 0xc9a26d, roughness: 0.85 }) : mats.seed);
    mesh.position.set(x, 0.6, z); mesh.rotation.set(type === 'peanut' ? 0 : 0, Math.random() * 6, type === 'peanut' ? Math.PI / 2 : 0);
    mesh.castShadow = true; scene.add(mesh);
    const t = { mesh, x, z, vy: 0, landed: false, type, eaten: false };
    W.treats.push(t);
    return t;
  };
  W.updateTreats = (dt) => {
    for (const t of W.treats) {
      if (t.landed) continue;
      t.vy -= 4 * dt; t.mesh.position.y += t.vy * dt;
      const gy = W.groundY(t.x, t.z) + 0.003;
      if (t.mesh.position.y <= gy) { t.mesh.position.y = gy; t.landed = true; }
    }
  };
  W.removeTreat = (t) => { scene.remove(t.mesh); t.eaten = true; W.treats = W.treats.filter((q) => q !== t); };

  W.glassFront.visible = true;
  W.setTime(20);
  return W;
}
