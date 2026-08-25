/* ═══════════════════════════════════════════════════════════════
   NANOPHONICS — main.js
   Vanilla, no dependencies.
   1. helpers · 2. reveal · 3. nav · 4. work accordion
   5. stats counter · 6. hero scope · 7. capability vizzes · 8. form
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ── 1. HELPERS ─────────────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Deterministic 1-D value noise — smooth, cheap, no RNG state. */
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const vnoise = x => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
};

/** Size a canvas to its CSS box at device pixel ratio. Returns {w,h} in CSS px. */
function fitCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  if (cv.width !== w * dpr || cv.height !== h * dpr) {
    cv.width  = w * dpr;
    cv.height = h * dpr;
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/** Run `draw(ctx,w,h,t)` on rAF, but only while the canvas is on screen. */
function animate(cv, draw) {
  let raf = 0, t0 = 0, visible = false;

  const frame = ts => {
    if (!t0) t0 = ts;
    const { ctx, w, h } = fitCanvas(cv);
    draw(ctx, w, h, (ts - t0) / 1000);
    raf = requestAnimationFrame(frame);
  };

  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const stop  = () => { cancelAnimationFrame(raf); raf = 0; };

  const once = () => { const { ctx, w, h } = fitCanvas(cv); draw(ctx, w, h, 0.8); };

  if (REDUCED) {
    once();
    window.addEventListener('resize', once, { passive: true });
    return;
  }

  // keep the observer referenced — an unreferenced IO is a GC hazard
  const io = new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    visible ? start() : stop();
  }, { rootMargin: '120px' });
  io.observe(cv);
  cv._io = io;

  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : (visible && start());
  });

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (!raf && visible) once(); }, 120);
  }, { passive: true });
}

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ACC  = css('--acc')  || '#d4ff3f';
const CYAN = css('--cyan') || '#3fe8ff';

/* ── 2. REVEAL ──────────────────────────────────────────────── */
(() => {
  const items = $$('[data-r]');
  if (!items.length) return;

  if (REDUCED) { items.forEach(el => el.classList.add('is-in')); return; }

  // stagger children of a shared parent
  items.forEach(el => {
    const d = el.dataset.rD;
    if (d) el.style.setProperty('--d', d);
  });

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      obs.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  items.forEach(el => io.observe(el));
})();

/* ── 3. NAV ─────────────────────────────────────────────────── */
(() => {
  const nav    = $('#nav');
  const rail   = $('#navRail');
  const burger = $('#burger');
  const menu   = $('#mobilemenu');
  const links  = $$('[data-nav]');
  const secs   = links.map(a => $(a.getAttribute('href'))).filter(Boolean);

  /* stuck state + scroll progress rail */
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-stuck', y > 24);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (rail) rail.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* active section highlight */
  if (secs.length) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => spy.observe(s));
  }

  /* mobile menu */
  if (burger && menu) {
    const setOpen = open => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setOpen(menu.hidden));
    $$('a', menu).forEach(a => a.addEventListener('click', () => setOpen(false)));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setOpen(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 900 && !menu.hidden) setOpen(false); });
  }

  /* mark hero in, so the headline decorations can run */
  requestAnimationFrame(() => document.body.classList.add('is-in'));
})();

