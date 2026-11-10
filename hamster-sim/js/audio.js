// Tiny synthesized soundscape (no samples): room tone, crickets at night, paws, nibbling, lapping, wheel.
export class Audio {
  constructor() { this.ctx = null; this.on = false; this.stepT = 0; this.night = 0; }
  start() {
    if (this.ctx) { this.ctx.resume(); this.on = true; this.master.gain.value = 0.9; return; }
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    // noise buffer
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // room tone
    const n = c.createBufferSource(); n.buffer = buf; n.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const g = c.createGain(); g.gain.value = 0.05;
    n.connect(lp).connect(g).connect(this.master); n.start();
    // crickets
    this.cricket = c.createGain(); this.cricket.gain.value = 0;
    const o = c.createOscillator(); o.frequency.value = 4300;
    const am = c.createGain(); am.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 7.5; const lg = c.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
    const bias = c.createConstantSource(); bias.offset.value = 0.5; bias.connect(am.gain); bias.start();
    o.connect(am).connect(this.cricket).connect(this.master); o.start(); lfo.start();
    // wheel
    this.wheelG = c.createGain(); this.wheelG.gain.value = 0;
    const wn = c.createBufferSource(); wn.buffer = buf; wn.loop = true;
    const wb = c.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 900; wb.Q.value = 1.2;
    this.wheelF = wb;
    wn.connect(wb).connect(this.wheelG).connect(this.master); wn.start();
    this.wo = c.createOscillator(); this.wo.type = 'triangle'; this.wo.frequency.value = 60;
    const wog = c.createGain(); wog.gain.value = 0.35; this.wo.connect(wog).connect(this.wheelG); this.wo.start();
    this.on = true;
  }
  stop() { if (this.ctx) this.master.gain.value = 0; this.on = false; }
  burst(freq, q, dur, vol, type = 'bandpass', delay = 0) {
    if (!this.on) return;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); const t = c.currentTime + delay;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random(), dur + 0.05);
  }
  walk(speed, dt) {
    if (!this.on || speed < 0.03) { this.stepT = 0; return; }
    this.stepT -= dt;
    if (this.stepT <= 0) { this.stepT = clampN(0.34 - speed * 0.3, 0.07, 0.3); this.burst(2600 + Math.random() * 1500, 1.2, 0.03, 0.04 + speed * 0.05); }
  }
  nibble(v = 1) { this.burst(3400 + Math.random() * 900, 2, 0.025, 0.12 * v); this.burst(2200, 2, 0.03, 0.08 * v, 'bandpass', 0.05); }
  lap() { this.burst(900, 3, 0.05, 0.08); }
  rustle(v = 1) { this.burst(1800, 0.7, 0.35, 0.06 * v); }
  squeak(v = 1) {
    if (!this.on) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.frequency.setValueAtTime(3600, t); o.frequency.exponentialRampToValueAtTime(2200, t + 0.16);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.2);
  }
  update(wheelVel, night) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    this.wheelG.gain.setTargetAtTime(Math.min(0.09, Math.abs(wheelVel) * 0.012), t, 0.1);
    this.wheelF.frequency.setTargetAtTime(500 + Math.abs(wheelVel) * 120, t, 0.1);
    this.wo.frequency.setTargetAtTime(30 + Math.abs(wheelVel) * 9, t, 0.1);
    this.cricket.gain.setTargetAtTime(0.0035 * night, t, 1);
  }
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
