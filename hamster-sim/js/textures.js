// Procedural textures – everything in the sim is generated, no external assets.
import * as THREE from 'three';

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function h2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 144665);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sm = (t) => t * t * (3 - 2 * t);
export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = sm(x - xi), yf = sm(y - yi);
  const a = h2(xi, yi, seed), b = h2(xi + 1, yi, seed), c = h2(xi, yi + 1, seed), d = h2(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
export function fbm(x, y, oct = 4, seed = 0) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, seed + i * 17); f *= 2.02; a *= 0.5; }
  return v;
}

export function pixelTex(w, h, fn, { srgb = true, repeat = [1, 1], aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const r = fn(x / w, y / h, x, y);
      d[o] = r[0]; d[o + 1] = r[1]; d[o + 2] = r[2]; d[o + 3] = r.length > 3 ? r[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, srgb, repeat, aniso);
}
export function canvasTex(w, h, draw, { srgb = true, repeat = [1, 1], aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return finish(c, srgb, repeat, aniso);
}
function finish(c, srgb, repeat, aniso) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}
const clamp8 = (v) => Math.max(0, Math.min(255, v));

export function woodTexture(base = [176, 126, 76], { size = 512, repeat = [1, 1], rings = 16, seed = 3 } = {}) {
  return pixelTex(size, size, (u, v) => {
    const ring = u * rings + 3.2 * fbm(u * 2.2, v * 0.8, 3, seed);
    const g = 0.5 + 0.5 * Math.sin(ring * 6.2831);
    const streak = vnoise(u * 260, v * 7, seed + 9);
    const knot = fbm(u * 6, v * 3, 3, seed + 4);
    const k = 0.72 + 0.22 * g + 0.14 * (streak - 0.5) + 0.12 * (knot - 0.5);
    return [clamp8(base[0] * k), clamp8(base[1] * k), clamp8(base[2] * k)];
  }, { repeat });
}

export function corkTexture(size = 512) {
  return pixelTex(size, size, (u, v) => {
    const n = fbm(u * 40, v * 40, 4, 5);
    const s = vnoise(u * 160, v * 160, 8);
    const dark = s > 0.82 ? 0.55 : 1;
    const k = (0.62 + 0.55 * n) * dark;
    return [clamp8(150 * k), clamp8(104 * k), clamp8(64 * k)];
  }, { repeat: [2, 1] });
}

// Paper / aspen bedding ground texture
export function beddingTexture(size = 1024) {
  const r = rng(11);
  return canvasTex(size, size, (ctx, w, h) => {
    ctx.fillStyle = '#c8ab80';
    ctx.fillRect(0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const n = fbm(x / 64, y / 64, 4, 2) * 0.5 + vnoise(x / 3, y / 3, 6) * 0.5;
      const k = 0.7 + 0.5 * n;
      id.data[o] = clamp8(id.data[o] * k); id.data[o + 1] = clamp8(id.data[o + 1] * k); id.data[o + 2] = clamp8(id.data[o + 2] * (k * 0.95));
    }
    ctx.putImageData(id, 0, 0);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, l = 12 + r() * 40;
      const tone = r();
      ctx.strokeStyle = tone < 0.3 ? 'rgba(244,230,200,0.5)' : tone < 0.7 ? 'rgba(190,150,100,0.5)' : 'rgba(120,88,56,0.35)';
      ctx.lineWidth = 1.5 + r() * 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  }, { repeat: [3, 2] });
}

export function sandTexture(size = 512) {
  return pixelTex(size, size, (u, v) => {
    const n = fbm(u * 30, v * 30, 3, 21);
    const s = vnoise(u * 400, v * 400, 3);
    const k = 0.86 + 0.2 * n + 0.14 * (s - 0.5);
    return [clamp8(226 * k), clamp8(204 * k), clamp8(160 * k)];
  }, { repeat: [2, 2] });
}

export function wallpaperTexture(size = 512) {
  return pixelTex(size, size, (u, v) => {
    const stripe = 0.5 + 0.5 * Math.sin(u * 6.2831 * 8);
    const n = fbm(u * 60, v * 60, 3, 33);
    const k = 0.94 + 0.04 * stripe + 0.05 * n;
    return [clamp8(232 * k), clamp8(218 * k), clamp8(196 * k)];
  }, { repeat: [4, 3] });
}

export function seedTexture() {
  return pixelTex(128, 128, (u, v) => {
    const st = Math.sin(u * 6.2831 * 7 + fbm(u * 8, v * 8, 2, 4) * 3);
    const dark = st > 0.2;
    const n = vnoise(u * 80, v * 80, 1);
    return dark ? [clamp8(38 + 20 * n), clamp8(34 + 18 * n), clamp8(32 + 16 * n)] : [clamp8(206 + 30 * n), clamp8(200 + 28 * n), clamp8(184 + 26 * n)];
  });
}

export function pelletTexture() {
  return pixelTex(128, 128, (u, v) => {
    const n = fbm(u * 30, v * 30, 3, 8);
    const k = 0.7 + 0.5 * n;
    return [clamp8(150 * k), clamp8(106 * k), clamp8(64 * k)];
  });
}

export function wireTexture() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(30,30,32,1)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * w, 0); ctx.lineTo(i * w, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * h); ctx.lineTo(w, i * h); ctx.stroke();
    }
  }, { repeat: [14, 7] });
}

