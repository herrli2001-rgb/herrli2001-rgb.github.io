/* XP portfolio: original canvas / scroll choreography, inspired by wodniack.dev.
   Uses XPScroll for batched geometry reads. No animation library or remote runtime. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smooth = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  const motion = () => !reduced.matches && !document.hidden && !document.querySelector('dialog[open]');
  const animate = (element, frames, duration = 550) => {
    if (reduced.matches) return;
    element.animate(frames, { duration, easing: 'cubic-bezier(.22,1,.36,1)' });
  };

  // White is the new default, including visitors with a legacy yellow preference.
  const contrast = $('.contrast-toggle'), themeKey = 'xp-theme-v2';
  function setTheme(paper) {
    document.body.classList.toggle('contrasted', paper);
    document.body.classList.toggle('theme-yellow', !paper);
    contrast.setAttribute('aria-pressed', String(paper));
    contrast.title = paper ? '切换为暖黄色' : '切换为白色';
    $('meta[name="theme-color"]').content = paper ? '#ffffff' : '#f4c95d';
  }
  let paper = true;
  try { paper = localStorage.getItem(themeKey) !== 'yellow'; } catch {}
  setTheme(paper);
  contrast.addEventListener('click', () => {
    const white = !document.body.classList.contains('contrasted'); setTheme(white);
    try { localStorage.setItem(themeKey, white ? 'white' : 'yellow'); } catch {}
  });

  // Rolling type: measured display faces turn into italic faces, glyph by glyph.
  const words = $$('[data-roll-word]');
  words.forEach(word => {
    const label = word.textContent.trim();
    word.classList.add('roll-word'); word.setAttribute('aria-label', label); word.textContent = '';
    [...label].forEach((letter, index) => {
      const glyph = document.createElement('span'); glyph.className = 'glyph'; glyph.setAttribute('aria-hidden', 'true');
      glyph.style.setProperty('--glyph-delay', index * 24 + 'ms');
      const measure = document.createElement('span'); measure.className = 'glyph-measure'; measure.textContent = letter;
      const drum = document.createElement('span'); drum.className = 'glyph-drum';
      const front = document.createElement('span'); front.className = 'glyph-face glyph-front'; front.textContent = letter;
      const alt = document.createElement('span'); alt.className = 'glyph-face glyph-alt'; alt.textContent = letter.toLowerCase();
      drum.append(front, alt); glyph.append(measure, drum); word.append(glyph);
    });
    const flip = state => { if (!reduced.matches) $$('.glyph', word).forEach(el => el.classList.toggle('is-flipped', state)); };
    word.addEventListener('pointerenter', () => flip(true));
    word.addEventListener('pointerleave', () => flip(false));
    word.closest('a')?.addEventListener('focus', () => flip(true));
    word.closest('a')?.addEventListener('blur', () => flip(false));
  });
  let fitFrame = 0;
  function fitType() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      $$('.display-line').forEach(line => {
        const mobile = innerWidth <= 700 && !line.classList.contains('contact-title');
        const spans = $$('.roll-word', line), star = $('.display-star', line);
        const usable = line.clientWidth - (innerWidth <= 700 ? 24 : 40);
        const base = innerWidth * .17;
        line.style.setProperty('--display-size', base + 'px');
        const widths = spans.map(span => span.offsetWidth);
        const needed = mobile ? Math.max(...widths) : widths.reduce((a, b) => a + b, 0) + (star?.clientWidth || 0) + innerWidth * .032;
        line.style.setProperty('--display-size', (base * Math.min(1.35, usable / Math.max(1, needed))) + 'px');
      });
      window.XPScroll.request();
    });
  }
  new ResizeObserver(fitType).observe($('.site-shell'));
  document.fonts?.ready.then(fitType); fitType();
  if (!reduced.matches) {
    const introWords = $$('.opening .glyph');
    introWords.forEach((glyph, index) => {
      glyph.animate([{ opacity: 0, transform: 'translateY(35%) rotateX(-30deg)' }, { opacity: 1, transform: 'none' }],
        { duration: 650, delay: index * 28, fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)' });
    });
  }
  const consoleNode = $('[data-console]');
  const messages = ['AGENTS / REAL WORK_', 'GAMES / OPEN WORLDS_', 'IDEAS INTO SOFTWARE_'];
  let messageAt = 0, consoleTimer;
  function scheduleConsole() {
    clearTimeout(consoleTimer);
    if (!motion()) return;
    consoleTimer = setTimeout(() => {
      consoleNode.textContent = messages[messageAt++ % messages.length]; scheduleConsole();
    }, 3200);
  }
  scheduleConsole();

  const syncWave = () => window.XPWave?.sync();

  // A reversible scroll sequence, separate from the entrance animations below it.
  const openingSequence = $('[data-opening-scroll]'), opening = $('.opening', openingSequence);
  const openingHeader = $('.kinetic-header'), motto = $('.display-line--motto', opening);
  let introTravel = 1, headerHeight = 0, introBaseHeight = 1, introGrowth = 0, lastIntro = -1, lastOffset = -1;
  function sizeOpening() {
    headerHeight = openingHeader.offsetHeight;
    const compact = innerWidth <= 700, gutters = compact ? 17 : 33;
    introBaseHeight = Math.max(compact ? 550 : 480, innerHeight - headerHeight - gutters);
    const fullHeight = Math.max(introBaseHeight, innerHeight - (compact ? 9 : 17));
    introGrowth = fullHeight - introBaseHeight;
    introTravel = Math.round(Math.min(780, innerHeight * (compact ? .62 : .86)));
    openingSequence.style.setProperty('--intro-height', fullHeight + 'px');
    openingSequence.style.setProperty('--intro-offset', introGrowth + 'px');
    openingSequence.style.setProperty('--intro-full-height', fullHeight + 'px');
    openingSequence.style.setProperty('--intro-travel', introTravel + 'px');
    lastIntro = -1; lastOffset = -1; window.XPScroll.request();
  }
  new ResizeObserver(sizeOpening).observe(openingHeader);
  addEventListener('resize', sizeOpening, { passive: true });
  reduced.addEventListener('change', () => { sizeOpening(); window.XPWave?.sync(); });
  sizeOpening();
  window.XPScroll.register('opening-transition', context => {
    const bounds = openingSequence.getBoundingClientRect();
    const start = bounds.top + context.y - headerHeight - (context.width <= 700 ? 9 : 17);
    const distance = Math.max(0, context.y - start);
    const progress = reduced.matches ? 0 : clamp(distance / (introTravel + introGrowth));
    const offset = reduced.matches ? 0 : Math.max(0, introGrowth - distance);
    if (Math.abs(progress - lastIntro) < .0001 && offset === lastOffset) return;
    const width = bounds.width;
    return () => {
      lastIntro = progress;
      if (offset !== lastOffset) {
        openingSequence.style.setProperty('--intro-offset', offset.toFixed(2) + 'px'); lastOffset = offset;
      }
      opening.style.setProperty('--intro-progress', progress.toFixed(4));
      opening.style.setProperty('--wave-y', (-progress * 34).toFixed(2) + 'px');
      opening.style.setProperty('--wave-scale', (1 + progress * .18).toFixed(4));
      opening.style.setProperty('--wave-opacity', (1 - progress * .15).toFixed(4));
      opening.style.setProperty('--motto-x', (progress * width * .025).toFixed(2) + 'px');
      opening.style.setProperty('--motto-y', (-progress * 12).toFixed(2) + 'px');
      opening.style.setProperty('--motto-turn', (progress * .75).toFixed(3) + 'deg');
      opening.style.setProperty('--motto-scale', (1 - progress * .1).toFixed(4));
      opening.style.setProperty('--motto-opacity', (1 - smooth((progress - .6) / .4) * .25).toFixed(4));
      $('.display-star', motto).style.setProperty('--star-angle', (progress * 300).toFixed(2) + 'deg');
      window.XPWave?.setProgress(progress);
    };
  });

  // Sticky portals and flying, clickable real project screens.
  const walls = $$('[data-wall]').map(section => ({ section, stage: $('.wall-stage', section), gallery: $('.wall-gallery', section),
    cards: $$('[data-wall-card]', section), counter: $('[data-wall-count]', section), visible: false, progress: 0 }));
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => { const wall = walls.find(item => item.section === entry.target); wall.visible = entry.isIntersecting; });
    window.XPScroll.request();
  }, { rootMargin: '150px' });
  walls.forEach(wall => visibility.observe(wall.section));
  reduced.addEventListener('change', () => { walls.forEach(wall => { wall.rendered = false; }); window.XPScroll.request(); });
  function tileVideo(video, active) {
    if (!video) return;
    const play = active && motion() && !navigator.connection?.saveData;
    if (video._tilePlaying === play) return;
    video._tilePlaying = play;
    if (!play) { video.pause(); return; }
    if (!video.getAttribute('src')) { video.src = video.dataset.tileVideo; video.load(); }
    if (video.paused) video.play().catch(() => { video._tilePlaying = false; });
  }
  $$('[data-tile-video]').forEach(video => {
    video.addEventListener('loadeddata', () => video.classList.add('is-ready'));
    video.addEventListener('error', () => video.classList.remove('is-ready'));
  });
  window.XPScroll.register('kinetic-project-walls', context => {
    const compact = context.width <= 700;
    const snapshots = walls.map(wall => {
      const bounds = wall.section.getBoundingClientRect();
      return { wall, stageWidth: wall.stage.clientWidth, progress: clamp(-bounds.top / Math.max(1, bounds.height - context.height)) };
    });
    return () => {
      snapshots.forEach(({ wall, progress, stageWidth }) => {
        wall.progress = progress;
        if (wall.rendered && !wall.visible && !wall.wasVisible) return;
        wall.rendered = true; wall.wasVisible = wall.visible;
        const open = smooth(progress / .14) * (1 - smooth((progress - .89) / .11));
        wall.gallery.style.setProperty('--portal-y', (18 * (1 - open)).toFixed(3) + '%');
        wall.gallery.style.setProperty('--portal-x', (29 * (1 - open)).toFixed(3) + '%');
        wall.gallery.style.setProperty('--portal-radius', (140 * (1 - open)).toFixed(1) + 'px');
        wall.gallery.style.setProperty('--portal-scale', (.78 + open * .22).toFixed(4));
        wall.stage.style.setProperty('--wall-open', open.toFixed(3));
        wall.stage.style.setProperty('--ghost-x', ((progress - .5) * stageWidth * .72).toFixed(2) + 'px');
        wall.stage.style.setProperty('--grid-scale', (.8 + open * .2).toFixed(3));
        let nearest = 0, distance = 99;
        wall.cards.forEach((card, index) => {
          const local = (progress - (.04 + index * .082)) / .29;
          const active = local > -.04 && local < 1.04 && wall.visible;
          const opacity = smooth(local / .12) * (1 - smooth((local - .84) / .16));
          if (Math.abs(local - .5) < distance) { nearest = index; distance = Math.abs(local - .5); }
          if (!reduced.matches && (!active || opacity < .005)) {
            if (!card._wallHidden) {
              card.style.opacity = '0'; card.inert = true; card.tabIndex = -1; card.style.pointerEvents = 'none';
              card._wallHidden = true; card._wallEnabled = false; tileVideo($('video', card), false);
            }
            return;
          }
          card._wallHidden = false;
          const sign = index % 2 ? 1 : -1;
          const size = compact ? stageWidth * .79 : stageWidth * (index % 3 === 0 ? .47 : .41);
          const x = stageWidth * .5 - size * .5 + sign * stageWidth * (compact ? .075 : .215) + Math.sin(local * Math.PI) * sign * stageWidth * .045;
          const y = context.height * (1.10 - local * 1.9) - size * .14;
          const z = -130 + Math.sin(clamp(local) * Math.PI) * 210;
          card.style.setProperty('--card-width', size.toFixed(1) + 'px');
          const transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotate(${(sign * (9 - local * 16)).toFixed(2)}deg) scale(${(.9 + Math.sin(clamp(local) * Math.PI) * .12).toFixed(4)})`;
          if (card._wallTransform !== transform) { card.style.transform = transform; card._wallTransform = transform; }
          card.style.opacity = opacity.toFixed(4);
          const enabled = reduced.matches || (active && opacity > .25);
          if (card._wallEnabled !== enabled) {
            card.inert = !enabled; card.tabIndex = enabled ? 0 : -1; card.style.pointerEvents = enabled ? 'auto' : 'none'; card._wallEnabled = enabled;
          }
          tileVideo($('video', card), active && opacity > .2 && !reduced.matches);
        });
        wall.counter.textContent = String(nearest + 1).padStart(2, '0') + ' / 08';
      });
    };
  });
  $$('[data-wall-card]').forEach(card => {
    let pointerFrame = 0;
    card.addEventListener('pointermove', event => {
      if (pointerFrame || reduced.matches || event.pointerType !== 'mouse') return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0; const box = card.getBoundingClientRect();
        card.style.setProperty('--card-ry', ((event.clientX - box.left) / box.width - .5) * 13 + 'deg');
        card.style.setProperty('--card-rx', -((event.clientY - box.top) / box.height - .5) * 10 + 'deg');
      });
    }, { passive: true });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--card-rx', '0deg'); card.style.setProperty('--card-ry', '0deg'); });
  });

  // Small magnetic responses make the fixed controls and keyword cloud feel draggable
  // without adding a custom cursor or stealing the page scroll.
  const magneticTargets = $$('.kinetic-header nav a,.header-product,.github-cell,.contrast-toggle,.record-actions button,.record-actions a,.contact-email,.footer-base a,.keyword-cloud span');
  magneticTargets.forEach(element => {
    element.classList.add('magnetic');
    element.addEventListener('pointermove', event => {
      if (reduced.matches || innerWidth <= 700 || event.pointerType !== 'mouse') return;
      const bounds = element.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - .5) * 9;
      const y = ((event.clientY - bounds.top) / bounds.height - .5) * 7;
      element.style.setProperty('--mag-x', x.toFixed(2) + 'px'); element.style.setProperty('--mag-y', y.toFixed(2) + 'px');
    }, { passive: true });
    element.addEventListener('pointerleave', () => { element.style.setProperty('--mag-x', '0px'); element.style.setProperty('--mag-y', '0px'); });
  });

  // Editorial scroll, hover depth and controls are coordinated by studio-depth.js.

  // Modal detail pages preserve a concise visual index on the main page.
  const dialogs = $$('dialog');
  function refreshMedia() {
    document.body.classList.toggle('modal-open', Boolean(document.querySelector('dialog[open]')));
    if (!motion()) $$('[data-tile-video]').forEach(video => tileVideo(video, false));
    syncWave(); scheduleConsole(); syncRecordings(); gallerySync.forEach(sync => sync()); window.XPScroll.request();
  }
  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal(); dialog.scrollTop = 0;
    animate(dialog, [{ opacity: 0, transform: 'translateY(35px) scale(.965)' }, { opacity: 1, transform: 'none' }], 520);
  }
  const films = {
    dream: ['Dream School · 完整宣传片', 'assets/portfolio/dream-pv.mp4', 'assets/portfolio/dream-poster.webp'],
    sakura: ['樱花小镇 · 完整宣传片', 'assets/portfolio/sakura-pv.mp4', 'assets/portfolio/sakura-poster.webp']
  };
  const film = $('#film-dialog'), filmVideo = $('video', film);
  let draggedGallery = false;
  document.addEventListener('click', event => {
    const button = event.target.closest('button,a'); if (!button) return;
    if (button.matches('[data-project]')) openDialog($('#' + (button.dataset.project === 'bot' ? 'bot' : 'studio') + '-product-dialog'));
    else if (button.matches('[data-case]')) openDialog($('#' + button.dataset.case + '-case'));
    else if (button.matches('[data-film]')) {
      const data = films[button.dataset.film]; if (!data) return;
      $('#film-title').textContent = data[0]; filmVideo.src = data[1]; filmVideo.poster = data[2];
      $('[data-video-link]').href = data[1]; $('.video-error').hidden = true;
      openDialog(film); filmVideo.load(); filmVideo.play().catch(() => {});
    } else if (button.matches('[data-agent-detail]')) openDialog($('#agent-dialog'));
    else if (button.matches('[data-close]')) button.closest('dialog').close();
    else if (button.matches('[data-image]')) {
      if (draggedGallery) return;
      const source = $('img', button), dialog = $('#image-dialog');
      $('img', dialog).src = source.src; $('img', dialog).alt = source.alt; $('#image-title').textContent = source.alt;
      openDialog(dialog);
    }
  });
  dialogs.forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => { $$('video', dialog).forEach(video => video.pause()); refreshMedia(); });
  });
  filmVideo.addEventListener('error', () => { $('.video-error').hidden = false; });
  const dialogObserver = new MutationObserver(refreshMedia);
  dialogs.forEach(dialog => dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] }));

  // Keyboard and loading-safe, animated product tabs for XP Studio.
  function tabKeys(list, tabs, select) {
    list.addEventListener('keydown', event => {
      const at = tabs.indexOf(document.activeElement); if (at < 0) return;
      let next;
      if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (at + 1) % tabs.length;
      else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (at + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); tabs[next].focus(); select(tabs[next]);
    });
  }
  const tabs = $$('[data-product]'), xpPanel = $('#xp-demo-panel'), xpImage = $('#xp-demo-image');
  const shots = {
    home: ['assets/studio/xp-home.png', 'XP Studio · 首页与工作区'],
    dashboard: ['assets/studio/xp-dashboard.png', '经营日报 · 真实软件空状态'],
    human: ['assets/studio/xp-human.png', '说人话 · 营销表达工作区'],
    search: ['assets/studio/xp-search.png', '搜索词 · 采集与分析工作区']
  };
  const loaded = new Map(); let ticket = 0, shown = tabs[0];
  function readyImage(src) {
    if (!loaded.has(src)) loaded.set(src, new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(src); image.onerror = () => { loaded.delete(src); reject(new Error('Unavailable')); }; image.src = src;
    }));
    return loaded.get(src);
  }
  function setFeature(tab) {
    tabs.forEach(item => { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; $('.feature-copy', item).setAttribute('aria-hidden', String(!active)); });
  }
  async function selectFeature(tab) {
    if (tab.getAttribute('aria-selected') === 'true') return;
    const current = ++ticket, previous = shown, [src, caption] = shots[tab.dataset.product];
    setFeature(tab); xpPanel.setAttribute('aria-busy', 'true');
    try { await readyImage(src); }
    catch { if (current === ticket) { setFeature(shown); xpPanel.removeAttribute('aria-busy'); $('#xp-demo-caption').textContent = '图片加载失败，请重新选择。'; } return; }
    if (current !== ticket) return;
    const surface = xpImage.parentElement;
    xpImage.getAnimations().forEach(animation => animation.cancel());
    $$('.product-image-outgoing', surface).forEach(image => image.remove());
    const outgoing = xpImage.cloneNode(false); outgoing.removeAttribute('id'); outgoing.removeAttribute('loading'); outgoing.alt = ''; outgoing.setAttribute('aria-hidden', 'true'); outgoing.className = 'product-image-outgoing';
    if (!reduced.matches) surface.append(outgoing);
    shown = tab; xpImage.src = src; xpImage.alt = caption;
    $('#xp-demo-caption').textContent = caption; xpPanel.setAttribute('aria-labelledby', tab.id); xpPanel.removeAttribute('aria-busy');
    if (!reduced.matches) {
      const direction = tabs.indexOf(tab) > tabs.indexOf(previous) ? 1 : -1;
      outgoing.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-direction * 22}px)` }], { duration: 600, easing: 'cubic-bezier(.22,1,.36,1)' }).finished.catch(() => {}).finally(() => outgoing.remove());
      animate(xpImage, [{ opacity: 0, transform: `translateX(${direction * 24}px) scale(.985)` }, { opacity: 1, transform: 'none' }], 600);
    }
  }
  tabs.forEach(tab => tab.addEventListener('click', () => selectFeature(tab))); tabKeys($('.feature-list'), tabs, selectFeature); setFeature(shown);
  const xpPreload = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { Object.values(shots).forEach(([src]) => readyImage(src).catch(() => {})); xpPreload.disconnect(); }
  }); xpPreload.observe(xpPanel);
  $$('.case-tabs').forEach(list => {
    const group = $$('[role=tab]', list);
    function select(tab) {
      if (tab.getAttribute('aria-selected') === 'true') return;
      group.forEach(item => {
        const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
        $('#' + item.dataset.panel).hidden = !selected;
      });
      animate($('#' + tab.dataset.panel), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], 500);
    }
    group.forEach(tab => tab.addEventListener('click', () => select(tab))); tabKeys(list, group, select);
  });
  function syncRecordings() {
    $$('[data-recording]').forEach(video => {
      const active = video.closest('dialog').open && !video.closest('[role=tabpanel]').hidden && !document.hidden && !film.open && !$('#image-dialog').open;
      if (!active) { video.pause(); return; }
      if (!video.getAttribute('src')) { video.src = video.dataset.recording; video.load(); }
      if (!reduced.matches && video.paused) video.play().catch(() => {});
    });
  }
  const gallerySync = [];
  $$('[data-gallery]').forEach(gallery => {
    const track = $('.gallery-track', gallery), pause = $('.gallery-pause', gallery), figures = $$('figure', track);
    let paused = reduced.matches, timer = 0, startX = 0, startScroll = 0, dragging = false;
    function go(direction) {
      const step = figures[1] ? figures[1].offsetLeft - figures[0].offsetLeft : track.clientWidth;
      let index = Math.round(track.scrollLeft / step) + direction;
      if (index >= figures.length) index = 0; if (index < 0) index = figures.length - 1;
      track.scrollTo({ left: index * step, behavior: reduced.matches ? 'instant' : 'smooth' });
    }
    function sync() {
      clearInterval(timer); timer = 0;
      const active = gallery.closest('dialog').open && !gallery.closest('[role=tabpanel]').hidden && !document.hidden && !film.open && !$('#image-dialog').open;
      if (active && !paused && !reduced.matches && !gallery.matches(':hover') && !gallery.contains(document.activeElement)) timer = setInterval(() => go(1), 4000);
    }
    gallerySync.push(sync);
    pause.addEventListener('click', () => {
      paused = !paused; pause.setAttribute('aria-pressed', String(paused)); pause.textContent = paused ? '继续轮播' : '暂停轮播'; pause.setAttribute('aria-label', pause.textContent); sync();
    });
    $('[data-prev]', gallery).addEventListener('click', () => go(-1)); $('[data-next]', gallery).addEventListener('click', () => go(1));
    track.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); go(event.key === 'ArrowRight' ? 1 : -1); } });
    track.addEventListener('pointerdown', event => { if (event.button !== 0 || event.pointerType === 'touch') return; startX = event.clientX; startScroll = track.scrollLeft; dragging = true; draggedGallery = false; });
    track.addEventListener('pointermove', event => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      if (Math.abs(dx) > 7) { draggedGallery = true; track.style.scrollSnapType = 'none'; track.scrollLeft = startScroll - dx; }
    });
    const finish = () => { dragging = false; track.style.scrollSnapType = ''; setTimeout(() => { draggedGallery = false; }, 0); };
    track.addEventListener('pointerup', finish); track.addEventListener('pointerleave', finish); track.addEventListener('pointercancel', finish);
    ['mouseenter', 'mouseleave', 'focusin', 'focusout'].forEach(name => gallery.addEventListener(name, () => requestAnimationFrame(sync)));
    sync();
  });
  const panelObserver = new MutationObserver(() => { syncRecordings(); gallerySync.forEach(sync => sync()); });
  $$('[role=tabpanel]').forEach(panel => panelObserver.observe(panel, { attributes: true, attributeFilter: ['hidden'] }));
  document.addEventListener('visibilitychange', refreshMedia);
  reduced.addEventListener('change', refreshMedia);
  addEventListener('xp-qualitychange', () => { syncWave(); window.XPScroll.request(); });
  addEventListener('hashchange', () => {
    if (location.hash === '#xp-bot') openDialog($('#bot-product-dialog'));
    if (location.hash === '#xp-studio') openDialog($('#studio-product-dialog'));
  });
  if (location.hash === '#xp-bot') openDialog($('#bot-product-dialog'));
  if (location.hash === '#xp-studio') openDialog($('#studio-product-dialog'));
  window.XPScrollCoverage = () => walls.map(wall => ({ section: wall.section.dataset.wall, progress: +wall.progress.toFixed(3), visible: wall.visible }));
  refreshMedia();
})();
