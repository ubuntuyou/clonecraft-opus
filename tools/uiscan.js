// UI rule sweep (ui-guidelines R2, R3). Runs in the page. Returns the breaks for the current state.
// Targets: buttons, inputs, selects, slots, recipe rows, and anything with cursor:pointer.
// Text contrast: text on a translucent background is checked over white and over black (worst case).
window.__uiscan = function () {
  const vis = e => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    for (let a = e; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; }
    return true;
  };
  const rgba = s => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, base) => [0, 1, 2].map(i => top[i] * top[3] + base[i] * (1 - top[3]));
  const name = e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`;
  const out = { size: [], gap: [], contrast: [] };
  // Targets
  const sel = 'button, input:not([type=hidden]):not([hidden]), select, textarea, .islot, .recipe, a[href]';
  let targets = [...document.querySelectorAll(sel)].filter(vis);
  for (const e of document.querySelectorAll('body *')) if (!targets.includes(e) && getComputedStyle(e).cursor === 'pointer' && vis(e) && !e.closest(sel) && e.id !== 'overlay') targets.push(e);
  targets = targets.filter(e => !e.disabled || e.tagName !== 'BUTTON' || true);
  const rects = targets.map(e => e.getBoundingClientRect());
  targets.forEach((e, i) => { const r = rects[i]; if (r.width < 44 || r.height < 44) out.size.push(`${name(e)} ${Math.round(r.width)}x${Math.round(r.height)}`); });
  for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
    const A = targets[i], Bb = targets[j];
    if (A.contains(Bb) || Bb.contains(A)) continue;
    const a = rects[i], b = rects[j];
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0, v = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0;
    const g = h ? Math.max(b.left - a.right, a.left - b.right) : v ? Math.max(b.top - a.bottom, a.top - b.bottom) : null;
    if (g !== null && g < 11.5) out.gap.push(`${name(A)} | ${name(Bb)} gap ${Math.round(g)}`);
  }
  // Text contrast
  for (const e of document.querySelectorAll('body *')) {
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || !vis(e)) continue;
    const st = getComputedStyle(e);
    if (e.tagName === 'BUTTON' && e.disabled) continue;
    const fg = rgba(st.color);
    // collect backgrounds up the tree until an opaque one
    const layers = []; let opaque = null;
    for (let a = e; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.backgroundImage !== 'none' && a !== document.body) { layers.push('img'); }
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) { if (c[3] >= 1) { opaque = c; break; } layers.push(c); }
    }
    const hasImg = layers.includes('img');
    const flat = layers.filter(l => l !== 'img');
    const worst = [];
    const bases = opaque && !hasImg ? [opaque] : [[255, 255, 255, 1], [0, 0, 0, 1]];
    for (const base of bases) {
      let c = base.slice(0, 3);
      for (let k = flat.length - 1; k >= 0; k--) c = over(flat[k], c);
      const f = fg[3] < 1 ? over(fg, c) : fg;
      worst.push(ratio(f, c) * (+st.opacity < 1 ? 1 : 1));
    }
    const minR = Math.min(...worst);
    const big = parseFloat(st.fontSize) >= 24 || (parseFloat(st.fontSize) >= 18.66 && +st.fontWeight >= 700);
    if (minR < (big ? 3 : 4.5)) out.contrast.push(`${name(e)} "${e.textContent.trim().slice(0, 24)}" ${minR.toFixed(2)}${opaque && !hasImg ? '' : ' (over scene, worst case)'}${hasImg ? ' [bg image]' : ''}`);
  }
  return out;
};
