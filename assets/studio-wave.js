/* Cached wave geometry. No keyword DOM, text animations or ripple point searches. */
(() => {
  'use strict';
  const field = document.querySelector('[data-waves]');
  if (!field) return;
  const canvas = field.querySelector('canvas'), ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const interval = 1000 / 60, rows = 33;
  let width = 1, height = 1, phase = 0, progress = 0, visible = true, frame = 0, lastPaint = 0, nextPaint = 0;
  let origins = [], ys = [], sinA = [], cosA = [], sinB = [], cosB = [], rowGain = [];
  let bounds = { left: 0, top: 0, width: 1, height: 1 }, background = '#ffffff', rebuilds = 0, draws = 0;
  const pointer = { x: -1000, y: -1000, tx: -1000, ty: -1000, strength: 0, present: false };
  const allowed = () => visible && !reduced.matches && !document.hidden && !document.body.classList.contains('modal-open');
  function cacheGeometry() {
    const lines = Math.ceil((width + 160) / 10), count = lines * rows;
    origins = new Float32Array(lines); ys = new Float32Array(rows); rowGain = new Float32Array(rows);
    sinA = new Float32Array(count); cosA = new Float32Array(count); sinB = new Float32Array(count); cosB = new Float32Array(count);
    const amplitude = Math.min(80, width * .065);
    for (let row = 0; row < rows; row++) ys[row] = -20 + row * (height + 40) / (rows - 1);
    for (let line = 0; line < lines; line++) {
      const origin = -80 + line * 10; origins[line] = origin;
      for (let row = 0; row < rows; row++) {
        const y = ys[row], envelope = Math.sin(Math.PI * clamp(y / height, 0, 1));
        const a = y * .008 + origin * .009, b = y * .016 - origin * .003, i = line * rows + row;
        sinA[i] = Math.sin(a) * amplitude * envelope; cosA[i] = Math.cos(a) * amplitude * envelope;
        sinB[i] = Math.sin(b) * amplitude * .32 * envelope; cosB[i] = Math.cos(b) * amplitude * .32 * envelope;
      }
    }
    rebuilds++;
  }
  function draw(dt) {
    phase += dt * .00015;
    const flow = phase + progress * 3.2;
    const sa = Math.sin(flow), ca = Math.cos(flow), sb = Math.sin(flow * 1.5), cb = Math.cos(flow * 1.5);
    const ease = 1 - Math.exp(-Math.max(1, dt) / 75);
    pointer.x += (pointer.tx - pointer.x) * ease; pointer.y += (pointer.ty - pointer.y) * ease;
    pointer.strength += ((pointer.present ? 1 : 0) - pointer.strength) * ease;
    const interactive = pointer.strength > .005, radius = 180, inverseRadius2 = 1 / (radius * radius);
    if (interactive) for (let row = 0; row < rows; row++) rowGain[row] = Math.max(0, 1 - (ys[row] - pointer.y) ** 2 * inverseRadius2);
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#24170b'; ctx.lineWidth = .85; ctx.beginPath();
    for (let line = 0; line < origins.length; line++) {
      const start = line * rows, origin = origins[line];
      for (let row = 0; row < rows; row++) {
        const i = start + row;
        let x = origin + sinA[i] * ca + cosA[i] * sa + sinB[i] * cb + cosB[i] * sb, y = ys[row];
        if (interactive && rowGain[row] > 0) {
          const dx = x - pointer.x, influence = rowGain[row] - dx * dx * inverseRadius2;
          if (influence > 0) { const force = influence * influence * pointer.strength * .3; x += dx * force; y += (y - pointer.y) * force * .35; }
        }
        if (row === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }
    ctx.stroke(); draws++;
  }
  function resize() {
    bounds = field.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(280, Math.min(700, Math.round(innerHeight * .65)));
    const dpr = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(1200000 / (nextWidth * nextHeight)));
    const bw = Math.round(nextWidth * dpr), bh = Math.round(nextHeight * dpr);
    if (nextWidth !== width || nextHeight !== height || canvas.width !== bw || canvas.height !== bh) {
      width = nextWidth; height = nextHeight; canvas.width = bw; canvas.height = bh;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); cacheGeometry();
    }
    if (visible) draw(0);
  }
  function tick(now) {
    frame = 0;
    if (!allowed()) { lastPaint = nextPaint = 0; return; }
    if (now + .4 >= nextPaint) {
      draw(lastPaint ? Math.min(50, now - lastPaint) : interval); lastPaint = now;
      nextPaint = nextPaint ? nextPaint + interval : now + interval;
      if (nextPaint < now - interval) nextPaint = now + interval;
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    background = document.body.classList.contains('theme-yellow') ? '#f4c95d' : '#ffffff';
    if (allowed()) {
      if (!frame) { lastPaint = nextPaint = 0; frame = requestAnimationFrame(tick); }
    } else {
      cancelAnimationFrame(frame); frame = 0; lastPaint = nextPaint = 0; pointer.present = false; pointer.strength = 0;
      if (visible && !document.hidden && !document.body.classList.contains('modal-open')) draw(0);
    }
  }
  field.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reduced.matches) return;
    pointer.tx = (event.clientX - bounds.left) * width / Math.max(1, bounds.width);
    pointer.ty = (event.clientY - bounds.top) * height / Math.max(1, bounds.height);
    pointer.present = true;
  }, { passive: true });
  field.addEventListener('pointerleave', () => { pointer.present = false; });
  window.XPScroll.register('wave-input-bounds', () => {
    if (!visible) return;
    const measured = field.getBoundingClientRect(); return () => { bounds = measured; };
  });
  addEventListener('resize', resize, { passive: true });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0 }).observe(field);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', sync); reduced.addEventListener('change', sync); document.fonts?.ready.then(resize);
  window.XPWave = { sync, setProgress(value) { progress = value; },
    getState: () => ({ visible, running: Boolean(frame), background, targetFps: 60, vertices: origins.length * rows,
      geometryRebuilds: rebuilds, drawCalls: draws, bitmap: [canvas.width, canvas.height] }) };
  resize(); sync();
})();
