// Undo — rendering, input, game flow.
(function () {
  'use strict';
  const S = window.UndoSim, LEVELS = S.LEVELS, TICKS = S.TICKS;
  const $ = (id) => document.getElementById(id);
  const cv = $('c'), ctx = cv.getContext('2d');
  const W = 800, H = 450;
  ctx.scale(cv.width / W, cv.height / H);

  // ---------- persistence (best stars per level) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('undo:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('undo:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  let best = store.get('best', {});

  // ---------- audio ----------
  let ac = null;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = false; } } return ac; }
  function tone(f, dur, type, vol, f2) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  }
  function crash() {
    const a = audio(); if (!a) return;
    const n = a.sampleRate * 0.35, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1800; g.gain.value = 0.35;
    s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const sfx = {
    bump: (imp) => tone(140 + Math.random() * 60, 0.08, 'triangle', Math.min(0.12, imp / 3000)),
    break: () => { crash(); tone(900, 0.25, 'square', 0.05, 200); },
    escape: () => { tone(500, 0.12, 'square', 0.06, 900); setTimeout(() => tone(700, 0.18, 'square', 0.06, 1200), 110); },
    rewind: () => tone(1200, 0.7, 'sawtooth', 0.05, 90),
    pick: () => tone(660, 0.06, 'sine', 0.08),
    drop: () => tone(440, 0.08, 'sine', 0.08),
    toggle: () => tone(300, 0.1, 'square', 0.05, 600),
    win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.1), i * 110)),
    fail: () => { tone(330, 0.25, 'triangle', 0.08, 220); setTimeout(() => tone(220, 0.4, 'triangle', 0.08, 110), 200); },
  };

  // ---------- state ----------
  const st = {
    tab: 'kitchen',
    li: 0, level: null, edits: {}, mode: 'menu', run: null, t: 0, world: null,
    drag: null, daily: false, shake: 0, lastEv: 0, firstWatch: true,
  };
  const editList = () => Object.keys(st.edits).map((id) => Object.assign({ id }, st.edits[id]));
  const changeCount = () => Object.keys(st.edits).length;

  function loadLevel(i, daily) {
    st.li = i; st.level = LEVELS[i]; st.edits = {}; st.daily = !!daily; st.drag = null; st.hint = false;
    $('menu').hidden = true; $('result').hidden = true;
    $('story').textContent = st.level.story;
    // First, watch the disaster unfold.
    st.run = S.run(st.level, []); st.t = 0; st.lastEv = 0; st.mode = 'play'; st.firstWatch = true;
    st.world = S.build(st.level, []);
    ui();
  }
  function startPlay() {
    audio();
    st.run = S.run(st.level, editList()); st.world = S.build(st.level, editList());
    st.t = 0; st.lastEv = 0; st.mode = 'play'; st.firstWatch = false; ui();
  }
  function rewind() {
    if (st.mode === 'edit') return;
    $('result').hidden = true; st.mode = 'rewind'; sfx.rewind(); ui();
  }
  function enterEdit() { st.mode = 'edit'; st.t = 0; st.world = S.build(st.level, editList()); ui(); }

  function finish() {
    const r = st.run; st.mode = 'result';
    if (r.win && !st.firstWatch) {
      const n = changeCount(), par = st.level.par, stars = n <= par ? 3 : n === par + 1 ? 2 : 1;
      if (!best[st.li] || best[st.li] < stars) { best[st.li] = stars; store.set('best', best); }
      sfx.win();
      showResult('Perfect moment!', '⭐'.repeat(stars) + '☆'.repeat(3 - stars),
        `${n} change${n === 1 ? '' : 's'} · par ${par}` + (stars < 3 ? ' — can you do it in fewer?' : ''),
        [st.daily ? ['📋 Share', share, 'cyan'] : null, ['↺ Replay', () => { $('result').hidden = true; startPlay(); }],
          nextInWorld(st.li) >= 0 ? ['Next ▶', () => loadLevel(nextInWorld(st.li)), 'primary'] : ['🏁 Menu', menu, 'primary']].filter(Boolean));
    } else {
      sfx.fail();
      const why = failText(r);
      showResult(st.firstWatch ? 'Well, that went badly.' : 'Not quite…', '', why + (st.firstWatch ? ' Rewind time and change something.' : ''),
        [['👀 Watch again', () => { $('result').hidden = true; st.t = 0; st.lastEv = 0; st.mode = 'play'; ui(); }], ['⏪ Rewind', rewind, 'cyan']]);
    }
    ui();
  }
  function failText(r) {
    const names = { vase: "Grandma's vase", egg: 'The egg', orange: 'The orange', ball: 'The ball', cat: 'Mittens', mug: 'The mug', pot: 'The flower pot', soccer: 'The football', robot: 'The delivery robot', orb: 'The orb', crystal: 'The crystal', rover: 'The rover', crate: 'The crate', bulb: 'The light bulb', widget: 'The widget', forkbot: 'The forkbot' };
    const out = [];
    st.level.goals.forEach((g, i) => {
      if (r.results[i]) return;
      const b = r.world.bodies.find((x) => x.id === g.id), n = names[b.kind];
      if (g.t === 'intact') out.push(`${n} didn't survive.`);
      else if (g.t === 'in') out.push(b.broken ? `${n} broke on the way.` : g.zone === 'bay' ? `${n} never reached the cargo bay.` : `${n} missed the ${{ city: 'bin', space: 'dock', factory: 'chute' }[st.level.world] || 'bowl'}.`);
      else if (g.t === 'reach') out.push(b.kind === 'rover' ? `${n} never reached its charger.` : `${n} never made it to bed.`);
      else if (g.t === 'out') out.push(b.kind === 'robot' ? `${n} fell down the manhole!` : b.kind === 'rover' ? `${n} drifted out of the airlock!` : b.kind === 'forkbot' ? `${n} drove into the recycler!` : `${n} escaped through the door!`);
    });
    return out.join(' ');
  }
  function showResult(title, stars, text, buttons) {
    $('resTitle').textContent = title; $('resStars').textContent = stars; $('resStars').hidden = !stars; $('resText').textContent = text;
    const row = $('resButtons'); row.innerHTML = '';
    buttons.forEach(([label, fn, cls]) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; row.appendChild(b); });
    $('result').hidden = false;
  }
  const dayNumber = () => Math.floor((Date.now() - new Date(2026, 0, 1).getTime()) / 864e5) + 1;
  function share() {
    const n = changeCount(), stars = best[st.li] || 0;
    const txt = `UNDO Daily #${dayNumber()} ⏪\n${st.level.name}: fixed in ${n} change${n === 1 ? '' : 's'}\n${'⭐'.repeat(stars)}${'⬛'.repeat(3 - stars)}`;
    const done = () => toast('Copied! Paste it anywhere.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    else fallbackCopy(txt, done);
  }
  function fallbackCopy(txt, done) {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast(txt); } ta.remove();
  }
  let toastT; function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

  const worldOrder = (wn) => LEVELS.map((l, i) => i).filter((i) => LEVELS[i].world === wn);
  const nextInWorld = (i) => { const o = worldOrder(LEVELS[i].world), k = o.indexOf(i); return k < o.length - 1 ? o[k + 1] : -1; };
  const numInWorld = (i) => worldOrder(LEVELS[i].world).indexOf(i) + 1;
  function menu() {
    st.mode = 'menu'; $('result').hidden = true; $('menu').hidden = false;
    const g = $('levelGrid'); g.innerHTML = '';
    const names = { kitchen: '🍳 Kitchen', city: '🏙️ City', space: '🚀 Space', factory: '🏭 Factory' };
    const tabs = document.createElement('div'); tabs.className = 'tabs'; g.appendChild(tabs);
    Object.keys(names).forEach((wn) => {
      const t = document.createElement('button'); t.textContent = names[wn]; t.className = wn === st.tab ? 'tab on' : 'tab';
      t.onclick = () => { st.tab = wn; store.set('tab', wn); menu(); }; tabs.appendChild(t);
    });
    [st.tab].forEach((wn) => {
      worldOrder(wn).forEach((i, k, arr) => {
      const lv = LEVELS[i];
      const b = document.createElement('button'), s = best[i] || 0;
      const unlocked = k === 0 || best[arr[k - 1]] || best[i];
      b.innerHTML = `${k + 1}<small>${'★'.repeat(s)}</small>`; b.title = lv.name; b.disabled = !unlocked;
      b.onclick = () => { audio(); st.tab = wn; loadLevel(i); };
      g.appendChild(b);
      });
    });
    st.level = LEVELS[0]; st.world = S.build(st.level, []); st.run = null;
    $('story').textContent = ''; ui();
  }

  function ui() {
    const m = st.mode, lv = st.level;
    $('playBtn').disabled = m !== 'edit';
    $('hintBtn').disabled = m !== 'edit';
    $('hintBtn').textContent = st.hint ? '💡 Hide hint' : '💡 Hint';
    $('rewindBtn').disabled = !(m === 'play' || m === 'result');
    $('resetBtn').disabled = m !== 'edit' || !changeCount();
    $('scrub').disabled = !(m === 'result' || m === 'play');
    $('status').innerHTML = m === 'menu' ? '' :
      `${st.daily ? '☀️ Daily · ' : ''}<b>${{ kitchen: '🍳', city: '🏙️', space: '🚀', factory: '🏭' }[lv.world]} ${numInWorld(st.li)}. ${lv.name}</b><br>Changes <b>${changeCount()}</b> · par ${lv.par}`;
  }

  // ---------- input ----------
  $('playBtn').onclick = startPlay;
  $('rewindBtn').onclick = rewind;
  $('resetBtn').onclick = () => { st.edits = {}; enterEdit(); sfx.drop(); };
  $('menuBtn').onclick = menu;
  $('hintBtn').onclick = () => { st.hint = !st.hint; if (st.hint) toast('Move things to the faded ghost spots, then press Play.'); sfx.pick(); ui(); };
  $('dailyBtn').onclick = () => { audio(); loadLevel(dayNumber() % LEVELS.length, true); };
  $('scrub').oninput = (e) => { if (st.mode === 'play') st.mode = 'result'; st.t = +e.target.value; st.lastEv = st.t; };
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (st.mode === 'edit') startPlay(); else if (st.mode === 'play' || st.mode === 'result') rewind(); }
    if (e.key === 'r' || e.key === 'Backspace') rewind();
  });

  function toLogical(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function distSeg(p, s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L2 = dx * dx + dy * dy || 1;
    let t = ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / L2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - s.x1 - dx * t, p.y - s.y1 - dy * t);
  }
  function pick(p) {
    const w = st.world;
    for (const f of w.fans) { const fp = fanPos(f); if (f.toggle && Math.hypot(p.x - fp.x, p.y - fp.y) < 34) return { fan: f.id }; }
    for (const z of w.zones) if (z.movable && !z.group && Math.hypot(p.x - z.x, p.y - z.y) < 34) return { id: z.id };
    for (const b of w.bodies) if (b.movable && Math.hypot(p.x - b.x, p.y - b.y) < b.r + 14) return { id: b.id };
    for (const s of w.segs) if (s.toggle && distSeg(p, s) < 18) return { fan: s.id };
    let bestS = null, bd = 20;
    for (const s of w.segs) if (s.movable) { const d = distSeg(p, s); if (d < bd) { bd = d; bestS = s; } }
    if (bestS) return { id: bestS.group || bestS.id };
    for (const z of w.zones) if (z.movable && p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) return { id: z.group };
    return null;
  }
  cv.addEventListener('pointerdown', (e) => {
    audio();
    if (st.mode !== 'edit') { if (st.mode === 'play' || st.mode === 'result') rewind(); return; }
    const p = toLogical(e), h = pick(p);
    if (!h) return;
    if (h.fan) {
      if (st.edits[h.fan]) delete st.edits[h.fan]; else st.edits[h.fan] = { toggle: true };
      sfx.toggle(); enterEdit(); return;
    }
    const prev = st.edits[h.id] || { dx: 0, dy: 0 };
    st.drag = { id: h.id, sx: p.x, sy: p.y, bx: prev.dx, by: prev.dy };
    cv.setPointerCapture(e.pointerId); sfx.pick();
  });
  cv.addEventListener('pointermove', (e) => {
    if (st.mode === 'edit' && !st.drag) { const h = pick(toLogical(e)); cv.style.cursor = h ? 'grab' : 'default'; }
    if (!st.drag) return;
    cv.style.cursor = 'grabbing';
    const p = toLogical(e), d = st.drag;
    let dx = Math.round((d.bx + p.x - d.sx) / 10) * 10, dy = Math.round((d.by + p.y - d.sy) / 10) * 10;
    // keep the object on screen
    const base = S.build(st.level, editList().filter((x) => x.id !== d.id));
    const pts = base.segs.filter((s) => s.id === d.id || s.group === d.id).flatMap((s) => [[s.x1, s.y1], [s.x2, s.y2]])
      .concat(base.bodies.filter((b) => b.id === d.id).map((b) => [b.x, b.y]))
      .concat(base.zones.filter((z) => z.id === d.id && !z.group).map((z) => [z.x, z.y]));
    const minx = Math.min(...pts.map((q) => q[0])), maxx = Math.max(...pts.map((q) => q[0]));
    const miny = Math.min(...pts.map((q) => q[1])), maxy = Math.max(...pts.map((q) => q[1]));
    dx = Math.max(10 - minx, Math.min(790 - maxx, dx)); dy = Math.max(20 - miny, Math.min(430 - maxy, dy));
    if (dx || dy) st.edits[d.id] = { dx, dy }; else delete st.edits[d.id];
    st.world = S.build(st.level, editList()); ui();
  });
  const endDrag = () => { if (st.drag) { st.drag = null; sfx.drop(); cv.style.cursor = 'default'; } };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

  // ---------- drawing ----------
  const now = () => performance.now() / 1000;
  function fanPos(f) { if (f.type === 'magnet') return { x: f.x, y: f.y }; if (!f.fx) return { x: f.x + f.w / 2, y: 418 }; return f.fx > 0 ? { x: f.x + 22, y: f.y + f.h / 2 } : { x: f.x + f.w - 22, y: f.y + f.h / 2 }; }

  function drawCity() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8ec5ff'); g.addColorStop(1, '#ffd6e0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffffaa'; [[120, 60], [520, 40], [700, 90]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 40, 12, 0, 0, 7); ctx.ellipse(x + 25, y - 8, 25, 12, 0, 0, 7); ctx.fill(); });
    const blds = [[0, 120, 150, '#b8a1d9'], [150, 60, 120, '#9d86c9'], [270, 150, 140, '#c2b0e3'], [410, 90, 130, '#a892d1'], [540, 40, 120, '#b8a1d9'], [660, 130, 140, '#9d86c9']];
    for (const [x, y, w, c] of blds) {
      ctx.fillStyle = c; ctx.fillRect(x, y, w, 430 - y);
      ctx.fillStyle = '#fff3b0aa';
      for (let wy = y + 16; wy < 400; wy += 34) for (let wx = x + 14; wx < x + w - 20; wx += 30) if ((wx * 7 + wy * 3) % 5 > 1) ctx.fillRect(wx, wy, 14, 18);
    }
    ctx.fillStyle = '#8d8a9e'; ctx.fillRect(0, 430, W, 20);
    ctx.fillStyle = '#77748a'; for (let x = 0; x < W; x += 50) ctx.fillRect(x, 430, 2, 20);
  }
  function drawSpace() {
    ctx.fillStyle = '#0f1028'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { const x = (i * 97) % W, y = (i * 53) % 300, tw = 0.5 + 0.5 * Math.sin(now() * 2 + i);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * tw})`; ctx.fillRect(x, y, i % 7 ? 1.5 : 2.5, i % 7 ? 1.5 : 2.5); }
    ctx.fillStyle = '#f4a259'; ctx.beginPath(); ctx.arc(660, 90, 46, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd16688'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(660, 90, 78, 16, -0.3, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#2b2d55'; ctx.lineWidth = 6; ctx.strokeRect(20, 20, 260, 140); ctx.fillStyle = '#ffffff08'; ctx.fillRect(20, 20, 260, 140);
    ctx.fillStyle = '#23254a'; ctx.fillRect(0, 300, W, 130);
    ctx.strokeStyle = '#2f3263'; ctx.lineWidth = 2; for (let x = 0; x < W; x += 100) { ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x, 430); ctx.stroke(); }
    ctx.fillStyle = '#3d4080'; ctx.fillRect(0, 430, W, 20);
    ctx.fillStyle = '#5ce1e6'; for (let x = 30; x < W; x += 100) ctx.fillRect(x, 436, 30, 3);
    if (st.level.gravity) { ctx.fillStyle = '#5ce1e6'; ctx.font = 'bold 12px ui-monospace,monospace'; ctx.textAlign = 'right'; ctx.fillText('GRAVITY ' + Math.round(st.level.gravity * 100) + '%', 784, 290); }
  }
  function drawFactory() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a3f4b'); g.addColorStop(1, '#525866');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#2d313b'; ctx.lineWidth = 6;
    for (let x = 0; x < W; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 80, 70); ctx.lineTo(x + 160, 0); ctx.stroke(); }
    ctx.fillStyle = '#2d313b'; ctx.fillRect(0, 66, W, 8);
    const t = now();
    [[110, 140], [690, 120]].forEach(([x, y], i) => { ctx.save(); ctx.translate(x, y); ctx.rotate(t * (i ? -0.6 : 0.8)); ctx.fillStyle = '#6b7280';
      for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-6, -38, 12, 14); } ctx.beginPath(); ctx.arc(0, 0, 28, 0, 7); ctx.fill(); ctx.fillStyle = '#3a3f4b'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill(); ctx.restore(); });
    ctx.fillStyle = '#ffd16622'; ctx.fillRect(300, 74, 200, 6);
    ctx.fillStyle = '#ffd166'; for (let x = 0; x < W; x += 40) { ctx.save(); ctx.translate(x, 430); ctx.fillRect(0, 0, 20, 20); ctx.restore(); }
    ctx.fillStyle = '#222'; for (let x = 20; x < W; x += 40) ctx.fillRect(x, 430, 20, 20);
  }
  function drawRoom() {
    if (st.level && st.level.world === 'factory') return drawFactory();
    if (st.level && st.level.world === 'space') return drawSpace();
    if (st.level && st.level.world === 'city') return drawCity();
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffe9d6'); g.addColorStop(1, '#ffd9c2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // backsplash tiles
    ctx.strokeStyle = '#f5c9b0'; ctx.lineWidth = 1;
    for (let y = 30; y < 430; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let y = 0; y < 430; y += 30) for (let x = (y / 30) % 2 ? 0 : 30; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 30); ctx.stroke(); }
    // window
    ctx.fillStyle = '#bfe8ff'; rr(330, 30, 140, 90, 8); ctx.fill();
    ctx.fillStyle = '#fff8'; ctx.beginPath(); ctx.arc(440, 55, 14, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; rr(330, 30, 140, 90, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(400, 30); ctx.lineTo(400, 120); ctx.moveTo(330, 75); ctx.lineTo(470, 75); ctx.stroke();
    // floor
    ctx.fillStyle = '#c98f6b'; ctx.fillRect(0, 430, W, 20);
    ctx.fillStyle = '#b57c5a'; for (let x = 0; x < W; x += 80) ctx.fillRect(x, 430, 2, 20);
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function line(s, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }

  function drawSeg(s, editing) {
    if (s.mat === 'wall' || s.mat === 'floor') return;
    if (editing && (s.movable || s.toggle)) {
      ctx.save(); ctx.setLineDash([6, 6]); ctx.lineDashOffset = -now() * 30;
      line(s, 22 + Math.sin(now() * 5) * 3, '#5ce1e688'); ctx.restore();
    }
    if (s.mat === 'counter') { line(s, 12, '#8a5a3c'); line({ x1: s.x1, y1: s.y1 - 3, x2: s.x2, y2: s.y2 - 3 }, 5, '#e9e2dc'); }
    else if (s.mat === 'board') { line(s, 9, '#d9a066'); line(s, 3, '#e8bb86'); }
    else if (s.mat === 'sponge') { line(s, 12, '#ffd84d'); line({ x1: s.x1, y1: s.y1 + 4, x2: s.x2, y2: s.y2 + 4 }, 4, '#4caf50'); }
    else if (s.mat === 'jelly') {
      const wob = Math.sin(now() * 8) * 2; ctx.fillStyle = '#ff6b8bcc';
      const x = Math.min(s.x1, s.x2), w = Math.abs(s.x2 - s.x1);
      ctx.beginPath(); ctx.ellipse(x + w / 2, s.y1 + 2, w / 2 + wob, 9 - wob / 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff6'; ctx.beginPath(); ctx.ellipse(x + w / 3, s.y1 - 2, w / 6, 2.5, 0, 0, 7); ctx.fill();
    }
    else if (s.mat === 'bowl') line(s, 7, st.level.world === 'city' ? '#2e7d4f' : '#4fb3bf');
    else if (s.mat === 'metal') { line(s, 12, '#8a919e'); line({ x1: s.x1, y1: s.y1 - 3, x2: s.x2, y2: s.y2 - 3 }, 3, '#c4c9d4'); }
    else if (s.mat === 'chute') line(s, 7, '#ffd166');
    else if (s.mat === 'lift') { line(s, 12, '#ff9f1c'); ctx.save(); ctx.setLineDash([8, 8]); line(s, 12, '#222'); ctx.restore(); ctx.strokeStyle = '#8a919e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo((s.x1 + s.x2) / 2, s.y1 + 6); ctx.lineTo((s.x1 + s.x2) / 2, 430); ctx.stroke(); }
    else if (s.mat === 'gate') {
      if (s.off) { ctx.save(); ctx.setLineDash([3, 5]); line(s, 4, '#ff6b8b88'); ctx.restore(); }
      else { line(s, 10, '#ff6b8b'); ctx.save(); ctx.setLineDash([6, 6]); line(s, 10, '#fff'); ctx.restore(); }
      ctx.fillStyle = s.off ? '#7ee0a4' : '#ff6b8b'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(s.off ? 'GATE OPEN' : 'GATE SHUT', s.x1, Math.min(s.y1, s.y2) - 8);
    }
    else if (s.mat === 'hull') { line(s, 12, '#5a5f9e'); line({ x1: s.x1, y1: s.y1 - 3, x2: s.x2, y2: s.y2 - 3 }, 3, '#9aa0e0'); }
    else if (s.mat === 'dock') line(s, 7, '#5ce1e6');
    else if (s.mat === 'panel') { line(s, 11, '#c9cdf2'); line(s, 3, '#ff9f1c'); }
    else if (s.mat === 'foam') { line(s, 14, '#7ee0a4'); ctx.fillStyle = '#4caf7a'; for (let x = Math.min(s.x1, s.x2) + 8; x < Math.max(s.x1, s.x2); x += 14) { ctx.beginPath(); ctx.arc(x, s.y1, 2, 0, 7); ctx.fill(); } }
    else if (s.mat === 'conveyor') {
      line(s, 14, '#3d3b4f'); const dir = Math.sign(s.belt), x0 = Math.min(s.x1, s.x2), x1 = Math.max(s.x1, s.x2), off = ((now() * 60 * dir) % 24 + 24) % 24;
      ctx.fillStyle = '#ffd166';
      for (let x = x0 + off; x < x1 - 4; x += 24) { ctx.beginPath(); ctx.moveTo(x + 4 * dir, s.y1); ctx.lineTo(x - 3 * dir, s.y1 - 4); ctx.lineTo(x - 3 * dir, s.y1 + 4); ctx.fill(); }
      ctx.fillStyle = '#8d8a9e'; [x0, x1].forEach((x) => { ctx.beginPath(); ctx.arc(x, s.y1, 8, 0, 7); ctx.fill(); });
      if (editing && s.toggle) { ctx.fillStyle = '#5ce1e6'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('TAP TO REVERSE', (x0 + x1) / 2, s.y1 + 24); }
    }
    else if (s.mat === 'ledge') { line(s, 12, '#6b6680'); line({ x1: s.x1, y1: s.y1 - 3, x2: s.x2, y2: s.y2 - 3 }, 4, '#cfcbe0'); }
    else if (s.mat === 'plank') { line(s, 10, '#ff9f1c'); ctx.save(); ctx.setLineDash([6, 6]); line(s, 10, '#fff'); ctx.restore(); }
    else if (s.mat === 'trash') {
      const x = Math.min(s.x1, s.x2), w = Math.abs(s.x2 - s.x1); ctx.fillStyle = '#2b2b3a';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + w * (i + 0.5) / 3, s.y1 - 4, w / 6 + 2, 11, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#555570'; ctx.fillRect(x + w / 6 - 2, s.y1 - 17, 4, 5);
    }
    else if (s.mat === 'awning') {
      const x = Math.min(s.x1, s.x2), w = Math.abs(s.x2 - s.x1), n = 6;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#e63946'; ctx.beginPath(); ctx.moveTo(x + w * i / n, s.y1 - 6); ctx.lineTo(x + w * (i + 1) / n, s.y1 - 6); ctx.arc(x + w * (i + 0.5) / n, s.y1 + 2, w / n / 2, 0, Math.PI); ctx.fill(); }
    }
    else line(s, 8, '#777');
  }
  function drawZone(z, editing) {
    if (z.label === 'door') {
      ctx.fillStyle = '#3a2f4f'; ctx.fillRect(z.x + 6, z.y - 10, z.w - 6, z.h + 10);
      ctx.fillStyle = '#8fd694'; ctx.fillRect(z.x + 14, z.y, z.w - 20, z.h);           // garden outside
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(z.x + 45, z.y + 25, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#a0623f'; ctx.save(); ctx.translate(z.x + 6, z.y - 10); ctx.transform(1, 0.12, 0, 1, 0, 0); ctx.fillRect(0, 0, 16, z.h + 10); ctx.restore();
      ctx.fillStyle = '#ff6b8b'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('EXIT', z.x + z.w / 2 + 4, z.y - 16);
    }
    if (z.label === 'bed') {
      ctx.fillStyle = '#7b5ea7'; rr(z.x, z.y + 28, z.w, 26, 13); ctx.fill();
      ctx.fillStyle = '#c9b6f2'; rr(z.x + 8, z.y + 22, z.w - 16, 18, 9); ctx.fill();
      ctx.fillStyle = '#ff6b8b'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('CAT BED', z.x + z.w / 2, z.y + 14);
    }
    if (z.label === 'press') {
      const tt = now(), drop = (Math.sin(tt * 3) * 0.5 + 0.5) * 30;
      ctx.fillStyle = '#2d313b'; ctx.fillRect(z.x, z.y + z.h - 8, z.w, 8);
      ctx.fillStyle = '#6b7280'; ctx.fillRect(z.x + z.w / 2 - 6, 0, 12, z.y - 10 + drop);
      ctx.fillStyle = '#ff6b8b'; ctx.fillRect(z.x + 6, z.y - 10 + drop, z.w - 12, 16);
      ctx.fillStyle = '#ffd166'; for (let x = z.x + 10; x < z.x + z.w - 10; x += 16) ctx.fillRect(x, z.y - 4 + drop, 8, 4);
      ctx.fillStyle = '#ff6b8b'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⚠ PRESS', z.x + z.w / 2, z.y + z.h - 14);
    }
    if (z.label === 'recycler') {
      ctx.fillStyle = '#1f2937'; ctx.fillRect(z.x + 4, z.y, z.w - 4, z.h);
      ctx.fillStyle = '#7ee0a4'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('♻', z.x + z.w / 2 + 2, z.y + z.h / 2);
      ctx.fillStyle = '#ffd166'; for (let y = z.y; y < z.y + z.h; y += 16) ctx.fillRect(z.x, y, 4, 8);
      ctx.fillStyle = '#7ee0a4'; ctx.font = 'bold 11px system-ui'; ctx.fillText('RECYCLER', z.x + z.w / 2, z.y - 8);
    }
    if (z.label === 'portal-in' || z.label === 'portal-out') {
      const c = z.label === 'portal-in' ? '#b388ff' : '#ff9f1c', t = now();
      for (let i = 3; i > 0; i--) { ctx.strokeStyle = c; ctx.globalAlpha = 0.3 * i; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(z.x, z.y, 12 + i * 4 + Math.sin(t * 4 + i) * 2, 20 + i * 5, 0, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = c + '55'; ctx.beginPath(); ctx.ellipse(z.x, z.y, 14, 22, 0, 0, 7); ctx.fill();
      if (editing && z.movable) { ctx.strokeStyle = '#5ce1e6'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(z.x, z.y, 38 + Math.sin(t * 5) * 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = c; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(z.label === 'portal-in' ? 'IN' : 'OUT', z.x, z.y - 40);
    }
    if (z.label === 'airlock') {
      ctx.fillStyle = '#050510'; ctx.fillRect(z.x + 6, z.y, z.w - 6, z.h);
      for (let i = 0; i < 12; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(z.x + 12 + (i * 23) % (z.w - 18), z.y + (i * 37) % z.h, 1.5, 1.5); }
      ctx.fillStyle = '#ff6b8b'; ctx.fillRect(z.x, z.y, 6, z.h); ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('AIRLOCK', z.x + z.w / 2, z.y - 8);
    }
    if (z.label === 'pad') {
      ctx.fillStyle = '#2e933c'; rr(z.x + 10, z.y + z.h - 10, z.w - 20, 8, 4); ctx.fill();
      ctx.fillStyle = '#7ee0a4'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⚡ CHARGER', z.x + z.w / 2, z.y + z.h - 18);
    }
    if (z.label === 'bay') { ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = '#7ee0a488'; ctx.lineWidth = 2; ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.restore(); ctx.fillStyle = '#7ee0a4'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('CARGO BAY', z.x + z.w / 2, z.y + 14); }
    if (z.label === 'manhole') {
      ctx.fillStyle = '#1a1a24'; ctx.beginPath(); ctx.ellipse(z.x + z.w / 2, 432, z.w / 2, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5c5a6e'; ctx.beginPath(); ctx.ellipse(z.x + z.w + 18, 427, 16, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.moveTo(z.x - 18, 430); ctx.lineTo(z.x - 10, 404); ctx.lineTo(z.x - 2, 430); ctx.fill();
    }
    if (editing && z.movable) { ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = '#5ce1e6'; ctx.lineWidth = 2; rr(z.x - 4, z.y - 4, z.w + 8, z.h + 8, 8); ctx.stroke(); ctx.restore(); }
  }
  function drawFan(f, editing, t) {
    const p = fanPos(f), on = f.on;
    if (f.type === 'magnet') {
      if (f.on) { for (let i = 0; i < 3; i++) { const ph = 1 - ((t * 0.8 + i / 3) % 1); ctx.strokeStyle = `rgba(255,107,139,${0.5 * (1 - ph)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * ph, 0, 7); ctx.stroke(); } }
      if (editing && f.toggle) { ctx.strokeStyle = '#5ce1e6'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(f.x, f.y, 30 + Math.sin(now() * 5) * 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      ctx.lineWidth = 10; ctx.lineCap = 'butt'; ctx.strokeStyle = f.on ? '#ff6b8b' : '#8d8a9e'; ctx.beginPath(); ctx.arc(f.x, f.y, 14, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#e8ecff'; ctx.fillRect(f.x - 19, f.y, 10, 8); ctx.fillRect(f.x + 9, f.y, 10, 8);
      ctx.fillStyle = f.on ? '#ff6b8b' : '#aab'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(f.on ? 'MAGNET ON' : 'MAGNET OFF', f.x, f.y - 22);
      return;
    }
    if (!f.fx) { // subway vent blowing upward
      if (on) { ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) { const xx = f.x + 10 + (i * 29) % (f.w - 20), ph = (t * 1.8 + i * 0.31) % 1, yy = 410 - ph * 380;
          ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 24); ctx.stroke(); }
        ctx.globalAlpha = 1; }
      if (editing && f.toggle) { ctx.strokeStyle = '#5ce1e6'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); rr(p.x - 40, p.y - 14, 80, 24, 6); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = '#3d3b4f'; rr(p.x - 34, p.y - 8, 68, 14, 3); ctx.fill();
      ctx.strokeStyle = '#8d8a9e'; ctx.lineWidth = 2; for (let x = p.x - 28; x <= p.x + 28; x += 8) { ctx.beginPath(); ctx.moveTo(x, p.y - 6); ctx.lineTo(x, p.y + 4); ctx.stroke(); }
      ctx.fillStyle = on ? '#5ce1e6' : '#ff6b8b'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(on ? 'VENT ON' : 'VENT OFF', p.x, p.y - 14);
      return;
    }
    if (on) { // wind streaks
      ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const yy = f.y + 12 + (i * 37) % (f.h - 20), ph = ((t * 2.2 + i * 0.37) % 1);
        const x0 = f.fx > 0 ? f.x + 40 + ph * (f.w - 70) : f.x + f.w - 40 - ph * (f.w - 70), dir = Math.sign(f.fx);
        ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + dir * 26, yy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (editing && f.toggle) { ctx.strokeStyle = '#5ce1e6'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(p.x, p.y, 30 + Math.sin(now() * 5) * 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = '#7d8cc4'; ctx.fillRect(p.x - 4, p.y, 8, 430 - p.y > 0 ? Math.min(40, 430 - p.y) : 0);
    ctx.fillStyle = '#e8ecff'; ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7d8cc4'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(on ? t * 25 : 0.3); ctx.fillStyle = on ? '#5ce1e6' : '#aab';
    for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.ellipse(0, -9, 5, 10, 0, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = on ? '#5ce1e6' : '#ff6b8b'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(on ? 'ON' : 'OFF', p.x, p.y + 36);
  }
  function drawBody(b, f, editing, broken, bt, napping) {
    const [x, y, a, , dir] = f; ctx.save(); ctx.translate(x, y);
    if (editing && b.movable) { ctx.strokeStyle = '#5ce1e6'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(0, 0, b.r + 8 + Math.sin(now() * 5) * 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    const k = b.kind, r = b.r;
    if (k === 'ball') {
      ctx.rotate(a); const cols = ['#ff5a5f', '#fff', '#3d9df3', '#fff'];
      for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i * Math.PI / 2, (i + 1) * Math.PI / 2); ctx.fill(); }
      ctx.strokeStyle = '#0002'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    } else if (k === 'soccer') {
      ctx.rotate(a); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const an = i * 1.2566 - 1.57; ctx.lineTo(Math.cos(an) * 5, Math.sin(an) * 5); } ctx.fill();
      for (let i = 0; i < 5; i++) { const an = i * 1.2566 + 0.3; ctx.beginPath(); ctx.arc(Math.cos(an) * 11, Math.sin(an) * 11, 3, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#0003'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    } else if (k === 'pot') {
      if (broken) { shards('#c8553d', bt); ctx.fillStyle = '#6b4226'; ctx.beginPath(); ctx.ellipse(0, r - 4, 12, 4, 0, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = '#c8553d'; ctx.beginPath(); ctx.moveTo(-r, -4); ctx.lineTo(r, -4); ctx.lineTo(r - 4, r); ctx.lineTo(-r + 4, r); ctx.fill(); ctx.fillRect(-r - 2, -8, 2 * r + 4, 6);
        ctx.fillStyle = '#2e933c'; ctx.beginPath(); ctx.ellipse(-5, -14, 4, 8, -0.4, 0, 7); ctx.ellipse(5, -14, 4, 8, 0.4, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, -22, 5, 0, 7); ctx.fill(); }
    } else if (k === 'robot') {
      if (broken) { ctx.globalAlpha = Math.max(0, 1 - bt * 1.5); ctx.translate(0, Math.min(30, bt * 60)); }
      ctx.scale(dir || 1, 1);
      ctx.fillStyle = '#e8ecff'; rr(-17, -14, 34, 26, 7); ctx.fill(); ctx.strokeStyle = '#7d8cc4'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ff6b8b'; ctx.fillRect(-12, -10, 16, 10);
      ctx.fillStyle = '#5ce1e6'; ctx.beginPath(); ctx.arc(10, -4, 3.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7d8cc4'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -24); ctx.stroke(); ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, -25, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#3d3b4f'; ctx.save(); ctx.translate(-9, 13); ctx.rotate(a); ctx.fillRect(-4, -1, 8, 2); ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(9, 13); ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); ctx.restore();
    } else if (k === 'crate') {
      ctx.rotate(a * 0.15); ctx.fillStyle = '#c8955c'; ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.strokeStyle = '#8a5a3c'; ctx.lineWidth = 2; ctx.strokeRect(-r, -r, 2 * r, 2 * r);
      ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
    } else if (k === 'bulb') {
      if (broken) { shards('#fff3b0', bt); ctx.fillStyle = '#8a919e'; ctx.fillRect(-4, r - 6, 8, 6); }
      else { ctx.rotate(a * 0.3); ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(0, -2, r - 1, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd16655'; ctx.beginPath(); ctx.arc(0, -2, r + 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#8a919e'; ctx.fillRect(-5, r - 6, 10, 7); ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(0, -4); ctx.lineTo(3, 2); ctx.stroke(); }
    } else if (k === 'widget') {
      ctx.rotate(a); ctx.fillStyle = '#5ce1e6'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.fill();
      ctx.fillStyle = '#3a3f4b'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
    } else if (k === 'forkbot') {
      if (broken) { ctx.globalAlpha = Math.max(0, 1 - bt * 1.5); ctx.translate(0, Math.min(25, bt * 50)); }
      ctx.scale(dir || 1, 1);
      ctx.fillStyle = '#ffd166'; rr(-18, -16, 26, 26, 4); ctx.fill(); ctx.fillStyle = '#3a3f4b'; ctx.fillRect(-14, -12, 14, 10);
      ctx.fillStyle = '#5ce1e6'; ctx.beginPath(); ctx.arc(-7, -7, 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a919e'; ctx.fillRect(8, -18, 4, 28); ctx.fillRect(8, 6, 14, 4);
      ctx.fillStyle = '#222'; [-12, 2].forEach((x) => { ctx.beginPath(); ctx.arc(x, 12, 5, 0, 7); ctx.fill(); });
    } else if (k === 'orb') {
      const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, r); g.addColorStop(0, '#e0f7ff'); g.addColorStop(1, '#5ce1e6');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.rotate(a); ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, 1.5); ctx.stroke();
    } else if (k === 'crystal') {
      if (broken) shards('#b388ff', bt);
      else { ctx.fillStyle = '#b388ff'; ctx.beginPath(); ctx.moveTo(0, -r - 4); ctx.lineTo(r - 2, 0); ctx.lineTo(0, r); ctx.lineTo(-r + 2, 0); ctx.fill(); ctx.fillStyle = '#e4d4ff'; ctx.beginPath(); ctx.moveTo(0, -r - 4); ctx.lineTo(4, 0); ctx.lineTo(0, r); ctx.fill(); }
    } else if (k === 'rover') {
      if (broken && napping) { ctx.fillStyle = '#7ee0a4'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⚡', 0, -30); }
      else if (broken) { ctx.globalAlpha = Math.max(0, 1 - bt * 1.2); ctx.rotate(bt * 3); ctx.translate(bt * 40, -bt * 30); }
      ctx.scale(dir || 1, 1);
      ctx.fillStyle = '#e8ecff'; rr(-18, -10, 36, 18, 5); ctx.fill(); ctx.fillStyle = '#ff9f1c'; ctx.fillRect(-18, -2, 36, 4);
      ctx.fillStyle = '#3d3b4f'; ctx.fillRect(4, -20, 4, 10); ctx.fillStyle = '#5ce1e6'; ctx.beginPath(); ctx.arc(6, -22, 6, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#3d3b4f'; [-12, 0, 12].forEach((x) => { ctx.beginPath(); ctx.arc(x, 11, 5, 0, 7); ctx.fill(); });
    } else if (k === 'orange') {
      ctx.rotate(a); ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffbf69'; ctx.beginPath(); ctx.arc(-4, -4, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#2e933c'; ctx.beginPath(); ctx.ellipse(3, -r, 5, 2.5, -0.5, 0, 7); ctx.fill();
    } else if (k === 'vase' || k === 'mug') {
      const c = k === 'vase' ? '#3d6fd8' : '#e85d75';
      if (broken) { shards(c, bt); }
      else if (k === 'vase') {
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-6, -r - 4); ctx.lineTo(6, -r - 4); ctx.quadraticCurveTo(4, -6, r, 4); ctx.quadraticCurveTo(r, r, 0, r); ctx.quadraticCurveTo(-r, r, -r, 4); ctx.quadraticCurveTo(-4, -6, -6, -r - 4); ctx.fill();
        ctx.fillStyle = '#ffd166'; ctx.fillRect(-r + 3, 2, 2 * r - 6, 3);
        ctx.fillStyle = '#ff6b8b'; ctx.beginPath(); ctx.arc(-3, -r - 8, 4, 0, 7); ctx.arc(4, -r - 10, 4, 0, 7); ctx.fill();
      } else { ctx.fillStyle = c; rr(-r, -r, 2 * r - 4, 2 * r, 3); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r - 4, 0, 6, -1.2, 1.2); ctx.stroke(); }
    } else if (k === 'egg') {
      if (broken) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, r - 3, r + 8, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(0, r - 4, 5, 0, 7); ctx.fill(); shards('#f3e9dc', bt, 4); }
      else { ctx.rotate(a * 0.3); ctx.fillStyle = '#f7efe3'; ctx.beginPath(); ctx.ellipse(0, 0, r - 2, r + 1, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#d8c8b0'; ctx.lineWidth = 1; ctx.stroke(); }
    } else if (k === 'cat') {
      if (broken && napping) { ctx.fillStyle = '#7b5ea7'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('z'.repeat(1 + Math.floor(now() * 2) % 3), 4, -30); }
      else if (broken) ctx.globalAlpha = Math.max(0, 1 - bt * 1.5); // escaped: fade out
      ctx.scale(dir || 1, 1);
      const step = Math.sin(x * 0.25) * 3;
      ctx.fillStyle = '#f4a259';
      ctx.fillRect(-14, 6, 5, 10 + step * 0.3); ctx.fillRect(8, 6, 5, 10 - step * 0.3);
      ctx.beginPath(); ctx.ellipse(-2, 2, 17, 11, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#f4a259'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-17, 0); ctx.quadraticCurveTo(-28, -8, -24, -20 + step); ctx.stroke();
      ctx.beginPath(); ctx.arc(14, -8, 10, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(7, -14); ctx.lineTo(9, -24); ctx.lineTo(14, -17); ctx.moveTo(15, -17); ctx.lineTo(21, -23); ctx.lineTo(21, -13); ctx.fill();
      ctx.fillStyle = '#c56a2c'; ctx.fillRect(-8, -8, 3, 8); ctx.fillRect(-1, -8, 3, 8);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(17, -10, 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8fa3'; ctx.beginPath(); ctx.arc(23, -6, 1.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function shards(c, bt, n) {
    ctx.fillStyle = c; const spread = Math.min(1, bt * 4);
    for (let i = 0; i < (n || 7); i++) {
      const ang = i * 2.4, d = 6 + (i % 3) * 7 * spread;
      ctx.save(); ctx.translate(Math.cos(ang) * d, 10 - Math.abs(Math.sin(ang)) * 3); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(4, -3); ctx.lineTo(2, 4); ctx.fill(); ctx.restore();
    }
  }

  function drawWorld(frameIdx) {
    const w = st.world, editing = st.mode === 'edit';
    drawRoom();
    const t = frameIdx * S.DT;
    w.zones.forEach((z) => drawZone(z, editing));
    w.fans.forEach((f) => drawFan(f, editing, t));
    w.segs.forEach((s) => {
      if (s.lift && !editing) {
        const L = s.lift, k = (1 - Math.cos(2 * Math.PI * t / L.period)) / 2, ox = (L.dx || 0) * k, oy = (L.dy || 0) * k;
        drawSeg(Object.assign({}, s, { x1: s.b[0] + ox, y1: s.b[1] + oy, x2: s.b[2] + ox, y2: s.b[3] + oy }), editing);
      } else drawSeg(s, editing);
    });
    const frame = st.run && !editing ? st.run.frames[Math.min(TICKS, Math.round(frameIdx))] : w.bodies.map((b) => [b.x, b.y, 0, 0, b.dir]);
    const evs = st.run && !editing ? st.run.events : [];
    w.bodies.forEach((b, i) => {
      const f = frame[i], broken = !!f[3];
      const ev = broken ? evs.find((e) => e.id === b.id && (e.type === 'break' || e.type === 'escape' || e.type === 'nap')) : null;
      drawBody(b, f, editing, broken, ev ? (frameIdx - ev.t) * S.DT : 0, ev && ev.type === 'nap');
    });
    if (editing && st.hint) drawHint();
    // goal markers
    if (editing || frameIdx === 0) {
      st.level.goals.forEach((g) => {
        const b = w.bodies.find((x) => x.id === g.id); if (!b) return;
        const icon = g.t === 'intact' ? '🛡️' : g.t === 'in' ? '🎯' : '🏠';
        ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(icon, b.x, b.y - b.r - 14);
      });
    }
  }

  function centerOf(w, id) {
    const pts = w.segs.filter((s) => s.id === id || s.group === id).flatMap((s) => [[s.x1, s.y1], [s.x2, s.y2]])
      .concat(w.bodies.filter((b) => b.id === id).map((b) => [b.x, b.y]))
      .concat(w.zones.filter((z) => z.id === id && !z.group).map((z) => [z.x, z.y]));
    return { x: pts.reduce((a, q) => a + q[0], 0) / pts.length, y: pts.reduce((a, q) => a + q[1], 0) / pts.length };
  }
  function drawHint() {
    const lv = st.level, hw = S.build(lv, lv.hint), pulse = 0.5 + 0.5 * Math.sin(now() * 4);
    ctx.save();
    for (const h of lv.hint) {
      if (h.toggle) {
        const f = st.world.fans.find((x) => x.id === h.id), sg = st.world.segs.find((x) => x.id === h.id);
        const p = f ? fanPos(f) : { x: (sg.x1 + sg.x2) / 2, y: sg.y1 + 20 }, done = !!st.edits[h.id];
        ctx.globalAlpha = 1; ctx.fillStyle = done ? '#2e933c' : '#ffd166';
        rr(p.x - 34, p.y - 62, 68, 24, 12); ctx.fill();
        ctx.fillStyle = '#1d1b2e'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(done ? '✓ done' : '👆 TAP', p.x, p.y - 45);
        continue;
      }
      ctx.globalAlpha = 0.35 + 0.25 * pulse;
      hw.segs.filter((sg) => sg.id === h.id || sg.group === h.id).forEach((sg) => drawSeg(Object.assign({}, sg, { movable: false }), false));
      hw.bodies.filter((b) => b.id === h.id).forEach((b) => drawBody(b, [b.x, b.y, 0, 0, b.dir], false, false, 0));
      hw.zones.filter((z) => z.id === h.id && !z.group).forEach((z) => drawZone(z, false));
      const from = centerOf(st.world, h.id), to = centerOf(hw, h.id), d = Math.hypot(to.x - from.x, to.y - from.y);
      ctx.globalAlpha = 1;
      if (d > 15) {
        ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -now() * 40;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.setLineDash([]);
        const a = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - 14 * Math.cos(a - 0.4), to.y - 14 * Math.sin(a - 0.4)); ctx.lineTo(to.x - 14 * Math.cos(a + 0.4), to.y - 14 * Math.sin(a + 0.4)); ctx.fill();
      } else {
        ctx.fillStyle = '#2e933c'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✓', to.x, to.y - 22);
      }
    }
    ctx.restore();
  }
  function drawVHS(intensity) {
    const t = now();
    ctx.fillStyle = `rgba(20,0,40,${0.25 * intensity})`; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) { ctx.fillStyle = `rgba(0,0,0,${0.18 * intensity})`; ctx.fillRect(0, y, W, 2); }
    for (let i = 0; i < 3; i++) {
      const y = ((t * 300 + i * 157) % (H + 40)) - 20;
      ctx.fillStyle = `rgba(255,255,255,${0.12 * intensity})`; ctx.fillRect(0, y, W, 3 + i * 2);
      ctx.fillStyle = `rgba(92,225,230,${0.15 * intensity})`; ctx.fillRect(Math.sin(t * 40 + i) * 8, y + 6, W, 2);
    }
    ctx.globalAlpha = intensity; ctx.fillStyle = '#fff'; ctx.font = 'bold 28px ui-monospace,monospace'; ctx.textAlign = 'left';
    ctx.fillText('◀◀ REWIND', 24, 46); ctx.globalAlpha = 1;
  }
  function drawHUD() {
    ctx.font = 'bold 15px ui-monospace,monospace'; ctx.textAlign = 'left';
    if (st.mode === 'edit') {
      ctx.fillStyle = '#1d1b2ecc'; rr(14, 12, 300, 30, 15); ctx.fill();
      ctx.fillStyle = '#5ce1e6'; ctx.fillText('⏸ 0.0s  drag ✦ glowing things', 26, 32);
    } else if (st.mode === 'play') {
      ctx.fillStyle = '#1d1b2ecc'; rr(14, 12, 112, 30, 15); ctx.fill();
      ctx.fillStyle = Math.floor(now() * 2) % 2 ? '#ff6b8b' : '#fff'; ctx.fillText('● PLAY ' + (st.t * S.DT).toFixed(1), 26, 32);
    }
  }

  let last = performance.now();
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    if (st.mode === 'play') {
      const prev = st.t; st.t = Math.min(TICKS, st.t + dt * 60);
      for (const ev of st.run.events) if (ev.t > prev && ev.t <= st.t) {
        if (ev.type === 'break') { sfx.break(); st.shake = 0.35; }
        else if (ev.type === 'escape') sfx.escape();
        else if (ev.type === 'nap') sfx.toggle();
        else if (ev.type === 'warp') tone(200, 0.3, 'sine', 0.08, 1400);
        else if (ev.type === 'bump' && ev.imp > 180) sfx.bump(ev.imp);
      }
      if (st.t >= TICKS) finish();
    } else if (st.mode === 'rewind') {
      st.t = Math.max(0, st.t - dt * 60 * 7);
      if (st.t <= 0) enterEdit();
    }
    ctx.save();
    if (st.shake > 0) { st.shake -= dt; const m = st.shake * 18; ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m); }
    drawWorld(st.t);
    ctx.restore();
    if (st.mode === 'rewind') drawVHS(1);
    drawHUD();
    $('scrub').value = st.t; $('time').textContent = (st.t * S.DT).toFixed(1) + 's';
    requestAnimationFrame(loop);
  }

  st.tab = store.get('tab', 'kitchen');
  menu();
  requestAnimationFrame(loop);
})();
