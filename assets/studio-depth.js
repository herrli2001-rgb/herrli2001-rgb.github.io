/* Scroll planes, line masks, pointer lighting and real product peeks. No idle render loop. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const scenes = [], sceneMap = new Map(), pointerNodes = new Set();
  let pointerFrame = 0, lastPointerTime = 0;

  function lines(node) {
    if (!node || node.querySelector('.fx-line')) return;
    const chunks = node.innerHTML.split(/<br\s*\/?>/i);
    node.innerHTML = chunks.map(chunk => '<span class="fx-line"><span class="fx-line-inner">' + chunk + '</span></span>').join('');
  }
  function letters(node) {
    const label = node.textContent.trim();
    node.setAttribute('aria-label', label); node.textContent = '';
    [...label].forEach((letter, index) => {
      const span = document.createElement('span'); span.className = 'fx-letter';
      span.textContent = letter; span.style.setProperty('--letter-index', index); span.setAttribute('aria-hidden', 'true'); node.append(span);
    });
  }
  function scene(node, kind, layers) {
    node.classList.add('fx-scene'); node.dataset.motionScene = kind;
    layers.filter(Boolean).forEach(layer => layer.classList.add('fx-layer'));
    const state = { node, kind, layers: layers.filter(Boolean), active: false, played: false, animations: [], bounds: null,
      x: 0, y: 0, tx: 0, ty: 0, scrollY: 0, rx: 0, z: 0, scale: 1, opacity: 1, reveal: 1, counted: false };
    scenes.push(state); sceneMap.set(node, state); return state;
  }
  $$('.editorial-statement').forEach(node => {
    lines(node.firstElementChild); scene(node, 'statement', [...node.children]);
  });
  $$('.project-index>article').forEach(node => {
    const children = [...node.children], surface = document.createElement('div'); surface.className = 'record-surface';
    children[1]?.classList.add('record-copy'); children.forEach(child => surface.append(child)); node.append(surface);
    node.classList.add('fx-record'); letters($('.record-title', node));
    const ghost = document.createElement('span'); ghost.className = 'record-ghost'; ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = $('.record-title', node).getAttribute('aria-label'); node.prepend(ghost);
    scene(node, 'record', [surface]);
  });
  const about = $('.about-top'), aboutLede = $('.about-lede');
  if (aboutLede) {
    aboutLede.innerHTML = aboutLede.innerHTML.replace('李小朋', '<span class="fx-name">' +
      [...'李小朋'].map((letter, index) => `<span class="fx-name-letter" style="--letter-index:${index}">${letter}</span>`).join('') +
      '<svg viewBox="0 0 260 30" aria-hidden="true"><path pathLength="1" d="M3 20C58 2 110 29 164 13S235 7 256 18M30 26C102 14 173 29 234 22"/></svg></span>');
    lines(aboutLede);
  }
  if (about) scene(about, 'about', [...about.children]);
  $$('.education-row').forEach(node => scene(node, 'education', [...node.children]));
  $$('.experience>article').forEach(node => scene(node, 'experience', [...node.children]));
  const stats = $('.result-band'); if (stats) scene(stats, 'stats', [...stats.children]);
  const contact = $('.contact-chapter'); if (contact) scene(contact, 'contact', [$('.contact-title', contact), $('.contact-email', contact)]);
  $$('.section-caption').forEach(node => scene(node, 'caption', [...node.children]));
  $$('.project-index>.future-record').forEach(node => scene(node, 'future', [...node.children]));
  const dividers = $$('.bit-strip').filter(node => !node.closest('.opening'));
  dividers.forEach(node => node.classList.add('fx-divider'));

  function fitStatements() {
    const paragraphs = $$('.editorial-statement>p');
    paragraphs.forEach(node => node.style.removeProperty('--statement-type'));
    const measures = paragraphs.map(node => ({ node, width: node.clientWidth, size: parseFloat(getComputedStyle(node).fontSize),
      needed: Math.max(...$$('.fx-line-inner', node).map(line => line.scrollWidth)) }));
    measures.forEach(({ node, width, size, needed }) => node.style.setProperty('--statement-type', Math.floor(size * Math.min(1, width / Math.max(needed, 1))) + 'px'));
    window.XPScroll.request();
  }
  addEventListener('resize', fitStatements, { passive: true }); document.fonts?.ready.then(fitStatements); fitStatements();

  function paint(state) {
    state.layers.forEach((layer, index) => {
      const factor = state.kind === 'record' ? 1 : index % 2 ? .62 : 1;
      const pointer = reduced.matches ? 0 : 1;
      layer.style.setProperty('--depth-x', (state.x * 11 * factor * pointer).toFixed(2) + 'px');
      layer.style.setProperty('--depth-y', ((state.scrollY + state.y * 10 * pointer) * factor).toFixed(2) + 'px');
      layer.style.setProperty('--depth-z', state.z.toFixed(1) + 'px');
      layer.style.setProperty('--depth-rx', (state.rx - state.y * (state.kind === 'record' ? 8 : 5) * pointer).toFixed(2) + 'deg');
      layer.style.setProperty('--depth-ry', (state.x * (state.kind === 'record' ? 10 : 5) * pointer).toFixed(2) + 'deg');
      layer.style.setProperty('--depth-scale', state.scale.toFixed(4));
      layer.style.setProperty('--depth-opacity', state.opacity.toFixed(3));
    });
  }
  window.XPScroll.register('editorial-depth', context => {
    const measurements = scenes.map(state => {
      const bounds = state.node.getBoundingClientRect();
      const entry = clamp((context.height - bounds.top) / Math.min(context.height * .62, 420));
      const exit = clamp((-bounds.top - bounds.height * .35) / Math.max(180, bounds.height));
      return { state, bounds, entry, exit, near: bounds.top < context.height + 160 && bounds.bottom > -160 };
    });
    const strips = dividers.map(node => ({ node, p: clamp((context.height - node.getBoundingClientRect().top) / context.height) }));
    return () => {
      measurements.forEach(({ state, bounds, entry, exit, near }) => {
        state.bounds = bounds; state.active = near; state.node.classList.toggle('is-motion-visible', near);
        if (!near && state.played) state.played = false;
        const amount = reduced.matches ? 0 : 1;
        const strength = state.kind === 'caption' || state.kind === 'future' ? .4 : 1;
        state.reveal = reduced.matches ? 1 : entry;
        state.scrollY = ((1 - entry) * 72 - exit * 30) * amount * strength;
        state.rx = ((1 - entry) * 13 - exit * 5) * amount * strength;
        state.z = -(1 - entry) * 65 * amount * strength;
        state.scale = 1 - ((1 - entry) * .07 + exit * .018) * amount * strength;
        state.opacity = 1 - ((1 - entry) * .6 + exit * .14) * amount;
        state.node.style.setProperty('--scene-reveal', state.reveal.toFixed(4));
        if (near || reduced.matches) paint(state);
      });
      strips.forEach(({ node, p }) => node.style.setProperty('--divider-progress', p.toFixed(4)));
    };
  });

  function enter(state) {
    if (state.played || reduced.matches) return;
    state.played = true; state.animations.forEach(animation => animation.cancel()); state.animations.length = 0;
    const lineTargets = $$('.fx-line-inner', state.node);
    const textTargets = state.kind === 'record' ? $$('.record-title .fx-letter', state.node) : lineTargets;
    textTargets.forEach((target, index) => {
      const animation = target.animate([
        { opacity: 0, transform: 'translateY(105%) rotateX(-65deg)' },
        { opacity: 1, transform: 'translateY(0) rotateX(0)' }
      ], { duration: state.kind === 'record' ? 650 : 900, delay: index * (state.kind === 'record' ? 28 : 130), easing: ease });
      state.animations.push(animation);
    });
    if (state.kind === 'statement') {
      const copy = state.node.lastElementChild;
      state.animations.push(copy.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0)' }], { duration: 1050, delay: 160, easing: ease }));
    }
    if (state.kind === 'stats' && !state.counted) countStats(state);
  }
  const entryObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = sceneMap.get(entry.target);
      if (entry.isIntersecting) enter(state);
      else { state.played = false; state.animations.forEach(animation => animation.cancel()); state.animations.length = 0; }
    });
  }, { rootMargin: '0px 0px -3%', threshold: .12 });
  scenes.forEach(state => entryObserver.observe(state.node));

  function countStats(state) {
    state.counted = true;
    const numbers = $$('strong', state.node).map(node => ({ node, original: node.textContent, value: Number(node.textContent.replace(/[^\d]/g, '')) }));
    const started = performance.now();
    function tick(now) {
      const p = clamp((now - started) / 1150), eased = 1 - (1 - p) ** 3;
      numbers.forEach(({ node, original, value }) => {
        const n = Math.round(value * eased);
        const text = original.includes(',') ? n.toLocaleString('en-US') : original.startsWith('0') ? String(n).padStart(original.length, '0') : String(n);
        node.textContent = p === 1 ? original : text + (original.includes('+') ? '+' : '');
      });
      if (p < 1 && !reduced.matches) requestAnimationFrame(tick);
      else numbers.forEach(({ node, original }) => { node.textContent = original; });
    }
    requestAnimationFrame(tick);
  }

  // One shared pointer spring. It stops when every hovered plane has settled.
  function pointerTick(now) {
    pointerFrame = 0;
    const rate = 1 - Math.exp(-Math.min(50, now - (lastPointerTime || now - 16)) / 70); lastPointerTime = now;
    pointerNodes.forEach(state => {
      state.x += (state.tx - state.x) * rate; state.y += (state.ty - state.y) * rate; paint(state);
      if (Math.abs(state.x - state.tx) + Math.abs(state.y - state.ty) < .002) {
        state.x = state.tx; state.y = state.ty; paint(state); pointerNodes.delete(state);
      }
    });
    if (pointerNodes.size) pointerFrame = requestAnimationFrame(pointerTick); else lastPointerTime = 0;
  }
  function wakePointer(state) { pointerNodes.add(state); if (!pointerFrame) pointerFrame = requestAnimationFrame(pointerTick); }
  const preview = document.createElement('figure'); preview.className = 'record-preview'; preview.setAttribute('aria-hidden', 'true');
  preview.innerHTML = '<img alt="" width="640" height="400"><figcaption><span></span><span>REAL INTERFACE</span></figcaption>'; document.body.append(preview);
  addEventListener('scroll', () => preview.classList.remove('is-open'), { passive: true });
  const previewAssets = { bot: ['assets/products/bot-overview.jpg', 'XP BOT'], studio: ['assets/studio/xp-home.png', 'XP STUDIO'], dream: ['assets/portfolio/dream-campus.webp', 'DREAM SCHOOL'], sakura: ['assets/portfolio/sakura-street.webp', '樱花小镇'] };
  function updatePreview(state, event) {
    if (state.kind !== 'record') return;
    const title = $('.record-title', state.node), key = title.dataset.project || title.dataset.case, asset = previewAssets[key];
    if (!asset) return;
    const image = $('img', preview);
    if (image.getAttribute('src') !== asset[0]) image.src = asset[0];
    $('figcaption>span', preview).textContent = asset[1];
    const w = Math.min(390, Math.max(250, innerWidth * .28)), h = w * .625 + 45;
    let x = event.clientX + 34; if (x + w > innerWidth - 18) x = event.clientX - w - 34;
    const y = clamp(event.clientY - h * .4, 16, innerHeight - h - 16);
    preview.style.setProperty('--preview-x', clamp(x, 16, innerWidth - w - 16) + 'px'); preview.style.setProperty('--preview-y', y + 'px');
    preview.style.setProperty('--preview-turn', (state.tx * 7).toFixed(2) + 'deg'); preview.classList.add('is-open');
  }
  scenes.forEach(state => {
    state.node.addEventListener('pointermove', event => {
      if (reduced.matches || !fine.matches || innerWidth <= 700 || event.pointerType !== 'mouse') return;
      const bounds = state.bounds || state.node.getBoundingClientRect();
      const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1), y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
      state.tx = (x - .5) * 2; state.ty = (y - .5) * 2;
      state.node.style.setProperty('--light-x', (x * 100).toFixed(2) + '%'); state.node.style.setProperty('--light-y', (y * 100).toFixed(2) + '%');
      state.node.classList.add('is-pointer-over'); wakePointer(state); updatePreview(state, event);
    }, { passive: true });
    state.node.addEventListener('pointerleave', () => {
      state.tx = state.ty = 0; state.node.classList.remove('is-pointer-over'); wakePointer(state); preview.classList.remove('is-open');
    });
  });

  // Press rings work on real buttons and links without intercepting their actions.
  const controls = $$('button,a').filter(node => !node.closest('[data-waves]'));
  const staticControls = controls.filter(node => getComputedStyle(node).position === 'static');
  controls.forEach(node => node.classList.add('fx-control'));
  staticControls.forEach(node => node.classList.add('fx-control-static'));
  document.addEventListener('pointerdown', event => {
    const target = event.target.closest('.fx-control');
    if (!target || reduced.matches || event.button !== 0) return;
    const ring = document.createElement('span'); ring.className = 'control-ring'; ring.setAttribute('aria-hidden', 'true'); target.append(ring);
    const animation = ring.animate([{ opacity: .7, transform: 'scale(.82)' }, { opacity: 0, transform: 'scale(1.25)' }], { duration: 600, easing: 'cubic-bezier(.2,.65,.2,1)' });
    animation.finished.then(() => ring.remove(), () => ring.remove());
  }, { passive: true });
  function stopPointer() {
    preview.classList.remove('is-open'); scenes.forEach(state => { state.tx = state.ty = state.x = state.y = 0; state.node.classList.remove('is-pointer-over'); paint(state); });
    pointerNodes.clear(); cancelAnimationFrame(pointerFrame); pointerFrame = 0; lastPointerTime = 0; window.XPScroll.request();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPointer(); });
  reduced.addEventListener('change', () => { stopPointer(); if (reduced.matches) scenes.forEach(state => state.animations.forEach(animation => animation.cancel())); });
  new MutationObserver(() => { if (document.querySelector('dialog[open]')) stopPointer(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.XPDepth = { getState: () => ({ scenes: scenes.length, visible: scenes.filter(s => s.active).length, pointerLoop: Boolean(pointerFrame), previewOpen: preview.classList.contains('is-open') }) };
  window.XPScroll.request();
})();
