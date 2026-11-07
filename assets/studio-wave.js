/* Hidden keyword discoveries. Nothing is rendered in the wave until a deliberate drag. */
(() => {
  'use strict';
  const field = document.querySelector('[data-waves]');
  if (!field) return;
  const canvas = field.querySelector('canvas'), ctx = canvas.getContext('2d', { alpha: false });
  const layer = field.querySelector('[data-wave-discoveries]');
  const pool = [...field.querySelector('[data-wave-keyword-pool]').content.querySelectorAll('span')].map(n => n.textContent);
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const motion = () => !reduced.matches && !document.hidden && !document.querySelector('dialog[open]');
  const ripples = [], discoveries = new Map();
  let width = 1, height = 1, phase = 0, progress = 0, visible = true, frame = 0, lastFrame = 0;
  let bag = [], lastWordAt = -Infinity, lastWordX = -500, lastWordY = -500;
  const pointer = { x: -500, y: -500, tx: -500, ty: -500 };
  const drag = { pending: false, active: false, moved: false, startX: 0, startY: 0, lastX: 0, lastY: 0, rippleX: 0, rippleY: 0 };
  function nextWord() {
    if (!bag.length) {
      bag = pool.slice();
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    }
    return bag.pop();
  }
  function dispose(node) {
    const state = discoveries.get(node);
    if (!state) return;
    discoveries.delete(node); clearTimeout(state.timer); state.animation?.cancel(); node.remove();
  }
  function clearWords(fade = false) {
    discoveries.forEach((state, node) => {
      if (!fade || reduced.matches) { dispose(node); return; }
      const opacity = getComputedStyle(node).opacity;
      state.animation?.cancel(); clearTimeout(state.timer);
      state.animation = node.animate([{ opacity }, { opacity: 0 }], { duration: 280, fill: 'forwards', easing: 'ease-out' });
      state.timer = setTimeout(() => dispose(node), 300);
    });
  }
  function discover(x, y, dx = 1, dy = 0) {
    const limit = innerWidth <= 700 ? 3 : 4;
    if (discoveries.size >= limit) dispose(discoveries.keys().next().value);
    const node = document.createElement('span'); node.className = 'wave-discovery'; node.textContent = nextWord();
    const fontSize = innerWidth <= 700 ? 12 : clamp(width * .017, 17, 27);
    const halfWidth = node.textContent.length * fontSize * .31 + 10;
    const speed = Math.hypot(dx, dy) || 1, side = Math.random() < .5 ? -1 : 1;
    const px = clamp(x - dy / speed * side * 34, halfWidth, width - halfWidth);
    const py = clamp(y + dx / speed * side * 34, 28, height - 28);
    node.style.left = px + 'px'; node.style.top = py + 'px'; node.style.fontSize = fontSize + 'px';
    layer.append(node);
    const driftX = dx / speed * 22 + side * 8, driftY = -18 + dy / speed * 12;
    const transform = (x, y, scale) => `translate(-50%,-50%) translate3d(${x}px,${y}px,0) scale(${scale})`;
    const animation = reduced.matches ? null : node.animate([
      { opacity: 0, transform: transform(0, 8, .86), offset: 0, easing: 'cubic-bezier(.16,1,.3,1)' },
      { opacity: 1, transform: transform(driftX * .2, 0, 1), offset: .18 },
      { opacity: .92, transform: transform(driftX * .65, driftY * .65, 1), offset: .6, easing: 'ease-in' },
      { opacity: 0, transform: transform(driftX, driftY, 1.04), offset: 1 }
    ], { duration: 1850, fill: 'both' });
    const state = { animation, timer: setTimeout(() => dispose(node), reduced.matches ? 900 : 1900) };
    discoveries.set(node, state); animation?.finished.then(() => dispose(node), () => {});
    lastWordAt = performance.now(); lastWordX = x; lastWordY = y;
  }
  function ripple(x, y, strength = 1) {
    ripples.push({ x, y, age: 0, strength }); if (ripples.length > 4) ripples.shift();
  }
  function draw(dt) {
    phase += dt * .00015;
    ctx.fillStyle = document.body.classList.contains('contrasted') ? '#fff8e8' : '#f4c95d';
    ctx.fillRect(0, 0, width, height);
    pointer.x += (pointer.tx - pointer.x) * .18; pointer.y += (pointer.ty - pointer.y) * .18;
    const amplitude = Math.min(80, width * .065), spacing = innerWidth <= 700 ? 9 : 10;
    const flow = phase + progress * 3.2;
    ctx.globalAlpha = 1; ctx.strokeStyle = '#24170b'; ctx.lineWidth = .85; ctx.beginPath();
    for (let origin = -95; origin <= width + 95; origin += spacing) {
      for (let y = -28, first = true; y <= height + 28; y += 9) {
        const envelope = Math.sin(Math.PI * clamp(y / height, 0, 1));
        let x = origin + Math.sin(y * .008 + origin * .009 + flow) * amplitude * envelope
          + Math.sin(y * .016 - origin * .003 + flow * 1.5) * amplitude * .32 * envelope;
        let yy = y;
        const baseX = x;
        const px = x - pointer.x, py = y - pointer.y, near = Math.hypot(px, py);
        if (near < 175) x += Math.sign(px || 1) * (1 - near / 175) ** 2 * (drag.active ? 35 : 18);
        for (const r of ripples) {
          const dx = baseX - r.x, dy = y - r.y, distance = Math.hypot(dx, dy) || 1;
          const ring = (distance - r.age * .4) / 48;
          const displacement = Math.exp(-ring * ring) * Math.cos(ring * 1.5) * 19 * r.strength * Math.max(0, 1 - r.age / 1550) ** 1.4;
          x += dx / distance * displacement; yy += dy / distance * displacement;
        }
        if (first) { ctx.moveTo(x, yy); first = false; } else ctx.lineTo(x, yy);
      }
    }
    ctx.stroke();
    for (const r of ripples) {
      const fade = Math.max(0, 1 - r.age / 1550);
      ctx.globalAlpha = fade * .27; ctx.lineWidth = 1.2 * fade;
      ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, r.age * .4), 0, Math.PI * 2); ctx.stroke();
      r.age += dt;
    }
    ctx.globalAlpha = 1;
    while (ripples.length && ripples[0].age >= 1550) ripples.shift();
  }
  function resize() {
    const box = field.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.35);
    width = Math.max(1, box.width); height = Math.max(1, box.height);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(0);
  }
  function tick(now) {
    frame = 0;
    if (!motion() || !visible) { lastFrame = 0; return; }
    if (!lastFrame || now - lastFrame >= 31) { draw(lastFrame ? Math.min(70, now - lastFrame) : 16); lastFrame = now; }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; lastFrame = 0;
    if (motion() && visible) frame = requestAnimationFrame(tick);
    else { ripples.length = 0; clearWords(); draw(0); }
  }
  function finish() { drag.pending = drag.active = drag.moved = false; field.classList.remove('is-dragging'); }
  field.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const box = field.getBoundingClientRect();
    drag.pending = true; drag.active = event.pointerType !== 'touch'; drag.moved = false;
    drag.startX = drag.lastX = drag.rippleX = event.clientX - box.left;
    drag.startY = drag.lastY = drag.rippleY = event.clientY - box.top;
    if (drag.active) { field.setPointerCapture(event.pointerId); field.classList.add('is-dragging'); ripple(drag.startX, drag.startY, .8); }
  });
  field.addEventListener('pointermove', event => {
    const box = field.getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top;
    pointer.tx = x; pointer.ty = y;
    if (!drag.pending) { if (reduced.matches) draw(0); return; }
    if (x < 0 || y < 0 || x > width || y > height) { finish(); clearWords(true); return; }
    const travelX = x - drag.startX, travelY = y - drag.startY;
    if (!drag.active && event.pointerType === 'touch' && Math.abs(travelX) > 10 && Math.abs(travelX) > Math.abs(travelY) * 1.2) {
      drag.active = true; field.setPointerCapture(event.pointerId); field.classList.add('is-dragging');
    }
    if (!drag.active) return;
    if (event.cancelable) event.preventDefault();
    const dx = x - drag.lastX, dy = y - drag.lastY;
    phase += dx * .0018;
    if (Math.hypot(x - drag.rippleX, y - drag.rippleY) > 42) { ripple(x, y); drag.rippleX = x; drag.rippleY = y; }
    if (Math.hypot(travelX, travelY) > 12) {
      drag.moved = true;
      if (performance.now() - lastWordAt > 180 && Math.hypot(x - lastWordX, y - lastWordY) > 65) discover(x, y, dx, dy);
    }
    drag.lastX = x; drag.lastY = y;
    if (reduced.matches) draw(0);
  }, { passive: false });
  field.addEventListener('pointerleave', () => { pointer.tx = pointer.ty = -500; finish(); clearWords(true); });
  field.addEventListener('pointercancel', () => { finish(); clearWords(true); });
  addEventListener('pointerup', finish);
  field.addEventListener('lostpointercapture', finish);
  field.addEventListener('keydown', event => {
    if (event.code !== 'Space' && event.key !== 'Enter') return;
    event.preventDefault(); ripple(width / 2, height / 2); discover(width / 2, height / 2);
    if (reduced.matches) draw(0);
  });
  new ResizeObserver(resize).observe(field);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0 }).observe(field);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); sync(); });
  reduced.addEventListener('change', sync);
  document.fonts?.ready.then(resize);
  window.XPWave = { sync, setProgress(value) { progress = value; if (reduced.matches) draw(0); }, getState: () => ({ discoveries: discoveries.size, ripples: ripples.length, dragging: drag.active, visible }) };
  resize(); sync();
})();
