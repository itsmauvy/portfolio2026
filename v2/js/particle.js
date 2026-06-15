(function () {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');

  const FONT_FAMILY = 'Syne';
  const FONT_WEIGHT = '800';
  const SAMPLE_STEP = 4;
  const MOUSE_RADIUS = 100;
  const MOUSE_FORCE = 7;
  const DAMPING = 0.84;
  const SPRING = 0.055;

  let W, H, dpr;
  let particles = [];
  let mouse = { x: null, y: null };
  let phase = 'idle';
  let fallDir = 'down';
  let panelOpen = false;
  let transitioning = false;

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

    update() {
      if (phase === 'falling') {
        const gravity = fallDir === 'down' ? 0.55 : -0.55;
        this.vy += gravity;
        this.vx += (Math.random() - 0.5) * 0.45;
        this.vx *= 0.96;
        if (this.size > 0.3) this.size -= 0.006;
        this.x += this.vx;
        this.y += this.vy;
        return;
      }
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
    }

    draw() {
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    }
  }

  function showSoobin(spawnDir) {
    const pts = sampleText('SOOBIN');
    particles = pts.map(p => new Particle(p.x, p.y, spawnDir));
    phase = 'forming';
    setTimeout(() => { if (phase === 'forming') phase = 'ready'; }, 2000);
  }

  function openPanel() {
    if (panelOpen || transitioning) return;
    transitioning = true;

    const hint = document.getElementById('scrollHint');
    if (hint) hint.classList.remove('visible');

    fallDir = 'down';
    phase = 'falling';

    if (overlay) overlay.classList.add('active');

    setTimeout(() => {
      if (panel) {
        panel.style.visibility = 'visible';
        panel.getBoundingClientRect();
        panel.style.transform = 'translateY(0%)';
      }
    }, 350);

    setTimeout(() => {
      canvas.style.opacity = '0';
      panelOpen = true;
      transitioning = false;
      particles = [];
    }, 1000);
  }

  function closePanel() {
    if (!panelOpen || transitioning) return;
    transitioning = true;

    canvas.style.opacity = '1';
    if (overlay) overlay.classList.remove('active');
    if (panel) panel.style.transform = 'translateY(100%)';

    setTimeout(() => {
      if (panel) panel.style.visibility = 'hidden';
      panelOpen = false;
      transitioning = false;
      showSoobin('random');
      setTimeout(() => {
        const hint = document.getElementById('scrollHint');
        if (hint) hint.classList.add('visible');
      }, 1900);
    }, 750);
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    if (particles.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      particles.forEach(p => { p.update(); p.draw(); });
    }
    requestAnimationFrame(tick);
  }

  let wheelCooldown = false;
  window.addEventListener('wheel', (e) => {
    if (panelOpen) {
      if (panel.scrollTop <= 0 && e.deltaY < -30) {
        e.preventDefault();
        closePanel();
      }
      return;
    }
    if (e.deltaY > 30 && phase === 'ready' && !wheelCooldown) {
      wheelCooldown = true;
      setTimeout(() => { wheelCooldown = false; }, 1500);
      openPanel();
    }
  }, { passive: false });

  let touchStartY = 0;
  window.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', e => {
    const dy = touchStartY - e.changedTouches[0].clientY;
    if (!panelOpen && dy > 50 && phase === 'ready') openPanel();
    else if (panelOpen && dy < -50 && panel.scrollTop <= 0) closePanel();
  }, { passive: true });

  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

  async function init() {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    resize();

    if (panel) { panel.style.transform = 'translateY(100%)'; panel.style.visibility = 'hidden'; }

    setTimeout(() => {
      const header = document.querySelector('.header');
      if (header) header.classList.add('visible');
    }, 400);

    try { await document.fonts.load(`${FONT_WEIGHT} 150px ${FONT_FAMILY}`); }
    catch (e) { await new Promise(r => setTimeout(r, 600)); }

    showSoobin('random');
    setTimeout(() => {
      const hint = document.getElementById('scrollHint');
      if (hint) hint.classList.add('visible');
    }, 2200);

    tick();

    window.addEventListener('resize', () => {
      resize();
      if (!panelOpen && (phase === 'ready' || phase === 'forming')) showSoobin('random');
    });
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