export function radialTex(stops, size = 128) {
  return canvasTex(size, size, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

export function woolTexture(size = 256) {
  return pixelTex(size, size, (u, v) => {
    const a = Math.sin(u * 6.2831 * 24) * Math.sin(v * 6.2831 * 24);
    const n = fbm(u * 50, v * 50, 3, 2);
    const k = 0.78 + 0.16 * a + 0.2 * n;
    return [clamp8(232 * k), clamp8(214 * k), clamp8(188 * k)];
  }, { repeat: [3, 3] });
}

// window sky (re-drawn from main as the clock advances)
export function makeSkyCanvas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const stars = Array.from({ length: 90 }, () => [Math.random() * 256, Math.random() * 300, Math.random() * 1.4 + 0.3, Math.random()]);
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const keys = [ // hour, top, horizon
    [0, [8, 12, 32], [18, 26, 54]],
    [5, [14, 20, 50], [60, 54, 84]],
    [7, [96, 150, 214], [255, 190, 140]],
    [12, [74, 142, 226], [188, 220, 250]],
    [17, [88, 140, 210], [250, 196, 150]],
    [19.5, [60, 54, 110], [255, 128, 80]],
    [21, [14, 20, 50], [48, 40, 80]],
    [24, [8, 12, 32], [18, 26, 54]],
  ];
  function draw(hour) {
    let i = 0;
    while (i < keys.length - 2 && hour > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1];
    const f = Math.max(0, Math.min(1, (hour - a[0]) / (b[0] - a[0])));
    const top = lerp(a[1], b[1], f), hor = lerp(a[2], b[2], f);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, `rgb(${top.map(Math.round)})`);
    g.addColorStop(1, `rgb(${hor.map(Math.round)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 512);
    const night = hour < 5.5 || hour > 20.5 ? 1 : (hour < 7 ? (7 - hour) / 1.5 : hour > 19.5 ? (hour - 19.5) / 1 : 0);
    if (night > 0) {
      stars.forEach(([x, y, r, tw]) => { ctx.fillStyle = `rgba(255,255,240,${night * (0.4 + 0.6 * tw)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
      ctx.fillStyle = `rgba(240,240,225,${night})`; ctx.beginPath(); ctx.arc(190, 90, 18, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(0,0,0,0)`;
    }
    // distant hills silhouette
    ctx.fillStyle = `rgb(${top.map((v, k) => Math.round(v * 0.35 + hor[k] * 0.1))})`;
    ctx.beginPath(); ctx.moveTo(0, 512);
    for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, 400 - 40 * Math.sin(x / 40) - 24 * Math.sin(x / 13 + 1));
    ctx.lineTo(256, 512); ctx.fill();
    t.needsUpdate = true;
  }
  return { texture: t, draw };
}
