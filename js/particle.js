(function () {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');

  const FONT_FAMILY = 'Syne';
  const FONT_WEIGHT = '800';
  const SAMPLE_STEP = 3;
  const MOUSE_RADIUS = 100;
  const MOUSE_FORCE = 7;
  const DAMPING = 0.84;
  const SPRING = 0.055;

  let W, H, dpr;
  let particles = [];
  let mouse = { x: null, y: null };
  let phase = 'idle';
  let panelOpen = false;
  // 0 = SOOBIN intact, 1 = panel fully revealed — driven directly by
  // scroll/drag distance instead of a fixed-duration animation, so the
  // sand crumbles exactly as much as the user disturbs it.
  let progress = 0;

  const panel = document.getElementById('contentPanel');
  const overlay = document.getElementById('bgOverlay');

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);
  }

  function sampleText(text) {
    const fontSize = Math.round(Math.min(W * 0.13, 150));
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const oc = off.getContext('2d');
    oc.fillStyle = '#fff';
    oc.font = `${FONT_WEIGHT} ${fontSize}px ${FONT_FAMILY}`;
    oc.textAlign = 'center';
    oc.textBaseline = 'middle';
    oc.fillText(text, W / 2, H / 2);
    const data = oc.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 0; y < H; y += SAMPLE_STEP)
      for (let x = 0; x < W; x += SAMPLE_STEP)
        if (data[(y * W + x) * 4 + 3] > 128) pts.push({ x, y });
    return pts;
  }

  class Particle {
    constructor(tx, ty, spawnDir) {
      this.tx = tx; this.ty = ty;
      this.size = Math.random() * 1.8 + 0.8;
      this.alpha = 1;
      this.drawSize = this.size;
      // Where this grain crumbles to once disturbed — mostly downward,
      // like sand pouring off a ledge, with a little horizontal scatter.
      this.scatterX = tx + (Math.random() - 0.5) * W * 0.5;
      this.scatterY = ty + H * (0.5 + Math.random() * 0.6);
      this.scatterSize = this.size + 2 + Math.random() * 2;
      if (spawnDir === 'random') {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
      } else {
        this.x = tx; this.y = ty;
        this.vx = 0; this.vy = 0;
      }
    }

    // Scrubbed directly by scroll/drag progress (0–1) instead of physics —
    // makes the crumble fully reversible and exactly as far as you pull it.
    applyProgress(p) {
      this.x = this.tx + (this.scatterX - this.tx) * p;
      this.y = this.ty + (this.scatterY - this.ty) * p;
      this.drawSize = this.size + (this.scatterSize - this.size) * p;
      this.alpha = 1 - p;
    }

    update() {
      this.vx += (this.tx - this.x) * SPRING;
      this.vy += (this.ty - this.y) * SPRING;
      if (mouse.x !== null && phase === 'ready') {
        const dx = this.x - mouse.x, dy = this.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_RADIUS * MOUSE_RADIUS) {
          const d = Math.sqrt(d2);
          const f = ((MOUSE_RADIUS - d) / MOUSE_RADIUS) * MOUSE_FORCE;
          this.vx += (dx / d) * f;
          this.vy += (dy / d) * f;
        }
      }
      this.vx *= DAMPING;
      this.vy *= DAMPING;
      this.x += this.vx;
      this.y += this.vy;
      this.drawSize = this.size;
    }

    draw() {
      if (this.alpha <= 0) return;
      ctx.globalAlpha = this.alpha;
      ctx.fillRect(this.x - this.drawSize / 2, this.y - this.drawSize / 2, this.drawSize, this.drawSize);
      ctx.globalAlpha = 1;
    }
  }

  function typeLogo(text) {
    const el = document.getElementById('typedLogo');
    if (!el) return;
    el.textContent = '';

    const TYPE_SPEED = 110;   // ms per char while typing
    const DELETE_SPEED = 55;  // ms per char while deleting
    const HOLD_FULL = 1800;   // pause once fully typed
    const HOLD_EMPTY = 600;   // pause once fully deleted

    let i = 0;
    let deleting = false;

    function step() {
      if (!deleting) {
        if (i < text.length) {
          i++;
          el.textContent = text.slice(0, i);
          setTimeout(step, TYPE_SPEED);
        } else {
          deleting = true;
          setTimeout(step, HOLD_FULL);
        }
      } else {
        if (i > 0) {
          i--;
          el.textContent = text.slice(0, i);
          setTimeout(step, DELETE_SPEED);
        } else {
          deleting = false;
          setTimeout(step, HOLD_EMPTY);
        }
      }
    }

    step();
  }

  function showSoobin(spawnDir) {
    const pts = sampleText('SOOBIN');
    particles = pts.map(p => new Particle(p.x, p.y, spawnDir));
    phase = 'forming';
    setTimeout(() => { if (phase === 'forming') phase = 'ready'; }, 2000);
  }

  // Background + panel opacity track progress 1:1, so whatever drives
  // `progress` (a single scroll trigger, animated below) keeps them in sync
  // with how far the sand has crumbled.
  function setProgress(p) {
    progress = Math.max(0, Math.min(1, p));
    if (overlay) gsap.set(overlay, { opacity: progress });
    if (panel) gsap.set(panel, { opacity: progress });
  }

  function commitOpen() {
    canvas.style.opacity = '0';
    panelOpen = true;
    phase = 'idle';
    particles = [];
  }

  function commitClose() {
    if (panel) panel.style.visibility = 'hidden';
    canvas.style.opacity = '1';
    panelOpen = false;
    showSoobin('random');
    setTimeout(() => {
      const hint = document.getElementById('scrollHint');
      if (hint) hint.classList.add('visible');
    }, 1900);
  }

  // One scroll/swipe is enough to trigger the whole crumble — it then
  // plays out on its own (sand falls, background snaps) instead of
  // requiring the user to keep scrolling the whole way.
  const proxy = { p: 0 };
  let animating = false;

  function playOpen() {
    if (animating || phase !== 'ready') return;
    animating = true;
    const hint = document.getElementById('scrollHint');
    if (hint) hint.classList.remove('visible');
    if (panel) panel.style.visibility = 'visible';
    phase = 'scrubbing';
    proxy.p = progress;
    gsap.to(proxy, {
      p: 1,
      duration: 0.4,
      ease: 'power2.in',
      onUpdate: () => setProgress(proxy.p),
      onComplete: () => { animating = false; commitOpen(); }
    });
  }

  function navOpenAndScroll(sectionId) {
    const target = document.getElementById(sectionId);
    if (panelOpen) {
      if (target && panel) panel.scrollTop = target.offsetTop - 80;
      return;
    }
    if (animating || phase !== 'ready') return;
    animating = true;
    const hint = document.getElementById('scrollHint');
    if (hint) hint.classList.remove('visible');
    if (panel) { panel.style.visibility = 'visible'; panel.scrollTop = 0; }
    phase = 'scrubbing';
    proxy.p = progress;
    gsap.to(proxy, {
      p: 1,
      duration: 0.4,
      ease: 'power2.in',
      onUpdate: () => setProgress(proxy.p),
      onComplete: () => {
        animating = false;
        commitOpen();
        if (target && panel) panel.scrollTop = target.offsetTop - 80;
      }
    });
  }

  function setupNavLinks() {
    document.querySelectorAll('.header__nav a[href^="#"]').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const sectionId = link.getAttribute('href').slice(1);
        navOpenAndScroll(sectionId);
      });
    });
  }

  function playClose() {
    if (animating || !panelOpen) return;
    animating = true;
    phase = 'scrubbing';
    if (panel) panel.style.visibility = 'visible';
    proxy.p = progress;
    gsap.to(proxy, {
      p: 0,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: () => setProgress(proxy.p),
      onComplete: () => { animating = false; commitClose(); }
    });
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    if (particles.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      particles.forEach(p => {
        if (phase === 'scrubbing') p.applyProgress(progress);
        else p.update();
        p.draw();
      });
    }
    requestAnimationFrame(tick);
  }

  let wheelCooldown = false;
  window.addEventListener('wheel', (e) => {
    if (panelOpen) {
      if (panel.scrollTop <= 0 && e.deltaY < -30 && !wheelCooldown) {
        e.preventDefault();
        wheelCooldown = true;
        setTimeout(() => { wheelCooldown = false; }, 1500);
        playClose();
      }
      return;
    }
    if (e.deltaY > 30 && phase === 'ready' && !wheelCooldown) {
      wheelCooldown = true;
      setTimeout(() => { wheelCooldown = false; }, 1500);
      playOpen();
    }
  }, { passive: false });

  let touchStartY = 0;
  window.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', e => {
    const dy = touchStartY - e.changedTouches[0].clientY;
    if (!panelOpen && dy > 50 && phase === 'ready') playOpen();
    else if (panelOpen && dy < -50 && panel.scrollTop <= 0) playClose();
  }, { passive: true });

  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

  // ── 상세페이지 복귀 처리: load 이벤트 안 기다리고 즉시 실행 ──
  const _returnTo = sessionStorage.getItem('returnTo')
    || (window.location.hash ? window.location.hash.slice(1) : null);

  if (['work', 'about', 'contact'].includes(_returnTo)) {
    sessionStorage.removeItem('returnTo');
    history.replaceState(null, '', window.location.pathname);

    resize();
    canvas.style.opacity = '0';
    panelOpen = true;
    phase = 'idle';

    // 헤더 표시 + 로고 타이핑
    const header = document.querySelector('.header');
    if (header) header.classList.add('visible');
    setTimeout(() => typeLogo('SOOBIN PORTFOLIO'), 400);

    // 패널 즉시 세팅 (inline style — CSS 충돌 없음)
    if (panel) {
      panel.style.opacity = '1';
      panel.style.visibility = 'visible';
      panel.scrollTop = 0;
    }
    if (overlay) overlay.style.opacity = '1';

    // 페이지 fade in → 스크롤
    // Lenis 초기화 전 임시 scrollTop (같은 스크립트 블록에서 바뀔 수 있음)
    const _target = document.getElementById(_returnTo);
    if (_target && panel) panel.scrollTop = _target.offsetTop - 80;

    // Lenis가 panel에 초기화되면 scrollTop 리셋 — 모든 동기 JS 완료 후 재스크롤
    setTimeout(function() {
      const t = document.getElementById(_returnTo);
      if (!t) return;
      if (window.__lenis) {
        window.__lenis.scrollTo(t, { offset: -80, immediate: true });
      } else if (panel) {
        panel.scrollTop = t.offsetTop - 80;
      }
    }, 0);

    // fade in (검정에서 panel 부드럽게 등장)
    gsap.to(document.documentElement, { opacity: 1, duration: 0.6, ease: 'power2.out' });
    gsap.from(panel, { scale: 0.98, duration: 0.6, ease: 'power2.out' });

    setupNavLinks();
    tick();

    window.addEventListener('resize', () => { resize(); });

  } else {
    // ── 일반 진입 ──
    async function init() {
      history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
      resize();

      if (panel) { gsap.set(panel, { opacity: 0 }); panel.style.visibility = 'hidden'; }

      setTimeout(() => {
        const header = document.querySelector('.header');
        if (header) header.classList.add('visible');
      }, 400);
      setTimeout(() => typeLogo('SOOBIN PORTFOLIO'), 1300);

      try { await document.fonts.load(`${FONT_WEIGHT} 150px ${FONT_FAMILY}`); }
      catch (e) { await new Promise(r => setTimeout(r, 600)); }

      showSoobin('random');
      setTimeout(() => {
        const hint = document.getElementById('scrollHint');
        if (hint) hint.classList.add('visible');
      }, 2200);
      document.documentElement.style.transition = 'opacity 0.4s ease';
      document.documentElement.style.opacity = '';

      setupNavLinks();
      tick();

      window.addEventListener('resize', () => {
        resize();
        if (!panelOpen && (phase === 'ready' || phase === 'forming')) showSoobin('random');
      });
    }

    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);
  }
})();
