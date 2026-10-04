// ---- audio --------------------------------------------------------------------------------
import { THREE } from './three.js';
import { clamp, CONFIG, randRange } from './config.js';
import { camera } from './engine.js';

const audio = {
  ctx: null, master: null, noiseBuf: null, _v: new THREE.Vector3(), _r: new THREE.Vector3(),
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 6;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = CONFIG.volume;
    this.master.connect(comp);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  setVolume(v) { if (this.master) this.master.gain.value = v; },
  ok() { return this.ctx && this.ctx.state === 'running' && CONFIG.volume > 0; },

  // Output node for a sound: a panner + gain for positional sounds, the master otherwise.
  out(pos, vol) {
    const ctx = this.ctx, g = ctx.createGain();
    let v = vol;
    if (pos) {
      const cp = camera.position;
      this._v.set(pos.x - cp.x, pos.y - cp.y, pos.z - cp.z);
      const d = this._v.length();
      if (d > 32) return null;
      v *= Math.pow(1 - d / 32, 1.6);
      if (ctx.createStereoPanner && d > 0.5) {
        this._r.set(1, 0, 0).applyQuaternion(camera.quaternion);
        const p = ctx.createStereoPanner();
        p.pan.value = clamp(this._v.normalize().dot(this._r) * 0.8, -1, 1);
        g.connect(p); p.connect(this.master);
      } else g.connect(this.master);
    } else g.connect(this.master);
    g.gain.value = v;
    return g;
  },
  // Enveloped oscillator. f0 -> f1 exponential sweep; vib adds vibrato (Hz, depth).
  tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.2, vol = 0.3, attack = 0.005, delay = 0, pos = null, filter = 0, vib = null }) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const out = this.out(pos, vol); if (!out) return;
    const o = ctx.createOscillator(), env = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = vib[0]; lg.gain.value = vib[1];
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
    node.connect(env); env.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  },
  // Enveloped filtered noise. f0 -> f1 sweeps the filter frequency.
  noise({ ftype = 'bandpass', f0 = 1000, f1 = f0, q = 1, dur = 0.15, vol = 0.3, attack = 0.004, delay = 0, pos = null }) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const out = this.out(pos, vol); if (!out) return;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(env); env.connect(out);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },

  // Material sounds shared by digging, placing, and footsteps.
  material(sound, vol, pos, pitch) {
    const r = () => randRange(0.9, 1.1) * pitch;
    switch (sound) {
      case 'stone':
        this.noise({ f0: 1700 * r(), f1: 900, q: 1.2, dur: 0.12, vol: vol * 0.7, pos });
        this.tone({ type: 'triangle', f0: 180 * r(), f1: 90, dur: 0.08, vol: vol * 0.35, pos });
        break;
      case 'wood':
        this.tone({ type: 'triangle', f0: 260 * r(), f1: 140, dur: 0.1, vol: vol * 0.5, pos });
        this.noise({ f0: 700 * r(), f1: 400, q: 2, dur: 0.1, vol: vol * 0.5, pos });
        break;
      case 'gravel':
        for (let i = 0; i < 3; i++) this.noise({ f0: 1000 * r(), f1: 600, q: 0.8, dur: 0.06, vol: vol * 0.5, delay: i * 0.035, pos });
        break;
      case 'sand':
        this.noise({ ftype: 'highpass', f0: 3000 * r(), f1: 1800, q: 0.5, dur: 0.16, vol: vol * 0.35, pos });
        break;
      case 'snow':
        this.noise({ ftype: 'lowpass', f0: 1800 * r(), f1: 700, q: 0.7, dur: 0.18, vol: vol * 0.45, pos });
        break;
      case 'cloth':
        this.noise({ ftype: 'lowpass', f0: 900 * r(), f1: 400, q: 0.5, dur: 0.14, vol: vol * 0.45, pos });
        break;
      case 'glass':
        this.noise({ ftype: 'highpass', f0: 5000 * r(), f1: 2600, q: 0.8, dur: 0.16, vol: vol * 0.5, pos });
        this.tone({ type: 'triangle', f0: 2300 * r(), f1: 1700, dur: 0.08, vol: vol * 0.2, pos });
        break;
      default: // grass, leaves, plants
        this.noise({ f0: 2600 * r(), f1: 1400, q: 0.6, dur: 0.13, vol: vol * 0.5, pos });
        this.noise({ ftype: 'highpass', f0: 4000 * r(), f1: 3000, q: 0.5, dur: 0.07, vol: vol * 0.25, delay: 0.03, pos });
    }
  },
  dig(sound, vol, x, y, z, place = false) { this.material(sound, vol * 0.8, { x, y, z }, place ? 1.2 : 1); },
  step(sound, vol) { this.material(sound, vol * 0.35, null, 0.85); },
  hurt() {
    this.tone({ type: 'square', f0: 260, f1: 150, dur: 0.18, vol: 0.22, filter: 900 });
    this.noise({ ftype: 'lowpass', f0: 800, f1: 300, dur: 0.15, vol: 0.2 });
  },
  fall(dmg) {
    this.noise({ ftype: 'lowpass', f0: 500, f1: 80, dur: 0.25, vol: Math.min(0.8, 0.3 + dmg * 0.05) });
    this.tone({ f0: 90, f1: 40, dur: 0.2, vol: 0.4 });
  },
  splash() {
    this.noise({ ftype: 'lowpass', f0: 3500, f1: 300, q: 0.7, dur: 0.6, vol: 0.45, attack: 0.01 });
    for (let i = 0; i < 4; i++) this.tone({ f0: randRange(700, 1400), f1: randRange(1500, 2500), dur: 0.05, vol: 0.06, delay: 0.1 + i * 0.07 });
  },
  swim() { this.noise({ ftype: 'lowpass', f0: 900, f1: 300, q: 0.5, dur: 0.35, vol: 0.18, attack: 0.08 }); },
  pop() { this.tone({ f0: randRange(500, 700), f1: randRange(1100, 1500), dur: 0.07, vol: 0.18 }); },
  eat() {
    for (let i = 0; i < 3; i++) this.noise({ f0: randRange(1100, 1800), f1: 700, q: 1.5, dur: 0.08, vol: 0.35, delay: i * 0.13 });
    this.tone({ type: 'triangle', f0: 180, f1: 120, dur: 0.12, vol: 0.2, delay: 0.42 });
  },
  toolBreak() {
    this.noise({ ftype: 'highpass', f0: 5000, f1: 2000, dur: 0.25, vol: 0.4 });
    this.tone({ type: 'square', f0: 1400, f1: 250, dur: 0.25, vol: 0.15, filter: 3000 });
  },
  equip() {
    this.noise({ ftype: 'bandpass', f0: 1800, f1: 900, q: 1.2, dur: 0.12, vol: 0.3 });
    this.tone({ type: 'triangle', f0: 620, f1: 480, dur: 0.1, vol: 0.12, delay: 0.05 });
  },
  armorHit() { this.noise({ ftype: 'bandpass', f0: 2600, f1: 1500, q: 2, dur: 0.09, vol: 0.25 }); },
  bowDraw() { this.noise({ ftype: 'bandpass', f0: 500, f1: 1400, q: 3, dur: 0.6, vol: 0.12, attack: 0.3 }); },
  bow(pos, power = 1) {
    this.noise({ ftype: 'bandpass', f0: 1600, f1: 500, q: 1.5, dur: 0.18, vol: 0.35 * power + 0.1, pos });
    this.tone({ type: 'triangle', f0: 190, f1: 90, dur: 0.14, vol: 0.2, pos });
  },
  arrowHit(x, y, z) {
    const pos = { x, y, z };
    this.noise({ ftype: 'bandpass', f0: 900, f1: 400, q: 2.5, dur: 0.08, vol: 0.35, pos });
    this.tone({ type: 'triangle', f0: 320, f1: 260, dur: 0.18, vol: 0.12, vib: [45, 30], pos });
  },
  enchant(vol = 1) {
    for (let i = 0; i < 4; i++) this.tone({ type: 'sine', f0: [880, 1175, 1397, 1760][i], dur: 0.35, vol: 0.09 * vol, vib: [6, 12], delay: i * 0.07 });
  },
  click() { this.tone({ type: 'square', f0: 1100, f1: 900, dur: 0.035, vol: 0.06, filter: 3000 }); },
  craft() {
    this.tone({ type: 'triangle', f0: 523, dur: 0.1, vol: 0.18 });
    this.tone({ type: 'triangle', f0: 784, dur: 0.16, vol: 0.18, delay: 0.08 });
  },
  door(open, x, y, z) {
    const pos = { x, y, z };
    this.tone({ type: 'triangle', f0: open ? 230 : 170, f1: open ? 150 : 110, dur: 0.16, vol: 0.35, filter: 900, pos });
    this.noise({ f0: 650, f1: 300, q: 1.5, dur: 0.1, vol: 0.3, delay: open ? 0 : 0.06, pos });
  },
  chest(open, x, y, z) {
    const pos = { x, y, z };
    this.tone({ type: 'sawtooth', f0: open ? 140 : 200, f1: open ? 210 : 120, dur: 0.32, vol: 0.16, filter: 700, vib: [16, 8], pos });
    if (!open) this.noise({ ftype: 'lowpass', f0: 700, f1: 200, dur: 0.12, vol: 0.35, delay: 0.26, pos });
  },
  fizz(x, y, z) { this.noise({ ftype: 'highpass', f0: 3000, f1: 6500, q: 0.5, dur: 0.45, vol: 0.28, attack: 0.02, pos: { x, y, z } }); },
  fuse(x, y, z) { this.noise({ ftype: 'highpass', f0: 1800, f1: 5200, q: 0.6, dur: 0.35, vol: 0.5, attack: 0.01, pos: { x, y, z } }); },
  sizzle(x, y, z) {
    const pos = { x, y, z };
    for (let i = 0; i < 3; i++) this.noise({ ftype: 'highpass', f0: randRange(3500, 6000), f1: 4000, q: 0.7, dur: 0.05, vol: 0.2, delay: i * 0.08 + Math.random() * 0.04, pos });
  },
  trapWarn() {   // a set trap is near: a dry rattle over a low falling tritone
    for (let i = 0; i < 14; i++) this.noise({ ftype: 'bandpass', f0: 3200, f1: 2600, q: 4, dur: 0.03, vol: 0.22, delay: i * 0.045 });
    this.tone({ type: 'triangle', f0: 220, f1: 210, dur: 0.5, vol: 0.3, filter: 1200 });
    this.tone({ type: 'triangle', f0: 156, f1: 150, dur: 0.8, vol: 0.3, filter: 1200, delay: 0.4 });
  },
  fireballShoot(pos) { this.noise({ ftype: 'bandpass', f0: 500, f1: 1500, q: 0.8, dur: 0.4, vol: 0.4, attack: 0.05, pos: { x: pos.x, y: pos.y + 0.5, z: pos.z } }); },
  fireballHit(x, y, z) {
    this.noise({ ftype: 'lowpass', f0: 1400, f1: 200, dur: 0.35, vol: 0.45, pos: { x, y, z } });
    this.noise({ ftype: 'highpass', f0: 3000, f1: 5000, q: 0.5, dur: 0.25, vol: 0.15, delay: 0.05, pos: { x, y, z } });
  },
  hiss(pos) { this.noise({ ftype: 'highpass', f0: 2500, f1: 5000, q: 0.4, dur: 1.5, vol: 0.55, attack: 0.9, pos }); },
  explode(x, y, z) {
    const pos = { x, y, z };
    this.noise({ ftype: 'lowpass', f0: 1400, f1: 60, q: 0.4, dur: 1.8, vol: 1.2, attack: 0.005, pos });
    this.tone({ f0: 70, f1: 25, dur: 1.2, vol: 0.9, pos });
    this.noise({ ftype: 'bandpass', f0: 400, f1: 100, q: 0.5, dur: 0.9, vol: 0.5, delay: 0.1, pos });
  },
  mob(type, pos, hurt) {
    const p = { x: pos.x, y: pos.y + 1, z: pos.z }, h = hurt ? 1.35 : 1;
    switch (type) {
      case 'cow':
        this.tone({ type: 'sawtooth', f0: 150 * h, f1: 105 * h, dur: hurt ? 0.4 : 1.0, vol: 0.4, attack: 0.08, filter: 650, vib: [5, 4], pos: p });
        break;
      case 'pig':
        for (let i = 0; i < (hurt ? 1 : 2); i++) this.tone({ type: 'square', f0: 330 * h, f1: 210 * h, dur: 0.16, vol: 0.28, filter: 1000, vib: [30, 25], delay: i * 0.22, pos: p });
        break;
      case 'sheep':
        this.tone({ type: 'sawtooth', f0: 430 * h, f1: 380 * h, dur: hurt ? 0.3 : 0.7, vol: 0.28, attack: 0.04, filter: 1600, vib: [9, 18], pos: p });
        break;
      case 'chicken':
        for (let i = 0; i < (hurt ? 2 : 3); i++) this.tone({ type: 'triangle', f0: 1100 * h, f1: 650 * h, dur: 0.07, vol: 0.2, delay: i * 0.1, pos: p });
        break;
      case 'zombie':
        this.tone({ type: 'sawtooth', f0: 95 * h, f1: 70 * h, dur: hurt ? 0.4 : 1.3, vol: 0.4, attack: 0.1, filter: 420, vib: [3, 6], pos: p });
        this.noise({ ftype: 'lowpass', f0: 500, f1: 200, dur: hurt ? 0.3 : 1, vol: 0.12, attack: 0.1, pos: p });
        break;
      case 'creeper':
        this.noise({ ftype: 'highpass', f0: 3000, f1: 2000, dur: 0.25, vol: 0.3, pos: p });
        break;
      case 'skeleton':   // a bone rattle
        for (let i = 0; i < (hurt ? 3 : 5); i++) this.noise({ ftype: 'bandpass', f0: randRange(1500, 2600) * h, f1: 1200, q: 4, dur: 0.04, vol: 0.3, delay: i * 0.07, pos: p });
        break;
      case 'spider':
        this.noise({ ftype: 'bandpass', f0: 3200 * h, f1: 2200, q: 1.5, dur: hurt ? 0.2 : 0.5, vol: 0.3, attack: 0.05, pos: p });
        for (let i = 0; i < 3; i++) this.tone({ type: 'square', f0: 180 * h, f1: 150, dur: 0.04, vol: 0.08, delay: 0.1 + i * 0.09, filter: 1200, pos: p });
        break;
      case 'wisp':   // a breathy whistle over a crackle
        this.tone({ type: 'sine', f0: 820 * h, f1: 600 * h, dur: hurt ? 0.25 : 0.8, vol: 0.18, attack: 0.15, vib: [7, 40], pos: p });
        this.noise({ ftype: 'bandpass', f0: 1800, f1: 900, q: 0.7, dur: hurt ? 0.25 : 0.7, vol: 0.12, attack: 0.1, pos: p });
        break;
      case 'knight':   // plate armor clanks under a low growl
        for (let i = 0; i < 2; i++) this.noise({ ftype: 'bandpass', f0: randRange(2400, 3200) * h, f1: 2000, q: 9, dur: 0.12, vol: 0.3, delay: i * 0.16, pos: p });
        this.tone({ type: 'sawtooth', f0: 85 * h, f1: 65 * h, dur: hurt ? 0.3 : 0.8, vol: 0.3, attack: 0.08, filter: 380, vib: [4, 5], pos: p });
        break;
      case 'brute':   // a deep rumble with a crackle
        this.tone({ type: 'sawtooth', f0: 60 * h, f1: 42 * h, dur: hurt ? 0.5 : 1.2, vol: 0.5, attack: 0.1, filter: 300, vib: [6, 4], pos: p });
        for (let i = 0; i < 4; i++) this.noise({ ftype: 'highpass', f0: randRange(3000, 5000), f1: 3000, q: 0.7, dur: 0.04, vol: 0.18, delay: Math.random() * 0.8, pos: p });
        break;
    }
  },
};

export { audio };
