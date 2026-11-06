(() => {
  'use strict';
  const root = document.querySelector('[data-bot-demo]');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const tabs = [...root.querySelectorAll('[data-bot-feature]')];
  const panel = $('#bot-demo-panel');
  const image = $('#bot-demo-image');
  const video = $('#bot-demo-video');
  const media = $('.bot-media');
  const diagram = $('.bot-knowledge-flow');
  const screen = $('.bot-screen');
  const caption = $('#bot-demo-caption');
  const play = $('[data-bot-play]');
  const expand = $('[data-bot-expand]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const frames = {
    automation: { image: 'assets/products/bot-overview.jpg', video: 'assets/products/bot-automation.mp4', caption: '定时任务 · 真实界面实录，敏感信息已遮挡', alt: 'XP BOT 定时任务真实软件界面，账号、地址及项目明细已遮挡' },
    knowledge: { diagram: true, caption: '私人知识库 · 功能流程示意，完整问答实录待补录' },
    templates: { image: 'assets/products/bot-templates.jpg', video: 'assets/products/bot-templates.mp4', caption: '图片模板 · 真实界面实录，模板规则已遮挡', alt: 'XP BOT 图片模板真实界面，模板名称与创作规则已遮挡' },
    setup: { image: 'assets/products/bot-setup.jpg', caption: '接入设置 · 真实软件界面，连接信息已遮挡', alt: 'XP BOT 接入设置真实软件界面，配置与连接信息已遮挡' }
  };
  let shown = 'automation';
  let request = 0;
  let visible = false;
  let paused = reduced.matches || Boolean(navigator.connection?.saveData);
  const images = new Map();

  function prepareImage(src) {
    if (!images.has(src)) {
      const frame = new Image();
      images.set(src, new Promise((resolve, reject) => {
        frame.onload = () => resolve(src);
        frame.onerror = () => { images.delete(src); reject(new Error('Frame unavailable')); };
        frame.src = src;
      }));
    }
    return images.get(src);
  }
  function selectState(key) {
    tabs.forEach(tab => {
      const selected = tab.dataset.botFeature === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.querySelector('.bot-feature-copy').setAttribute('aria-hidden', String(!selected));
    });
    const selectedTab = tabs.find(tab => tab.dataset.botFeature === key);
    $('.bot-mobile-summary strong').textContent = selectedTab.querySelector('.bot-feature-copy strong').textContent;
    $('.bot-mobile-summary>span').textContent = selectedTab.querySelector('.bot-feature-copy>span>span').textContent;
  }
  function playbackState() {
    const running = !video.paused;
    play.setAttribute('aria-label', (running ? '暂停' : '播放') + ' XP BOT 实机演示');
    play.setAttribute('aria-pressed', String(running));
    play.querySelector('span').textContent = running ? '暂停实机' : '播放实机';
    play.querySelector('path').setAttribute('d', running ? 'M6 4h3v12H6zm5 0h3v12h-3Z' : 'm7 4 9 6-9 6Z');
  }
  function syncVideo() {
    const frame = frames[shown];
    const ownDialog = root.closest('dialog');
    const covered = [...document.querySelectorAll('dialog[open]')].some(dialog => dialog !== ownDialog);
    const blocked = !frame.video || !visible || paused || document.hidden || covered;
    if (blocked) { video.pause(); playbackState(); return; }
    if (video.getAttribute('src') !== frame.video) {
      video.classList.remove('is-ready');
      video.src = frame.video;
      video.load();
    }
    video.play().catch(playbackState);
  }
  async function selectFeature(tab) {
    const key = tab.dataset.botFeature;
    if (tab.getAttribute('aria-selected') === 'true') return;
    const ticket = ++request;
    const previous = shown;
    const frame = frames[key];
    selectState(key);
    panel.setAttribute('aria-busy', 'true');
    if (frame.image) {
      try { await prepareImage(frame.image); }
      catch {
        if (ticket === request) {
          selectState(shown); panel.removeAttribute('aria-busy');
          caption.textContent = '画面加载失败，请重新选择。';
        }
        return;
      }
    }
    if (ticket !== request) return;
    video.pause(); video.classList.remove('is-ready');
    screen.querySelectorAll('.bot-image-outgoing').forEach(el => el.remove());
    let outgoing;
    if (!reduced.matches && !media.hidden) {
      outgoing = image.cloneNode(false);
      outgoing.removeAttribute('id'); outgoing.removeAttribute('loading');
      outgoing.alt = ''; outgoing.setAttribute('aria-hidden', 'true');
      outgoing.className = 'bot-image-outgoing'; screen.append(outgoing);
    }
    shown = key;
    media.hidden = Boolean(frame.diagram); diagram.hidden = !frame.diagram;
    if (frame.image) { image.src = frame.image; image.alt = frame.alt; }
    caption.textContent = frame.caption;
    play.hidden = !frame.video; expand.hidden = Boolean(frame.diagram);
    panel.setAttribute('aria-labelledby', tab.id); panel.removeAttribute('aria-busy');
    if (!reduced.matches) {
      const direction = tabs.findIndex(t => t.dataset.botFeature === key) > tabs.findIndex(t => t.dataset.botFeature === previous) ? 1 : -1;
      const options = { duration: 600, easing: 'cubic-bezier(.22,1,.36,1)' };
      outgoing?.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-direction * 16}px)` }], options).finished.catch(() => {}).finally(() => outgoing.remove());
      const incoming = frame.diagram ? diagram : media;
      incoming.getAnimations().forEach(animation => animation.cancel());
      incoming.animate([{ opacity: 0, transform: `translateX(${direction * 20}px) scale(.985)` }, { opacity: 1, transform: 'none' }], options);
    }
    syncVideo();
    window.XPScroll?.request();
  }
  tabs.forEach(tab => tab.addEventListener('click', () => selectFeature(tab)));
  $('.bot-feature-list').addEventListener('keydown', event => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    let next = current;
    if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (current + 1) % tabs.length;
    else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (current + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); tabs[next].focus(); selectFeature(tabs[next]);
  });
  play.addEventListener('click', () => {
    // Starting a clip is also allowed when the OS prefers less motion.
    paused = !video.paused;
    syncVideo();
  });
  video.addEventListener('loadeddata', () => {
    if (video.getAttribute('src') === frames[shown].video) video.classList.add('is-ready');
  });
  video.addEventListener('playing', playbackState);
  video.addEventListener('pause', playbackState);
  video.addEventListener('error', () => {
    video.classList.remove('is-ready'); playbackState();
    caption.textContent = '视频暂时无法播放，已保留真实界面截图。';
  });
  expand.addEventListener('click', () => {
    const dialog = document.querySelector('#image-dialog');
    const fullImage = dialog.querySelector('img');
    fullImage.src = image.src; fullImage.alt = image.alt;
    document.querySelector('#image-title').textContent = 'XP BOT · ' + ({ automation: '定时自动化', templates: '图片与模板', setup: '接入与复用' })[shown];
    video.pause(); document.querySelector('#hero-video')?.pause();
    document.body.classList.add('modal-open'); dialog.showModal();
  });
  const observedDialogs = [...document.querySelectorAll('dialog')];
  const dialogs = new MutationObserver(syncVideo);
  observedDialogs.forEach(dialog => dialogs.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; syncVideo(); window.XPScroll?.request();
    }, { threshold: .12 });
    visibility.observe(screen);
    const preload = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      Object.values(frames).filter(frame => frame.image).forEach(frame => prepareImage(frame.image).catch(() => {}));
      preload.disconnect();
    }, { rootMargin: '250px' });
    preload.observe(root);
  } else { visible = true; syncVideo(); }
  document.addEventListener('visibilitychange', syncVideo);
  reduced.addEventListener('change', () => { if (reduced.matches) paused = true; syncVideo(); window.XPScroll?.request(); });
  const plane = $('.bot-visual-plane');
  let last = null;
  window.XPScroll?.register('bot-product-media', context => {
    if (!visible) return;
    const compact = context.width <= 700 || reduced.matches || document.documentElement.classList.contains('effects-balanced');
    const bounds = compact ? null : screen.getBoundingClientRect();
    const progress = bounds ? Math.max(0, Math.min(1, (context.height - bounds.top) / (context.height * .72))) : 1;
    const transform = compact ? 'none' : `translate3d(0,${((1 - progress) * 20).toFixed(2)}px,0) scale(${(.98 + progress * .02).toFixed(4)})`;
    return () => { if (last !== transform) { plane.style.transform = transform; last = transform; } };
  });
  selectState(shown);
  playbackState();
})();