/* ── 4. WORK ACCORDION ──────────────────────── */
(() => {
  const rows = $$('.work__row');
  if (!rows.length) return;

  const DUR = 500;                  // keep in step with the CSS transition
  const inFlight = new WeakMap();   // panel -> abort fn for the running animation

  const panelOf = btn => $('#' + btn.getAttribute('aria-controls'));

  /* Abandon the animation currently running on this panel WITHOUT applying its
     end state. Skipping this is what made repeated clicks misbehave: an
     interrupted open left its transitionend listener attached, and it later
     fired during an unrelated transition and clobbered the panel. */
  const abort = panel => {
    const stop = inFlight.get(panel);
    if (stop) stop();
  };

  /* Animate height to `to`, then run `settle`.
     The listener is guarded on the panel itself and on the height property:
     transitionend bubbles, and the tag pills inside the panel animate their
     own colours, which used to end the collapse early. */
  const slide = (panel, to, settle) => {
    let timer;

    const detach = () => {
      clearTimeout(timer);
      panel.removeEventListener('transitionend', onEnd);
      inFlight.delete(panel);
    };
    const finish = () => { detach(); settle(); };
    const onEnd = e => {
      if (e.target !== panel || e.propertyName !== 'height') return;
      finish();
    };

    timer = setTimeout(finish, DUR + 80);   // safety net if transitionend is missed
    inFlight.set(panel, detach);
    panel.addEventListener('transitionend', onEnd);
    panel.style.height = to + 'px';
  };

  const open = btn => {
    const panel = panelOf(btn);
    if (!panel) return;
    abort(panel);
    btn.setAttribute('aria-expanded', 'true');

    // start from wherever it actually is, not from zero, so reopening
    // mid-collapse picks up smoothly instead of snapping
    const from = panel.hidden ? 0 : panel.getBoundingClientRect().height;
    panel.hidden = false;
    panel.style.height = from + 'px';
    void panel.offsetHeight;                // commit `from` before animating
    slide(panel, panel.scrollHeight, () => { panel.style.height = 'auto'; });
  };

  const close = btn => {
    const panel = panelOf(btn);
    if (!panel || panel.hidden) return;
    abort(panel);
    btn.setAttribute('aria-expanded', 'false');

    panel.style.height = panel.getBoundingClientRect().height + 'px';
    void panel.offsetHeight;
    slide(panel, 0, () => { panel.hidden = true; panel.style.height = ''; });
  };

  rows.forEach(row => {
    const btn = $('.work__btn', row);
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      rows.forEach(r => {                   // accordion: one at a time
        const other = $('.work__btn', r);
        if (other !== btn) close(other);
      });
      isOpen ? close(btn) : open(btn);
    });
  });

  /* Initial state, applied without animating: everything shut except the
     first entry, so the section never reads as an empty list. The markup
     ships open so the copy is still there when JavaScript is not. */
  rows.forEach((row, i) => {
    const btn = $('.work__btn', row);
    const panel = panelOf(btn);
    if (!panel) return;
    const first = i === 0;
    btn.setAttribute('aria-expanded', String(first));
    panel.hidden = !first;
    panel.style.height = first ? 'auto' : '';
  });
})();

/* ── 5. STATS COUNTER ───────────────────────────────────────── */
(() => {
  const nums = $$('[data-count]');
  if (!nums.length || REDUCED) return;

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      obs.unobserve(e.target);

      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const dur = 1100;
      let start = 0;

      const step = ts => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });

  nums.forEach(n => io.observe(n));
})();

