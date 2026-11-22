(() => {
  'use strict';
  const slides = [...document.querySelectorAll('.slide')];
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const currentPage = document.getElementById('currentPage');
  const sectionLabel = document.getElementById('sectionLabel');
  const progress = document.querySelector('.progress-track');
  const progressFill = document.getElementById('progressFill');
  const announcer = document.getElementById('announcer');
  const outline = document.getElementById('outline');
  const menu = document.querySelector('.menu-toggle');
  const motionButton = document.getElementById('motionToggle');
  const motionMedia = matchMedia('(prefers-reduced-motion: reduce)');
  const narrowMedia = matchMedia('(max-width: 900px)');
  let index = 0;
  let navigationId = 0;
  let cleanupTimer;
  let toastTimer;
  let motionPreference = null;
  try { motionPreference = localStorage.getItem('pe0-motion'); } catch (_) {}
  let motion = !motionMedia.matches && motionPreference !== 'off';

  const format = (value, decimals = 0) => new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals
  }).format(value);
  const stopAnimations = () => {
    slides.forEach(slide => {
      slide.querySelectorAll('[data-count]').forEach(node => {
        if (node._countFrame) cancelAnimationFrame(node._countFrame);
        node.textContent = format(+node.dataset.count, +(node.dataset.decimals || 0));
      });
    });
  };
  const updateMotion = () => {
    document.body.classList.toggle('motion-off', !motion);
    motionButton.setAttribute('aria-pressed', String(motion));
    document.getElementById('motionState').textContent = motion ? '開' : '關';
    if (!motion) stopAnimations();
  };

  slides.forEach((slide, i) => {
    slide.setAttribute('aria-label', `第 ${i + 1} 頁，共 ${slides.length} 頁：${slide.dataset.title}`);
    slide.setAttribute('role', 'group');
    slide.querySelectorAll('.reveal').forEach((node, j) => {
      node.style.setProperty('--delay', `${Math.min(j * 70, 560)}ms`);
    });
  });
  document.getElementById('totalPages').textContent = String(slides.length).padStart(2, '0');
  const outlineLinks = document.getElementById('outlineLinks');
  slides.forEach((slide, i) => {
    const link = document.createElement('a');
    link.href = `#${i + 1}`;
    const number = document.createElement('span');
    number.textContent = String(i + 1).padStart(2, '0');
    link.append(number, document.createTextNode(slide.dataset.title));
    outlineLinks.append(link);
  });

  function animateCounters(slide, ticket) {
    slide.querySelectorAll('[data-count]').forEach(node => {
      const target = +node.dataset.count;
      const decimals = +(node.dataset.decimals || 0);
      if (!motion) { node.textContent = format(target, decimals); return; }
      if (node._countFrame) cancelAnimationFrame(node._countFrame);
      const start = performance.now() + 250;
      const duration = 1250;
      function frame(time) {
        if (ticket !== navigationId || !motion) {
          node.textContent = format(target, decimals);
          return;
        }
        const fraction = Math.min(Math.max((time - start) / duration, 0), 1);
        const eased = 1 - Math.pow(1 - fraction, 3);
        node.textContent = format(target * eased, decimals);
        if (fraction < 1) node._countFrame = requestAnimationFrame(frame);
      }
      node._countFrame = requestAnimationFrame(frame);
    });
  }

  function navigate(to, options = {}) {
    const newIndex = Math.min(Math.max(to, 0), slides.length - 1);
    if (newIndex === index && !options.initial) return;
    const last = index;
    const backwards = newIndex < last;
    const focusedElement = document.activeElement;
    const focusWasInSlide = slides.some(slide => slide.contains(focusedElement));
    index = newIndex;
    navigationId++;
    const ticket = navigationId;
    clearTimeout(cleanupTimer);
    stopAnimations();
    slides.forEach((slide, i) => {
      slide.classList.remove('active', 'arriving', 'leaving', 'backwards', 'entered');
      const isCurrent = i === index;
      const isPrevious = i === last && !options.initial && motion && !narrowMedia.matches;
      slide.hidden = !(isCurrent || isPrevious);
      slide.inert = !isCurrent;
      slide.setAttribute('aria-hidden', String(!isCurrent));
      if (isPrevious) slide.classList.add('leaving');
      if (backwards) slide.classList.add('backwards');
    });
    const active = slides[index];
    active.classList.add('active');
    if (!options.initial) active.classList.add('arriving');
    // A fresh frame restarts entry choreography even when users revisit a slide.
    requestAnimationFrame(() => {
      if (ticket !== navigationId) return;
      active.classList.add('entered');
      animateCounters(active, ticket);
    });
    cleanupTimer = setTimeout(() => {
      if (ticket !== navigationId) return;
      slides.forEach((slide, i) => {
        if (i !== index) slide.hidden = true;
        slide.classList.remove('leaving', 'arriving');
      });
    }, motion && !narrowMedia.matches ? 720 : 0);
    currentPage.textContent = String(index + 1).padStart(2, '0');
    sectionLabel.textContent = active.dataset.title;
    progressFill.style.width = `${(index + 1) / slides.length * 100}%`;
    progress.setAttribute('aria-valuenow', String(index + 1));
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    outlineLinks.querySelectorAll('a').forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (options.history !== false) {
      history.pushState({slide: index + 1}, '', `#${index + 1}`);
    }
    if (!options.initial) announcer.textContent = `第 ${index + 1} 頁，共 ${slides.length} 頁：${active.dataset.title}`;
    if (focusWasInSlide && !options.initial) {
      const heading = active.querySelector('h1,h2');
      heading.tabIndex = -1;
      heading.focus({preventScroll: true});
    }
    if (narrowMedia.matches && !options.initial) window.scrollTo({top: 0, behavior: 'instant'});
  }
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
  }
  function closeOutline() {
    outline.close();
    menu.setAttribute('aria-expanded', 'false');
  }
  menu.addEventListener('click', () => {
    outline.showModal();
    menu.setAttribute('aria-expanded', 'true');
    const selected = outlineLinks.querySelector('[aria-current]');
    if (selected) selected.focus({preventScroll: true});
  });
  document.getElementById('closeOutline').addEventListener('click', closeOutline);
  outline.addEventListener('close', () => menu.setAttribute('aria-expanded', 'false'));
  outline.addEventListener('click', event => {
    if (event.target === outline) {
      const box = outline.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeOutline();
    }
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !/^#\d+$/.test(link.getAttribute('href'))) return;
    event.preventDefault();
    if (outline.open) closeOutline();
    navigate(+link.getAttribute('href').slice(1) - 1);
  });
  prev.addEventListener('click', () => navigate(index - 1));
  next.addEventListener('click', () => navigate(index + 1));
  motionButton.addEventListener('click', () => {
    if (!motion && motionMedia.matches) {
      showToast('目前依系統的減少動態效果設定關閉動畫');
      return;
    }
    motion = !motion;
    try { localStorage.setItem('pe0-motion', motion ? 'on' : 'off'); } catch (_) {}
    updateMotion();
    showToast(motion ? '動畫已開啟' : '動畫已關閉');
  });
  motionMedia.addEventListener('change', () => {
    motion = !motionMedia.matches && (() => { try { return localStorage.getItem('pe0-motion') !== 'off'; } catch (_) { return true; } })();
    updateMotion();
  });
  const fullscreenButton = document.getElementById('fullscreen');
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else showToast('此瀏覽器請使用橫向顯示或加入主畫面');
    } catch (_) { showToast('請使用瀏覽器的全屏選單'); }
  }
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '進入全屏'));
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
    if (outline.open) return;
    if (event.target.closest('button,a') && (event.key === ' ' || event.key === 'Enter')) return;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': event.preventDefault(); navigate(index + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': event.preventDefault(); navigate(index - 1); break;
      case 'Home': event.preventDefault(); navigate(0); break;
      case 'End': event.preventDefault(); navigate(slides.length - 1); break;
      case 'f': case 'F': event.preventDefault(); toggleFullscreen(); break;
      case 'm': case 'M': event.preventDefault(); menu.click(); break;
    }
  });
  function fromHash(initial = false) {
    const match = location.hash.match(/^#(\d+)$/);
    navigate(match ? +match[1] - 1 : 0, {history: false, initial});
  }
  window.addEventListener('popstate', () => fromHash());
  window.addEventListener('hashchange', () => fromHash());
  updateMotion();
  fromHash(true);
})();