/* ── 6. HERO SCOPE — noisy input cleaned by a sweeping edge ──── */
(() => {
  const cv = $('#scopeCanvas');
  if (!cv) return;

  const ro = {
    snr: $('[data-ro="snr"]'),
    f0:  $('[data-ro="f0"]'),
    lat: $('[data-ro="lat"]'),
  };
  let lastWrite = 0;

  /* the underlying "clean" waveform: a small harmonic stack */
  const clean = (u, t) =>
      0.52 * Math.sin(u *  6.1 + t * 1.15)
    + 0.26 * Math.sin(u * 14.7 - t * 1.75)
    + 0.13 * Math.sin(u * 27.3 + t * 2.55)
    + 0.07 * Math.sin(u * 46.9 - t * 0.90);

  /* band-limited noise riding on top of it — deliberately kept below the
     harmonic content so the signal stays legible *through* the noise */
  const noise = (u, t) =>
      0.24 * vnoise(u *  88 + t * 26)
    + 0.12 * vnoise(u * 205 - t * 60)
    + 0.05 * vnoise(u * 420 + t * 110);

  function grid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 1;

    // 10 vertical divisions
    for (let i = 1; i < 10; i++) {
      const x = Math.round(w * i / 10) + .5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    // 6 horizontal divisions
    for (let j = 1; j < 6; j++) {
      const y = Math.round(h * j / 6) + .5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // centre line, dotted + brighter
    ctx.strokeStyle = 'rgba(255,255,255,.11)';
    ctx.setLineDash([2, 5]);
    const cy = Math.round(h / 2) + .5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.restore();
  }

  /* draws one pass of the trace; `mode` picks noisy vs processed */
  function trace(ctx, w, h, t, mode, x0, x1, style) {
    const cy = h / 2;
    const amp = h * 0.26;
    const step = w > 700 ? 1.5 : 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, Math.max(0, x1 - x0), h);
    ctx.clip();

    ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
      const u = x / w;
      let v = clean(u, t);
      if (mode === 'noisy') v += noise(u, t);
      // processed signal is slightly compressed — reads as "controlled"
      else v *= 1.06;
      const y = cy - v * amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }

    Object.assign(ctx, style);
    ctx.stroke();
    ctx.restore();
  }

  animate(cv, (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    grid(ctx, w, h);

    /* sweep: 0 → 1 over 5.2s, then a short hold before restarting */
    const CYCLE = 6.2, SWEEP = 5.2;
    const phase = (t % CYCLE);
    const p = Math.min(phase / SWEEP, 1);
    const ex = p * w;

    /* ghost of the raw input across the full width — what gets removed */
    trace(ctx, w, h, t, 'noisy', 0, w, {
      strokeStyle: 'rgba(255,255,255,.055)', lineWidth: 1,
      shadowBlur: 0, lineJoin: 'round',
    });

    /* ahead of the edge: raw noisy input */
    trace(ctx, w, h, t, 'noisy', ex, w, {
      strokeStyle: 'rgba(150,158,170,.62)', lineWidth: 1.15,
      shadowBlur: 0, lineJoin: 'round',
    });

    /* behind the edge: processed signal, glowing */
    trace(ctx, w, h, t, 'clean', 0, ex, {
      strokeStyle: ACC, lineWidth: 1.9,
      shadowColor: ACC, shadowBlur: 14, lineJoin: 'round',
    });

    /* the processing edge itself */
    if (p < 1) {
      const g = ctx.createLinearGradient(ex - 46, 0, ex, 0);
      g.addColorStop(0, 'rgba(212,255,63,0)');
      g.addColorStop(1, 'rgba(212,255,63,.13)');
      ctx.fillStyle = g;
      ctx.fillRect(ex - 46, 0, 46, h);

      ctx.save();
      ctx.strokeStyle = ACC;
      ctx.lineWidth = 1;
      ctx.shadowColor = ACC;
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(ex + .5, 0); ctx.lineTo(ex + .5, h); ctx.stroke();
      ctx.restore();

      // small marker head
      ctx.fillStyle = ACC;
      ctx.beginPath();
      ctx.moveTo(ex - 4, 0); ctx.lineTo(ex + 4, 0); ctx.lineTo(ex, 7);
      ctx.closePath(); ctx.fill();
    }

    /* dB ticks on the right edge */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1;
    for (let j = 0; j <= 6; j++) {
      const y = Math.round(h * j / 6) + .5;
      ctx.beginPath(); ctx.moveTo(w - 7, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    /* readouts — throttled to ~8 fps so the digits stay legible */
    if (t - lastWrite > 0.12) {
      lastWrite = t;
      const snr = 4.5 + p * 27.5 + vnoise(t * 3) * 0.5;
      const f0  = 218 + Math.sin(t * 0.6) * 42;
      const lat = 2.1 + vnoise(t * 5) * 0.35;
      if (ro.snr) ro.snr.textContent = `SNR  +${snr.toFixed(1)} dB`;
      if (ro.f0)  ro.f0.textContent  = `f₀  ${f0.toFixed(0)} Hz`;
      if (ro.lat) ro.lat.textContent = `LAT  ${lat.toFixed(1)} ms`;
    }
  });
})();

/* ── 7. CAPABILITY VISUALS ──────────────────────────────────── */
(() => {

  /* 01 — signal decomposition: one signal split into its components */
  const wave = (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const rows = 4;
    const pad = h * 0.16;
    const gap = (h - pad * 2) / (rows - 1);

    for (let r = 0; r < rows; r++) {
      const y0 = pad + gap * r;
      const front = r === 0;
      const freq = 3.0 * Math.pow(1.7, r);
      const amp  = (h * 0.085) / Math.pow(1.2, r);

      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const u = x / w;
        const v = Math.sin(u * freq * Math.PI * 2 + t * (0.9 + r * 0.5)) *
                  (0.7 + 0.3 * Math.sin(u * 3 - t * 0.5));
        const y = y0 - v * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = front ? ACC : `rgba(150,158,170,${0.34 - r * 0.07})`;
      ctx.lineWidth = front ? 1.8 : 1;
      ctx.shadowColor = front ? ACC : 'transparent';
      ctx.shadowBlur = front ? 12 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // baseline
      ctx.strokeStyle = 'rgba(255,255,255,.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y0) + .5); ctx.lineTo(w, Math.round(y0) + .5);
      ctx.stroke();
    }
  };

  /* 02 — embedding space: points drifting into three clusters */
  const PTS = (() => {
    const out = [];
    const centres = [[0.26, 0.34], [0.68, 0.28], [0.5, 0.74]];
    for (let i = 0; i < 78; i++) {
      const c = i % 3;
      out.push({
        c,
        cx: centres[c][0],
        cy: centres[c][1],
        // stable per-point offset + orbit params
        ox: (hash(i * 3.1) - 0.5),
        oy: (hash(i * 7.7) - 0.5),
        sp: 0.25 + hash(i * 11.3) * 0.55,
        ph: hash(i * 5.5) * Math.PI * 2,
        rd: 0.06 + hash(i * 2.9) * 0.11,
      });
    }
    return out;
  })();

  const embed = (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);

    // faint axes
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const x = Math.round(w * i / 4) + .5, y = Math.round(h * i / 4) + .5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const pos = PTS.map(p => {
      const a = p.ph + t * p.sp;
      return {
        c: p.c,
        x: (p.cx + Math.cos(a) * p.rd + p.ox * 0.045) * w,
        y: (p.cy + Math.sin(a) * p.rd * 0.85 + p.oy * 0.045) * h,
      };
    });

    // intra-cluster links
    ctx.lineWidth = 1;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        if (pos[i].c !== pos[j].c) continue;
        const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
        const d = Math.hypot(dx, dy);
        if (d > w * 0.11) continue;
        const a = (1 - d / (w * 0.11)) * 0.3;
        ctx.strokeStyle = pos[i].c === 0 ? `rgba(212,255,63,${a})` : `rgba(150,158,170,${a * 0.6})`;
        ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[j].x, pos[j].y); ctx.stroke();
      }
    }

    // points
    pos.forEach(p => {
      const hot = p.c === 0;
      ctx.fillStyle = hot ? ACC : 'rgba(160,168,180,.55)';
      ctx.shadowColor = hot ? ACC : 'transparent';
      ctx.shadowBlur = hot ? 8 : 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, hot ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // decision boundary sweeping through
    const bx = (0.5 + Math.sin(t * 0.35) * 0.34) * w;
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(212,255,63,.34)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + w * 0.12, h); ctx.stroke();
    ctx.restore();
  };

  /* 03 — spectrum analyser with a smoothed response curve */
  const spectrum = (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const N = Math.max(28, Math.min(64, Math.floor(w / 11)));
    const gap = 2;
    const bw = (w - gap * (N - 1)) / N;
    const base = h * 0.9;

    const mag = i => {
      const f = i / N;
      // three resonant peaks that breathe
      const peak = (c, q, g) => g / (1 + Math.pow((f - c) * q, 2));
      let m = peak(0.10 + Math.sin(t * 0.4) * 0.02, 22, 0.92)
            + peak(0.36 + Math.sin(t * 0.31 + 2) * 0.05, 16, 0.62)
            + peak(0.70 + Math.sin(t * 0.52 + 4) * 0.05, 26, 0.40);
      m *= 0.72 + 0.28 * Math.abs(Math.sin(t * 1.6 + f * 5));
      m += 0.05 + 0.05 * Math.abs(vnoise(f * 30 + t * 6));
      return Math.min(m, 1);
    };

    // bars
    for (let i = 0; i < N; i++) {
      const m = mag(i);
      const bh = m * base * 0.86;
      const x = i * (bw + gap);
      const g = ctx.createLinearGradient(0, base - bh, 0, base);
      g.addColorStop(0, `rgba(212,255,63,${0.35 + m * 0.55})`);
      g.addColorStop(1, 'rgba(212,255,63,.06)');
      ctx.fillStyle = g;
      ctx.fillRect(x, base - bh, bw, bh);
    }

    // response curve on top
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const x = i * (bw + gap) + bw / 2;
      const y = base - mag(i) * base * 0.86;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.7;
    ctx.shadowColor = CYAN; ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // floor
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(base) + .5); ctx.lineTo(w, Math.round(base) + .5);
    ctx.stroke();
  };

  /* 04 — orchestration: a hub dispatching work to tools and sub-agents of
     different kinds, each call travelling out and coming back with a result.
     Several are always in flight on their own phase, so it reads as parallel
     work rather than a queue. */
  const AG = (() => {
    const N = 7, out = [];
    for (let i = 0; i < N; i++) {
      out.push({
        a: (i / N) * Math.PI * 2 - Math.PI / 2,
        k: 0.80 + hash(i * 3.7) * 0.38,     // how far from the hub it sits
        ph: hash(i * 5.1),                  // where in its cycle it starts
        sp: 0.85 + hash(i * 9.3) * 0.55,    // how fast it runs
        shape: i % 3,                       // square, circle, triangle
      });
    }
    return out;
  })();

  const agents = (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const rx = w * 0.33, ry = h * 0.34;

    /* faint grid, same texture as the other panels */
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const gx = Math.round(w * i / 5) + .5;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }

    const pos = AG.map(sat => ({
      shape: sat.shape,
      x: cx + Math.cos(sat.a) * rx * sat.k,
      y: cy + Math.sin(sat.a) * ry * sat.k,
      ph: sat.ph,
      sp: sat.sp,
      hit: 0,
    }));

    /* the orbit the tools sit on */
    ctx.save();
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    /* idle spokes */
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.lineWidth = 1;
    pos.forEach(n => {
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(n.x, n.y);
      ctx.stroke();
    });

    /* calls in flight */
    pos.forEach(n => {
      const p = (t * 0.4 * n.sp + n.ph) % 1;
      const f = p < 0.5 ? p * 2 : (1 - p) * 2;      // out, then back
      const e = f * f * (3 - 2 * f);                // ease both ends
      n.hit = Math.max(0, (e - 0.8) / 0.2);

      const px = cx + (n.x - cx) * e;
      const py = cy + (n.y - cy) * e;

      // the stretch already travelled glows
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(px, py);
      ctx.strokeStyle = `rgba(212,255,63,${0.08 + e * 0.24})`;
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // trail
      for (let k = 7; k >= 1; k--) {
        const e2 = Math.max(0, e - k * 0.03);
        ctx.fillStyle = `rgba(212,255,63,${(1 - k / 7) * 0.45})`;
        ctx.beginPath();
        ctx.arc(cx + (n.x - cx) * e2, cy + (n.y - cy) * e2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // head
      ctx.fillStyle = ACC;
      ctx.shadowColor = ACC; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(px, py, 2.3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    /* the tools and sub-agents, three kinds so it never reads as one thing */
    pos.forEach(n => {
      const hot = n.hit;
      ctx.save();
      ctx.translate(n.x, n.y);

      if (hot > 0.02) {
        ctx.strokeStyle = `rgba(212,255,63,${hot * 0.45})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 8 + (1 - hot) * 13, 0, Math.PI * 2);
        ctx.stroke();
      }

      const r = 4.4;
      ctx.beginPath();
      if (n.shape === 0) ctx.rect(-r, -r, r * 2, r * 2);
      else if (n.shape === 1) ctx.arc(0, 0, r, 0, Math.PI * 2);
      else {
        ctx.moveTo(0, -r * 1.25);
        ctx.lineTo(r * 1.15, r * 0.8);
        ctx.lineTo(-r * 1.15, r * 0.8);
        ctx.closePath();
      }
      if (hot > 0.15) {
        ctx.fillStyle = ACC;
        ctx.shadowColor = ACC; ctx.shadowBlur = 12;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.18)';
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    /* the hub */
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.5);
    ctx.strokeStyle = `rgba(212,255,63,${0.10 + breathe * 0.20})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 14 + breathe * 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = ACC;
    ctx.shadowColor = ACC; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.rect(-6.5, -6.5, 13, 13); ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  };

  const MAP = { wave, embed, spectrum, agents };
  $$('[data-viz]').forEach(cv => {
    const fn = MAP[cv.dataset.viz];
    if (fn) animate(cv, fn);
  });
})();

/* ── 8. CONTACT FORM ────────────────────────────────────────── */
(() => {
  const form = $('#contactForm');
  if (!form) return;
  const status = $('#formStatus');

  const setErr = (field, msg) => {
    field.classList.toggle('is-bad', Boolean(msg));
    const slot = $('[data-err]', field);
    if (slot) slot.textContent = msg || '';
  };

  const validate = () => {
    let ok = true;
    $$('.field', form).forEach(field => {
      const input = $('input, textarea', field);
      if (!input || !input.required) { setErr(field, ''); return; }
      const v = input.value.trim();
      if (!v) { setErr(field, 'required'); ok = false; return; }
      if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        setErr(field, 'not a valid address'); ok = false; return;
      }
      setErr(field, '');
    });
    return ok;
  };

  $$('.field input, .field textarea', form).forEach(el => {
    el.addEventListener('input', () => {
      const f = el.closest('.field');
      if (f && f.classList.contains('is-bad')) setErr(f, '');
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.classList.remove('is-bad');
    status.textContent = '';

    if (form._gotcha && form._gotcha.value) return;          // bot
    if (!validate()) {
      status.classList.add('is-bad');
      status.textContent = 'Please check the highlighted fields.';
      const bad = $('.field.is-bad input, .field.is-bad textarea', form);
      if (bad) bad.focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    let endpoint = form.getAttribute('action');

    /* On Netlify hosting the platform itself accepts the POST at "/"; the
       data-netlify attributes register the form at deploy time. GitHub Pages
       has no server side, so the same markup skips this branch there. */
    const onNetlify = form.hasAttribute('data-netlify') &&
                      !/(^|\.)github\.io$/.test(location.hostname) &&
                      location.protocol !== 'file:';
    if (!endpoint && onNetlify) endpoint = '/';

    /* With no endpoint at all, hand off to the visitor's mail client so the
       form is never a dead end. */
    if (!endpoint) {
      const subject = encodeURIComponent(data.subject || `Project enquiry from ${data.name}`);
      const body = encodeURIComponent(`${data.message}\n\n${data.name}\n${data.email}`);
      window.location.href = `mailto:info@nanophonics.com?subject=${subject}&body=${body}`;
      status.textContent = 'Opening your mail client…';
      return;
    }

    const btn = $('button[type="submit"]', form);
    const label = $('span', btn);
    const original = label.textContent;
    label.textContent = 'Sending…';
    btn.disabled = true;

    try {
      // Netlify expects urlencoded; Formspree-style endpoints take FormData
      const res = await fetch(endpoint, endpoint === '/'
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(new FormData(form)).toString(),
          }
        : {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: new FormData(form),
          });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = 'Message sent. We will get back to you shortly.';
    } catch {
      status.classList.add('is-bad');
      status.textContent = 'Could not send. Please email info@nanophonics.com directly.';
    } finally {
      label.textContent = original;
      btn.disabled = false;
    }
  });
})();

/* ── year ───────────────────────────────────────────────────── */
const yr = $('#year');
if (yr) yr.textContent = new Date().getFullYear();

})();
